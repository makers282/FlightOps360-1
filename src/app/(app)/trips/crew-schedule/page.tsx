
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { CalendarCheck2, Loader2, ChevronLeft, ChevronRight, Lock } from 'lucide-react'; 
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchTrips, type Trip, type TripLeg } from '@/ai/flows/manage-trips-flow';
import { fetchCrewBlockOuts, saveCrewBlockOut, type CrewBlockOut, deleteCrewBlockOut } from '@/ai/flows/manage-crew-block-outs-flow';
import { 
  startOfMonth, endOfMonth, getDaysInMonth, format, addMonths, subMonths, getYear, setYear,
  setMonth, parseISO, isWithinInterval, startOfDay, endOfDay, max, min, getHours, getMinutes
} from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from "@/lib/utils";
import { CreateCrewBlockOutModal, type CrewBlockOutFormData } from '../calendar/components/create-crew-block-out-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


type EventType = 'duty' | 'revenue_flight' | 'operational_flight' | 'rest' | 'off';

interface CalendarEvent {
  type: EventType;
  startHour: number;
  durationHours: number;
  label?: string;
  originalEvent?: CrewBlockOut; // To link back to the source for editing/deleting
}

interface DayData {
  dayOfMonth: number;
  events: CalendarEvent[];
  dutyTotal: number;
  flightTotal: number;
}

const getEventTypeStyles = (type: EventType): string => {
  switch (type) {
    case 'duty': return 'bg-black h-1 absolute top-1/2 -translate-y-1/2';
    case 'revenue_flight': return 'bg-yellow-400 h-4 absolute top-1/2 -translate-y-1/2 rounded-sm border border-yellow-600';
    case 'operational_flight': return 'bg-sky-400 h-4 absolute top-1/2 -translate-y-1/2 rounded-sm border border-sky-600';
    case 'rest': return 'bg-gray-300 h-px absolute top-1/2 -translate-y-1/2';
    case 'off': return 'bg-red-200 h-full absolute flex items-center justify-center text-xs font-semibold text-red-800/70 p-1';
    default: return 'bg-gray-500';
  }
};

const isRevenueLeg = (legType: TripLeg['legType']) => ["Charter", "Owner", "Ambulance", "Cargo"].includes(legType);

export default function CrewSchedulePage() {
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [blockOuts, setBlockOuts] = useState<CrewBlockOut[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isBlockOutModalOpen, setIsBlockOutModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<any>(null);
  const [isEditingBlockOut, setIsEditingBlockOut] = useState(false);
  
  const [blockOutToDelete, setBlockOutToDelete] = useState<CrewBlockOut | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [crewData, tripsData, blockOutsData] = await Promise.all([
        fetchCrewMembers(), fetchTrips(), fetchCrewBlockOuts()
      ]);
      const activeCrew = crewData.filter(c => c.isActive);
      setCrewMembers(activeCrew);
      setTrips(tripsData);
      setBlockOuts(blockOutsData);
      if (activeCrew.length > 0 && !selectedCrewId) setSelectedCrewId(activeCrew[0].id);
    } catch (error) {
      console.error("Failed to load schedule data:", error);
      toast({ title: "Error Loading Data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedCrewId]);

  useEffect(() => { loadData(); }, [loadData]);
  
  const processedCalendarData = useMemo(() => {
    if (!selectedCrewId) return { days: [], monthlyDutyTotal: 0, monthlyFlightTotal: 0 };
    
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const days: DayData[] = [];
    let monthlyDutyTotal = 0;
    let monthlyFlightTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayDate = new Date(getYear(currentDate), currentDate.getMonth(), day);
      const dayStart = startOfDay(currentDayDate);
      const dayEnd = endOfDay(currentDayDate);

      let eventsForDay: CalendarEvent[] = [];
      let dailyDuty = 0;
      let dailyFlight = 0;
      
      const crewBlockOuts = blockOuts.filter(bo => bo.crewMemberId === selectedCrewId);
      
      crewBlockOuts.forEach(bo => {
        const blockStart = parseISO(bo.startDate);
        const blockEnd = parseISO(bo.endDate);
        if (isWithinInterval(dayStart, { start: blockStart, end: blockEnd }) || isWithinInterval(dayEnd, { start: blockStart, end: blockEnd }) || (blockStart < dayStart && blockEnd > dayEnd)) {
            const effectiveStart = max([blockStart, dayStart]);
            const effectiveEnd = min([blockEnd, dayEnd]);

            const startHour = getHours(effectiveStart) + getMinutes(effectiveStart) / 60;
            const endHour = getHours(effectiveEnd) + getMinutes(effectiveEnd) / 60;
            let durationHours = endHour - startHour;
            if(durationHours <= 0) durationHours = 0.01; // Ensure visible for zero-duration

            eventsForDay.push({ type: 'off', startHour, durationHours, label: bo.reason, originalEvent: bo });
        }
      });
      
      if (eventsForDay.some(e => e.type === 'off' && e.durationHours >= 23.9)) {
          // Full day off, no need to process flight events
      } else {
        const legsForDay: TripLeg[] = [];
        trips.forEach(trip => {
          const isAssigned = trip.assignedPilotId === selectedCrewId || trip.assignedCoPilotId === selectedCrewId || trip.assignedFlightAttendantIds?.includes(selectedCrewId);
          if(isAssigned) {
            trip.legs.forEach(leg => {
              if (leg.departureDateTime && isWithinInterval(parseISO(leg.departureDateTime), { start: dayStart, end: dayEnd })) {
                legsForDay.push(leg);
              }
            });
          }
        });

        if (legsForDay.length > 0) {
            legsForDay.sort((a,b) => parseISO(a.departureDateTime!).getTime() - parseISO(b.departureDateTime!).getTime());
            
            const firstDeparture = parseISO(legsForDay[0].departureDateTime!);
            const dutyStart = new Date(firstDeparture.getTime() - 60 * 60 * 1000); 
            
            let lastArrival: Date | null = null;
            legsForDay.forEach(leg => {
              const departure = parseISO(leg.departureDateTime!);
              const flightHours = leg.blockTimeHours || 0; 
              dailyFlight += flightHours;
              
              const arrival = new Date(departure.getTime() + flightHours * 60 * 60 * 1000);
              if (!lastArrival || arrival > lastArrival) lastArrival = arrival;
              
              const startHour = departure.getHours() + departure.getMinutes() / 60;
              eventsForDay.push({ type: isRevenueLeg(leg.legType) ? 'revenue_flight' : 'operational_flight', startHour, durationHours: flightHours, label: `${leg.origin}-${leg.destination}` });
            });

            const dutyEnd = new Date(lastArrival!.getTime() + 30 * 60 * 1000);
            
            const dutyDurationMillis = dutyEnd.getTime() - dutyStart.getTime();
            dailyDuty = dutyDurationMillis / (1000 * 60 * 60);
            
            const dutyStartHour = dutyStart.getHours() + dutyStart.getMinutes() / 60;

            eventsForDay.push({ type: 'duty', startHour: dutyStartHour, durationHours: dailyDuty });
            eventsForDay.push({ type: 'rest', startHour: dutyStartHour + dailyDuty, durationHours: 24 - (dutyStartHour + dailyDuty)});
        }
      }

      days.push({ dayOfMonth: day, events: eventsForDay, dutyTotal: dailyDuty, flightTotal: dailyFlight });
      monthlyDutyTotal += dailyDuty;
      monthlyFlightTotal += dailyFlight;
    }
    return { days, monthlyDutyTotal, monthlyFlightTotal };
  }, [selectedCrewId, currentDate, trips, blockOuts]);
  
  const handleOpenBlockOutModal = (date?: Date, eventToEdit?: CrewBlockOut) => {
    if (!selectedCrewId) {
      toast({ title: "Select a Crew Member", variant: "destructive" });
      return;
    }
    if (eventToEdit) {
      setIsEditingBlockOut(true);
      setModalInitialData({
        id: eventToEdit.id,
        reason: eventToEdit.reason,
        notes: eventToEdit.notes,
        startDate: parseISO(eventToEdit.startDate),
        endDate: parseISO(eventToEdit.endDate),
      });
    } else {
      setIsEditingBlockOut(false);
      setModalInitialData({ startDate: date || new Date() });
    }
    setIsBlockOutModalOpen(true);
  };
  
  const handleSaveCrewBlockOut = async (data: SaveCrewBlockOutInput, id?: string) => {
    try {
      await saveCrewBlockOut({ ...data, id });
      toast({ title: "Block-Out Saved", variant: "default" });
      await loadData();
      setIsBlockOutModalOpen(false);
    } catch (error) {
       toast({ title: "Error Saving Block-Out", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };
  
  const handleDeleteBlockOut = async (id: string) => {
     try {
        await deleteCrewBlockOut({ blockOutId: id });
        toast({ title: "Block-Out Deleted", variant: "default" });
        await loadData();
        setIsBlockOutModalOpen(false);
        setShowDeleteConfirm(false);
    } catch (error) {
        toast({ title: "Error Deleting", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };


  const formatHourTotal = (totalHours: number) => {
      if (totalHours <= 0) return '00:00';
      const hours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const years = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, name: format(new Date(0, i), 'MMMM') }));

  const LegendItem = ({ color, label }: { color: string, label: string }) => (
    <div className="flex items-center gap-2"><div className={cn("h-4 w-4 border border-black/30", color)}></div><span className="text-xs">{label}</span></div>
  );
  
  const selectedCrewMember = crewMembers.find(c => c.id === selectedCrewId);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <PageHeader title="Crew Schedule" description="Monthly view of crew duty, flight, and rest periods." icon={CalendarCheck2} />
            <Card><CardHeader><Skeleton className="h-10 w-[450px]" /></CardHeader><CardContent><Skeleton className="h-[500px] w-full" /></CardContent></Card>
        </div>
    );
  }

  return (
    <>
      <PageHeader title="Crew Schedule" description="Monthly view of crew duty, flight, and rest periods." icon={CalendarCheck2} />
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex gap-2 items-center flex-wrap">
                    <Select value={selectedCrewId || ''} onValueChange={setSelectedCrewId}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Select Crew Member"/></SelectTrigger><SelectContent>{crewMembers.map(c => <SelectItem key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`}</SelectItem>)}</SelectContent></Select>
                    <Select value={String(currentDate.getMonth())} onValueChange={(m) => setCurrentDate(prev => setMonth(prev, parseInt(m)))}><SelectTrigger className="w-[130px]"><SelectValue/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={String(getYear(currentDate))} onValueChange={(y) => setCurrentDate(prev => setYear(prev, parseInt(y)))}><SelectTrigger className="w-[90px]"><SelectValue/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                    <div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4"/></Button></div>
                     <Button variant="outline" size="sm" onClick={() => handleOpenBlockOutModal(new Date())} disabled={!selectedCrewId}><Lock className="mr-2 h-4 w-4" /> Schedule Block Out</Button>
                </div>
                 <div className="flex items-center gap-x-4 gap-y-1 flex-wrap border rounded-md p-2 bg-muted/50 text-muted-foreground"><LegendItem color="bg-black h-1" label="Duty" /><LegendItem color="bg-sky-400" label="Part 91 Leg" /><LegendItem color="bg-yellow-400" label="Revenue Leg" /><LegendItem color="bg-gray-300 h-px" label="Rest" /><LegendItem color="bg-red-200" label="Day Off" /></div>
            </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="w-max min-w-full">
            <table className="w-full border-collapse">
              <thead><tr className="bg-muted"><th className="sticky left-0 bg-muted border p-2 text-xs font-semibold text-center z-10 w-24">Duty Days</th>{Array.from({length: 24}).map((_, i) => (<th key={`header-${i}`} className="border p-2 text-xs font-semibold text-center w-12">{String(i).padStart(2,'0')}</th>))}<th className="sticky right-0 bg-muted border p-2 text-xs font-semibold text-center z-10 w-24 whitespace-nowrap">Duty Time</th><th className="sticky right-0 bg-muted border p-2 text-xs font-semibold text-center z-10 w-24 whitespace-nowrap">Flight Time</th></tr></thead>
              <tbody>
                {processedCalendarData.days.map(({ dayOfMonth, events, dutyTotal, flightTotal }) => (
                    <tr key={dayOfMonth}>
                        <td className="sticky left-0 bg-muted border p-2 text-sm font-semibold text-center z-10 hover:bg-muted/80 cursor-pointer" onClick={() => handleOpenBlockOutModal(new Date(getYear(currentDate), currentDate.getMonth(), dayOfMonth))} >{dayOfMonth}</td>
                        <td colSpan={24} className="border p-0 relative h-10">
                             {events.map((event, i) => (
                                <div
                                    key={`${dayOfMonth}-${i}`}
                                    title={event.label || event.type}
                                    className={cn("rounded", getEventTypeStyles(event.type), event.originalEvent && "cursor-pointer hover:ring-2 hover:ring-primary")}
                                    style={{ left: `${(event.startHour / 24) * 100}%`, width: `${(event.durationHours / 24) * 100}%` }}
                                    onClick={() => event.originalEvent && handleOpenBlockOutModal(undefined, event.originalEvent)}
                                >
                                  {event.type === 'off' && <span className="truncate px-1">{event.label}</span>}
                                </div>
                            ))}
                        </td>
                        <td className="sticky right-0 bg-muted border p-2 text-sm text-center font-mono z-10">{formatHourTotal(dutyTotal)}</td>
                        <td className="sticky right-0 bg-muted border p-2 text-sm text-center font-mono z-10">{formatHourTotal(flightTotal)}</td>
                    </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-card font-bold"><td className="sticky left-0 bg-card border p-2 text-sm text-center z-10">Total</td><td colSpan={24} className="border p-2"></td><td className="sticky right-0 bg-card border p-2 text-sm text-center font-mono z-10">{formatHourTotal(processedCalendarData.monthlyDutyTotal)}</td><td className="sticky right-0 bg-card border p-2 text-sm text-center font-mono z-10">{formatHourTotal(processedCalendarData.monthlyFlightTotal)}</td></tr></tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <CreateCrewBlockOutModal
        isOpen={isBlockOutModalOpen}
        setIsOpen={setIsBlockOutModalOpen}
        onSave={handleSaveCrewBlockOut}
        onDelete={(id) => { setBlockOutToDelete({ id } as CrewBlockOut); setShowDeleteConfirm(true); }}
        crewMember={selectedCrewMember || null}
        initialData={modalInitialData}
        isEditing={isEditingBlockOut}
      />

       {showDeleteConfirm && blockOutToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete this block-out event? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteBlockOut(blockOutToDelete.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

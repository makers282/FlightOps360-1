
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { CalendarCheck2, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchTrips, type Trip, type TripLeg } from '@/ai/flows/manage-trips-flow';
import { fetchCrewBlockOuts, type CrewBlockOut } from '@/ai/flows/manage-crew-block-outs-flow';
import { 
  startOfMonth, endOfMonth, getDaysInMonth, format, addMonths, subMonths, getYear, setYear,
  setMonth, parseISO, isWithinInterval, differenceInMinutes, startOfDay, endOfDay
} from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from "@/lib/utils";

type EventType = 'duty' | 'flight' | 'rest' | 'off';

interface CalendarEvent {
  type: EventType;
  startHour: number; // 0-23.99
  durationHours: number; // duration in hours
  label?: string;
}

interface DayData {
  dayOfMonth: number;
  events: CalendarEvent[];
  dutyTotal: number;
  flightTotal: number;
}

const getEventTypeStyles = (type: EventType) => {
  switch (type) {
    case 'duty': return 'bg-black h-1 absolute top-1/2 -translate-y-1/2';
    case 'flight': return 'bg-sky-400 h-4 absolute top-1/2 -translate-y-1/2 rounded-sm';
    case 'rest': return 'bg-gray-300 h-px absolute top-1/2 -translate-y-1/2';
    case 'off': return 'bg-red-400 h-full absolute';
    default: return 'bg-gray-500';
  }
};

export default function CrewDutyLogPage() {
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [blockOuts, setBlockOuts] = useState<CrewBlockOut[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [crewData, tripsData, blockOutsData] = await Promise.all([
        fetchCrewMembers(),
        fetchTrips(),
        fetchCrewBlockOuts()
      ]);
      const activeCrew = crewData.filter(c => c.isActive);
      setCrewMembers(activeCrew);
      setTrips(tripsData);
      setBlockOuts(blockOutsData);
      if (activeCrew.length > 0 && !selectedCrewId) {
        setSelectedCrewId(activeCrew[0].id);
      }
    } catch (error) {
      console.error("Failed to load schedule data:", error);
      toast({ title: "Error Loading Data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedCrewId]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
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

      const eventsForDay: CalendarEvent[] = [];
      let dailyDuty = 0;
      let dailyFlight = 0;
      
      const dayBlockOut = blockOuts.find(bo => 
          bo.crewMemberId === selectedCrewId && 
          isWithinInterval(currentDayDate, { start: parseISO(bo.startDate), end: parseISO(bo.endDate) })
      );

      if (dayBlockOut) {
          eventsForDay.push({ type: 'off', startHour: 0, durationHours: 24, label: dayBlockOut.reason });
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
            const dutyStart = new Date(firstDeparture.getTime() - 60 * 60 * 1000); // Duty 1hr before first departure
            const dutyStartHour = dutyStart.getHours() + dutyStart.getMinutes() / 60;

            let lastArrival: Date | null = null;
            legsForDay.forEach(leg => {
              const departure = parseISO(leg.departureDateTime!);
              const flightHours = leg.flightTimeHours || 0;
              dailyFlight += flightHours;
              
              const arrival = new Date(departure.getTime() + flightHours * 60 * 60 * 1000);
              if (!lastArrival || arrival > lastArrival) {
                lastArrival = arrival;
              }
              
              const startHour = departure.getHours() + departure.getMinutes() / 60;
              eventsForDay.push({ type: 'flight', startHour, durationHours: flightHours });
            });

            const dutyEnd = new Date(lastArrival!.getTime() + 30 * 60 * 1000); // Duty 30min after last arrival
            const dutyEndHour = dutyEnd.getHours() + dutyEnd.getMinutes() / 60;

            const dutyDurationHours = dutyEndHour - dutyStartHour;
            dailyDuty = dutyDurationHours > 0 ? dutyDurationHours : 0;
            eventsForDay.push({ type: 'duty', startHour: dutyStartHour, durationHours: dutyDurationHours });
        }
      }

      days.push({ dayOfMonth: day, events: eventsForDay, dutyTotal: dailyDuty, flightTotal: dailyFlight });
      monthlyDutyTotal += dailyDuty;
      monthlyFlightTotal += dailyFlight;
    }

    return { days, monthlyDutyTotal, monthlyFlightTotal };

  }, [selectedCrewId, currentDate, trips, blockOuts]);
  
  const formatHourTotal = (totalHours: number) => {
      if (totalHours <= 0) return '00:00';
      const hours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const years = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, name: format(new Date(0, i), 'MMMM') }));

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading schedule data...</p>
        </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Crew Duty Log"
        description="Detailed monthly view of crew duty, flight times, and off-duty periods."
        icon={CalendarCheck2}
      />
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedCrewId || ''} onValueChange={setSelectedCrewId}>
                    <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Crew Member"/></SelectTrigger>
                    <SelectContent>{crewMembers.map(c => <SelectItem key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Select value={String(currentDate.getMonth())} onValueChange={(m) => setCurrentDate(prev => setMonth(prev, parseInt(m)))}>
                        <SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger>
                        <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(getYear(currentDate))} onValueChange={(y) => setCurrentDate(prev => setYear(prev, parseInt(y)))}>
                        <SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger>
                        <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4"/></Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4"/></Button>
                </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-2"><div className="w-4 h-1 bg-black"/>Duty</div>
                <div className="flex items-center gap-2"><div className="w-4 h-3 bg-sky-400 rounded-sm"/>Flight Leg</div>
                <div className="flex items-center gap-2"><div className="w-4 h-px bg-gray-300"/>Rest</div>
                <div className="flex items-center gap-2"><div className="w-4 h-3 bg-red-400 rounded-sm"/>Day Off</div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <div className="grid grid-cols-[auto_repeat(24,minmax(40px,1fr))_auto] min-w-[1300px]">
              {/* Header */}
              <div className="sticky left-0 bg-muted border-b border-r p-2 text-xs font-semibold text-center z-10">Day</div>
              {Array.from({length: 24}).map((_, i) => (
                <div key={`header-${i}`} className="border-b p-2 text-xs font-semibold text-center">{String(i).padStart(2,'0')}</div>
              ))}
              <div className="bg-muted border-b border-l p-2 text-xs font-semibold text-center whitespace-nowrap sticky right-0 z-10">Duty | Flight</div>

              {/* Body */}
              {processedCalendarData.days.map(({ dayOfMonth, events, dutyTotal, flightTotal }) => (
                <React.Fragment key={dayOfMonth}>
                  <div className="sticky left-0 bg-muted border-r p-2 text-xs font-semibold text-center z-10">{dayOfMonth}</div>
                  <div className="col-span-24 border-r relative grid grid-cols-24">
                      {/* Grid lines */}
                      {Array.from({ length: 23 }).map((_, i) => (
                          <div key={`line-${dayOfMonth}-${i}`} className="h-full border-r"></div>
                      ))}
                      {/* Events */}
                      {events.map((event, i) => (
                          <div
                              key={`${dayOfMonth}-${i}`}
                              title={event.label || event.type}
                              className={cn("rounded", getEventTypeStyles(event.type))}
                              style={{
                                  left: `${(event.startHour / 24) * 100}%`,
                                  width: `${(event.durationHours / 24) * 100}%`,
                              }}
                          />
                      ))}
                  </div>
                  <div className="bg-muted border-l p-2 text-xs text-center whitespace-nowrap sticky right-0 z-10">
                    <span className="font-mono">{formatHourTotal(dutyTotal)}</span>
                    <span className="mx-1">|</span>
                    <span className="font-mono">{formatHourTotal(flightTotal)}</span>
                  </div>
                </React.Fragment>
              ))}

              {/* Footer */}
              <div className="sticky left-0 bg-card border-t border-r p-2 text-xs font-bold text-center z-10">Total</div>
              <div className="col-span-24 border-t p-2"></div>
              <div className="bg-card border-t border-l p-2 text-xs font-bold text-center whitespace-nowrap sticky right-0 z-10">
                  <span className="font-mono">{formatHourTotal(processedCalendarData.monthlyDutyTotal)}</span>
                  <span className="mx-1">|</span>
                  <span className="font-mono">{formatHourTotal(processedCalendarData.monthlyFlightTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
        

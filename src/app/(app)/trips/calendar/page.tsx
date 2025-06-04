
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide, Loader2, Filter as FilterIcon, PlusCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { format, parseISO, startOfDay, endOfDay, addDays, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import dayGridPlugin from '@fullcalendar/daygrid'; // For dayGridMonth view
import interactionPlugin from '@fullcalendar/interaction'; // For future interactions

import '@fullcalendar/core/main.css'; // Corrected path for v5/v6
import '@fullcalendar/daygrid/main.css'; // Corrected path
import '@fullcalendar/resource-timeline/main.css'; // Corrected path


import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAircraftBlockOuts, saveAircraftBlockOut, type AircraftBlockOut } from '@/ai/flows/manage-aircraft-block-outs-flow';
import { CreateBlockOutEventModal, type BlockOutFormData } from './components/create-block-out-event-modal';

interface FullCalendarEvent {
  id: string;
  resourceId?: string; // Link to aircraft
  title: string;
  start: string; // ISO string or YYYY-MM-DD
  end: string;   // ISO string or YYYY-MM-DD (exclusive for FullCalendar)
  allDay: boolean;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  extendedProps?: Record<string, any>;
}

interface FullCalendarResource {
  id: string; // Aircraft ID
  title: string; // Aircraft Label (e.g., N123AB - Cessna CJ3)
}

export interface AircraftFilterOption { // Re-using for filter UI
  id: string;
  label: string;
}

const AIRCRAFT_EVENT_COLORS = [
  { color: 'hsl(200 69% 53%)', textColor: 'hsl(200 60% 95%)' }, // Sky Blue
  { color: 'hsl(145 63% 42%)', textColor: 'hsl(145 60% 95%)' }, // Emerald Green
  { color: 'hsl(30 80% 50%)', textColor: 'hsl(30 60% 95%)' },   // Amber Orange
  { color: 'hsl(240 60% 58%)', textColor: 'hsl(240 60% 95%)' }, // Indigo
  { color: 'hsl(0 72% 45%)', textColor: 'hsl(0 60% 95%)' },     // Crimson Red
  { color: 'hsl(170 60% 40%)', textColor: 'hsl(170 60% 95%)' }, // Teal
  { color: 'hsl(320 60% 55%)', textColor: 'hsl(320 60% 95%)' }, // Pink
  { color: 'hsl(270 50% 50%)', textColor: 'hsl(270 60% 95%)' }, // Purple
];
const BLOCK_OUT_COLOR = 'hsl(var(--muted))';
const BLOCK_OUT_TEXT_COLOR = 'hsl(var(--muted-foreground))';


export default function TripCalendarPage() {
  const [calendarEvents, setCalendarEvents] = useState<FullCalendarEvent[]>([]);
  const [calendarResources, setCalendarResources] = useState<FullCalendarResource[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { toast } = useToast();
  const [isClientReady, setIsClientReady] = useState(false);

  const [allFleetAircraftOptions, setAllFleetAircraftOptions] = useState<AircraftFilterOption[]>([]);
  const [isLoadingFleetForModal, setIsLoadingFleetForModal] = useState(true);
  const [activeAircraftFilters, setActiveAircraftFilters] = useState<string[]>([]);
  
  const aircraftColorMap = useMemo(() => new Map<string, { color: string, textColor: string }>(), []);

  const getAircraftColor = useCallback((aircraftId: string) => {
    if (!aircraftColorMap.has(aircraftId)) {
      const colorIndex = aircraftColorMap.size % AIRCRAFT_EVENT_COLORS.length;
      aircraftColorMap.set(aircraftId, AIRCRAFT_EVENT_COLORS[colorIndex] || AIRCRAFT_EVENT_COLORS[0]);
    }
    return aircraftColorMap.get(aircraftId) || AIRCRAFT_EVENT_COLORS[0];
  }, [aircraftColorMap]);

  const [isBlockOutModalOpen, setIsBlockOutModalOpen] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsLoadingData(true);
    setIsLoadingFleetForModal(true);
    try {
      const [fetchedTrips, completeFleet, fetchedBlockOuts] = await Promise.all([
        fetchTrips(),
        fetchFleetAircraft(),
        fetchAircraftBlockOuts(),
      ]);

      const resources: FullCalendarResource[] = completeFleet.map(ac => ({
        id: ac.id,
        title: `${ac.tailNumber} - ${ac.model}`,
      }));
      setCalendarResources(resources);

      const fleetOptionsForModal: AircraftFilterOption[] = completeFleet
        .filter(ac => ac.id && ac.tailNumber && ac.model)
        .map(ac => ({ id: ac.id, label: `${ac.tailNumber} - ${ac.model}` }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setAllFleetAircraftOptions(fleetOptionsForModal);
      
      // Initialize active filters to all fetched aircraft initially
      setActiveAircraftFilters(resources.map(r => r.id));


      const tripEvents: FullCalendarEvent[] = fetchedTrips.map(trip => {
        let startDateStr = trip.legs?.[0]?.departureDateTime;
        let endDateStr: string | undefined = undefined;

        if (trip.legs && trip.legs.length > 0) {
            const lastLeg = trip.legs[trip.legs.length - 1];
            if (lastLeg.arrivalDateTime) { // Prefer arrival time if available
                endDateStr = lastLeg.arrivalDateTime;
            } else if (lastLeg.departureDateTime && lastLeg.blockTimeHours) {
                const departure = parseISO(lastLeg.departureDateTime);
                const arrival = addDays(departure, Math.ceil(lastLeg.blockTimeHours / 24)); // Rough estimate for end day
                endDateStr = arrival.toISOString();
            } else if (startDateStr) { // Fallback if no other end info
                 endDateStr = addDays(parseISO(startDateStr), 1).toISOString(); // Assume at least 1 day
            }
        }
        
        // Ensure start and end dates are valid and in YYYY-MM-DD format for allDay events
        const start = startDateStr && isValid(parseISO(startDateStr)) ? format(parseISO(startDateStr), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        // For FullCalendar allDay events, the end date is exclusive.
        const end = endDateStr && isValid(parseISO(endDateStr)) ? format(addDays(parseISO(endDateStr), 1), 'yyyy-MM-dd') : format(addDays(parseISO(start), 1), 'yyyy-MM-dd');


        const aircraftColor = getAircraftColor(trip.aircraftId || 'UNKNOWN_AC');
        return {
          id: trip.id,
          resourceId: trip.aircraftId,
          title: `${trip.aircraftLabel || trip.aircraftId}: ${trip.tripId} (${trip.clientName})`,
          start: start,
          end: end,
          allDay: true,
          backgroundColor: aircraftColor.color,
          textColor: aircraftColor.textColor,
          borderColor: aircraftColor.color,
          extendedProps: { tripData: trip, type: 'trip' },
        };
      });

      const blockOutEvents: FullCalendarEvent[] = fetchedBlockOuts.map(blockOut => {
        // FullCalendar's end date is exclusive for allDay events
        const endDateExclusive = format(addDays(parseISO(blockOut.endDate), 1), 'yyyy-MM-dd');
        return {
          id: blockOut.id,
          resourceId: blockOut.aircraftId,
          title: `${blockOut.aircraftLabel || blockOut.aircraftId}: ${blockOut.title}`,
          start: format(parseISO(blockOut.startDate), 'yyyy-MM-dd'),
          end: endDateExclusive,
          allDay: true,
          backgroundColor: BLOCK_OUT_COLOR,
          textColor: BLOCK_OUT_TEXT_COLOR,
          borderColor: BLOCK_OUT_COLOR,
          extendedProps: { blockOutData: blockOut, type: 'block_out' },
        };
      });

      setCalendarEvents([...tripEvents, ...blockOutEvents]);

    } catch (error) {
      console.error("Failed to load data for FullCalendar:", error);
      toast({ title: "Error Loading Calendar Data", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
    } finally {
      setIsLoadingData(false);
      setIsLoadingFleetForModal(false);
    }
  }, [toast, getAircraftColor]);

  useEffect(() => {
    setIsClientReady(true); // Indicate client-side rendering is ready
    loadInitialData();
  }, [loadInitialData]);

  const handleSaveBlockOut = async (data: BlockOutFormData) => {
    const selectedAircraft = allFleetAircraftOptions.find(ac => ac.id === data.aircraftId);
    if (!selectedAircraft) {
      toast({ title: "Error", description: "Selected aircraft not found.", variant: "destructive" });
      return;
    }
    const blockOutToSave = {
      aircraftId: data.aircraftId,
      aircraftLabel: selectedAircraft.label,
      title: data.title,
      startDate: format(data.startDate, "yyyy-MM-dd"),
      endDate: format(data.endDate, "yyyy-MM-dd"),
    };
    try {
      await saveAircraftBlockOut(blockOutToSave as any);
      toast({ title: "Aircraft Block-Out Saved", variant: "default" });
      await loadInitialData();
      setIsBlockOutModalOpen(false);
    } catch (error) {
      toast({ title: "Error Saving Block-Out", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };
  
  const handleEventClick = (clickInfo: any) => {
    if (clickInfo.event.extendedProps?.type === 'trip' && clickInfo.event.id) {
      // Using Next.js Link component behavior for navigation
      const link = document.createElement('a');
      link.href = `/trips/details/${clickInfo.event.id}`;
      link.click();
    } else if (clickInfo.event.extendedProps?.type === 'block_out') {
      // Optionally, open an edit modal for block-outs or show details
      toast({
        title: "Block-Out Event",
        description: `${clickInfo.event.title}\nFrom: ${format(clickInfo.event.start || new Date(), "PPP")}\nTo: ${format(addDays(clickInfo.event.end || new Date(), -1), "PPP")}`, // Adjust end date for display
      });
    }
  };

  const filteredCalendarResources = useMemo(() => {
    if (activeAircraftFilters.length === 0) return calendarResources; // Show all if no filter or show all
    return calendarResources.filter(res => activeAircraftFilters.includes(res.id));
  }, [calendarResources, activeAircraftFilters]);


  if (!isClientReady || isLoadingData) {
    return (
      <>
        <PageHeader title="Trip & Maintenance Calendar" description="Visual overview of scheduled trips and maintenance events." icon={CalendarIconLucide} />
        <Card className="shadow-xl border-border/50">
          <CardHeader className="border-b py-3 px-4">
            <CardDescription className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading calendar and data...</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><Skeleton className="w-full aspect-[1.5/1] rounded-md" /></CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Trip & Maintenance Calendar" description="Resource timeline view for aircraft activities." icon={CalendarIconLucide} />
      <Card className="shadow-xl border-border/50">
        <CardHeader className="border-b py-3 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle className="text-lg">Aircraft Timeline</CardTitle>
            <CardDescription>Default view: Resource Timeline Week. Use controls to navigate.</CardDescription>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
             {calendarResources.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon className="mr-2 h-4 w-4" /> Filter Aircraft ({activeAircraftFilters.length === calendarResources.length ? 'All' : `${activeAircraftFilters.length} selected`})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <div className="p-4 border-b">
                    <h4 className="font-medium text-sm">Filter Events by Aircraft</h4>
                  </div>
                  <ScrollArea className="h-[200px] p-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-all-fc-aircraft"
                          checked={activeAircraftFilters.length === calendarResources.length}
                          onCheckedChange={(checked) => setActiveAircraftFilters(Boolean(checked) ? calendarResources.map(r => r.id) : [])}
                        />
                        <Label htmlFor="filter-all-fc-aircraft" className="font-medium text-sm">
                          All Aircraft
                        </Label>
                      </div>
                      {calendarResources.map(aircraft => (
                        <div key={`filter-fc-${aircraft.id}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-fc-ac-${aircraft.id}`}
                            checked={activeAircraftFilters.includes(aircraft.id)}
                            onCheckedChange={(checked) => {
                               setActiveAircraftFilters(prev => 
                                Boolean(checked) ? [...prev, aircraft.id] : prev.filter(id => id !== aircraft.id)
                               )
                            }}
                          />
                          <Label htmlFor={`filter-fc-ac-${aircraft.id}`} className="text-sm font-normal">
                            {aircraft.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsBlockOutModalOpen(true)} disabled={isLoadingFleetForModal}>
              <Lock className="mr-2 h-4 w-4" /> Schedule Block Out
            </Button>
            <Button asChild size="sm">
              <Link href="/trips/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Trip
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {isClientReady && (
            <FullCalendar
              plugins={[resourceTimelinePlugin, dayGridPlugin, interactionPlugin]}
              initialView="resourceTimelineWeek"
              schedulerLicenseKey="GPL-My-Project-Is-Open-Source" // Required for resource views in v5+
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth,dayGridMonth'
              }}
              editable={false} // Set to true for drag/drop, resize
              selectable={false} // Set to true to select dates/times
              resources={filteredCalendarResources}
              events={calendarEvents}
              resourceAreaHeaderContent="Aircraft"
              resourceAreaWidth="25%"
              slotMinWidth={50} // Adjust width of time slots
              aspectRatio={1.8} // Adjust overall aspect ratio
              eventClick={handleEventClick}
              height="auto" // Or a fixed pixel value like 700
              eventDisplay="block" // Ensures events take up block space
              // Add more FullCalendar options here as needed
            />
          )}
        </CardContent>
      </Card>
      <CreateBlockOutEventModal
        isOpen={isBlockOutModalOpen}
        setIsOpen={setIsBlockOutModalOpen}
        onSave={handleSaveBlockOut}
        aircraftOptions={allFleetAircraftOptions}
        isLoadingAircraft={isLoadingFleetForModal}
      />
    </>
  );
}

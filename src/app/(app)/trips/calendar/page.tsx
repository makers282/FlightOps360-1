
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide, Plane, Loader2, Filter as FilterIcon, PlusCircle, Lock } from 'lucide-react';
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import type { DayProps } from "react-day-picker";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday, addHours, isValid, addDays, isBefore, isAfter } from 'date-fns';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTrips, type Trip, type TripStatus } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; // Import for full fleet
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { CreateBlockOutEventModal, type BlockOutFormData } from './components/create-block-out-event-modal';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'trip' | 'maintenance' | 'block_out';
  aircraftId?: string;
  aircraftLabel?: string;
  route?: string;
  color: string;
  textColor: string;
  description?: string;
  status?: TripStatus;
}

export interface AircraftFilterOption {
  id: string;
  label: string;
}

const AIRCRAFT_COLORS_PALETTE = [
  { color: 'bg-sky-500', textColor: 'text-white' },
  { color: 'bg-emerald-500', textColor: 'text-white' },
  { color: 'bg-amber-500', textColor: 'text-black' },
  { color: 'bg-rose-500', textColor: 'text-white' },
  { color: 'bg-violet-500', textColor: 'text-white' },
  { color: 'bg-lime-500', textColor: 'text-black' },
  { color: 'bg-cyan-500', textColor: 'text-black' },
  { color: 'bg-pink-500', textColor: 'text-white' },
  { color: 'bg-teal-500', textColor: 'text-white' },
  { color: 'bg-orange-500', textColor: 'text-black' },
];
const DEFAULT_AIRCRAFT_COLOR = { color: 'bg-gray-400', textColor: 'text-white' };
const BLOCK_OUT_EVENT_COLOR = { color: 'bg-slate-600', textColor: 'text-slate-100' };

function CustomDay(dayProps: DayProps & { eventsForDay: CalendarEvent[] }) {
  const { date, displayMonth, eventsForDay } = dayProps;
  const isCurrentMonth = date.getMonth() === displayMonth.getMonth();

  if (!isCurrentMonth) {
    return <div className="h-full w-full" />;
  }

  const dayEvents = useMemo(() => {
    return eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [eventsForDay]);

  const dayNumberSectionClasses = cn("flex justify-end p-0.5 h-6 items-start");

  const eventsForDayContainerClasses = cn("flex-1 flex flex-col gap-px");

  return (
    <div className="h-full w-full flex flex-col">
      <div className={dayNumberSectionClasses}>
        <time
          dateTime={format(date, "yyyy-MM-dd")}
          className={cn(
            "text-xs",
            isToday(date)
              ? "text-primary font-bold rounded-full bg-primary/10 size-5 flex items-center justify-center"
              : "px-1"
          )}
        >
          {format(date, "d")}
        </time>
      </div>

      {dayEvents.length > 0 && (
        <div className={eventsForDayContainerClasses}>
          {dayEvents.map(event => {
            const mapKey = `${event.id}-${format(date, "yyyy-MM-dd")}`;
            const currentCellDayStart = startOfDay(date);
            const currentCellDayEnd = endOfDay(date);

            const eventStartsInThisCell = isSameDay(event.start, date);
            const eventEndsInThisCell = isSameDay(event.end, date);
            const eventStartedBeforeCell = isBefore(event.start, currentCellDayStart);
            const eventEndsAfterCell = isAfter(event.end, currentCellDayEnd);
            
            let borderRadiusClasses = "rounded-sm";
            let marginClasses = "";
            let zIndexClass = "";

            if (eventStartsInThisCell && eventEndsAfterCell) {
                borderRadiusClasses = "rounded-l-sm rounded-r-none";
                marginClasses = "mr-[-1px]"; 
                zIndexClass = "relative z-10";
            } else if (eventStartedBeforeCell && eventEndsInThisCell) {
                borderRadiusClasses = "rounded-r-sm rounded-l-none";
                marginClasses = "ml-[-1px]";
                zIndexClass = "relative z-10";
            } else if (eventStartedBeforeCell && eventEndsAfterCell) {
                borderRadiusClasses = "rounded-none";
                marginClasses = "mx-[-1px]";
                zIndexClass = "relative z-10";
            }
            
            const displayTitle = eventStartsInThisCell || event.type === 'block_out';
            const showPaddingForText = displayTitle;
            const eventDisplayTitle = event.type === 'block_out' 
              ? `${event.aircraftLabel || 'UNK'}: ${event.title}`
              : `${event.aircraftLabel || 'UNK'}: ${event.title}`;
            const eventLink = event.type === 'trip' ? `/trips/details/${event.id}` : undefined;

            const EventContent = () => (
                 <div className={cn("h-full w-full text-[0.55rem] sm:text-[0.6rem] flex items-center hover:opacity-90", event.color, event.textColor, borderRadiusClasses)}>
                    <span className={cn(
                        "w-full overflow-hidden whitespace-nowrap truncate",
                        showPaddingForText ? "px-0.5 sm:px-1" : ""
                    )}>
                      {displayTitle ? eventDisplayTitle : <>&nbsp;</>}
                    </span>
                  </div>
            );

            return (
              <TooltipProvider key={mapKey} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {eventLink ? (
                        <Link 
                            href={eventLink} 
                            className={cn("block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring h-5 sm:h-6", marginClasses, zIndexClass)}
                        >
                           <EventContent />
                        </Link>
                    ) : (
                        <div className={cn("block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring h-5 sm:h-6", marginClasses, zIndexClass)}>
                             <EventContent />
                        </div>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md text-xs">
                    <p className="font-semibold">{eventDisplayTitle} {event.status && event.type === 'trip' && <span className="text-muted-foreground">({event.status})</span>}</p>
                    {event.route && event.type === 'trip' && <p>Route: {event.route}</p>}
                    <p className="text-muted-foreground">
                      {format(event.start, 'MMM d, H:mm zz')} - {format(event.end, 'MMM d, H:mm zz')}
                    </p>
                    {event.description && <p className="mt-1">{event.description}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TripCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isClientReady, setIsClientReady] = useState(false);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isLoadingFleetForModal, setIsLoadingFleetForModal] = useState(true); // Dedicated loading state
  const { toast } = useToast();

  const [uniqueAircraftForFilter, setUniqueAircraftForFilter] = useState<AircraftFilterOption[]>([]);
  const [allFleetAircraftOptions, setAllFleetAircraftOptions] = useState<AircraftFilterOption[]>([]); // For block-out modal
  const [activeAircraftFilters, setActiveAircraftFilters] = useState<string[]>([]);

  const aircraftColorMap = useMemo(() => new Map<string, { color: string, textColor: string }>(), []);
  
  const getAircraftColor = useCallback((aircraftId: string) => {
    if (!aircraftColorMap.has(aircraftId)) {
      const colorIndex = aircraftColorMap.size % AIRCRAFT_COLORS_PALETTE.length;
      aircraftColorMap.set(aircraftId, AIRCRAFT_COLORS_PALETTE[colorIndex]);
    }
    return aircraftColorMap.get(aircraftId) || DEFAULT_AIRCRAFT_COLOR;
  }, [aircraftColorMap]);

  const [isBlockOutModalOpen, setIsBlockOutModalOpen] = useState(false);

  const handleSaveBlockOut = (data: BlockOutFormData) => {
    const selectedAircraft = allFleetAircraftOptions.find(ac => ac.id === data.aircraftId);
    const newEvent: CalendarEvent = {
      id: `block-${Date.now()}`,
      title: data.title,
      start: startOfDay(data.startDate),
      end: endOfDay(data.endDate),
      type: 'block_out',
      aircraftId: data.aircraftId,
      aircraftLabel: selectedAircraft?.label || data.aircraftId,
      color: BLOCK_OUT_EVENT_COLOR.color,
      textColor: BLOCK_OUT_EVENT_COLOR.textColor,
      description: `Aircraft ${selectedAircraft?.label || data.aircraftId} blocked out: ${data.title}`,
    };
    setRawEvents(prev => [...prev, newEvent]);
    toast({
      title: "Aircraft Blocked Out",
      description: `${selectedAircraft?.label || data.aircraftId} blocked from ${format(data.startDate, "PPP")} to ${format(data.endDate, "PPP")}. (Client-side only)`,
      variant: "default"
    });
  };

  const isValidISO = (dateString?: string): boolean => {
    if (!dateString) return false;
    return isValid(parseISO(dateString));
  };

  useEffect(() => {
    setIsClientReady(true);
    let isMounted = true;

    const loadInitialData = async () => {
        setIsLoadingTrips(true);
        setIsLoadingFleetForModal(true);
        try {
            const [fetchedTrips, completeFleet] = await Promise.all([
                fetchTrips(),
                fetchFleetAircraft()
            ]);

            if (!isMounted) return;

            // Process trips
            const aircraftSetForFilter = new Map<string, string>();
            const calendarEvents: CalendarEvent[] = fetchedTrips.map(trip => {
              let startDate: Date | null = null;
              let endDate: Date | null = null;
              let route = "N/A";

              if (trip.legs && trip.legs.length > 0) {
                const firstLeg = trip.legs[0];
                const lastLeg = trip.legs[trip.legs.length - 1];
                route = `${firstLeg.origin || 'UNK'} -> ${lastLeg.destination || 'UNK'}`;
                if (firstLeg.departureDateTime && isValidISO(firstLeg.departureDateTime)) startDate = parseISO(firstLeg.departureDateTime);
                
                let lastLegDeparture: Date | null = null;
                if (lastLeg.departureDateTime && isValidISO(lastLeg.departureDateTime)) lastLegDeparture = parseISO(lastLeg.departureDateTime);
                
                if (lastLeg.arrivalDateTime && isValidISO(lastLeg.arrivalDateTime)) endDate = parseISO(lastLeg.arrivalDateTime);
                else if (lastLegDeparture && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) endDate = addHours(lastLegDeparture, lastLeg.blockTimeHours);
                else if (startDate && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) endDate = addHours(startDate, lastLeg.blockTimeHours);
                else if (startDate) {
                  let totalBlockTimeForEndDate = 0;
                  trip.legs.forEach(leg => { totalBlockTimeForEndDate += (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1)); });
                  endDate = addHours(startDate, totalBlockTimeForEndDate > 0 ? totalBlockTimeForEndDate : 2);
                }
              }
              
              if (!startDate) startDate = new Date();
              if (!endDate || !isValid(endDate) || isBefore(endDate, startDate)) endDate = addHours(startDate, 2);
              if (isSameDay(startDate, endDate) && isBefore(endDate,startDate)) endDate = addHours(startDate, 2);
              
              const aircraftIdentifier = trip.aircraftId || 'UNKNOWN_AIRCRAFT';
              const aircraftDisplayLabel = trip.aircraftLabel || trip.aircraftId || 'Unknown Aircraft';
              if (aircraftIdentifier !== 'UNKNOWN_AIRCRAFT' && !aircraftSetForFilter.has(aircraftIdentifier)) {
                aircraftSetForFilter.set(aircraftIdentifier, aircraftDisplayLabel);
              }
              const { color, textColor } = getAircraftColor(aircraftIdentifier);

              return {
                id: trip.id, title: trip.tripId, start: startDate, end: endDate, type: 'trip',
                aircraftId: aircraftIdentifier, aircraftLabel: aircraftDisplayLabel,
                route: route, color, textColor,
                description: `Trip for ${trip.clientName} on ${aircraftDisplayLabel}. Status: ${trip.status}.`,
                status: trip.status
              };
            }).filter(event => event.start && event.end && isValid(event.start) && isValid(event.end));
            
            setRawEvents(calendarEvents);
            setUniqueAircraftForFilter(Array.from(aircraftSetForFilter.entries()).map(([id, label]) => ({ id, label })).sort((a,b) => a.label.localeCompare(b.label)));

            // Process complete fleet for block out modal
            const fleetOptions = completeFleet
                .filter(ac => ac.id && ac.tailNumber && ac.model) // Ensure essential fields
                .map(ac => ({ id: ac.id, label: `${ac.tailNumber} - ${ac.model}` }));
            setAllFleetAircraftOptions(fleetOptions.sort((a, b) => a.label.localeCompare(b.label)));

        } catch (error) {
            if (isMounted) {
                console.error("Failed to load initial data for calendar:", error);
                toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Failed to fetch trip or fleet data."), variant: "destructive"});
            }
        } finally {
            if (isMounted) {
                setIsLoadingTrips(false);
                setIsLoadingFleetForModal(false);
            }
        }
    };

    loadInitialData();

    return () => { isMounted = false; };
  }, [toast, getAircraftColor]);
  
  const filteredEvents = useMemo(() => {
    if (activeAircraftFilters.length === 0) return rawEvents;
    return rawEvents.filter(event => event.aircraftId && activeAircraftFilters.includes(event.aircraftId));
  }, [rawEvents, activeAircraftFilters]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(event => {
      if (!event.start || !event.end || !isValid(event.start) || !isValid(event.end)) {
        return;
      }
      let currentDayIter = startOfDay(event.start);
      const eventEndBoundary = endOfDay(event.end);
      while (currentDayIter <= eventEndBoundary) {
        const dayKey = format(currentDayIter, "yyyy-MM-dd");
        if (!map.has(dayKey)) map.set(dayKey, []);
        const dayEvents = map.get(dayKey)!;
        if (!dayEvents.find(e => e.id === event.id)) dayEvents.push(event);
        currentDayIter = addDays(currentDayIter, 1);
      }
    });
    return map;
  }, [filteredEvents]);

  const handleAircraftFilterChange = (aircraftId: string, checked: boolean) => {
    setActiveAircraftFilters(prev => 
      checked ? [...prev, aircraftId] : prev.filter(id => id !== aircraftId)
    );
  };

  const handleSelectAllAircraftFilter = (checked: boolean) => {
    if (checked) {
      setActiveAircraftFilters(uniqueAircraftForFilter.map(ac => ac.id));
    } else {
      setActiveAircraftFilters([]);
    }
  };

  if (!isClientReady || (isLoadingTrips && isLoadingFleetForModal)) {
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
      <PageHeader title="Trip & Maintenance Calendar" description="Visual overview of scheduled trips and maintenance events." icon={CalendarIconLucide} />
      <Card className="shadow-xl border-border/50">
        <CardHeader className="border-b py-3 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle className="text-lg">Activity View</CardTitle>
            <CardDescription>Trip colors represent different aircraft. Grey blocks are other scheduled unavailability.</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            {uniqueAircraftForFilter.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon className="mr-2 h-4 w-4" /> Filter Trips ({activeAircraftFilters.length > 0 ? `${activeAircraftFilters.length} selected` : 'All'})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <div className="p-4 border-b">
                    <h4 className="font-medium text-sm">Filter Trips by Aircraft</h4>
                  </div>
                  <ScrollArea className="h-[200px] p-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-all-trip-aircraft"
                          checked={activeAircraftFilters.length === uniqueAircraftForFilter.length && uniqueAircraftForFilter.length > 0}
                          onCheckedChange={(checked) => handleSelectAllAircraftFilter(Boolean(checked))}
                        />
                        <Label htmlFor="filter-all-trip-aircraft" className="font-medium text-sm">
                          All Aircraft (in trips)
                        </Label>
                      </div>
                      {uniqueAircraftForFilter.map(aircraft => (
                        <div key={`filter-${aircraft.id}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-ac-${aircraft.id}`}
                            checked={activeAircraftFilters.includes(aircraft.id)}
                            onCheckedChange={(checked) => handleAircraftFilterChange(aircraft.id, Boolean(checked))}
                          />
                          <Label htmlFor={`filter-ac-${aircraft.id}`} className="text-sm font-normal">
                            {aircraft.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
             <Button variant="outline" size="sm" onClick={() => setIsBlockOutModalOpen(true)}>
              <Lock className="mr-2 h-4 w-4" /> Schedule Block Out
            </Button>
            <Button asChild size="sm">
              <Link href="/trips/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Trip
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ShadcnCalendar
            mode="single" month={currentMonth} onMonthChange={setCurrentMonth}
            className="w-full rounded-md bg-card"
            classNames={{
                table: "w-full border-collapse table-fixed", month: "w-full", head_row: "border-b border-border/50 flex",
                head_cell: cn("text-muted-foreground align-middle text-center font-normal text-[0.65rem] sm:text-xs py-1.5 border-r border-b border-border/30 last:border-r-0 w-[calc(100%/7)]"),
                row: "flex w-full",
                cell: cn("p-0 m-0 text-left align-top relative h-24 min-h-[6rem] sm:h-28 sm:min-h-[7rem] md:h-32 md:min-h-[8rem] lg:h-36 lg:min-h-[9rem] xl:h-40 xl:min-h-[10rem] border-r border-b border-border/30 w-[calc(100%/7)]"),
                day_disabled: "opacity-50 pointer-events-none", caption: "flex justify-center items-center py-2.5 relative gap-x-1 px-2",
                caption_label: "text-sm font-medium px-2", nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"),
                nav_button_previous: "absolute left-1", nav_button_next: "absolute right-1",
            }}
            components={{ Day: (dayProps) => <CustomDay {...dayProps} eventsForDay={eventsByDay.get(format(startOfDay(dayProps.date), "yyyy-MM-dd")) || []} /> }}
            showOutsideDays={false} numberOfMonths={1} captionLayout="buttons"
            fromYear={new Date().getFullYear() - 5} toYear={new Date().getFullYear() + 5}
          />
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


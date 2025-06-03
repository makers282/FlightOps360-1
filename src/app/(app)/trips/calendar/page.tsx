
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide, Plane, Loader2, Filter as FilterIcon, PlusCircle, Lock } from 'lucide-react';
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import type { DayProps } from "react-day-picker";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday, addHours, isValid, addDays, isBefore, isAfter, isSameMonth, differenceInCalendarDays, eachDayOfInterval } from 'date-fns';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTrips, type Trip, type TripStatus } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { CreateBlockOutEventModal, type BlockOutFormData } from './components/create-block-out-event-modal';
import { fetchAircraftBlockOuts, saveAircraftBlockOut, type AircraftBlockOut } from '@/ai/flows/manage-aircraft-block-outs-flow';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PHASE_COLORS = {
  DEFAULT_TRIP: { color: 'hsl(var(--primary))',    textColor: 'hsl(var(--primary-foreground))' }, 
  BLOCK_OUT: { color: 'hsl(var(--muted))', textColor: 'hsl(var(--muted-foreground))' }, 
};

const AIRCRAFT_EVENT_COLORS = [
  { color: 'hsl(200 69% 73%)', textColor: 'hsl(208 60% 20%)' }, // Soft Sky Blue (primary)
  { color: 'hsl(145 63% 49%)', textColor: 'hsl(145 60% 15%)' }, // Green
  { color: 'hsl(30 80% 60%)', textColor: 'hsl(30 60% 15%)' },  // Orange/Amber
  { color: 'hsl(240 60% 65%)', textColor: 'hsl(240 60% 15%)' }, // Indigo
  { color: 'hsl(0 72% 51%)', textColor: 'hsl(0 60% 95%)' },    // Red
  { color: 'hsl(170 60% 50%)', textColor: 'hsl(170 60% 15%)' }, // Teal
  { color: 'hsl(320 60% 60%)', textColor: 'hsl(320 60% 15%)' }, // Pink
  { color: 'hsl(270 50% 60%)', textColor: 'hsl(270 60% 15%)' }, // Purple
];

interface CalendarEvent {
  id: string;
  title: string;
  start: Date; // Inclusive start date
  end: Date;   // Inclusive end date
  type: 'trip' | 'block_out';
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

const CustomDay = React.memo(function CustomDay(dayProps: DayProps & { eventsForDay: CalendarEvent[] }) {
  const { date, displayMonth, eventsForDay } = dayProps;
  const currentDay = startOfDay(date);
  const isCurrentMonthDay = isSameMonth(date, displayMonth);

  if (!isCurrentMonthDay) {
    return <div className="h-full w-full border-r border-b border-border/30" />;
  }

  // Sort events: block_outs "on top" visually if they overlap, then by aircraft ID for stable trip order
  const sortedEventsForDay = useMemo(() => {
    return [...eventsForDay].sort((a, b) => {
      if (a.type === 'block_out' && b.type !== 'block_out') return -1;
      if (a.type !== 'block_out' && b.type === 'block_out') return 1;
      return (a.aircraftId || '').localeCompare(b.aircraftId || '');
    });
  }, [eventsForDay]);

  const eventsForDayContainerClasses = cn("h-full flex flex-col gap-px overflow-hidden p-px"); 
  const eventBarHeight = "h-5 sm:h-6"; 
  const baseTextSize = "text-[0.6rem]";

  return (
    <div className="h-full w-full border-r border-b border-border/30 group-data-[row-last=true]:border-b-0 last:border-r-0 relative">
      <time
        dateTime={format(date, "yyyy-MM-dd")}
        className={cn(
          "absolute top-0.5 right-0.5 z-20 text-xs px-1",
          isToday(date)
            ? "text-primary font-bold rounded-full bg-primary/20 size-5 flex items-center justify-center"
            : "text-muted-foreground"
        )}
      >
        {format(date, "d")}
      </time>
      
      {sortedEventsForDay.length > 0 && (
        <div className={eventsForDayContainerClasses}>
          {sortedEventsForDay.map(event => {
            const eventStartDay = startOfDay(event.start);
            const eventEndDay = startOfDay(event.end); // End date is inclusive

            const isEventActiveOnThisDay = currentDay >= eventStartDay && currentDay <= eventEndDay;
            if (!isEventActiveOnThisDay) return null;

            const eventStartsOnThisDay = isSameDay(currentDay, eventStartDay);
            const eventEndsOnThisDay = isSameDay(currentDay, eventEndDay);
            
            let borderRadiusClasses = "rounded-sm";
            let marginClasses = "mx-0"; 
            let widthAndPositionClasses = "w-full";

            if (eventStartsOnThisDay && eventEndsOnThisDay) {
              // Single day event
              borderRadiusClasses = "rounded-sm";
              marginClasses = "mx-0";
              widthAndPositionClasses = "w-full";
            } else if (eventStartsOnThisDay) { // Multi-day, starts today
              borderRadiusClasses = "rounded-l-sm rounded-r-none";
              marginClasses = "ml-0 mr-[-1px]"; 
              widthAndPositionClasses = "w-full"; 
            } else if (eventEndsOnThisDay) { // Multi-day, ends today
              borderRadiusClasses = "rounded-r-sm rounded-l-none";
              marginClasses = "mr-0 ml-[-1px]"; 
              widthAndPositionClasses = "w-full";
            } else { // Middle segment of a multi-day event
              borderRadiusClasses = "rounded-none";
              marginClasses = "mx-[-1px]";
              widthAndPositionClasses = "w-[calc(100%+2px)]"; 
            }
            
            const displayColor = event.color;
            const displayTextColor = event.textColor;
            const showTitle = eventStartsOnThisDay;

            const LinkOrDiv = event.type === 'trip' && event.id ? Link : 'div';
            const linkProps = event.type === 'trip' && event.id 
                              ? { href: `/trips/details/${event.id}` } 
                              : {};
            
            return (
              <TooltipProvider key={event.id + event.type} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LinkOrDiv
                      {...linkProps}
                      className={cn(
                        "block relative", 
                        eventBarHeight,
                        widthAndPositionClasses,
                        marginClasses, 
                        borderRadiusClasses,
                        "z-10 overflow-hidden" 
                      )}
                      style={{ backgroundColor: displayColor }}
                    >
                      {showTitle && (
                        <span
                          className={cn(
                            "absolute inset-0 px-1.5 flex items-center",
                            baseTextSize,
                            "whitespace-nowrap overflow-hidden truncate"
                          )}
                          style={{ color: displayTextColor }}
                        >
                          {event.title}
                        </span>
                      )}
                    </LinkOrDiv>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md">
                    <p className="font-semibold">{event.title}</p>
                    {event.route && <p className="text-xs">Route: {event.route}</p>}
                    <p className="text-xs">Starts: {format(event.start, "MMM d, yyyy")}</p>
                    <p className="text-xs">Ends: {format(event.end, "MMM d, yyyy")} (Inclusive)</p>
                    {event.status && <p className="text-xs">Status: {event.status}</p>}
                    {event.description && !event.route && <p className="text-xs">{event.description}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}
    </div>
  );
});
CustomDay.displayName = "CustomDay";


export default function TripCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isClientReady, setIsClientReady] = useState(false);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { toast } = useToast();

  const [uniqueAircraftForFilter, setUniqueAircraftForFilter] = useState<AircraftFilterOption[]>([]);
  const [allFleetAircraftOptions, setAllFleetAircraftOptions] = useState<AircraftFilterOption[]>([]);
  const [isLoadingFleetForModal, setIsLoadingFleetForModal] = useState(true);
  const [activeAircraftFilters, setActiveAircraftFilters] = useState<string[]>([]);
  
  const aircraftColorMap = useMemo(() => new Map<string, { color: string, textColor: string }>(), []);

  const getAircraftColor = useCallback((aircraftId: string) => {
    if (!aircraftColorMap.has(aircraftId)) {
      const colorIndex = aircraftColorMap.size % AIRCRAFT_EVENT_COLORS.length;
      aircraftColorMap.set(aircraftId, AIRCRAFT_EVENT_COLORS[colorIndex] || PHASE_COLORS.DEFAULT_TRIP);
    }
    return aircraftColorMap.get(aircraftId) || PHASE_COLORS.DEFAULT_TRIP;
  }, [aircraftColorMap]);


  const [isBlockOutModalOpen, setIsBlockOutModalOpen] = useState(false);

  const isValidISO = (dateString?: string): boolean => {
    if (!dateString) return false;
    return isValid(parseISO(dateString));
  };

  const loadInitialData = useCallback(async () => {
    setIsLoadingData(true);
    setIsLoadingFleetForModal(true);
    try {
        const [fetchedTrips, completeFleet, fetchedBlockOuts] = await Promise.all([
            fetchTrips(),
            fetchFleetAircraft(),
            fetchAircraftBlockOuts(),
        ]);

        const aircraftSetForFilter = new Map<string, string>();
        
        const tripCalendarEvents: CalendarEvent[] = fetchedTrips.map(trip => {
          let overallStartDate: Date | null = null;
          let lastActiveDayInclusive: Date | null = null; 
          let route = "N/A";

          if (trip.legs && trip.legs.length > 0) {
            const firstLeg = trip.legs[0];
            const lastLegTripData = trip.legs[trip.legs.length - 1];
            route = `${firstLeg.origin || 'UNK'} -> ${lastLegTripData.destination || 'UNK'}`;
            if (isValidISO(firstLeg.departureDateTime)) overallStartDate = startOfDay(parseISO(firstLeg.departureDateTime));

            if (isValidISO(lastLegTripData.arrivalDateTime)) {
                lastActiveDayInclusive = startOfDay(parseISO(lastLegTripData.arrivalDateTime));
            } else if (isValidISO(lastLegTripData.departureDateTime)) {
                const departure = parseISO(lastLegTripData.departureDateTime);
                const blockTime = lastLegTripData.blockTimeHours || (lastLegTripData.flightTimeHours ? lastLegTripData.flightTimeHours + 0.5 : 1); 
                lastActiveDayInclusive = startOfDay(addHours(departure, blockTime));
            } else if (overallStartDate) { 
                let totalBlockTime = 0;
                trip.legs.forEach(leg => { totalBlockTime += (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1));});
                lastActiveDayInclusive = startOfDay(addHours(overallStartDate, totalBlockTime > 0 ? totalBlockTime : 2)); 
            }
          }
          
          if (!overallStartDate || !isValid(overallStartDate)) overallStartDate = startOfDay(new Date()); 
          if (!lastActiveDayInclusive || !isValid(lastActiveDayInclusive) || isBefore(lastActiveDayInclusive, overallStartDate)) {
             lastActiveDayInclusive = overallStartDate; 
          }
          
          const aircraftIdentifier = trip.aircraftId || 'UNKNOWN_AIRCRAFT';
          const aircraftDisplayLabel = trip.aircraftLabel || trip.aircraftId || 'Unknown Aircraft';
          if (aircraftIdentifier !== 'UNKNOWN_AIRCRAFT' && !aircraftSetForFilter.has(aircraftIdentifier)) {
            aircraftSetForFilter.set(aircraftIdentifier, aircraftDisplayLabel);
          }
          
          const colorDetails = getAircraftColor(aircraftIdentifier); 

          return {
            id: trip.id, title: `${aircraftDisplayLabel} - ${trip.tripId}`, 
            start: overallStartDate, end: lastActiveDayInclusive, 
            type: 'trip',
            aircraftId: aircraftIdentifier, aircraftLabel: aircraftDisplayLabel,
            route: route, 
            color: colorDetails.color, textColor: colorDetails.textColor,
            description: `Trip for ${trip.clientName}. Status: ${trip.status}.`,
            status: trip.status,
          };
        }).filter(event => event.start && event.end && isValid(event.start) && isValid(event.end));

        const blockOutCalendarEvents: CalendarEvent[] = fetchedBlockOuts.map(blockOut => {
            const aircraftDisplayLabel = blockOut.aircraftLabel || blockOut.aircraftId;
             if (blockOut.aircraftId && !aircraftSetForFilter.has(blockOut.aircraftId)) {
                aircraftSetForFilter.set(blockOut.aircraftId, aircraftDisplayLabel);
            }
            const blockOutStartDate = startOfDay(parseISO(blockOut.startDate));
            const blockOutEndDateInclusive = startOfDay(parseISO(blockOut.endDate));

            return {
                id: blockOut.id,
                title: `${aircraftDisplayLabel}: ${blockOut.title}`,
                start: blockOutStartDate,
                end: blockOutEndDateInclusive,  
                type: 'block_out',
                aircraftId: blockOut.aircraftId,
                aircraftLabel: aircraftDisplayLabel,
                color: PHASE_COLORS.BLOCK_OUT.color,
                textColor: PHASE_COLORS.BLOCK_OUT.textColor,
                description: `Aircraft ${aircraftDisplayLabel} blocked: ${blockOut.title}`
            };
        }).filter(event => event.start && event.end && isValid(event.start) && isValid(event.end));

        setRawEvents([...tripCalendarEvents, ...blockOutCalendarEvents]);
        setUniqueAircraftForFilter(Array.from(aircraftSetForFilter.entries()).map(([id, label]) => ({ id, label })).sort((a,b) => a.label.localeCompare(b.label)));

        const fleetOptions = completeFleet
            .filter(ac => ac.id && ac.tailNumber && ac.model) 
            .map(ac => ({ id: ac.id, label: `${ac.tailNumber} - ${ac.model}` }));
        setAllFleetAircraftOptions(fleetOptions.sort((a, b) => a.label.localeCompare(b.label)));

    } catch (error) {
        console.error("Failed to load initial data for calendar:", error);
        toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Failed to fetch trip or fleet data."), variant: "destructive"});
    } finally {
        setIsLoadingData(false);
        setIsLoadingFleetForModal(false);
    }
  }, [toast, getAircraftColor]); 


  useEffect(() => {
    setIsClientReady(true);
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
      toast({
        title: "Aircraft Block-Out Saved",
        description: `${selectedAircraft.label} blocked from ${format(data.startDate, "PPP")} to ${format(data.endDate, "PPP")} has been saved to Firestore.`,
        variant: "default"
      });
      await loadInitialData(); 
      setIsBlockOutModalOpen(false);
    } catch (error) {
      console.error("Failed to save block-out event:", error);
      toast({ title: "Error Saving Block-Out", description: (error instanceof Error ? error.message : "Could not save to Firestore."), variant: "destructive" });
    }
  };

  const filteredEvents = useMemo(() => {
    if (activeAircraftFilters.length === 0) return rawEvents;
    return rawEvents.filter(event => event.aircraftId && activeAircraftFilters.includes(event.aircraftId));
  }, [rawEvents, activeAircraftFilters]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(event => {
      if (!event.start || !event.end || !isValid(event.start) || !isValid(event.end)) {
        console.warn("Skipping event with invalid dates:", event.id, event.start, event.end);
        return;
      }
      const eventStartDay = startOfDay(event.start);
      const eventEndDay = startOfDay(event.end);
      for (let dayIter = eventStartDay; !isAfter(dayIter, eventEndDay); dayIter = addDays(dayIter, 1)) {
        const dayKey = format(dayIter, "yyyy-MM-dd");
        if (!map.has(dayKey)) map.set(dayKey, []);
        map.get(dayKey)!.push(event);
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
      <PageHeader title="Trip & Maintenance Calendar" description="Visual overview of scheduled trips and maintenance events." icon={CalendarIconLucide} />
      <Card className="shadow-xl border-border/50">
        <CardHeader className="border-b py-3 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle className="text-lg">Activity View</CardTitle>
            <CardDescription>Event segments span cell borders for continuity. Titles show on event start day.</CardDescription>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {uniqueAircraftForFilter.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon className="mr-2 h-4 w-4" /> Filter Aircraft ({activeAircraftFilters.length > 0 ? `${activeAircraftFilters.length} selected` : 'All'})
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
                          id="filter-all-trip-aircraft"
                          checked={activeAircraftFilters.length === uniqueAircraftForFilter.length && uniqueAircraftForFilter.length > 0}
                          onCheckedChange={(checked) => handleSelectAllAircraftFilter(Boolean(checked))}
                        />
                        <Label htmlFor="filter-all-trip-aircraft" className="font-medium text-sm">
                          All Aircraft
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
             <Button variant="outline" size="sm" onClick={() => setIsBlockOutModalOpen(true)} disabled={isLoadingFleetForModal}>
              {isLoadingFleetForModal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Schedule Block Out
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
                table: "w-full border-collapse table-fixed", month: "w-full",
                head_row: "border-b border-border/50 flex",
                head_cell: cn("text-muted-foreground align-middle text-center font-normal text-[0.65rem] sm:text-xs py-1.5 border-r border-border/30 last:border-r-0 w-[calc(100%/7)]"),
                row: "flex w-full group", 
                cell: cn("p-0 m-0 text-left align-top relative h-24 min-h-[6rem] sm:h-28 sm:min-h-[7rem] md:h-32 md:min-h-[8rem] lg:h-36 lg:min-h-[9rem] xl:h-40 xl:min-h-[10rem] w-[calc(100%/7)] last:border-r-0 group-data-[row-last=true]:border-b-0"),
                day_disabled: "opacity-50 pointer-events-none", caption: "flex justify-center items-center py-2.5 relative gap-x-1 px-2",
                caption_label: "text-sm font-medium px-2", nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"),
                nav_button_previous: "absolute left-1", nav_button_next: "absolute right-1",
                row_last: "group-data-[row-last=true]",
            }}
            components={{ Day: (dayProps) => <CustomDay {...dayProps} eventsForDay={eventsByDay.get(format(startOfDay(dayProps.date), "yyyy-MM-dd")) || []} /> }}
            showOutsideDays={false} numberOfMonths={1} captionLayout="buttons"
            fromYear={new Date().getFullYear() - 5} toYear={new Date().getFullYear() + 5}
            onDayRender={(day, modifiers, dayProps) => {
              // This logic helps identify the last row for border styling in CustomDay
              // by adding a data attribute if the cell is in the last conceptual row.
              // It's a bit of a workaround as react-day-picker doesn't directly expose "isLastRow".
              // Calculate the total number of weeks displayed for the current month view.
              const firstDayOfMonth = startOfDay(dayProps.displayMonth);
              const lastDayOfMonth = endOfDay(firstDayOfMonth); // Incorrect, should be end of month
              
              // A simpler way might be to check if the day is in the last *visible* week.
              // This usually means it's in the 5th or 6th row of cells.
              // This is not perfect but often good enough for styling.
              const dayRowIndex = Math.floor(dayProps.date.getDay() + dayProps.date.getDate() / 7); // Approximate row index logic
              if (dayProps.displayMonth.getMonth() === dayProps.date.getMonth() && dayRowIndex >=4) { // Heuristic for last rows
                 return { className: 'group-data-[row-last=true]' }; // Signal it's a last row cell
              }
              return {};
            }}
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

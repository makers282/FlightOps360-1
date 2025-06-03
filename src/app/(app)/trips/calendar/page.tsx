
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
  SCHEDULED: { color: 'bg-orange-500', textColor: 'text-white' },
  ACTIVE:    { color: 'bg-gray-600',   textColor: 'text-white' },
  CLOSEOUT:  { color: 'bg-blue-500',   textColor: 'text-white' },
  DEFAULT_TRIP: { color: 'bg-sky-500',    textColor: 'text-white' },
  BLOCK_OUT: { color: 'bg-slate-700', textColor: 'text-slate-100' },
};

interface DailyPhase {
  phaseName: keyof typeof PHASE_COLORS; // Ensures phaseName is one of our defined keys
  displayTitle: string;
  color: string;
  textColor: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'trip' | 'block_out';
  aircraftId?: string;
  aircraftLabel?: string;
  route?: string;
  color: string;
  textColor: string;
  description?: string;
  status?: TripStatus;
  extendedProps?: {
    dailyPhaseInfo?: Map<string, DailyPhase>;
  };
}

export interface AircraftFilterOption {
  id: string;
  label: string;
}

const DEFAULT_AIRCRAFT_COLOR_FALLBACK = { color: 'bg-gray-400', textColor: 'text-white' };

const CustomDay = React.memo(function CustomDay(dayProps: DayProps & { eventsForDay: CalendarEvent[] }) {
  const { date, displayMonth, eventsForDay } = dayProps;
  const isCurrentMonthDay = isSameMonth(date, displayMonth);

  if (!isCurrentMonthDay) {
    return <div className="h-full w-full" />;
  }

  const dayEvents = useMemo(() => {
    return eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [eventsForDay]);

  const dayNumberSectionClasses = cn("flex justify-end p-0.5 h-6 items-start");
  const eventsForDayContainerClasses = cn("h-full flex flex-col gap-px pt-1"); // No overflow-hidden

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
            const dayKey = format(date, "yyyy-MM-dd");
            
            const phaseInfoForDay = event.extendedProps?.dailyPhaseInfo?.get(dayKey);

            const displayColor = phaseInfoForDay?.color || event.color;
            const displayTextColor = phaseInfoForDay?.textColor || event.textColor;
            const baseTitleForSegment = phaseInfoForDay?.displayTitle || event.title;

            const isOverallEventStartInCell = isSameDay(event.start, date);
            let showTitleForThisSegment = false;

            if (phaseInfoForDay) { // Phased event (trip)
                if (isOverallEventStartInCell) {
                    showTitleForThisSegment = true;
                } else {
                    const prevDate = addDays(date, -1);
                    const prevDayKey = format(prevDate, "yyyy-MM-dd");
                    const phaseInfoForPrevDayOfThisEvent = event.extendedProps?.dailyPhaseInfo?.get(prevDayKey);
                    if (!phaseInfoForPrevDayOfThisEvent || phaseInfoForPrevDayOfThisEvent.phaseName !== phaseInfoForDay.phaseName) {
                        showTitleForThisSegment = true;
                    }
                }
            } else { // Non-phased event (e.g., block-out)
                showTitleForThisSegment = isOverallEventStartInCell;
            }
            
            const titleToRender = showTitleForThisSegment ? baseTitleForSegment : '\u00A0';

            // TEMPORARY LOGGING - Remove after diagnosis
            // console.log(`CustomDay LOG: CellDate=${format(date, "yyyy-MM-dd")}, EventID=${event.id}, Event.start=${format(event.start, "yyyy-MM-dd HH:mm")}, eventOverallStartsInCell=${isOverallEventStartInCell}, showTitleForThisSegment=${showTitleForThisSegment}, phaseInfoForDay.phaseName=${phaseInfoForDay?.phaseName}, BaseTitle='${baseTitleForSegment}', FINAL_TITLE_TO_RENDER='${titleToRender === '\u00A0' ? 'NBSP_PLACEHOLDER' : titleToRender}'`);


            const eventStartsForBorderRadius = isSameDay(event.start, date);
            const eventEndsForBorderRadius = isSameDay(event.end, date);
            const eventStartedBeforeForBorderRadius = isBefore(event.start, startOfDay(date));
            const eventEndsAfterForBorderRadius = isAfter(event.end, endOfDay(date));

            let borderRadiusClasses = "rounded-sm";
            if (eventStartsForBorderRadius && eventEndsAfterForBorderRadius) borderRadiusClasses = "rounded-l-sm";
            else if (eventStartedBeforeForBorderRadius && eventEndsForBorderRadius) borderRadiusClasses = "rounded-r-sm";
            else if (eventStartedBeforeForBorderRadius && eventEndsAfterForBorderRadius) borderRadiusClasses = "";

            let marginClasses = "";
            if (eventStartedBeforeForBorderRadius && eventEndsAfterForBorderRadius) marginClasses = "mx-[-1px]"; // Middle segment
            else if (eventStartsForBorderRadius && eventEndsAfterForBorderRadius) marginClasses = "ml-0 mr-[-1px]"; // Starts here, continues
            else if (eventStartedBeforeForBorderRadius && eventEndsForBorderRadius) marginClasses = "mr-0 ml-[-1px]"; // Started before, ends here
            // Single-day event uses default no margin adjustment for this logic

            const EventLinkOrDiv = event.type === 'trip' && event.id ? Link : 'div';
            const hrefProp = event.type === 'trip' && event.id ? { href: `/trips/details/${event.id}` } : {};
            
            const tooltipText = phaseInfoForDay?.displayTitle || event.title;

            return (
              <TooltipProvider key={mapKey} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <EventLinkOrDiv
                      {...hrefProp}
                      className={cn(
                        "block h-5 sm:h-6 text-[0.55rem] sm:text-[0.6rem] flex items-center relative",
                        displayColor, displayTextColor,
                        borderRadiusClasses,
                        marginClasses, // Use negative margins for overlap
                        "z-10" 
                      )}
                    >
                      <span
                        className={cn(
                            "w-full overflow-hidden whitespace-nowrap px-0.5 sm:px-1",
                            showTitleForThisSegment && "truncate" // Only truncate if there's an actual title
                        )}
                      >
                        {titleToRender}
                      </span>
                    </EventLinkOrDiv>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md">
                    <p className="font-semibold">{tooltipText}</p>
                    {event.route && <p className="text-xs">Route: {event.route}</p>}
                    <p className="text-xs">Starts: {format(event.start, "MMM d, HH:mm")}</p>
                    <p className="text-xs">Ends: {format(event.end, "MMM d, HH:mm")}</p>
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
}, (prevProps, nextProps) => {
    return isSameDay(prevProps.date, nextProps.date) &&
           prevProps.displayMonth.getTime() === nextProps.displayMonth.getTime() &&
           prevProps.eventsForDay.length === nextProps.eventsForDay.length &&
           prevProps.eventsForDay.every((event, index) => {
               const nextEvent = nextProps.eventsForDay[index];
               return event.id === nextEvent.id &&
                      event.start.getTime() === nextEvent.start.getTime() &&
                      event.end.getTime() === nextEvent.end.getTime() &&
                      event.title === nextEvent.title &&
                      event.color === nextEvent.color &&
                      // Deep compare dailyPhaseInfo map if it exists
                      (event.extendedProps?.dailyPhaseInfo === nextEvent.extendedProps?.dailyPhaseInfo ||
                        (event.extendedProps?.dailyPhaseInfo && nextEvent.extendedProps?.dailyPhaseInfo &&
                         (() => {
                            if (event.extendedProps.dailyPhaseInfo.size !== nextEvent.extendedProps.dailyPhaseInfo.size) return false;
                            for (const [key, value] of event.extendedProps.dailyPhaseInfo) {
                                const nextValue = nextEvent.extendedProps.dailyPhaseInfo.get(key);
                                if (!nextValue || value.phaseName !== nextValue.phaseName || value.displayTitle !== nextValue.displayTitle) return false;
                            }
                            return true;
                         })()
                        )
                      )
           });
}));
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
      aircraftColorMap.set(aircraftId, PHASE_COLORS.DEFAULT_TRIP);
    }
    return aircraftColorMap.get(aircraftId) || DEFAULT_AIRCRAFT_COLOR_FALLBACK;
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
          let overallEndDate: Date | null = null;
          let route = "N/A";
          const dailyPhaseInfo = new Map<string, DailyPhase>();

          if (trip.legs && trip.legs.length > 0) {
            const firstLeg = trip.legs[0];
            const lastLeg = trip.legs[trip.legs.length - 1];
            route = `${firstLeg.origin || 'UNK'} -> ${lastLeg.destination || 'UNK'}`;
            if (isValidISO(firstLeg.departureDateTime)) overallStartDate = parseISO(firstLeg.departureDateTime);

            let lastLegDeparture: Date | null = null;
            if (isValidISO(lastLeg.departureDateTime)) lastLegDeparture = parseISO(lastLeg.departureDateTime);

            if (isValidISO(lastLeg.arrivalDateTime)) overallEndDate = parseISO(lastLeg.arrivalDateTime);
            else if (lastLegDeparture && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) overallEndDate = addHours(lastLegDeparture, lastLeg.blockTimeHours);
            else if (overallStartDate && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) overallEndDate = addHours(overallStartDate, lastLeg.blockTimeHours);
            else if (overallStartDate) {
              let totalBlockTimeForEndDate = 0;
              trip.legs.forEach(leg => { totalBlockTimeForEndDate += (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1)); });
              overallEndDate = addHours(overallStartDate, totalBlockTimeForEndDate > 0 ? totalBlockTimeForEndDate : 2);
            }
          }

          if (!overallStartDate || !isValid(overallStartDate)) overallStartDate = new Date(); 
          if (!overallEndDate || !isValid(overallEndDate) || isBefore(overallEndDate, overallStartDate)) overallEndDate = addHours(overallStartDate, 2);
          if (isSameDay(overallStartDate, overallEndDate) && isBefore(overallEndDate, overallStartDate)) overallEndDate = addHours(overallStartDate, 2);

          if (isValid(overallStartDate) && isValid(overallEndDate)) {
            const daysOfTrip = eachDayOfInterval({ start: startOfDay(overallStartDate), end: startOfDay(overallEndDate) });
            const totalDays = daysOfTrip.length;
            
            let phase: keyof typeof PHASE_COLORS = 'DEFAULT_TRIP';
            let currentPhaseDisplayString: string = trip.status || "Active";

            daysOfTrip.forEach((day, index) => {
              const dayKey = format(day, "yyyy-MM-dd");

              if (totalDays >= 3) {
                if (index < Math.floor(totalDays / 3)) { phase = 'SCHEDULED'; currentPhaseDisplayString = 'Scheduled'; }
                else if (index < Math.floor(totalDays * 2 / 3)) { phase = 'ACTIVE'; currentPhaseDisplayString = 'Active'; }
                else { phase = 'CLOSEOUT'; currentPhaseDisplayString = 'Closeout'; }
              } else if (totalDays === 2) {
                if (index === 0) { phase = 'SCHEDULED'; currentPhaseDisplayString = 'Scheduled';}
                else { phase = 'ACTIVE'; currentPhaseDisplayString = 'Active'; }
              } else if (totalDays === 1) {
                 phase = trip.status === 'Scheduled' ? 'SCHEDULED' : (trip.status === 'En Route' ? 'ACTIVE' : (trip.status === 'Completed' || trip.status === 'Awaiting Closeout' ? 'CLOSEOUT' : 'DEFAULT_TRIP'));
                 if (phase === 'SCHEDULED') currentPhaseDisplayString = 'Scheduled';
                 else if (phase === 'ACTIVE') currentPhaseDisplayString = 'Active';
                 else if (phase === 'CLOSEOUT') currentPhaseDisplayString = 'Closeout';
                 else currentPhaseDisplayString = trip.status || 'Trip Event';
              }
              
              const phaseStyle = PHASE_COLORS[phase] || PHASE_COLORS.DEFAULT_TRIP;
              dailyPhaseInfo.set(dayKey, {
                phaseName: phase,
                displayTitle: `${trip.aircraftLabel || trip.aircraftId} - ${trip.tripId} - ${currentPhaseDisplayString}`,
                color: phaseStyle.color,
                textColor: phaseStyle.textColor,
              });
            });
          }

          const aircraftIdentifier = trip.aircraftId || 'UNKNOWN_AIRCRAFT';
          const aircraftDisplayLabel = trip.aircraftLabel || trip.aircraftId || 'Unknown Aircraft';
          if (aircraftIdentifier !== 'UNKNOWN_AIRCRAFT' && !aircraftSetForFilter.has(aircraftIdentifier)) {
            aircraftSetForFilter.set(aircraftIdentifier, aircraftDisplayLabel);
          }
          
          const acColor = getAircraftColor(aircraftIdentifier);

          return {
            id: trip.id, title: `${trip.aircraftLabel || trip.aircraftId} - ${trip.tripId}`, 
            start: overallStartDate, end: overallEndDate, type: 'trip',
            aircraftId: aircraftIdentifier, aircraftLabel: aircraftDisplayLabel,
            route: route, 
            color: acColor.color, textColor: acColor.textColor,
            description: `Trip for ${trip.clientName}. Overall Status: ${trip.status}.`,
            status: trip.status,
            extendedProps: { dailyPhaseInfo }
          };
        }).filter(event => event.start && event.end && isValid(event.start) && isValid(event.end));

        const blockOutCalendarEvents: CalendarEvent[] = fetchedBlockOuts.map(blockOut => {
            const aircraftDisplayLabel = blockOut.aircraftLabel || blockOut.aircraftId;
             if (blockOut.aircraftId && !aircraftSetForFilter.has(blockOut.aircraftId)) {
                aircraftSetForFilter.set(blockOut.aircraftId, aircraftDisplayLabel);
            }
            return {
                id: blockOut.id,
                title: `${aircraftDisplayLabel}: ${blockOut.title}`,
                start: startOfDay(parseISO(blockOut.startDate)),
                end: endOfDay(parseISO(blockOut.endDate)),      
                type: 'block_out',
                aircraftId: blockOut.aircraftId,
                aircraftLabel: aircraftDisplayLabel,
                color: PHASE_COLORS.BLOCK_OUT.color,
                textColor: PHASE_COLORS.BLOCK_OUT.textColor,
                description: `Aircraft ${aircraftDisplayLabel} blocked: ${blockOut.title}`
            };
        });

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
        return;
      }
      let currentDayIter = startOfDay(event.start);
      const eventEndBoundary = endOfDay(event.end); 
      while (currentDayIter <= eventEndBoundary) {
        const dayKey = format(currentDayIter, "yyyy-MM-dd");
        if (!map.has(dayKey)) map.set(dayKey, []);
        const dayEvents = map.get(dayKey)!;
        // Avoid duplicate references if an event is already processed for this day from another source (shouldn't happen with current logic)
        if (!dayEvents.find(e => e.id === event.id && e.extendedProps?.dailyPhaseInfo === event.extendedProps?.dailyPhaseInfo)) {
           dayEvents.push(event);
        }
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
            <CardDescription>Trip colors indicate different phases or types. Grey bars are block-outs.</CardDescription>
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



"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide, Plane, Loader2 } from 'lucide-react';
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import type { DayProps } from "react-day-picker";
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday, addHours, isValid, addDays } from 'date-fns';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTrips, type Trip, type TripStatus } from '@/ai/flows/manage-trips-flow';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'trip' | 'maintenance';
  aircraft?: string;
  route?: string; 
  color: string; 
  textColor: string; 
  description?: string;
  status?: TripStatus;
}


const getTripEventColor = (status?: TripStatus): { color: string, textColor: string } => {
  switch (status?.toLowerCase()) {
    case 'scheduled': return { color: 'bg-blue-500', textColor: 'text-white' };
    case 'confirmed': return { color: 'bg-green-600', textColor: 'text-white' };
    case 'en route': return { color: 'bg-indigo-600', textColor: 'text-white' };
    case 'completed': return { color: 'bg-gray-500', textColor: 'text-white' };
    case 'cancelled':
    case 'diverted':
      return { color: 'bg-red-600', textColor: 'text-white' };
    default: return { color: 'bg-sky-600', textColor: 'text-white' };
  }
};

function CustomDay(dayProps: DayProps & { eventsForDay: CalendarEvent[] }) {
  const { date, displayMonth, eventsForDay } = dayProps;
  const isCurrentMonth = date.getMonth() === displayMonth.getMonth();

  if (!isCurrentMonth) {
    // For days outside the current month, render an empty div to maintain grid structure.
    // No need for react-day-picker's default button styling here if we're fully overriding.
    return <div className="h-full w-full" />;
  }

  const dayEvents = useMemo(() => {
    return eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [eventsForDay]);

  return (
    // CustomDay root: Removed p-1. Ensure it fills the cell.
    <div className={cn("relative h-full w-full flex flex-col")}>
      <time dateTime={format(date, "yyyy-MM-dd")} className={cn(
        "text-[0.6rem] sm:text-xs self-end mb-0.5 px-1", // Added px-1 for a bit of space from edge
        isToday(date) && "text-primary font-bold rounded-full bg-primary/10 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center"
      )}>
        {format(date, "d")}
      </time>
      {dayEvents.length > 0 && (
        // Event list container: Removed overflow-hidden for negative margins to work.
        <div className="flex-grow"> 
          <div className="flex flex-col gap-px h-full"> {/* Ensure this takes height */}
            {dayEvents.map(event => {
              const mapKey = `${event.id}-${format(date, "yyyy-MM-dd")}`;

              // Determine if the event's actual start/end falls on THIS calendar cell's date.
              const eventIsActuallyStartingInCell = isSameDay(date, event.start);
              const eventIsActuallyEndingInCell = isSameDay(date, event.end);
              
              // Determine if the event spans beyond THIS calendar cell's date.
              const eventContinuesPastThisCell = event.end > endOfDay(date);
              const eventStartedBeforeThisCell = event.start < startOfDay(date);

              let borderRadiusClasses = "";
              let marginClasses = "";

              if (eventIsActuallyStartingInCell && eventIsActuallyEndingInCell) {
                borderRadiusClasses = "rounded-sm";
              } else if (eventIsActuallyStartingInCell && eventContinuesPastThisCell) {
                borderRadiusClasses = "rounded-l-sm rounded-r-none";
                marginClasses = "mr-[-1px] relative z-10"; 
              } else if (eventStartedBeforeThisCell && eventIsActuallyEndingInCell) {
                borderRadiusClasses = "rounded-r-sm rounded-l-none";
                marginClasses = "ml-[-1px] relative z-10";
              } else if (eventStartedBeforeThisCell && eventContinuesPastThisCell) {
                borderRadiusClasses = "rounded-none";
                marginClasses = "mx-[-1px] relative z-10";
              } else {
                borderRadiusClasses = "rounded-sm"; // Fallback
              }
              
              // Display title only on the very first day the event appears.
              const displayTitle = eventIsActuallyStartingInCell;
              const showPaddingForText = displayTitle;

              const eventBarDivClasses = cn(
                "h-full w-full text-[0.55rem] sm:text-[0.6rem] flex items-center hover:opacity-90",
                event.color,
                event.textColor,
                borderRadiusClasses,
                marginClasses
                // Removed truncate, as it might interfere with visual bleeding. 
                // Text overflow handled by span.
              );

              return (
                <TooltipProvider key={mapKey} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild className="h-5 sm:h-6 block w-full"> 
                      <Link href={`/trips/details/${event.id}`} className="block h-full w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <div className={eventBarDivClasses}>
                          <span className={cn(
                              "w-full overflow-hidden whitespace-nowrap",
                              showPaddingForText ? "px-0.5 sm:px-1" : "" 
                          )}>
                            {displayTitle ? event.title : <>&nbsp;</>}
                          </span>
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md text-xs">
                      <p className="font-semibold">{event.title} {event.status && <span className="text-muted-foreground">({event.status})</span>}</p>
                      {event.route && <p>Route: {event.route}</p>}
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
        </div>
      )}
    </div>
  );
}

export default function TripCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isClientReady, setIsClientReady] = useState(false);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsClientReady(true);
    const loadTrips = async () => {
      setIsLoadingTrips(true);
      try {
        const fetchedTrips = await fetchTrips();
        const calendarEvents: CalendarEvent[] = fetchedTrips.map(trip => {
          let startDate: Date | null = null;
          let endDate: Date | null = null;
          let route = "N/A";
          
          if (trip.legs && trip.legs.length > 0) {
            const firstLeg = trip.legs[0];
            const lastLeg = trip.legs[trip.legs.length - 1];
            route = `${firstLeg.origin || 'UNK'} -> ${lastLeg.destination || 'UNK'}`;

            if (firstLeg.departureDateTime && isValidISO(firstLeg.departureDateTime)) {
              startDate = parseISO(firstLeg.departureDateTime);
            }
            
            if (lastLeg.arrivalDateTime && isValidISO(lastLeg.arrivalDateTime)) {
              endDate = parseISO(lastLeg.arrivalDateTime);
            } else if (lastLeg.departureDateTime && isValidISO(lastLeg.departureDateTime) && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) {
              endDate = addHours(parseISO(lastLeg.departureDateTime), lastLeg.blockTimeHours);
            } else if (startDate) { 
              let totalBlockTimeForEndDate = 0;
              trip.legs.forEach(leg => {
                totalBlockTimeForEndDate += (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1)); 
              });
              endDate = addHours(startDate, totalBlockTimeForEndDate > 0 ? totalBlockTimeForEndDate : 1);
            }
          }
          
          if (!startDate) {
            startDate = new Date(); 
            console.warn(`Trip ${trip.id} missing valid start date, defaulting to now.`);
          }
          if (!endDate || endDate <= startDate) { // ensure end is after start
            let cumulativeBlockTime = (trip.legs || []).reduce((sum, leg) => sum + (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1)), 0);
            endDate = addHours(startDate, Math.max(1, cumulativeBlockTime));
            if (endDate <= startDate) endDate = addHours(startDate, 1); // Absolute fallback
          }

          const { color, textColor } = getTripEventColor(trip.status);

          return {
            id: trip.id,
            title: trip.tripId,
            start: startDate,
            end: endDate,
            type: 'trip',
            aircraft: trip.aircraftLabel || trip.aircraftId,
            route: route,
            color,
            textColor,
            description: `Trip for ${trip.clientName} on ${trip.aircraftLabel || trip.aircraftId}. Status: ${trip.status}.`,
            status: trip.status
          };
        }).filter(event => event.start && event.end); // Filter out events with invalid dates
        setAllEvents(calendarEvents);
      } catch (error) {
        console.error("Failed to load trips for calendar:", error);
        toast({ title: "Error Loading Trips", description: (error instanceof Error ? error.message : "Failed to fetch trip data."), variant: "destructive"});
      } finally {
        setIsLoadingTrips(false);
      }
    };
    loadTrips();
  }, [toast]);

  const isValidISO = (dateString?: string): boolean => {
    if (!dateString) return false;
    return isValid(parseISO(dateString));
  };
  
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allEvents.forEach(event => {
      if (!event.start || !event.end || !isValid(event.start) || !isValid(event.end)) {
        console.warn(`Skipping event ${event.id} due to invalid start/end dates`);
        return;
      }
      let currentDayIter = startOfDay(event.start);
      const eventEndBoundary = endOfDay(event.end); // Use end of day for comparison

      while (currentDayIter <= eventEndBoundary) { // Use <= to include the end day itself
        const dayKey = format(currentDayIter, "yyyy-MM-dd");
        if (!map.has(dayKey)) {
          map.set(dayKey, []);
        }
        if (!map.get(dayKey)!.find(e => e.id === event.id)) {
            map.get(dayKey)!.push(event);
        }
        currentDayIter = addDays(currentDayIter, 1);
        if (currentDayIter > eventEndBoundary && !isSameDay(currentDayIter, eventEndBoundary) && isSameDay(addDays(currentDayIter,-1),event.end)) {
            // This is to catch events ending exactly on midnight, make sure they are on their "end day"
             const finalEndDayKey = format(startOfDay(event.end), "yyyy-MM-dd");
             if (!map.has(finalEndDayKey)) map.set(finalEndDayKey, []);
             if (!map.get(finalEndDayKey)!.find(e => e.id === event.id)) {
                 map.get(finalEndDayKey)!.push(event);
             }
        }
      }
    });
    return map;
  }, [allEvents]);


  if (!isClientReady || isLoadingTrips) {
    return (
      <>
        <PageHeader
          title="Trip & Maintenance Calendar"
          description="Visual overview of scheduled trips and maintenance events."
          icon={CalendarIconLucide}
        />
        <Card className="shadow-xl border-border/50">
          <CardHeader className="border-b py-3 px-4">
            <CardDescription className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading calendar and trip data...
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Skeleton className="w-full aspect-[1.5/1] rounded-md" />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Trip & Maintenance Calendar"
        description="Visual overview of scheduled trips and maintenance events."
        icon={CalendarIconLucide}
      />
      <Card className="shadow-xl border-border/50">
        <CardHeader className="border-b py-3 px-4">
          <CardDescription>
            Displaying trips from Firestore. Maintenance events will be added later.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ShadcnCalendar
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="w-full rounded-md bg-card"
            classNames={{
                table: "w-full border-collapse table-fixed",
                month: "w-full", 
                head_row: "border-b border-border/50 flex",
                head_cell: cn(
                    "text-muted-foreground align-middle text-center font-normal text-[0.65rem] sm:text-xs py-1.5",
                    "border-r border-b border-border/30 last:border-r-0", 
                    "w-[calc(100%/7)]" 
                ),
                row: "flex w-full", 
                cell: cn(
                    "p-0 m-0 text-left align-top relative", // Cell itself has no padding now
                    "h-24 min-h-[6rem] sm:h-28 sm:min-h-[7rem] md:h-32 md:min-h-[8rem] lg:h-36 lg:min-h-[9rem] xl:h-40 xl:min-h-[10rem]", 
                    "border-r border-b border-border/30", 
                    "w-[calc(100%/7)]" 
                ),
                day_disabled: "opacity-50 pointer-events-none",
                caption: "flex justify-center items-center py-2.5 relative gap-x-1 px-2",
                caption_label: "text-sm font-medium px-2", 
                nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"),
                nav_button_previous: "absolute left-1", 
                nav_button_next: "absolute right-1",
            }}
            components={{
              Day: (dayProps) => {
                const dayKey = format(startOfDay(dayProps.date), "yyyy-MM-dd");
                return <CustomDay {...dayProps} eventsForDay={eventsByDay.get(dayKey) || []} />;
              },
            }}
            showOutsideDays={false}
            numberOfMonths={1}
            captionLayout="buttons"
            fromYear={new Date().getFullYear() - 5} 
            toYear={new Date().getFullYear() + 5}
          />
        </CardContent>
      </Card>
    </>
  );
}


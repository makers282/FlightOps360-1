
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
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday, addHours, isValid, addDays, isBefore, isAfter, differenceInCalendarDays } from 'date-fns';
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
    return <div className="h-full w-full" />;
  }

  const dayEvents = useMemo(() => {
    return eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [eventsForDay]);

  const dayNumberSectionClasses = cn(
    "flex justify-end p-0.5 h-6 items-start", 
  );

  const eventsForDayContainerClasses = cn(
    "flex-1 flex flex-col gap-px", // Removed overflow-hidden and p-px
  );

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
            
            let borderRadiusClasses = "rounded-sm"; // Default for single-day event in cell
            let marginClasses = "";
            let zIndexClass = "";

            if (eventStartsInThisCell && eventEndsAfterCell) { // Starts in this cell, continues
                borderRadiusClasses = "rounded-l-sm rounded-r-none";
                marginClasses = "mr-[-1px]"; 
                zIndexClass = "relative z-10";
            } else if (eventStartedBeforeCell && eventEndsInThisCell) { // Started before, ends in this cell
                borderRadiusClasses = "rounded-r-sm rounded-l-none";
                marginClasses = "ml-[-1px]";
                zIndexClass = "relative z-10";
            } else if (eventStartedBeforeCell && eventEndsAfterCell) { // Middle segment
                borderRadiusClasses = "rounded-none";
                marginClasses = "mx-[-1px]";
                zIndexClass = "relative z-10";
            }
            // If eventStartsInThisCell && eventEndsInThisCell, default 'rounded-sm' and no marginClasses apply.

            const displayTitle = eventStartsInThisCell;
            const showPaddingForText = displayTitle;

            const eventBarWrapperClasses = cn(
              "block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring h-5 sm:h-6",
            );
            
            return (
              <TooltipProvider key={mapKey} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link 
                        href={`/trips/details/${event.id}`} 
                        className={cn(eventBarWrapperClasses, marginClasses, zIndexClass)}
                    >
                      <div className={cn("h-full w-full text-[0.55rem] sm:text-[0.6rem] flex items-center hover:opacity-90", event.color, event.textColor, borderRadiusClasses)}>
                        <span className={cn(
                            "w-full overflow-hidden whitespace-nowrap truncate",
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

            let lastLegDeparture: Date | null = null;
            if (lastLeg.departureDateTime && isValidISO(lastLeg.departureDateTime)) {
                lastLegDeparture = parseISO(lastLeg.departureDateTime);
            }

            if (lastLeg.arrivalDateTime && isValidISO(lastLeg.arrivalDateTime)) {
              endDate = parseISO(lastLeg.arrivalDateTime);
            } else if (lastLegDeparture && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) {
              endDate = addHours(lastLegDeparture, lastLeg.blockTimeHours);
            } else if (startDate && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) { // Fallback if last leg arrival is missing but block time exists
              endDate = addHours(startDate, lastLeg.blockTimeHours); 
            } else if (startDate) { // Broader fallback using total block time if available
              let totalBlockTimeForEndDate = 0;
              trip.legs.forEach(leg => {
                totalBlockTimeForEndDate += (leg.blockTimeHours || (leg.flightTimeHours ? leg.flightTimeHours + 0.5 : 1));
              });
              endDate = addHours(startDate, totalBlockTimeForEndDate > 0 ? totalBlockTimeForEndDate : 2); // Default to 2 hours if no block time
            }
          }

          if (!startDate) {
            startDate = new Date(); 
            console.warn(`Trip ${trip.id} missing valid start date for first leg, defaulting to now.`);
          }
          
          if (!endDate || !isValid(endDate) || isBefore(endDate, startDate)) {
             // Ensure end date is valid and after start date, default to 2 hours after start if not.
             console.warn(`Trip ${trip.id} had invalid or missing end date. Defaulting to 2 hours after start.`);
             endDate = addHours(startDate, 2);
          }
           // Specific check for events that might end up on the same day but with end time before start time after calculations
          if (isSameDay(startDate, endDate) && isBefore(endDate, startDate)) {
            console.warn(`Trip ${trip.id} end time was before start time on the same day. Adjusting to 2 hours after start.`);
            endDate = addHours(startDate, 2);
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
        }).filter(event => event.start && event.end && isValid(event.start) && isValid(event.end)); // Final filter for valid events
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
        return;
      }
      let currentDayIter = startOfDay(event.start);
      const eventEndBoundary = endOfDay(event.end);

      while (currentDayIter <= eventEndBoundary) {
        const dayKey = format(currentDayIter, "yyyy-MM-dd");
        if (!map.has(dayKey)) {
          map.set(dayKey, []);
        }

        const dayEvents = map.get(dayKey)!;
        if (!dayEvents.find(e => e.id === event.id)) { // Add event only once per day
            dayEvents.push(event);
        }
        currentDayIter = addDays(currentDayIter, 1);
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
                    "p-0 m-0 text-left align-top relative",
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


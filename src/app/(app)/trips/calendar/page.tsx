
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
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday, addHours, isValid } from 'date-fns';
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

function CustomDay({ date, displayMonth, eventsForDay }: DayProps & { eventsForDay: CalendarEvent[] }) {
  const isCurrentMonth = date.getMonth() === displayMonth.getMonth();

  if (!isCurrentMonth) {
    return <div className="h-full w-full" />;
  }

  const dayEvents = useMemo(() => {
    return eventsForDay.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [eventsForDay]);

  return (
    <div className={cn("relative h-full w-full flex flex-col p-1")}>
      <time dateTime={format(date, "yyyy-MM-dd")} className={cn(
        "text-[0.6rem] sm:text-xs self-end",
        isToday(date) && "text-primary font-bold rounded-full bg-primary/10 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center"
      )}>
        {format(date, "d")}
      </time>
      {dayEvents.length > 0 && (
        <div className="space-y-px mt-0.5 overflow-y-auto flex-grow max-h-[calc(100%-1rem)] sm:max-h-[calc(100%-1.25rem)] pr-0.5">
          {dayEvents.map(event => {
            const eventActualStart = event.start;
            const eventActualEnd = event.end;
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);

            const continuesFromPreviousDay = eventActualStart < dayStart;
            const continuesToNextDay = eventActualEnd > dayEnd;
            const isSingleDayEventOnThisCell = isSameDay(eventActualStart, eventActualEnd) && isSameDay(date, eventActualStart);

            let borderRadiusClasses = "rounded-xs"; // Default for single day event on this cell
            if (isSingleDayEventOnThisCell) {
              borderRadiusClasses = "rounded-xs";
            } else if (continuesFromPreviousDay && !continuesToNextDay) { // Ends today, started before
                borderRadiusClasses = "rounded-r-xs rounded-l-none";
            } else if (!continuesFromPreviousDay && continuesToNextDay) { // Starts today, continues after
                borderRadiusClasses = "rounded-l-xs rounded-r-none";
            } else if (continuesFromPreviousDay && continuesToNextDay) { // Middle of a multi-day event
                borderRadiusClasses = "rounded-none";
            }
            // else: default is rounded-xs (e.g. event that starts and ends today, not crossing midnight, or an event that starts on this day and ends on this day but might have crossed midnight from a previous day end)


            const mapKey = `${event.id}-${format(date, "yyyy-MM-dd")}`;

            return (
              <TooltipProvider key={mapKey} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/trips/details/${event.id}`} className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <div className={cn(
                        "h-3.5 sm:h-4 text-[0.55rem] sm:text-[0.6rem] flex items-center hover:opacity-90",
                        event.color,
                        event.textColor,
                        borderRadiusClasses,
                        "px-0.5 sm:px-1", 
                        "truncate" 
                      )}>
                        {isSameDay(event.start, date) || !continuesFromPreviousDay ? event.title : <>&nbsp;</>}
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
            
            // Determine end date
            if (lastLeg.arrivalDateTime && isValidISO(lastLeg.arrivalDateTime)) {
              endDate = parseISO(lastLeg.arrivalDateTime);
            } else if (lastLeg.departureDateTime && isValidISO(lastLeg.departureDateTime) && lastLeg.blockTimeHours && lastLeg.blockTimeHours > 0) {
              // If last leg has departure and block time, but no arrival time
              endDate = addHours(parseISO(lastLeg.departureDateTime), lastLeg.blockTimeHours);
            } else if (startDate) {
                // Fallback: If only first leg departure is known, estimate trip duration
                // Sum block times of all legs if available, or default to 2 hours per leg
                const totalBlockTime = trip.legs.reduce((sum, leg) => sum + (leg.blockTimeHours || 2), 0);
                endDate = addHours(startDate, totalBlockTime);
            }
          }
          
          if (!startDate) startDate = new Date(); 
          if (!endDate) endDate = addHours(startDate, 2); // Default duration if no leg data

          // Ensure end date is after start date
          if (endDate <= startDate) {
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
        });
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
      let currentDayMarker = startOfDay(event.start);
      const eventEndMarker = event.end; // Use actual end time

      // Add to the first day
      const startDayKey = format(currentDayMarker, "yyyy-MM-dd");
      if (!map.has(startDayKey)) map.set(startDayKey, []);
      map.get(startDayKey)!.push(event);
      
      // Iterate through subsequent days if the event spans
      currentDayMarker = startOfDay(addHours(currentDayMarker, 24)); // Move to start of next day

      while (currentDayMarker < eventEndMarker) { // Check if current day's start is before event's actual end
          const dayKey = format(currentDayMarker, "yyyy-MM-dd");
          if (!map.has(dayKey)) map.set(dayKey, []);
          
          // Ensure we don't add the same event object multiple times if already processed (though this loop structure avoids it for *this* event)
          if (!map.get(dayKey)!.find(e => e.id === event.id)) {
              map.get(dayKey)!.push(event);
          }
          currentDayMarker = startOfDay(addHours(currentDayMarker, 24));
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


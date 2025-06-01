
"use client";

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide } from 'lucide-react';
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import type { DayProps } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns';
import { buttonVariants } from '@/components/ui/button'; // For nav button styling

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'trip' | 'maintenance';
  aircraft?: string;
  color: string;
  textColor: string;
  description?: string;
}

// Mock Data (ensure start/end are valid Date objects)
const mockTripData: Omit<CalendarEvent, 'type' | 'color' | 'textColor'>[] = [
  { id: 'TRP001', title: 'KHPN -> KMIA', aircraft: 'N123AB', start: parseISO('2024-08-15T10:00:00'), end: parseISO('2024-08-15T13:00:00'), description: 'Charter flight to Miami' },
  { id: 'TRP002', title: 'KTEB -> KSDL', aircraft: 'N456CD', start: parseISO('2024-08-18T14:00:00'), end: parseISO('2024-08-20T17:00:00'), description: 'Multi-day trip to Scottsdale' },
  { id: 'TRP003', title: 'KLAX -> KLAS', aircraft: 'N789EF', start: parseISO('2024-08-22T09:00:00'), end: parseISO('2024-08-22T10:00:00'), description: 'Quick hop to Vegas' },
];

const mockMaintenanceData: Omit<CalendarEvent, 'type' | 'color' | 'textColor'>[] = [
  { id: 'MX001', title: 'N123AB - A Check', aircraft: 'N123AB', start: parseISO('2024-08-10T08:00:00'), end: parseISO('2024-08-11T17:00:00'), description: 'Scheduled A Check inspection' },
  { id: 'MX002', title: 'N789EF - Engine Swap', aircraft: 'N789EF', start: parseISO('2024-08-22T07:00:00'), end: parseISO('2024-08-24T18:00:00'), description: 'Engine #1 replacement' },
];

const allEvents: CalendarEvent[] = [
  ...mockTripData.map(trip => ({ ...trip, type: 'trip' as const, color: 'bg-primary/80', textColor: 'text-primary-foreground', title: `${trip.aircraft}: ${trip.title}` })),
  ...mockMaintenanceData.map(mx => ({ ...mx, type: 'maintenance' as const, color: 'bg-yellow-400/80', textColor: 'text-yellow-900', title: `${mx.aircraft}: ${mx.title}` })),
];


function CustomDay(props: DayProps) {
  const { date, displayMonth } = props;
  const isOutside = date.getMonth() !== displayMonth.getMonth();

  const eventsForDay = useMemo(() => {
    return allEvents.filter(event => {
      const eventStartDay = startOfDay(event.start);
      const eventEndDay = endOfDay(event.end); // Use endOfDay for multi-day events spanning across midnight
      const currentDay = startOfDay(date);
      return currentDay >= eventStartDay && currentDay <= eventEndDay;
    });
  }, [date]);

  return (
    <div className={cn(
      "relative h-full w-full flex flex-col p-1.5 border group",
      isOutside ? "text-muted-foreground/40 bg-muted/30" : "text-foreground hover:bg-muted/40 transition-colors duration-150"
    )}>
      <time dateTime={date.toISOString()} className={cn(
        "text-xs sm:text-sm self-end mb-1",
        isSameDay(date, new Date()) && !isOutside ? "text-primary font-bold rounded-full bg-primary/20 w-6 h-6 flex items-center justify-center" : "w-6 h-6 flex items-center justify-center"
      )}>
        {format(date, "d")}
      </time>
      {!isOutside && eventsForDay.length > 0 && (
        <div className="space-y-1 overflow-y-auto flex-grow mt-0.5 max-h-[calc(100%-2.5rem)]"> {/* Adjusted max-h */}
          {eventsForDay.slice(0, 3).map(event => ( // Show up to 3 events
            <TooltipProvider key={event.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/trips/details/${event.id}`} className="block w-full focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm">
                    <div className={cn(
                      "text-[10px] sm:text-xs p-1 rounded-sm truncate leading-tight hover:opacity-80",
                      event.color,
                      event.textColor
                    )}>
                      {event.title}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md">
                  <p className="font-semibold text-xs">{event.title}</p>
                  <p className="text-xs">{event.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(event.start, 'Pp')} - {format(event.end, 'Pp')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {eventsForDay.length > 3 && (
            <div className="text-[10px] text-muted-foreground text-center p-0.5">
              +{eventsForDay.length - 3} more
            </div>
          )}
        </div>
      )}
      {!isOutside && eventsForDay.length === 0 && <div className="flex-grow"></div>}
    </div>
  );
}


export default function TripCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfDay(new Date()));

  return (
    <>
      <PageHeader
        title="Trip & Maintenance Calendar"
        description="Visual overview of scheduled trips and maintenance events."
        icon={CalendarIconLucide}
      />
      <Card className="shadow-xl border-border/50">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Events for {format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <CardDescription>
            Blue entries are trips, Yellow are maintenance. Hover for details, click to view (placeholder link).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-2 md:p-3">
          <ShadcnCalendar
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="w-full rounded-md bg-card"
            classNames={{
                day_disabled: "text-muted-foreground/30 opacity-50",
                day_outside: "", // CustomDay handles its own styling for outside days
                cell: "p-0 m-0 border border-border/50 text-left align-top h-28 sm:h-32 md:h-36 lg:h-40", // Taller cells
                day: "h-full w-full p-0 focus:relative focus:z-10", // Ensure day component fills cell
                head_cell: "text-muted-foreground rounded-md w-[calc(100%/7)] font-medium text-xs sm:text-sm py-2.5 border-b border-border/50",
                caption_label: "text-lg sm:text-xl font-semibold",
                nav_button: cn(buttonVariants({ variant: "outline" }), "h-9 w-9 bg-transparent p-0 opacity-70 hover:opacity-100"),
                nav_button_next: "mr-1",
                nav_button_previous: "ml-1",
            }}
            components={{
              Day: CustomDay,
            }}
            fixedWeeks
            showOutsideDays
            numberOfMonths={1}
            captionLayout="dropdown-buttons"
            fromYear={new Date().getFullYear() - 2}
            toYear={new Date().getFullYear() + 3}
          />
        </CardContent>
      </Card>
    </>
  );
}


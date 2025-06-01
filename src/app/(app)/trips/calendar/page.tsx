
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
import { format, isSameDay, parseISO, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'trip' | 'maintenance';
  aircraft?: string;
  color: string; // Tailwind background color class e.g., 'bg-blue-500'
  textColor: string; // Tailwind text color class e.g., 'text-white'
  description?: string; // For tooltip
}

// Mock Data
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
  ...mockTripData.map(trip => ({ ...trip, type: 'trip' as const, color: 'bg-primary', textColor: 'text-primary-foreground', title: `${trip.aircraft}: ${trip.title}` })),
  ...mockMaintenanceData.map(mx => ({ ...mx, type: 'maintenance' as const, color: 'bg-yellow-500', textColor: 'text-yellow-900', title: `${mx.aircraft}: ${mx.title}` })),
];


function CustomDay(props: DayProps) {
  const { date, displayMonth } = props;
  const isOutside = date.getMonth() !== displayMonth.getMonth();

  const eventsForDay = useMemo(() => {
    return allEvents.filter(event => {
      const eventStartDay = startOfDay(event.start);
      const eventEndDay = endOfDay(event.end);
      const currentDay = startOfDay(date);
      return currentDay >= eventStartDay && currentDay <= eventEndDay;
    });
  }, [date]);

  return (
    <div className={cn(
      "relative h-full w-full flex flex-col p-1 border border-transparent group",
      isOutside ? "text-muted-foreground/50" : "text-foreground",
      { "hover:border-primary/50": !isOutside && eventsForDay.length === 0 }
    )}>
      <time dateTime={date.toISOString()} className={cn(
        "text-xs self-end mb-0.5",
        isSameDay(date, new Date()) && !isOutside ? "text-primary font-bold" : ""
      )}>
        {format(date, "d")}
      </time>
      {!isOutside && eventsForDay.length > 0 && (
        <div className="space-y-0.5 overflow-y-auto max-h-[60px] flex-grow">
          {eventsForDay.slice(0, 2).map(event => ( // Limit to 2 visible events per day, rest could be shown on click/hover detail
            <TooltipProvider key={event.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/trips/details/${event.id}`} className="block w-full">
                    <div className={cn(
                      "text-[10px] p-0.5 rounded-sm truncate leading-tight hover:opacity-80",
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
          {eventsForDay.length > 2 && (
            <div className="text-[10px] text-muted-foreground text-center p-0.5">
              +{eventsForDay.length - 2} more
            </div>
          )}
        </div>
      )}
       {/* Placeholder for empty day content to ensure consistent height if needed */}
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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Events for {format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <CardDescription>
            Blue entries are trips, Yellow are maintenance. Hover for details, click to view (placeholder).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-2 md:p-4">
          <ShadcnCalendar
            mode="single" // Still single for selection, but month shown is controlled
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="w-full rounded-md border bg-card shadow-sm [&_td]:h-20 [&_th]:h-10" // Custom height for day cells
            classNames={{
                day_disabled: "text-muted-foreground/30 opacity-50",
                day_outside: "text-muted-foreground/30 opacity-50",
                cell: "p-0 m-0 border text-left align-top h-20 md:h-24 lg:h-28", // Ensure cell takes height
                day: "h-full w-full p-0", // Ensure day component fills cell
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

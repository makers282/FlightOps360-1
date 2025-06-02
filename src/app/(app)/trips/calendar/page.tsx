
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIconLucide, Plane } from 'lucide-react';
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import type { DayProps } from "react-day-picker";
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay, endOfDay, isToday } from 'date-fns';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
}

// Mock data removed
const mockTripData: Omit<CalendarEvent, 'type' | 'color' | 'textColor' | 'description'>[] = [];

const mockMaintenanceData: Omit<CalendarEvent, 'type' | 'color' | 'textColor' | 'description' | 'route'>[] = [];

const allEvents: CalendarEvent[] = [
  ...mockTripData.map(trip => ({ 
    ...trip, 
    type: 'trip' as const, 
    color: trip.aircraft === 'N520PW' ? 'bg-cyan-500' : 
           trip.aircraft === 'N123MW' ? 'bg-blue-600' : 
           trip.aircraft === 'N555VP' ? 'bg-red-600' : 
           trip.aircraft === 'N345AG' ? 'bg-neutral-800' : 
           trip.aircraft === 'N170SCC' ? 'bg-lime-500' : 'bg-sky-600',
    textColor: trip.aircraft === 'N345AG' ? 'text-white' :
               trip.aircraft === 'N170SCC' ? 'text-black':
               'text-white', 
    description: `Trip for ${trip.aircraft}: ${trip.route}. Departs ${format(trip.start, 'Pp')}, Returns ${format(trip.end, 'Pp')}.` 
  })),
  ...mockMaintenanceData.map(mx => ({ 
    ...mx, 
    type: 'maintenance' as const, 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-950', 
    description: `Maintenance for ${mx.aircraft}: ${mx.title}. From ${format(mx.start, 'Pp')} to ${format(mx.end, 'Pp')}.` 
  })),
];

function CustomDay(props: DayProps) {
  const { date, displayMonth } = props;
  const isCurrentMonth = date.getMonth() === displayMonth.getMonth();

  if (!isCurrentMonth) {
    return <div className="h-full w-full" />;
  }

  const eventsForDay = useMemo(() => {
    const currentDayStart = startOfDay(date); 
    const currentDayEnd = endOfDay(date);     

    return allEvents
      .filter(event => {
        return event.start < currentDayEnd && event.end > currentDayStart;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [date]);

  return (
    <div className={cn("relative h-full w-full flex flex-col p-1")}>
      <time dateTime={format(date, "yyyy-MM-dd")} className={cn(
        "text-[0.6rem] sm:text-xs self-end",
        isToday(date) && "text-primary font-bold rounded-full bg-primary/10 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center"
      )}>
        {format(date, "d")}
      </time>
      {eventsForDay.length > 0 && (
        <div className="space-y-px mt-0.5 overflow-y-auto flex-grow max-h-[calc(100%-1rem)] sm:max-h-[calc(100%-1.25rem)] pr-0.5">
          {eventsForDay.map(event => (
            <TooltipProvider key={event.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/trips/details/${event.id}`} className="block focus:outline-none focus:ring-1 focus:ring-ring rounded-xs">
                    <div className={cn(
                      "h-3.5 sm:h-4 text-[0.55rem] sm:text-[0.6rem] px-0.5 sm:px-1 flex items-center rounded-xs truncate hover:opacity-90",
                      event.color,
                      event.textColor
                    )}>
                      {event.title}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-md rounded-md text-xs">
                  <p className="font-semibold">{event.title}</p>
                  {event.route && <p>Route: {event.route}</p>}
                  <p className="text-muted-foreground">
                    {format(event.start, 'MMM d, H:mm zz')} - {format(event.end, 'MMM d, H:mm zz')}
                  </p>
                  {event.description && <p className="mt-1">{event.description}</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TripCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date | undefined>(undefined);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setCurrentMonth(new Date()); // Default to current month
    setIsClientReady(true);
  }, []);

  if (!isClientReady) {
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
              Loading calendar...
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
            Calendar is ready. Event data will be loaded from Firestore in a future update.
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
              Day: CustomDay,
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


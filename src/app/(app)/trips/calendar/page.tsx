
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

const mockTripData: Omit<CalendarEvent, 'type' | 'color' | 'textColor' | 'description'>[] = [
  { id: 'TRP001', title: 'N520PW Challenger 300', aircraft: 'N520PW', route: 'VNY > TXKF > VNY', start: parseISO('2024-10-02T08:00:00Z'), end: parseISO('2024-10-04T17:00:00Z') },
  { id: 'TRP002', title: 'N123MW Gulfstream-G500', aircraft: 'N123MW', route: 'SFO > LAS > TEB > SFO', start: parseISO('2024-10-02T10:00:00Z'), end: parseISO('2024-10-05T22:00:00Z') },
  { id: 'TRP003', title: 'N555VP Gulfstream-G650', aircraft: 'N555VP', route: 'LFPB > LKPR > FLL', start: parseISO('2024-10-08T11:00:00Z'), end: parseISO('2024-10-09T18:00:00Z') },
  { id: 'TRP004', title: 'N123MW Gulfstream-G500', aircraft: 'N123MW', route: 'SFO > OMA > MMTJ', start: parseISO('2024-10-08T09:00:00Z'), end: parseISO('2024-10-09T17:00:00Z') },
  { id: 'TRP005', title: 'N345AG Gulfstream-4', aircraft: 'N345AG', route: 'DAL > OPF > DAL', start: parseISO('2024-10-09T10:00:00Z'), end: parseISO('2024-10-11T15:00:00Z') },
  { id: 'TRP006', title: 'N170SCC Global-7000', aircraft: 'N170SCC', route: 'ZBAA > WSSL > VVNB', start: parseISO('2024-10-15T06:00:00Z'), end: parseISO('2024-10-16T12:00:00Z') },
  { id: 'TRP007', title: 'N345AG Gulfstream-4', aircraft: 'N345AG', route: 'DAL > LAS > PBI > DAL', start: parseISO('2024-10-16T08:00:00Z'), end: parseISO('2024-10-18T20:00:00Z') },
  { id: 'TRP008', title: 'N520PW Challenger 300', aircraft: 'N520PW', route: 'VNY > MMTO > SBGL > SBGR > VNY', start: parseISO('2024-10-22T07:00:00Z'), end: parseISO('2024-10-26T23:00:00Z') },
  { id: 'TRP009', title: 'N555VP Gulfstream-G650', aircraft: 'N555VP', route: 'FLL > EGSS > FLL', start: parseISO('2024-10-28T10:00:00Z'), end: parseISO('2024-10-30T16:00:00Z') },
];

const mockMaintenanceData: Omit<CalendarEvent, 'type' | 'color' | 'textColor' | 'description' | 'route'>[] = [
  { id: 'MX001', title: 'N123AB - A Check', aircraft: 'N123AB', start: parseISO('2024-10-10T08:00:00Z'), end: parseISO('2024-10-11T17:00:00Z') },
  { id: 'MX002', title: 'N789EF - Engine Swap', aircraft: 'N789EF', start: parseISO('2024-10-20T07:00:00Z'), end: parseISO('2024-10-24T18:00:00Z') },
  { id: 'MX003', title: 'Annual Inspection', aircraft: 'N456CD', start: parseISO('2024-10-01T09:00:00Z'), end: parseISO('2024-10-01T17:00:00Z') },
];

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
    // This ensures that cells for days outside the current month
    // are rendered as blank but correctly sized due to parent TD styling.
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
    <div className={cn("relative h-full w-full flex flex-col p-1")}> {/* Added small padding to the cell content area */}
      <time dateTime={format(date, "yyyy-MM-dd")} className={cn(
        "text-[0.6rem] sm:text-xs self-end", // Adjusted day number size
        isToday(date) && "text-primary font-bold rounded-full bg-primary/10 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center"
      )}>
        {format(date, "d")}
      </time>
      {eventsForDay.length > 0 && (
        // Adjusted max-h to give more space for day number
        <div className="space-y-px mt-0.5 overflow-y-auto flex-grow max-h-[calc(100%-1rem)] sm:max-h-[calc(100%-1.25rem)] pr-0.5">
          {eventsForDay.map(event => (
            <TooltipProvider key={event.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/trips/details/${event.id}`} className="block focus:outline-none focus:ring-1 focus:ring-ring rounded-xs">
                    <div className={cn(
                      "h-3.5 sm:h-4 text-[0.55rem] sm:text-[0.6rem] px-0.5 sm:px-1 flex items-center rounded-xs truncate hover:opacity-90", // Smaller event bars
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
    setCurrentMonth(new Date(2024, 9, 1)); // Default to October 2024
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
            Colors indicate different aircraft or event types. Hover for details, click to view (placeholder link).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0"> {/* Removed padding from CardContent */}
          <ShadcnCalendar
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="w-full rounded-md bg-card" // Applied to the main calendar container
            classNames={{
                table: "w-full border-collapse table-fixed", // table-fixed is key for uniform columns
                month: "w-full", 
                head_row: "border-b border-border/50 flex", // Ensures header row uses flex
                head_cell: cn(
                    "text-muted-foreground align-middle text-center font-normal text-[0.65rem] sm:text-xs py-1.5",
                    "border-r border-b border-border/30 last:border-r-0", // Grid lines
                    "w-[calc(100%/7)]" // Explicit width for header cells
                ),
                row: "flex w-full", // Ensures week rows use flex

                cell: cn( // Styles the <td> element
                    "p-0 m-0 text-left align-top relative", // Base styling for cell
                    "h-24 min-h-[6rem] sm:h-28 sm:min-h-[7rem] md:h-32 md:min-h-[8rem] lg:h-36 lg:min-h-[9rem] xl:h-40 xl:min-h-[10rem]", // Consistent tall height
                    "border-r border-b border-border/30", // Grid lines applied to all cells
                    "w-[calc(100%/7)]" // Explicit width for all cells
                ),
                
                day_disabled: "opacity-50 pointer-events-none", // For days disabled by props (e.g. before/after)
                
                // Caption and Nav buttons styling
                caption: "flex justify-center items-center py-2.5 relative gap-x-1 px-2",
                caption_label: "text-sm font-medium px-2", 
                nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100"),
                nav_button_previous: "absolute left-1", 
                nav_button_next: "absolute right-1",
            }}
            components={{
              Day: CustomDay,
            }}
            showOutsideDays={false} // This is important. CustomDay handles making sure empty cells are rendered correctly.
            numberOfMonths={1}
            captionLayout="buttons" // Shows month/year as text, not dropdowns
            fromYear={new Date().getFullYear() - 5} 
            toYear={new Date().getFullYear() + 5}
          />
        </CardContent>
      </Card>
    </>
  );
}


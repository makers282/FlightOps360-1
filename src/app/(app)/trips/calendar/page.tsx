
"use client"; // Required for useState and the Calendar component

import React, { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Calendar as CalendarIcon } from 'lucide-react'; // Renamed to avoid conflict with ShadCN Calendar
import { Calendar } from "@/components/ui/calendar"; // ShadCN Calendar
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TripCalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <>
      <PageHeader
        title="Trip Calendar"
        description="View all scheduled trips in a calendar format."
        icon={CalendarIcon}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Trip Overview</CardTitle>
          <CardDescription>
            Select a date to see trips. Full event integration is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="rounded-md border bg-card shadow-sm">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="p-3"
              // Props to make it look more like an app calendar
              numberOfMonths={1}
              captionLayout="dropdown-buttons"
              fromYear={new Date().getFullYear() - 1}
              toYear={new Date().getFullYear() + 2}
            />
          </div>
          <div className="flex-1 md:mt-2">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Trips for: {date ? date.toLocaleDateString() : 'No date selected'}
            </h3>
            <div className="p-4 border-2 border-dashed rounded-lg min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-center">
                Trip data for the selected date will appear here.
                <br />
                (Backend integration for trip events is pending.)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

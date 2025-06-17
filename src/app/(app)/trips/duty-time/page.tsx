"use client";

import { PageHeader } from '@/components/page-header';
import { Clock, CalendarCheck2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DutyTimePageRedirect() {
  return (
    <>
      <PageHeader
        title="Duty Time Functionality Merged"
        description="Duty time tracking is now integrated into the main Crew Schedule view."
        icon={Clock}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Functionality Merged</CardTitle>
          <CardDescription>
            The dedicated Duty Time Calendar has been combined with the Crew Schedule page to provide a unified Gantt-style view of crew activities, including duty periods, flight times, and rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-10">
          <p className="text-lg text-muted-foreground mb-6">
            Please use the Crew Schedule page to view detailed duty times and schedules.
          </p>
          <Button asChild>
            <Link href="/trips/crew-schedule">
              <CalendarCheck2 className="mr-2 h-4 w-4" /> Go to Crew Schedule
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
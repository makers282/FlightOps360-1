
import { PageHeader } from '@/components/page-header';
import { CalendarCheck2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CrewScheduleCalendarPage() {
  return (
    <>
      <PageHeader
        title="Crew Schedule Calendar"
        description="View crew member assignments and availability on a calendar."
        icon={CalendarCheck2}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Crew Schedule</CardTitle>
          <CardDescription>
            This calendar will display crew assignments, duty periods, and availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg bg-muted/50">
            <p className="text-muted-foreground">
              Crew Schedule Calendar View - Full Implementation Coming Soon
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

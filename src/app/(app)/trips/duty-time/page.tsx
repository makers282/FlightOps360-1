
import { PageHeader } from '@/components/page-header';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DutyTimeCalendarPage() {
  return (
    <>
      <PageHeader
        title="Duty Time Calendar"
        description="Track crew duty times and Part 135 compliance on a calendar."
        icon={CalendarClock}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Duty Time Records</CardTitle>
          <CardDescription>
            This calendar will display crew duty periods, rest times, and compliance warnings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg bg-muted/50">
            <p className="text-muted-foreground">
              Duty Time Calendar View - Full Implementation Coming Soon
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

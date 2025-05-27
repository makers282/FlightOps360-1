
import { PageHeader } from '@/components/page-header';
import { CalendarClock } from 'lucide-react';

export default function DutyTimeCalendarPage() {
  return (
    <>
      <PageHeader
        title="Duty Time Calendar"
        description="Track crew duty times and Part 135 compliance on a calendar."
        icon={CalendarClock}
      />
      <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Duty Time Calendar View - Content Coming Soon</p>
      </div>
    </>
  );
}


import { PageHeader } from '@/components/page-header';
import { CalendarCheck2 } from 'lucide-react';

export default function CrewScheduleCalendarPage() {
  return (
    <>
      <PageHeader
        title="Crew Schedule Calendar"
        description="View crew member assignments and availability on a calendar."
        icon={CalendarCheck2}
      />
      <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Crew Schedule Calendar View - Content Coming Soon</p>
      </div>
    </>
  );
}

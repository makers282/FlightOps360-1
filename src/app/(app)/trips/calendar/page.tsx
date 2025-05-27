
import { PageHeader } from '@/components/page-header';
import { Calendar } from 'lucide-react';

export default function TripCalendarPage() {
  return (
    <>
      <PageHeader
        title="Trip Calendar"
        description="View all scheduled trips in a calendar format."
        icon={Calendar}
      />
      <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Trip Calendar View - Content Coming Soon</p>
      </div>
    </>
  );
}

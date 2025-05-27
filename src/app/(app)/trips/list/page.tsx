
import { PageHeader } from '@/components/page-header';
import { ListChecks } from 'lucide-react';

export default function TripListPage() {
  return (
    <>
      <PageHeader
        title="Trip List View"
        description="View all trips in a filterable and sortable list format."
        icon={ListChecks}
      />
      <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Trip List View - Content Coming Soon</p>
      </div>
    </>
  );
}

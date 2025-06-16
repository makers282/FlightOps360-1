
import React, { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { FileWarning, Loader2 } from 'lucide-react';
import DiscrepanciesClient from './DiscrepanciesClient'; // Import from the same directory

export default function AircraftDiscrepanciesPageContainer() {
  return (
    <>
      <PageHeader
        title="Global Aircraft Discrepancy Log"
        description="View and filter all reported aircraft discrepancies across the fleet."
        icon={FileWarning}
      />
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading discrepancies data...</p>
        </div>
      }>
        <DiscrepanciesClient />
      </Suspense>
    </>
  );
}

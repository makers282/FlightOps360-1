
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DiscrepanciesPageClientContent } from './components/discrepancies-page-client-content';

export default function AllAircraftDiscrepanciesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg text-muted-foreground">Loading Aircraft Discrepancy Log...</p>
      </div>
    }>
      <DiscrepanciesPageClientContent />
    </Suspense>
  );
}

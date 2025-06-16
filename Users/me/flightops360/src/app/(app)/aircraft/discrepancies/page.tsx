
import React, { Suspense } from 'react';
import DiscrepanciesClient from './components/discrepancies-client';
import { Loader2 } from 'lucide-react';

export default function AllAircraftDiscrepanciesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg text-muted-foreground">Loading Discrepancies Page...</p>
      </div>
    }>
      <DiscrepanciesClient />
    </Suspense>
  );
}

    
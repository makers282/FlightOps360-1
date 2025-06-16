
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the client content component with SSR turned off
const DiscrepanciesPageClientContent = dynamic(
  () => import('./components/discrepancies-page-client-content').then(mod => mod.DiscrepanciesPageClientContent),
  { 
    ssr: false,
    loading: () => ( // Optional: custom loading for the dynamic component itself
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Preparing discrepancy log...</p>
      </div>
    )
  }
);

export default function AllAircraftDiscrepanciesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg text-muted-foreground">Loading Aircraft Discrepancy Log Interface...</p>
      </div>
    }>
      <DiscrepanciesPageClientContent />
    </Suspense>
  );
}

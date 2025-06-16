
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react'; // For a more specific loading indicator
// Import DiscrepanciesClient from the same directory
import DiscrepanciesClient from './DiscrepanciesClient';

export default function AircraftDiscrepanciesPageContainer() {
  // This component remains a Server Component by default.
  // The actual client logic is in DiscrepanciesClient.
  return (
    <>
      {/*
        The PageHeader can be part of the server component layout
        as it likely doesn't use client-side hooks directly dependent on searchParams.
        If DiscrepanciesClient were to render the PageHeader itself,
        then Suspense boundary placement would be even more critical around it.
      */}
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

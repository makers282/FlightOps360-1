
"use client"; // Required for potential client-side hooks in TripForm later

import React, { Suspense } from 'react'; // Import Suspense
import { PageHeader } from '@/components/page-header';
import { TripForm } from '../edit/[tripId]/components/trip-form'; // Adjusted path
import { CalendarPlus, Loader2 } from 'lucide-react';

function NewTripPageContent() {
  return (
    <>
      <PageHeader 
        title="Create New Trip" 
        description="Enter the details below to schedule a new trip using the shared form."
        icon={CalendarPlus}
      />
      <TripForm isEditMode={false} />
    </>
  );
}

export default function NewTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading new trip form...</p></div>}>
      <NewTripPageContent />
    </Suspense>
  );
}

    
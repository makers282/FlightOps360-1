
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, ArrowLeft, InfoIcon } from 'lucide-react';
import { fetchTripById } from '@/ai/flows/manage-trips-flow';
import type { Trip } from '@/ai/schemas/trip-schemas';
import { useToast } from '@/hooks/use-toast';
import { TripForm } from './components/trip-form';

function EditTripPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const tripIdFromParam = params.tripId;
  const id = typeof tripIdFromParam === 'string' ? tripIdFromParam : undefined;

  const [tripData, setTripData] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setError(null);
      fetchTripById({ id })
        .then(data => {
          if (data) {
            setTripData(data);
          } else {
            setError("Trip not found.");
            toast({ title: "Error", description: `Trip with ID ${id} not found.`, variant: "destructive" });
          }
        })
        .catch(err => {
          console.error("Failed to fetch trip for editing:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
          toast({ title: "Error Fetching Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else {
      setError("No trip ID provided for editing.");
      setIsLoading(false);
      router.replace('/trips/list'); 
    }
  }, [id, toast, router]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Loading Trip for Editing..." icon={Loader2} description="Fetching trip details from Firestore." />
        <div className="flex flex-col items-center justify-center mt-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-3 text-lg text-muted-foreground">Loading trip data...</p>
        </div>
      </>
    );
  }

  if (error || !tripData) {
    return (
      <>
        <PageHeader title="Error Loading Trip" icon={InfoIcon} 
          actions={
             <Button onClick={() => router.push('/trips/list')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trip List
            </Button>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Trip data could not be loaded."}</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Edit Trip: ${tripData.tripId}`}
        description="Modify the details for this trip."
        icon={Edit3}
        actions={
            <Button onClick={() => router.push('/trips/list')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trip List
            </Button>
        }
      />
      <TripForm initialTripData={tripData} isEditMode={true} />
    </>
  );
}


export default function EditTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading editor...</p></div>}>
      <EditTripPageContent />
    </Suspense>
  );
}

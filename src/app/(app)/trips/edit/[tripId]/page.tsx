
"use client";

import React, { useState, useEffect, Suspense, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, ArrowLeft, InfoIcon } from 'lucide-react';
import { fetchTripById, saveTrip } from '@/ai/flows/manage-trips-flow'; // SaveTripInput type is not directly needed here
import type { Trip, SaveTripInput } from '@/ai/schemas/trip-schemas'; // Import SaveTripInput for type casting
import { useToast } from '@/hooks/use-toast';
import { TripForm, type FullTripFormData } from './components/trip-form';

function EditTripPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const tripIdFromParam = params.tripId;
  const id = typeof tripIdFromParam === 'string' ? tripIdFromParam : undefined;

  const [tripData, setTripData] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSavingTransition] = useTransition();

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

  const handleSaveTrip = async (formData: FullTripFormData) => {
    if (!tripData) {
      toast({ title: "Error", description: "Original trip data not available for update.", variant: "destructive" });
      return;
    }
    startSavingTransition(async () => {
      // Construct the object to save, ensuring we pass the original Firestore document ID
      const tripToSave: Trip = {
        ...tripData, // Spread existing trip data to preserve fields like createdAt, status, etc.
        id: tripData.id, // CRITICAL: Pass the original Firestore document ID for update
        tripId: formData.tripId, // User-facing Trip ID from form
        selectedCustomerId: formData.selectedCustomerId,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        aircraftId: formData.aircraftId || "UNKNOWN_AC",
        legs: formData.legs.map(leg => {
          const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
          const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
          const flightTime = Number(leg.flightTimeHours || 0);
          const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
          const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
          return {
            ...leg,
            departureDateTime: leg.departureDateTime ? leg.departureDateTime.toISOString() : undefined,
            blockTimeHours: blockTimeHours,
          };
        }),
        notes: formData.notes,
        // status: tripData.status, // Preserve existing status if not changed by form, or update if status is part of FullTripFormData
      };

      try {
        const savedTrip = await saveTrip(tripToSave); // saveTrip now expects the full Trip object
        setTripData(savedTrip); // Update local state with the response from saveTrip
        toast({
          title: "Trip Updated",
          description: `Trip ${savedTrip.tripId} has been successfully updated.`,
        });
      } catch (error) {
        console.error("Failed to save trip:", error);
        toast({
          title: "Error Updating Trip",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };


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
      <TripForm 
        initialTripData={tripData} 
        isEditMode={true} 
        onSave={handleSaveTrip}
        isSaving={isSaving}
      />
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

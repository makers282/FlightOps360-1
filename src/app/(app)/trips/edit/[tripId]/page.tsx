
"use client";

import React, { useState, useEffect, Suspense, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, ArrowLeft, InfoIcon, Send, Users as CrewIcon, FileText as FileIcon, Package as LoadManifestIcon } from 'lucide-react'; // Added Send, CrewIcon, FileIcon, LoadManifestIcon
import { fetchTripById, saveTrip } from '@/ai/flows/manage-trips-flow'; 
import type { Trip, SaveTripInput, TripStatus } from '@/ai/schemas/trip-schemas'; 
import { useToast } from '@/hooks/use-toast';
import { TripForm, type FullTripFormData } from './components/trip-form';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow'; 

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
      const aircraftSelectOptions = await fetchFleetAircraft().then(fleet => fleet.map(ac => ({ value: ac.id, label: `${ac.tailNumber} - ${ac.model}`, model: ac.model })));
      
      const tripToSave: Trip = {
        ...tripData, 
        id: tripData.id, 
        tripId: formData.tripId, 
        clientName: formData.clientName,
        clientEmail: formData.clientEmail, 
        clientPhone: formData.clientPhone,
        aircraftId: formData.aircraftId || "UNKNOWN_AC",
        aircraftLabel: formData.aircraftId ? (aircraftSelectOptions.find(ac => ac.value === formData.aircraftId)?.label) : undefined,
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
        status: formData.status as TripStatus,
        ...(formData.selectedCustomerId && { customerId: formData.selectedCustomerId }),
      };
      
      try {
        const savedTrip = await saveTrip(tripToSave); 
        toast({
          title: "Trip Updated",
          description: `Trip ${savedTrip.tripId} has been successfully updated.`,
        });
        router.push(`/trips/details/${savedTrip.id}`); 
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

  const handleSendItinerary = () => {
    if (!tripData) return;
    toast({
      title: "Send Itinerary (Simulation)",
      description: `Simulating sending itinerary for Trip ID: ${tripData.tripId} to ${tripData.clientName}.`,
    });
    // Future: Call a Genkit flow here
    // await sendTripItineraryEmailFlow({ tripId: tripData.id, ... });
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSendItinerary} variant="outline" disabled={isSaving}>
                <Send className="mr-2 h-4 w-4" /> Send Updated Itinerary
            </Button>
            <Button variant="outline" disabled>
                <CrewIcon className="mr-2 h-4 w-4" /> Assign Crew
            </Button>
             <Button variant="outline" disabled>
                <LoadManifestIcon className="mr-2 h-4 w-4" /> View Load Manifest
            </Button>
            <Button variant="outline" disabled>
                <FileIcon className="mr-2 h-4 w-4" /> Generate Flight Log
            </Button>
            <Button onClick={() => router.push('/trips/list')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trip List
            </Button>
          </div>
        }
      />
      <TripForm 
        initialTripData={tripData} 
        isEditMode={true} 
        onSave={handleSaveTrip}
        isSaving={isSaving}
        initialQuoteId={tripData.quoteId}
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

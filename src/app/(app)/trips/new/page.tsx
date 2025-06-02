
"use client"; 

import React, { Suspense, useTransition } from 'react'; // Import useTransition
import { useRouter } from 'next/navigation'; // Import useRouter
import { PageHeader } from '@/components/page-header';
import { TripForm, type FullTripFormData } from '../edit/[tripId]/components/trip-form'; // Adjusted path
import { CalendarPlus, Loader2 } from 'lucide-react';
import { saveTrip, type SaveTripInput } from '@/ai/flows/manage-trips-flow'; // Import saveTrip
import { useToast } from '@/hooks/use-toast'; // Import useToast

function NewTripPageContent() {
  const [isSaving, startSavingTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const handleSaveTrip = async (data: FullTripFormData) => {
    startSavingTransition(async () => {
      const tripToSave: SaveTripInput = {
        tripId: data.tripId,
        selectedCustomerId: data.selectedCustomerId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        aircraftId: data.aircraftId || "UNKNOWN_AC", // Provide a fallback or ensure it's always set
        legs: data.legs.map(leg => {
          // Calculate blockTimeHours for each leg
          const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
          const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
          const flightTime = Number(leg.flightTimeHours || 0);
          const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
          const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
          return {
            ...leg,
            departureDateTime: leg.departureDateTime ? leg.departureDateTime.toISOString() : undefined,
            blockTimeHours: blockTimeHours, // Add calculated block time
          };
        }),
        notes: data.notes,
        // Default status for new trips, or get from form if added
        status: "Scheduled", 
      };

      try {
        const savedTrip = await saveTrip(tripToSave);
        toast({
          title: "Trip Created",
          description: `Trip ${savedTrip.tripId} has been successfully scheduled.`,
        });
        // Redirect to the trip details page or trip list
        router.push(`/trips/details/${savedTrip.id}`); 
      } catch (error) {
        console.error("Failed to save trip:", error);
        toast({
          title: "Error Creating Trip",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  return (
    <>
      <PageHeader 
        title="Create New Trip" 
        description="Enter the details below to schedule a new trip."
        icon={CalendarPlus}
      />
      <TripForm 
        isEditMode={false} 
        onSave={handleSaveTrip} 
        isSaving={isSaving} 
      />
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


"use client"; 

import React, { Suspense, useTransition } from 'react'; 
import { useRouter } from 'next/navigation'; 
import { PageHeader } from '@/components/page-header';
import { TripForm, type FullTripFormData } from '../edit/[tripId]/components/trip-form'; 
import { CalendarPlus, Loader2 } from 'lucide-react';
import { saveTrip, type SaveTripInput } from '@/ai/flows/manage-trips-flow'; 
import { useToast } from '@/hooks/use-toast'; 
import type { TripStatus } from '@/ai/schemas/trip-schemas'; // Ensure TripStatus is available if needed for default


function NewTripPageContent() {
  const [isSaving, startSavingTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const handleSaveTrip = async (data: FullTripFormData) => {
    startSavingTransition(async () => {
      const tripToSave: SaveTripInput = {
        tripId: data.tripId,
        // selectedCustomerId: data.selectedCustomerId, // This seems to be missing in SaveTripInput, but was in FullTripFormData
        clientName: data.clientName,
        clientEmail: data.clientEmail, // Ensure email is passed, handle optionality in schema if needed
        clientPhone: data.clientPhone,
        aircraftId: data.aircraftId || "UNKNOWN_AC", 
        aircraftLabel: data.aircraftId ? (data as any).aircraftLabel : undefined, // Pass aircraftLabel if it exists on form data
        legs: data.legs.map(leg => {
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
        notes: data.notes,
        status: data.status || "Scheduled", // Use status from form or default
      };
      
      // If selectedCustomerId exists in form data and should be part of SaveTripInput, add it.
      // This depends on the exact definition of SaveTripInput. For now, assuming it's not strictly part of it.
      if (data.selectedCustomerId) {
        (tripToSave as any).customerId = data.selectedCustomerId; // Casting if customerId is the correct field name
      }


      try {
        const savedTrip = await saveTrip(tripToSave);
        toast({
          title: "Trip Created",
          description: `Trip ${savedTrip.tripId} has been successfully scheduled.`,
        });
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


"use client"; 

import React, { Suspense, useTransition } from 'react'; 
import { useRouter } from 'next/navigation'; 
import { PageHeader } from '@/components/page-header';
import { TripForm, type FullTripFormData } from '../edit/[tripId]/components/trip-form'; 
import { CalendarPlus, Loader2 } from 'lucide-react';
import { saveTrip, type SaveTripInput } from '@/ai/flows/manage-trips-flow'; 
import { useToast } from '@/hooks/use-toast'; 
import type { TripStatus } from '@/ai/schemas/trip-schemas';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';


function NewTripPageContent() {
  const [isSaving, startSavingTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const handleSaveTrip = async (data: FullTripFormData) => {
    startSavingTransition(async () => {
      let aircraftLabelForSave: string | undefined = undefined;
      if (data.aircraftId) {
        try {
          const fleetForLabel = await fetchFleetAircraft();
          const selectedAircraftInfo = fleetForLabel.find(ac => ac.id === data.aircraftId);
          aircraftLabelForSave = selectedAircraftInfo?.model ? `${selectedAircraftInfo.tailNumber} - ${selectedAircraftInfo.model}` : selectedAircraftInfo?.tailNumber;
        } catch (e) {
            console.warn("Could not fetch aircraft details for label on new trip save", e);
        }
      }
      
      const flightAttendantIds = [data.assignedFlightAttendantId1, data.assignedFlightAttendantId2].filter(faId => faId && faId !== "--UNASSIGNED--") as string[];

      const tripToSave: SaveTripInput = {
        tripId: data.tripId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        aircraftId: data.aircraftId || "UNKNOWN_AC", 
        aircraftLabel: aircraftLabelForSave,
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
        status: data.status || "Scheduled",
        assignedPilotId: data.assignedPilotId,
        assignedCoPilotId: data.assignedCoPilotId,
        assignedFlightAttendantIds: flightAttendantIds,
      };
      
      if (data.selectedCustomerId) {
        (tripToSave as any).customerId = data.selectedCustomerId;
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

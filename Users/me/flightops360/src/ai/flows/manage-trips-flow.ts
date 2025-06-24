
'use server';
/**
 * @fileOverview Genkit flows for managing trip data using Firestore.
 *
 * - saveTrip - Saves (adds or updates) a trip.
 * - fetchTrips - Fetches all trips.
 * - fetchCurrentTrips - Fetches trips that are currently in progress.
 * - fetchUpcomingTrips - Fetches trips scheduled for the future.
 * - fetchTripById - Fetches a single trip by its ID.
 * - deleteTrip - Deletes a trip.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin'; // Use Admin SDK
import { FieldValue, Timestamp } from 'firebase-admin/firestore'; // Admin SDK specific types
import { z } from 'zod';
import type { Trip, SaveTripInput, DeleteTripInput } from '@/ai/schemas/trip-schemas';
import {
    TripSchema,
    SaveTripInputSchema,
    SaveTripOutputSchema,
    FetchTripsOutputSchema,
    FetchTripByIdInputSchema,
    DeleteTripInputSchema,
    DeleteTripOutputSchema
} from '@/ai/schemas/trip-schemas';
import { isPast, parseISO, isWithinInterval, endOfDay } from 'date-fns';


const saveTripFlow = ai.defineFlow(
  {
    name: 'saveTripFlow',
    inputSchema: InternalSaveTripInputSchema,
    outputSchema: SaveTripOutputSchema,
  },
  async ({ firestoreDocId, tripData }) => {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveTripFlow (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in saveTripFlow.");
    }
    console.log('Executing saveTripFlow with input - Firestore Doc ID:', firestoreDocId, 'Data:', JSON.stringify(tripData));
    const tripDocRef = db.collection(TRIPS_COLLECTION).doc(firestoreDocId);

    try {
      const docSnap = await tripDocRef.get();
      let finalDataToSave;

      const dataWithDefaults = {
        ...tripData,
        assignedPilotId: tripData.assignedPilotId === undefined ? null : tripData.assignedPilotId,
        assignedCoPilotId: tripData.assignedCoPilotId === undefined ? null : tripData.assignedCoPilotId,
        assignedFlightAttendantIds: tripData.assignedFlightAttendantIds || [],
      };

      if (docSnap.exists) {
        finalDataToSave = {
          ...dataWithDefaults,
          id: firestoreDocId,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: docSnap.data()?.createdAt || FieldValue.serverTimestamp(),
        };
      } else {
        finalDataToSave = {
          ...dataWithDefaults,
          id: firestoreDocId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      }

      await tripDocRef.set(finalDataToSave, { merge: true });
      console.log('Saved trip in Firestore:', firestoreDocId);

      const savedDoc = await tripDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved trip data from Firestore.");
      }

      const outputTrip: Trip = {
        ...savedData,
        id: firestoreDocId,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        assignedFlightAttendantIds: savedData.assignedFlightAttendantIds || [],
        legs: savedData.legs || [],
        assignedPilotId: savedData.assignedPilotId === null ? undefined : savedData.assignedPilotId,
        assignedCoPilotId: savedData.assignedCoPilotId === null ? undefined : savedData.assignedCoPilotId,
      } as Trip;
      return outputTrip;

    } catch (error) {
      console.error(`Error saving trip ${firestoreDocId}:`, error);
      throw new Error(`Failed to save trip ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


const fetchTripsFlow = ai.defineFlow(
  {
    name: 'fetchTripsFlow',
    outputSchema: FetchTripsOutputSchema,
  },
  async () => {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTripsFlow (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in fetchTripsFlow.");
    }
    console.log('Executing fetchTripsFlow - Firestore Admin');
    try {
      const tripsCollectionRef = db.collection(TRIPS_COLLECTION);
      const snapshot = await tripsCollectionRef.orderBy("createdAt", "desc").get();
      const tripsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          assignedFlightAttendantIds: data.assignedFlightAttendantIds || [],
          legs: data.legs || [],
          assignedPilotId: data.assignedPilotId === null ? undefined : data.assignedPilotId,
          assignedCoPilotId: data.assignedCoPilotId === null ? undefined : data.assignedCoPilotId,
        } as Trip;
      });
      console.log('Fetched trips from Firestore:', tripsList.length, 'trips.');
      return tripsList;
    } catch (error) {
      console.error('Error fetching trips from Firestore:', error);
      throw new Error(`Failed to fetch trips: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchTripByIdFlow = ai.defineFlow(
  {
    name: 'fetchTripByIdFlow',
    inputSchema: FetchTripByIdInputSchema,
    outputSchema: TripSchema.nullable(),
  },
  async (input) => {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTripByIdFlow (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in fetchTripByIdFlow.");
    }
    console.log('Executing fetchTripByIdFlow - Firestore Admin for ID:', input.id);
    try {
      const tripDocRef = db.collection(TRIPS_COLLECTION).doc(input.id);
      const docSnap = await tripDocRef.get();

      if (docSnap.exists) {
        const data = docSnap.data()!; // Use non-null assertion as we checked exists
        const trip: Trip = {
          ...data,
          id: docSnap.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          assignedFlightAttendantIds: data.assignedFlightAttendantIds || [],
          legs: data.legs || [],
          assignedPilotId: data.assignedPilotId === null ? undefined : data.assignedPilotId,
          assignedCoPilotId: data.assignedCoPilotId === null ? undefined : data.assignedCoPilotId,
        } as Trip;
        console.log('Fetched trip by ID from Firestore:', trip);
        return trip;
      } else {
        console.log('No trip found with ID:', input.id);
        return null;
      }
    } catch (error) {
      console.error('Error fetching trip by ID from Firestore:', error);
      throw new Error(`Failed to fetch trip ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


const deleteTripFlow = ai.defineFlow(
  {
    name: 'deleteTripFlow',
    inputSchema: DeleteTripInputSchema,
    outputSchema: DeleteTripOutputSchema,
  },
  async (input) => {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteTripFlow (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in deleteTripFlow.");
    }
    console.log('Executing deleteTripFlow for trip ID - Firestore Admin:', input.id);
    try {
      const tripDocRef = db.collection(TRIPS_COLLECTION).doc(input.id);
      const docSnap = await tripDocRef.get();

      if (!docSnap.exists) {
          console.warn(`Trip with ID ${input.id} not found for deletion.`);
          return { success: true, tripId: input.id }; 
      }

      await tripDocRef.delete();
      console.log('Deleted trip from Firestore:', input.id);
      return { success: true, tripId: input.id };
    } catch (error) {
      console.error('Error deleting trip from Firestore:', error);
      throw new Error(`Failed to delete trip ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


// Exported async functions that clients will call
export async function fetchTrips(): Promise<Trip[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTrips (manage-trips-flow).");
    throw new Error("Firestore admin instance (db) is not initialized in fetchTrips.");
  }
  return fetchTripsFlow();
}

export async function fetchCurrentTrips(): Promise<Trip[]> {
  const allTrips = await fetchTrips();
  const now = new Date();
  return allTrips.filter(trip => {
    const isReleased = trip.status === 'Released';
    if (!isReleased) return false;
    
    // A trip is current if it's released and today is between the first leg's departure and the last leg's departure.
    // This is a simplified logic. A more robust check might consider arrival times.
    if (!trip.legs || trip.legs.length === 0) return false;
    
    const firstLegDeparture = trip.legs[0]?.departureDateTime ? parseISO(trip.legs[0].departureDateTime) : null;
    if (!firstLegDeparture) return false;
    
    // Simplistic view: if the first leg has departed and the trip isn't yet completed/cancelled, it's 'current'.
    return isPast(firstLegDeparture) && (trip.status !== 'Completed' && trip.status !== 'Cancelled');
  });
}

export async function fetchUpcomingTrips(): Promise<Trip[]> {
    const allTrips = await fetchTrips();
    const now = new Date();
    return allTrips.filter(trip => {
        const firstLegDeparture = trip.legs?.[0]?.departureDateTime ? parseISO(trip.legs[0].departureDateTime) : null;
        const isUpcomingStatus = trip.status === 'Scheduled' || trip.status === 'Confirmed';
        return firstLegDeparture && firstLegDeparture > now && isUpcomingStatus;
    }).sort((a,b) => parseISO(a.legs![0]!.departureDateTime!).getTime() - parseISO(b.legs![0]!.departureDateTime!).getTime());
}

export async function fetchTripById(input: { id: string }): Promise<Trip | null> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTripById (manage-trips-flow).");
    throw new Error("Firestore admin instance (db) is not initialized in fetchTripById.");
  }
  return fetchTripByIdFlow(input);
}


const TRIPS_COLLECTION = 'trips';
const InternalSaveTripInputSchema = z.object({
  firestoreDocId: z.string(),
  tripData: SaveTripInputSchema,
});


export async function saveTrip(input: SaveTripInput | Trip): Promise<Trip> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveTrip (manage-trips-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveTrip.");
  }
  const firestoreDocId = (input as Trip).id || db.collection(TRIPS_COLLECTION).doc().id;
  const { id, createdAt, updatedAt, ...tripDataForFlow } = input as Trip;
  console.log('[ManageTripsFlow Firestore Admin] Attempting to save trip with Firestore ID:', firestoreDocId, 'User-facing TripID:', input.tripId);
  return saveTripFlow({ firestoreDocId, tripData: tripDataForFlow as SaveTripInput });
}


export async function deleteTrip(input: DeleteTripInput): Promise<{ success: boolean; tripId: string }> {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteTrip (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in deleteTrip.");
    }
    console.log('[ManageTripsFlow Firestore Admin] Attempting to delete trip ID:', input.id);
    return deleteTripFlow(input);
}

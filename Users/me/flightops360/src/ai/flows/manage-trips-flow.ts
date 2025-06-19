
'use server';
/**
 * @fileOverview Genkit flows for managing trip data using Firestore.
 *
 * - saveTrip - Saves (adds or updates) a trip.
 * - fetchTrips - Fetches all trips.
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

const TRIPS_COLLECTION = 'trips';

// Exported async function that clients will call
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

const InternalSaveTripInputSchema = z.object({
  firestoreDocId: z.string(),
  tripData: SaveTripInputSchema,
});

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

export async function fetchTrips(): Promise<Trip[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTrips (manage-trips-flow).");
    throw new Error("Firestore admin instance (db) is not initialized in fetchTrips.");
  }
  console.log('[ManageTripsFlow Firestore Admin] Attempting to fetch all trips.');
  return fetchTripsFlow();
}

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

export async function fetchTripById(input: { id: string }): Promise<Trip | null> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchTripById (manage-trips-flow).");
    throw new Error("Firestore admin instance (db) is not initialized in fetchTripById.");
  }
  console.log('[ManageTripsFlow Firestore Admin] Attempting to fetch trip by ID:', input.id);
  return fetchTripByIdFlow(input);
}

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

export async function deleteTrip(input: DeleteTripInput): Promise<{ success: boolean; tripId: string }> {
    if (!db) {
      console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteTrip (manage-trips-flow).");
      throw new Error("Firestore admin instance (db) is not initialized in deleteTrip.");
    }
    console.log('[ManageTripsFlow Firestore Admin] Attempting to delete trip ID:', input.id);
    return deleteTripFlow(input);
}

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

    
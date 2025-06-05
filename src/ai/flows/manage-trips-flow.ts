
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
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
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
// Input is now the full Trip object which might include 'id' for updates, or SaveTripInput for new trips
export async function saveTrip(input: SaveTripInput | Trip): Promise<Trip> {
  // Use input.id if provided (for updates), otherwise generate a new Firestore document ID
  const firestoreDocId = (input as Trip).id || doc(collection(db, TRIPS_COLLECTION)).id;

  // Prepare data for the flow: exclude 'id', 'createdAt', 'updatedAt' from the data payload
  // as these are handled by Firestore or are part of the document key.
  const { id, createdAt, updatedAt, ...tripDataForFlow } = input as Trip;

  console.log('[ManageTripsFlow Firestore] Attempting to save trip with Firestore ID:', firestoreDocId, 'User-facing TripID:', input.tripId);
  // Pass the determined firestoreDocId and the cleaned tripData to the internal flow
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
    console.log('Executing saveTripFlow with input - Firestore Doc ID:', firestoreDocId, 'Data:', JSON.stringify(tripData));

    const tripDocRef = doc(db, TRIPS_COLLECTION, firestoreDocId);

    try {
      const docSnap = await getDoc(tripDocRef);
      let finalDataToSave;

      // Ensure crew assignment arrays are initialized if not provided,
      // and string fields are null if undefined.
      const dataWithDefaults = {
        ...tripData,
        assignedPilotId: tripData.assignedPilotId === undefined ? null : tripData.assignedPilotId,
        assignedCoPilotId: tripData.assignedCoPilotId === undefined ? null : tripData.assignedCoPilotId,
        assignedFlightAttendantIds: tripData.assignedFlightAttendantIds || [],
      };

      if (docSnap.exists()) {
        // Document exists, prepare for update
        finalDataToSave = {
          ...dataWithDefaults, // User-provided data with defaults
          id: firestoreDocId,
          updatedAt: serverTimestamp(),
          createdAt: docSnap.data().createdAt || serverTimestamp(), // Preserve original createdAt if it exists
        };
      } else {
        // New document, set both timestamps
        finalDataToSave = {
          ...dataWithDefaults,
          id: firestoreDocId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      }

      await setDoc(tripDocRef, finalDataToSave, { merge: true });
      console.log('Saved trip in Firestore:', firestoreDocId);

      const savedDoc = await getDoc(tripDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved trip data from Firestore.");
      }

      // Construct the output Trip object, ensuring all fields are present as per TripSchema
      const outputTrip: Trip = {
        ...savedData, // Spread saved data first
        id: firestoreDocId, // Override with the correct ID
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        // Ensure array fields are present even if they were undefined in Firestore
        assignedFlightAttendantIds: savedData.assignedFlightAttendantIds || [],
        legs: savedData.legs || [],
        assignedPilotId: savedData.assignedPilotId === null ? undefined : savedData.assignedPilotId,
        assignedCoPilotId: savedData.assignedCoPilotId === null ? undefined : savedData.assignedCoPilotId,
      } as Trip; // Assert type
      return outputTrip;

    } catch (error) {
      console.error(`Error saving trip ${firestoreDocId}:`, error);
      throw new Error(`Failed to save trip ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

export async function fetchTrips(): Promise<Trip[]> {
  console.log('[ManageTripsFlow Firestore] Attempting to fetch all trips.');
  return fetchTripsFlow();
}

const fetchTripsFlow = ai.defineFlow(
  {
    name: 'fetchTripsFlow',
    outputSchema: FetchTripsOutputSchema,
  },
  async () => {
    console.log('Executing fetchTripsFlow - Firestore');
    try {
      const tripsCollectionRef = collection(db, TRIPS_COLLECTION);
      const q = query(tripsCollectionRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const tripsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          assignedFlightAttendantIds: data.assignedFlightAttendantIds || [], // ensure array on output
          legs: data.legs || [], // ensure array on output
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
  console.log('[ManageTripsFlow Firestore] Attempting to fetch trip by ID:', input.id);
  return fetchTripByIdFlow(input);
}

const fetchTripByIdFlow = ai.defineFlow(
  {
    name: 'fetchTripByIdFlow',
    inputSchema: FetchTripByIdInputSchema,
    outputSchema: TripSchema.nullable(),
  },
  async (input) => {
    console.log('Executing fetchTripByIdFlow - Firestore for ID:', input.id);
    try {
      const tripDocRef = doc(db, TRIPS_COLLECTION, input.id);
      const docSnap = await getDoc(tripDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
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
    console.log('[ManageTripsFlow Firestore] Attempting to delete trip ID:', input.id);
    return deleteTripFlow(input);
}

const deleteTripFlow = ai.defineFlow(
  {
    name: 'deleteTripFlow',
    inputSchema: DeleteTripInputSchema,
    outputSchema: DeleteTripOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteTripFlow for trip ID - Firestore:', input.id);
    try {
      const tripDocRef = doc(db, TRIPS_COLLECTION, input.id);
      const docSnap = await getDoc(tripDocRef);

      if (!docSnap.exists()) {
          console.warn(`Trip with ID ${input.id} not found for deletion.`);
          return { success: true, tripId: input.id }; // Considered success if already gone
      }

      await deleteDoc(tripDocRef);
      console.log('Deleted trip from Firestore:', input.id);
      return { success: true, tripId: input.id };
    } catch (error) {
      console.error('Error deleting trip from Firestore:', error);
      throw new Error(`Failed to delete trip ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

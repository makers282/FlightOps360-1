
'use server';
/**
 * @fileOverview Genkit flows for managing trip data using Firestore.
 *
 * - saveTrip - Saves (adds or updates) a trip.
 * - fetchTrips - Fetches all trips.
 * - deleteTrip - Deletes a trip (to be implemented later).
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { Trip, SaveTripInput } from '@/ai/schemas/trip-schemas';
import { 
    TripSchema,
    SaveTripInputSchema, 
    SaveTripOutputSchema,
    FetchTripsOutputSchema,
    // DeleteTripInputSchema, 
    // DeleteTripOutputSchema 
} from '@/ai/schemas/trip-schemas';

const TRIPS_COLLECTION = 'trips';

// Exported async function that clients will call
export async function saveTrip(input: SaveTripInput): Promise<Trip> {
  // If tripId (user-facing) is not provided in input, but a Firestore ID might exist from an edit context,
  // we need to ensure we're using a consistent Firestore document ID.
  // For new trips, a Firestore ID will be auto-generated.
  const firestoreDocId = input.tripId && (await getDoc(doc(db, TRIPS_COLLECTION, input.tripId))).exists() 
    ? input.tripId // If input.tripId is an existing Firestore ID
    : doc(collection(db, TRIPS_COLLECTION)).id; // Generate new Firestore ID

  console.log('[ManageTripsFlow Firestore] Attempting to save trip with Firestore ID:', firestoreDocId, 'User-facing TripID:', input.tripId);
  return saveTripFlow({ firestoreDocId, tripData: input });
}

// Internal schema for the flow to handle firestoreDocId explicitly
const InternalSaveTripInputSchema = z.object({
  firestoreDocId: z.string(),
  tripData: SaveTripInputSchema, // This already has `tripId` (user-facing)
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

      if (docSnap.exists()) {
        // Update existing trip
        finalDataToSave = {
          ...tripData, // Contains user-facing tripId
          id: firestoreDocId, // Ensure Firestore ID is set for the document
          updatedAt: serverTimestamp(),
          // Preserve original createdAt
          createdAt: docSnap.data().createdAt || serverTimestamp(), 
        };
      } else {
        // Create new trip
        finalDataToSave = {
          ...tripData, // Contains user-facing tripId
          id: firestoreDocId, // Ensure Firestore ID is set for the document
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      }
      
      await setDoc(tripDocRef, finalDataToSave, { merge: true });
      console.log('Saved trip in Firestore:', firestoreDocId);

      // Refetch to get accurate server timestamps
      const savedDoc = await getDoc(tripDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved trip data from Firestore.");
      }
      
      // Convert Firestore Timestamps to ISO strings for the output
      const outputTrip: Trip = {
        ...savedData,
        id: firestoreDocId, // Ensure the output.id is the Firestore document ID
        // tripId is already part of savedData from tripData
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Trip; // Cast to Trip type
      return outputTrip;

    } catch (error) {
      console.error('Error saving trip to Firestore:', error);
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
      const q = query(tripsCollectionRef, orderBy("createdAt", "desc")); // Example sort, adjust as needed
      const snapshot = await getDocs(q);
      const tripsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id, // Ensure the id is the Firestore document ID
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
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

// DeleteTrip flow would be similar, using DeleteTripInputSchema and DeleteTripOutputSchema
// export async function deleteTrip(input: { tripId: string }): Promise<{ success: boolean; tripId: string }> {
//   return deleteTripFlow(input);
// }
// const deleteTripFlow = ai.defineFlow(...)


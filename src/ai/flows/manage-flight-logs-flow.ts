
'use server';
/**
 * @fileOverview Genkit flows for managing flight log data using Firestore.
 *
 * - saveFlightLogLeg - Saves (adds or updates) a flight log for a specific trip leg.
 * - fetchFlightLogForLeg - Fetches the flight log for a specific trip leg.
 * - deleteFlightLogLeg - Deletes a flight log entry.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { FlightLogLeg, SaveFlightLogLegInput, FetchFlightLogLegInput } from '@/ai/schemas/flight-log-schemas';
import { 
    FlightLogLegSchema, // For output validation
    SaveFlightLogLegInputSchema, // Input to save function (data + tripId, legIndex)
    FetchFlightLogLegInputSchema, // Input to fetch function
    FetchFlightLogLegOutputSchema, // Output of fetch function (FlightLogLegSchema.nullable())
    DeleteFlightLogLegInputSchema,
    DeleteFlightLogLegOutputSchema
} from '@/ai/schemas/flight-log-schemas';

const FLIGHT_LOGS_COLLECTION = 'flightLogs';

// Helper to create a composite document ID
const getFlightLogDocId = (tripId: string, legIndex: number): string => `${tripId}_${legIndex}`;

// Exported async functions that clients will call
export async function saveFlightLogLeg(input: SaveFlightLogLegInput): Promise<FlightLogLeg> {
  console.log('[ManageFlightLogsFlow Firestore] Attempting to save flight log for Trip ID:', input.tripId, 'Leg Index:', input.legIndex);
  return saveFlightLogLegFlow(input);
}

export async function fetchFlightLogForLeg(input: FetchFlightLogLegInput): Promise<FlightLogLeg | null> {
  console.log('[ManageFlightLogsFlow Firestore] Attempting to fetch flight log for Trip ID:', input.tripId, 'Leg Index:', input.legIndex);
  return fetchFlightLogForLegFlow(input);
}

export async function deleteFlightLogLeg(input: { flightLogId: string }): Promise<{ success: boolean; flightLogId: string }> {
    console.log('[ManageFlightLogsFlow Firestore] Attempting to delete flight log ID:', input.flightLogId);
    return deleteFlightLogLegFlow(input);
}


// Genkit Flow Definitions
const saveFlightLogLegFlow = ai.defineFlow(
  {
    name: 'saveFlightLogLegFlow',
    inputSchema: SaveFlightLogLegInputSchema,
    outputSchema: FlightLogLegSchema, // Returns the full log entry with timestamps
  },
  async (flightLogData) => {
    const { tripId, legIndex, ...logData } = flightLogData;
    const docId = getFlightLogDocId(tripId, legIndex);
    const logDocRef = doc(db, FLIGHT_LOGS_COLLECTION, docId);
    
    console.log('Executing saveFlightLogLegFlow - Firestore, Doc ID:', docId);
    
    try {
      const docSnap = await getDoc(logDocRef);
      const dataToSet = {
        id: docId, // Store the docId within the document as well
        tripId,
        legIndex,
        ...logData,
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(logDocRef, dataToSet, { merge: true }); // Merge true to update if exists
      console.log('Saved flight log in Firestore:', docId);

      const savedDoc = await getDoc(logDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved flight log data from Firestore.");
      }
      
      return {
        ...savedData,
        // Ensure Timestamps are converted to ISO strings for client compatibility
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as FlightLogLeg; // Cast to ensure type match for output schema

    } catch (error) {
      console.error('Error saving flight log to Firestore:', error);
      throw new Error(`Failed to save flight log ${docId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchFlightLogForLegFlow = ai.defineFlow(
  {
    name: 'fetchFlightLogForLegFlow',
    inputSchema: FetchFlightLogLegInputSchema,
    outputSchema: FetchFlightLogLegOutputSchema, // This is FlightLogLegSchema.nullable()
  },
  async ({ tripId, legIndex }) => {
    const docId = getFlightLogDocId(tripId, legIndex);
    const logDocRef = doc(db, FLIGHT_LOGS_COLLECTION, docId);
    console.log('Executing fetchFlightLogForLegFlow - Firestore for Doc ID:', docId);
    
    try {
      const docSnap = await getDoc(logDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Fetched flight log from Firestore:', docId);
        return {
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as FlightLogLeg;
      } else {
        console.log('No flight log found for Doc ID:', docId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching flight log from Firestore:', error);
      throw new Error(`Failed to fetch flight log ${docId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteFlightLogLegFlow = ai.defineFlow(
  {
    name: 'deleteFlightLogLegFlow',
    inputSchema: DeleteFlightLogLegInputSchema,
    outputSchema: DeleteFlightLogLegOutputSchema,
  },
  async ({ flightLogId }) => {
    // Assuming flightLogId is the composite ID like 'tripId_legIndex'
    console.log('Executing deleteFlightLogLegFlow for flight log ID - Firestore:', flightLogId);
    try {
      const logDocRef = doc(db, FLIGHT_LOGS_COLLECTION, flightLogId);
      const docSnap = await getDoc(logDocRef);

      if (!docSnap.exists()) {
          console.warn(`Flight log with ID ${flightLogId} not found for deletion.`);
          return { success: false, flightLogId: flightLogId };
      }
      
      await deleteDoc(logDocRef);
      console.log('Deleted flight log from Firestore:', flightLogId);
      return { success: true, flightLogId: flightLogId };
    } catch (error) {
      console.error('Error deleting flight log from Firestore:', error);
      throw new Error(`Failed to delete flight log ${flightLogId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

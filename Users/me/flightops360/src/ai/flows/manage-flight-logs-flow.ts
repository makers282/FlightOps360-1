
'use server';
/**
 * @fileOverview Genkit flows for managing flight log data using Firestore.
 *
 * - saveFlightLogLeg - Saves (adds or updates) a flight log for a specific trip leg and updates aircraft component times.
 * - fetchFlightLogForLeg - Fetches the flight log for a specific trip leg.
 * - deleteFlightLogLeg - Deletes a flight log entry.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { FlightLogLeg, SaveFlightLogLegInput, FetchFlightLogLegInput, FlightLogLegData } from '@/ai/schemas/flight-log-schemas';
import { 
    FlightLogLegSchema,
    SaveFlightLogLegInputSchema,
    FetchFlightLogLegInputSchema,
    FetchFlightLogLegOutputSchema,
    DeleteFlightLogLegInputSchema,
    DeleteFlightLogLegOutputSchema
} from '@/ai/schemas/flight-log-schemas';

// For updating component times
import { fetchTripById, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchComponentTimesForAircraft, saveComponentTimesForAircraft, type AircraftComponentTimes, type ComponentTimeData } from '@/ai/flows/manage-component-times-flow';
import { parse as parseTime, differenceInMinutes } from 'date-fns';


const FLIGHT_LOGS_COLLECTION = 'flightLogs';

// Helper to create a composite document ID
const getFlightLogDocId = (tripId: string, legIndex: number): string => `${tripId}_${legIndex}`;

// Helper to calculate flight duration in decimal hours from FlightLogLegData
function calculateFlightDurationFromLog(logData: FlightLogLegData): number {
  if (typeof logData.hobbsTakeOff === 'number' && typeof logData.hobbsLanding === 'number' && logData.hobbsLanding > logData.hobbsTakeOff) {
    return parseFloat((logData.hobbsLanding - logData.hobbsTakeOff).toFixed(2));
  }
  if (logData.takeOffTime && logData.landingTime) {
    try {
      const today = new Date().toISOString().split('T')[0]; 
      const takeOffDateTime = parseTime(logData.takeOffTime, 'HH:mm', new Date(`${today}T00:00:00Z`));
      let landingDateTime = parseTime(logData.landingTime, 'HH:mm', new Date(`${today}T00:00:00Z`));

      if (landingDateTime < takeOffDateTime) { 
        landingDateTime = new Date(landingDateTime.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const diffMins = differenceInMinutes(landingDateTime, takeOffDateTime);
      if (diffMins < 0) return 0;
      
      return parseFloat((diffMins / 60).toFixed(2));
    } catch (e) {
      console.error("Error parsing flight times from log for duration calculation:", e);
      return 0;
    }
  }
  return 0;
}


// Exported async functions that clients will call
export async function saveFlightLogLeg(input: SaveFlightLogLegInput): Promise<FlightLogLeg> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveFlightLogLeg (manage-flight-logs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveFlightLogLeg.");
  }
  console.log('[ManageFlightLogsFlow Firestore Admin] Attempting to save flight log for Trip ID:', input.tripId, 'Leg Index:', input.legIndex);
  return saveFlightLogLegFlow(input);
}

export async function fetchFlightLogForLeg(input: FetchFlightLogLegInput): Promise<FlightLogLeg | null> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchFlightLogForLeg (manage-flight-logs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchFlightLogForLeg.");
  }
  console.log('[ManageFlightLogsFlow Firestore Admin] Attempting to fetch flight log for Trip ID:', input.tripId, 'Leg Index:', input.legIndex);
  return fetchFlightLogForLegFlow(input);
}

export async function deleteFlightLogLeg(input: { flightLogId: string }): Promise<{ success: boolean; flightLogId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteFlightLogLeg (manage-flight-logs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteFlightLogLeg.");
  }
    console.log('[ManageFlightLogsFlow Firestore Admin] Attempting to delete flight log ID:', input.flightLogId);
    return deleteFlightLogLegFlow(input);
}


// Genkit Flow Definitions
const saveFlightLogLegFlow = ai.defineFlow(
  {
    name: 'saveFlightLogLegFlow',
    inputSchema: SaveFlightLogLegInputSchema,
    outputSchema: FlightLogLegSchema, 
  },
  async (flightLogInputData) => { 
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveFlightLogLegFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveFlightLogLegFlow.");
    }
    const { tripId, legIndex, ...logDataForDoc } = flightLogInputData;
    const docId = getFlightLogDocId(tripId, legIndex);
    const logDocRef = db.collection(FLIGHT_LOGS_COLLECTION).doc(docId);
    
    console.log('Executing saveFlightLogLegFlow - Firestore, Doc ID:', docId);
    
    try {
      const docSnap = await logDocRef.get();
      const dataToSetInLogDoc = {
        id: docId, 
        tripId,
        legIndex,
        ...logDataForDoc,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await logDocRef.set(dataToSetInLogDoc, { merge: true });
      console.log('Saved flight log in Firestore:', docId);

      const savedLogDoc = await logDocRef.get();
      const savedLogDataFromDb = savedLogDoc.data();

      if (!savedLogDataFromDb) {
        throw new Error("Failed to retrieve saved flight log data from Firestore.");
      }
      
      const tripDetails = await fetchTripById({ id: tripId });
      if (tripDetails && tripDetails.aircraftId) {
        const aircraftId = tripDetails.aircraftId;
        const allFleet = await fetchFleetAircraft();
        const aircraftDetails = allFleet.find(ac => ac.id === aircraftId);
        
        if (aircraftDetails && aircraftDetails.isMaintenanceTracked) {
          let currentComponentTimes = await fetchComponentTimesForAircraft({ aircraftId }) || {};
          
          const legFlightDuration = calculateFlightDurationFromLog(logDataForDoc as FlightLogLegData);
          const legCycles = 1; 
          const apuTime = Number(logDataForDoc.postLegApuTimeDecimal || 0);

          (aircraftDetails.trackedComponentNames || ['Airframe', 'Engine 1']).forEach(componentName => {
            const compKey = componentName.trim();
            if (!currentComponentTimes[compKey]) {
              currentComponentTimes[compKey] = { time: 0, cycles: 0 };
            }
            let component = currentComponentTimes[compKey] as ComponentTimeData;

            if (compKey.toLowerCase().startsWith('engine') || compKey.toLowerCase() === 'airframe' || compKey.toLowerCase().startsWith('propeller')) {
              component.time = parseFloat(((component.time || 0) + legFlightDuration).toFixed(2));
              component.cycles = (component.cycles || 0) + legCycles;
            } else if (compKey.toLowerCase() === 'apu' && apuTime > 0) {
              component.time = parseFloat(((component.time || 0) + apuTime).toFixed(2));
            }
             currentComponentTimes[compKey] = component;
          });
          
          await saveComponentTimesForAircraft({ aircraftId, componentTimes: currentComponentTimes });
          console.log(`Updated component times for aircraft ${aircraftId} based on flight log ${docId}.`);
        } else if (aircraftDetails && !aircraftDetails.isMaintenanceTracked) {
          console.log(`Aircraft ${aircraftId} is not maintenance tracked. Skipping component time update.`);
        } else {
          console.warn(`Could not find aircraft details for ID: ${aircraftId} to update component times.`);
        }
      } else {
        console.warn(`Trip ${tripId} or its aircraftId not found. Cannot update component times.`);
      }

      return {
        ...savedLogDataFromDb,
        createdAt: (savedLogDataFromDb.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedLogDataFromDb.updatedAt as Timestamp)?.toDate().toISOString(),
      } as FlightLogLeg; 

    } catch (error) {
      console.error('Error saving flight log to Firestore or updating component times:', error);
      throw new Error(`Failed to save flight log ${docId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchFlightLogForLegFlow = ai.defineFlow(
  {
    name: 'fetchFlightLogForLegFlow',
    inputSchema: FetchFlightLogLegInputSchema,
    outputSchema: FetchFlightLogLegOutputSchema, 
  },
  async ({ tripId, legIndex }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchFlightLogForLegFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchFlightLogForLegFlow.");
    }
    const docId = getFlightLogDocId(tripId, legIndex);
    const logDocRef = db.collection(FLIGHT_LOGS_COLLECTION).doc(docId);
    console.log('Executing fetchFlightLogForLegFlow - Firestore for Doc ID:', docId);
    
    try {
      const docSnap = await logDocRef.get();
      if (docSnap.exists) {
        const data = docSnap.data()!;
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteFlightLogLegFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteFlightLogLegFlow.");
    }
    console.log('Executing deleteFlightLogLegFlow for flight log ID - Firestore:', flightLogId);
    try {
      const logDocRef = db.collection(FLIGHT_LOGS_COLLECTION).doc(flightLogId);
      const docSnap = await logDocRef.get();

      if (!docSnap.exists) {
          console.warn(`Flight log with ID ${flightLogId} not found for deletion.`);
          return { success: false, flightLogId: flightLogId };
      }
      
      await logDocRef.delete();
      console.log('Deleted flight log from Firestore:', flightLogId);
      return { success: true, flightLogId: flightLogId };
    } catch (error) {
      console.error('Error deleting flight log from Firestore:', error);
      throw new Error(`Failed to delete flight log ${flightLogId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

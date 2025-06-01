
'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet using Firestore.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';

// Define the structure for an engine detail
const EngineDetailSchema = z.object({
  model: z.string().optional().describe("Engine model."),
  serialNumber: z.string().optional().describe("Engine serial number."),
});
export type EngineDetail = z.infer<typeof EngineDetailSchema>;

// Define the structure for a fleet aircraft
const FleetAircraftSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft, typically the tail number if unique, or an auto-generated ID."),
  tailNumber: z.string().min(1, "Tail number is required.").describe("The aircraft's tail number (e.g., N123AB)."),
  model: z.string().min(1, "Aircraft model is required.").describe("The aircraft model (e.g., Cessna Citation CJ3)."),
  serialNumber: z.string().optional().describe("Aircraft serial number."),
  aircraftYear: z.number().int().min(1900).max(new Date().getFullYear() + 10).optional().describe("Year of manufacture."),
  baseLocation: z.string().optional().describe("Primary base location of the aircraft (e.g., KTEB)."),
  engineDetails: z.array(EngineDetailSchema).optional().default([]).describe("Details for each engine."),
  isMaintenanceTracked: z.boolean().optional().default(true).describe("Whether maintenance tracking is enabled for this aircraft."),
  trackedComponentNames: z.array(z.string()).optional().default(['Airframe', 'Engine 1']).describe("List of component names to track hours/cycles for (e.g., Airframe, Engine 1, Propeller 1)."),
  primaryContactName: z.string().optional().describe("Primary contact person for the aircraft."),
  primaryContactPhone: z.string().optional().describe("Primary contact phone for the aircraft."),
  primaryContactEmail: z.string().email("Invalid email format.").optional().describe("Primary contact email for the aircraft."),
  internalNotes: z.string().optional().describe("Internal operational notes like hangar location, access codes, etc."),
});
export type FleetAircraft = z.infer<typeof FleetAircraftSchema>;

// Schemas for flow inputs and outputs
const SaveFleetAircraftInputSchema = FleetAircraftSchema;
export type SaveFleetAircraftInput = z.infer<typeof SaveFleetAircraftInputSchema>;

const DeleteFleetAircraftInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft to delete from the fleet."),
});
export type DeleteFleetAircraftInput = z.infer<typeof DeleteFleetAircraftInputSchema>;

const FetchFleetAircraftOutputSchema = z.array(FleetAircraftSchema);
const SaveFleetAircraftOutputSchema = FleetAircraftSchema;
const DeleteFleetAircraftOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

const FLEET_COLLECTION = 'fleet';
const AIRCRAFT_RATES_COLLECTION = 'aircraftRates'; // For cascading delete

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow Firestore] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow Firestore WRAPPER] Received input for save:', input.id, 'Data:', JSON.stringify(input));
  
  // Prepare the data for the flow, ensuring nulls for optional fields become undefined
  const aircraftToSave: FleetAircraft = {
    ...input, // Spread first to get all fields including id, tailNumber, model
    serialNumber: input.serialNumber === null ? undefined : input.serialNumber,
    aircraftYear: input.aircraftYear === null ? undefined : input.aircraftYear,
    baseLocation: input.baseLocation === null ? undefined : input.baseLocation,
    primaryContactName: input.primaryContactName === null ? undefined : input.primaryContactName,
    primaryContactPhone: input.primaryContactPhone === null ? undefined : input.primaryContactPhone,
    primaryContactEmail: input.primaryContactEmail === null ? undefined : input.primaryContactEmail,
    internalNotes: input.internalNotes === null ? undefined : input.internalNotes,
    
    // Fields with existing default handling or different types
    isMaintenanceTracked: input.isMaintenanceTracked ?? true,
    trackedComponentNames: (input.trackedComponentNames && input.trackedComponentNames.length > 0) ? input.trackedComponentNames : ['Airframe', 'Engine 1'],
    engineDetails: input.engineDetails || [],
  };
  console.log('[ManageFleetFlow Firestore WRAPPER] Data prepared for flow:', aircraftToSave.id, 'Data:', JSON.stringify(aircraftToSave));
  return saveFleetAircraftFlow(aircraftToSave);
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageFleetFlow Firestore] Attempting to delete fleet aircraft:', input.aircraftId);
  return deleteFleetAircraftFlow(input);
}

// Genkit Flow Definitions
const fetchFleetAircraftFlow = ai.defineFlow(
  {
    name: 'fetchFleetAircraftFlow',
    outputSchema: FetchFleetAircraftOutputSchema,
  },
  async () => {
    console.log('Executing fetchFleetAircraftFlow - Firestore');
    try {
      const fleetCollectionRef = collection(db, FLEET_COLLECTION);
      const snapshot = await getDocs(fleetCollectionRef);
      const aircraftList = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure defaults for fields that might be missing in older documents
        return {
          id: doc.id,
          tailNumber: data.tailNumber || '', 
          model: data.model || '', 
          serialNumber: data.serialNumber || undefined,
          aircraftYear: data.aircraftYear === null ? null : (data.aircraftYear || undefined), // Preserve null from DB if explicitly set, else undefined
          baseLocation: data.baseLocation || undefined,
          engineDetails: data.engineDetails || [], 
          isMaintenanceTracked: data.isMaintenanceTracked === undefined ? true : data.isMaintenanceTracked,
          trackedComponentNames: data.trackedComponentNames || ['Airframe', 'Engine 1'],
          primaryContactName: data.primaryContactName || undefined,
          primaryContactPhone: data.primaryContactPhone || undefined,
          primaryContactEmail: data.primaryContactEmail || undefined,
          internalNotes: data.internalNotes || undefined,
        } as FleetAircraft;
      });
      console.log('Fetched fleet from Firestore:', aircraftList.length, 'aircraft.');
      return aircraftList;
    } catch (error) {
      console.error('Error fetching fleet from Firestore:', error);
      throw new Error(`Failed to fetch fleet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveFleetAircraftFlow = ai.defineFlow(
  {
    name: 'saveFleetAircraftFlow',
    inputSchema: SaveFleetAircraftInputSchema, // This is FleetAircraftSchema
    outputSchema: SaveFleetAircraftOutputSchema,
  },
  async (input) => { // input here has already been cleaned by the wrapper
    console.log('Executing saveFleetAircraftFlow (FLOW INPUT) with input - Firestore:', JSON.stringify(input));
    try {
      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.id);
      // Data to set for Firestore can use null where appropriate if fields are undefined.
      // Firestore handles undefined by not writing the field (good for merge:true)
      // or explicitly set to null if that's desired.
      const dataToSet = {
        tailNumber: input.tailNumber,
        model: input.model,
        serialNumber: input.serialNumber === undefined ? null : input.serialNumber,
        aircraftYear: input.aircraftYear === undefined ? null : input.aircraftYear,
        baseLocation: input.baseLocation === undefined ? null : input.baseLocation,
        engineDetails: input.engineDetails ?? [],
        isMaintenanceTracked: input.isMaintenanceTracked ?? true,
        trackedComponentNames: input.trackedComponentNames ?? ['Airframe', 'Engine 1'],
        primaryContactName: input.primaryContactName === undefined ? null : input.primaryContactName,
        primaryContactPhone: input.primaryContactPhone === undefined ? null : input.primaryContactPhone,
        primaryContactEmail: input.primaryContactEmail === undefined ? null : input.primaryContactEmail,
        internalNotes: input.internalNotes === undefined ? null : input.internalNotes,
      };
      await setDoc(aircraftDocRef, dataToSet, { merge: true }); 
      console.log('Saved/Updated aircraft in Firestore:', input.id);
      // Return the input which is already compliant with FleetAircraft schema
      return input; 
    } catch (error) {
      console.error('Error saving aircraft to Firestore:', error);
      throw new Error(`Failed to save aircraft ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteFleetAircraftFlow = ai.defineFlow(
  {
    name: 'deleteFleetAircraftFlow',
    inputSchema: DeleteFleetAircraftInputSchema,
    outputSchema: DeleteFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteFleetAircraftFlow for ID - Firestore:', input.aircraftId);
    try {
      const batch = writeBatch(db);

      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.aircraftId);
      batch.delete(aircraftDocRef);

      const aircraftRateDocRef = doc(db, AIRCRAFT_RATES_COLLECTION, input.aircraftId);
      batch.delete(aircraftRateDocRef);
      
      await batch.commit();
      console.log('Deleted fleet aircraft and associated rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft from Firestore:', error);
      throw new Error(`Failed to delete aircraft ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet using mock in-memory storage.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the structure for a fleet aircraft
const FleetAircraftSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft, typically the tail number if unique, or an auto-generated ID."),
  tailNumber: z.string().min(1, "Tail number is required.").describe("The aircraft's tail number (e.g., N123AB)."),
  model: z.string().min(1, "Aircraft model is required.").describe("The aircraft model (e.g., Cessna Citation CJ3)."),
  isMaintenanceTracked: z.boolean().optional().default(true).describe("Whether maintenance tracking is enabled for this aircraft."),
  trackedComponentNames: z.array(z.string()).optional().default(['Airframe', 'Engine 1']).describe("List of component names to track hours/cycles for (e.g., Airframe, Engine 1, Propeller 1)."),
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

// Mock in-memory storage
let MOCK_FLEET_AIRCRAFT_DATA: FleetAircraft[] = [
  { id: 'N123AB', tailNumber: 'N123AB', model: 'Cessna Citation CJ3', isMaintenanceTracked: true, trackedComponentNames: ['Airframe', 'Engine 1', 'Engine 2', 'APU'] },
  { id: 'N456CD', tailNumber: 'N456CD', model: 'Bombardier Global 6000', isMaintenanceTracked: true, trackedComponentNames: ['Airframe', 'Engine 1', 'Engine 2', 'APU'] },
  { id: 'N789EF', tailNumber: 'N789EF', model: 'Gulfstream G650ER', isMaintenanceTracked: true, trackedComponentNames: ['Airframe', 'Engine 1', 'Engine 2', 'APU', 'Air Conditioning'] },
  { id: 'N630MW', tailNumber: 'N630MW', model: 'Pilatus PC-12 NG', isMaintenanceTracked: false, trackedComponentNames: ['Airframe', 'Engine 1', 'Propeller 1'] }, 
];

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow MOCK] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow MOCK] Attempting to save fleet aircraft:', input.id, 'Tracked:', input.isMaintenanceTracked, 'Components:', input.trackedComponentNames);
  const aircraftToSave: FleetAircraft = {
    ...input,
    isMaintenanceTracked: input.isMaintenanceTracked ?? true, 
    trackedComponentNames: input.trackedComponentNames && input.trackedComponentNames.length > 0 ? input.trackedComponentNames : ['Airframe', 'Engine 1'], // Ensure default if empty
  };
  return saveFleetAircraftFlow(aircraftToSave);
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageFleetFlow MOCK] Attempting to delete fleet aircraft:', input.aircraftId);
  return deleteFleetAircraftFlow(input);
}

// Genkit Flow Definitions
const fetchFleetAircraftFlow = ai.defineFlow(
  {
    name: 'fetchFleetAircraftFlow',
    outputSchema: FetchFleetAircraftOutputSchema,
  },
  async () => {
    console.log('Executing fetchFleetAircraftFlow - MOCK');
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Fetched fleet from MOCK_FLEET_AIRCRAFT_DATA:', MOCK_FLEET_AIRCRAFT_DATA.length, 'aircraft.');
    return MOCK_FLEET_AIRCRAFT_DATA;
  }
);

const saveFleetAircraftFlow = ai.defineFlow(
  {
    name: 'saveFleetAircraftFlow',
    inputSchema: SaveFleetAircraftInputSchema,
    outputSchema: SaveFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing saveFleetAircraftFlow with input - MOCK:', input);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const existingIndex = MOCK_FLEET_AIRCRAFT_DATA.findIndex(ac => ac.id === input.id);
    if (existingIndex !== -1) {
      MOCK_FLEET_AIRCRAFT_DATA[existingIndex] = input; 
      console.log('Updated aircraft in MOCK_FLEET_AIRCRAFT_DATA:', input);
    } else {
      MOCK_FLEET_AIRCRAFT_DATA.push(input); 
      console.log('Added new aircraft to MOCK_FLEET_AIRCRAFT_DATA:', input);
    }
    return input;
  }
);

const deleteFleetAircraftFlow = ai.defineFlow(
  {
    name: 'deleteFleetAircraftFlow',
    inputSchema: DeleteFleetAircraftInputSchema,
    outputSchema: DeleteFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteFleetAircraftFlow for ID - MOCK:', input.aircraftId);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialLength = MOCK_FLEET_AIRCRAFT_DATA.length;
    MOCK_FLEET_AIRCRAFT_DATA = MOCK_FLEET_AIRCRAFT_DATA.filter(ac => ac.id !== input.aircraftId);
    const success = MOCK_FLEET_AIRCRAFT_DATA.length < initialLength;
    
    if (success) {
      console.log('Deleted fleet aircraft from MOCK_FLEET_AIRCRAFT_DATA:', input.aircraftId);
    } else {
      console.warn(`Aircraft with ID ${input.aircraftId} not found for deletion in MOCK_FLEET_AIRCRAFT_DATA.`);
    }
    return { success, aircraftId: input.aircraftId };
  }
);

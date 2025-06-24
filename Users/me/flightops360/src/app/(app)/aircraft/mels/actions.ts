

'use server';

import { fetchAllMelItems } from '@/ai/flows/manage-mel-items-flow';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';

export async function getMelsAndFleetData() {
  try {
    const [melItems, fleet] = await Promise.all([
      fetchAllMelItems(),
      fetchFleetAircraft(),
    ]);
    return { melItems, fleet };
  } catch (error) {
    console.error("Error in getMelsAndFleetData server action:", error);
    // Re-throw the error to be caught by the client-side component
    throw new Error(`Failed to fetch data: ${error instanceof Error ? error.message : "An unexpected server error occurred."}`);
  }
}

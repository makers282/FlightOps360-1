
'use server';

import { fetchAllMelItems } from '@/ai/flows/manage-mel-items-flow';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';

export async function getMelsAndFleetData() {
  const [melItems, fleet] = await Promise.all([
    fetchAllMelItems(),
    fetchFleetAircraft(),
  ]);
  return { melItems, fleet };
}

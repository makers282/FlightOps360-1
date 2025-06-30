
"use server";

import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';

// This server action is created to be used by client components in the onboarding wizard
// without needing to pass down all the data via props from the page server component.
export async function getOnboardingActions() {
  try {
    const fleet = await fetchFleetAircraft();
    // In the future, you could fetch other data like available training programs here.
    return { fleet };
  } catch (error) {
    console.error("Error in getOnboardingActions:", error);
    // Return empty arrays on error to prevent crashes on the client
    return { fleet: [] };
  }
}

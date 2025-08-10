
"use server";

import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchAllFlightLogs, type FlightLogLeg } from '@/ai/flows/manage-flight-logs-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchQuotes, type Quote } from '@/ai/flows/manage-quotes-flow';

export interface AnalyticsData {
    trips: Trip[];
    flightLogs: FlightLogLeg[];
    fleet: FleetAircraft[];
    quotes: Quote[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  try {
    const [trips, flightLogs, fleet, quotes] = await Promise.all([
      fetchTrips(),
      fetchAllFlightLogs(),
      fetchFleetAircraft(),
      fetchQuotes(),
    ]);

    return { trips, flightLogs, fleet, quotes };
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    // In a real app, you might want more robust error handling or logging
    // For now, re-throwing allows the client to handle it.
    throw new Error(`Failed to fetch analytics data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

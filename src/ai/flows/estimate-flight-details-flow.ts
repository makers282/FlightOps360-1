
'use server';
/**
 * @fileOverview A function that uses a helper to look up airport data and estimate flight details.
 */

import {
  EstimateFlightDetailsInputSchema,
  type EstimateFlightDetailsInput,
  type EstimateFlightDetailsOutput,
} from '@/ai/schemas/estimate-flight-details-schemas';
import { lookupAirport } from '../tools/airport-lookup-tool';

/**
 * Helper to calculate great-circle distance in NM.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3440.065; // Nautical miles
  const toRad = (d:number) => d * Math.PI/180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function estimateFlightDetails(input: EstimateFlightDetailsInput): Promise<EstimateFlightDetailsOutput> {
    console.log('[estimateFlightDetails] Received input:', input);
    const validatedInput = EstimateFlightDetailsInputSchema.parse(input);
    
    try {
        console.log(`[estimateFlightDetails] Looking up origin: ${validatedInput.origin}`);
        const originData = await lookupAirport(validatedInput.origin);
        console.log(`[estimateFlightDetails] Found origin data:`, originData);

        console.log(`[estimateFlightDetails] Looking up destination: ${validatedInput.destination}`);
        const destinationData = await lookupAirport(validatedInput.destination);
        console.log(`[estimateFlightDetails] Found destination data:`, destinationData);

        const dist = haversineDistance(
            originData.lat, originData.lon,
            destinationData.lat, destinationData.lon
        );
        console.log(`[estimateFlightDetails] Calculated distance: ${dist} NM`);

        const speed = validatedInput.knownCruiseSpeedKts || 350;
        const flightTime = speed > 0 ? Math.round((dist / speed) * 100) / 100 : 0;
        console.log(`[estimateFlightDetails] Calculated flight time: ${flightTime} hours at ${speed} kts`);

        const result: EstimateFlightDetailsOutput = {
            resolvedOriginName: originData.name,
            resolvedOriginIcao: originData.icao,
            originLat: originData.lat,
            originLon: originData.lon,
            resolvedDestinationName: destinationData.name,
            resolvedDestinationIcao: destinationData.icao,
            destinationLat: destinationData.lat,
            destinationLon: destinationData.lon,
            assumedCruiseSpeedKts: speed,
            estimatedMileageNM: Math.round(dist),
            estimatedFlightTimeHours: flightTime,
            briefExplanation: `Estimated based on a direct route between ${originData.name} and ${destinationData.name}.`
        };

        console.log('[estimateFlightDetails] Successfully calculated details.');
        return result;

    } catch (error) {
        console.error("[estimateFlightDetails] CRITICAL: An error occurred during flight detail estimation.", error);
        // Re-throw the error to ensure the calling client-side code is aware of the failure.
        throw new Error(`Failed to estimate flight details: ${error instanceof Error ? error.message : String(error)}`);
    }
}

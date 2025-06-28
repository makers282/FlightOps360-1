
'use server';
/**
 * @fileOverview A function that uses a tool to look up airport data and estimate flight details.
 */

import {
  EstimateFlightDetailsInputSchema,
  type EstimateFlightDetailsInput,
  type EstimateFlightDetailsOutput,
} from '@/ai/schemas/estimate-flight-details-schemas';
import { lookupAirport } from '../tools/airport-lookup-tool';

/**
 * Helper to calculate great-circle distance in NM
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

// This is no longer a Genkit flow, just a regular server action.
export async function estimateFlightDetails(input: EstimateFlightDetailsInput): Promise<EstimateFlightDetailsOutput> {
    const validatedInput = EstimateFlightDetailsInputSchema.parse(input);

    const [originData, destinationData] = await Promise.all([
        lookupAirport(validatedInput.origin),
        lookupAirport(validatedInput.destination),
    ]);

    const dist = haversineDistance(
        originData.lat, originData.lon,
        destinationData.lat, destinationData.lon
    );

    const speed = validatedInput.knownCruiseSpeedKts || 350; // Default to 350 if not provided
    const flightTime = speed > 0 ? Math.round((dist / speed) * 100) / 100 : 0;

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

    return result;
}


'use server';
/**
 * @fileOverview A flow that uses a tool to look up airport data and estimate flight details.
 */

import { ai } from '@/ai/genkit';
import {
  EstimateFlightDetailsInputSchema,
  EstimateFlightDetailsOutputSchema,
  type EstimateFlightDetailsInput,
  type EstimateFlightDetailsOutput,
} from '@/ai/schemas/estimate-flight-details-schemas';
import { airportLookupTool } from '../tools/airport-lookup-tool';
import { flow } from 'genkit';

export type { EstimateFlightDetailsInput, EstimateFlightDetailsOutput };

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

export const estimateFlightDetails = flow(
    {
      name: 'estimateFlightDetailsFlow',
      inputSchema: EstimateFlightDetailsInputSchema,
      outputSchema: EstimateFlightDetailsOutputSchema,
      tools: [airportLookupTool],
    },
    async (input) => {
        const [originData, destinationData] = await Promise.all([
            airportLookupTool({ icao: input.origin }),
            airportLookupTool({ icao: input.destination }),
        ]);

        const dist = haversineDistance(
            originData.lat, originData.lon,
            destinationData.lat, destinationData.lon
        );

        const speed = input.knownCruiseSpeedKts || 350; // Default to 350 if not provided
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
            aiExplanation: `Estimated based on a direct route between ${originData.name} and ${destinationData.name}.`
        };

        return result;
    }
);

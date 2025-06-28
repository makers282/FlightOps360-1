
// src/ai/tools/airport-lookup-tool.ts
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

// Schema for the data returned by the lookup
const AirportDataSchema = z.object({
  icao: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string(),
  country: z.string(),
});
export type AirportData = z.infer<typeof AirportDataSchema>;

/**
 * Looks up airport data from Firestore based on an ICAO code.
 * @param icao The 4-letter ICAO code of the airport.
 * @returns A promise that resolves to the airport data.
 * @throws An error if the airport is not found or data is invalid.
 */
export async function lookupAirport(icao: string): Promise<AirportData> {
  if (!adminDb) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  
  const airportRef = adminDb.collection('airports').doc(icao.toUpperCase());
  const doc = await airportRef.get();

  if (!doc.exists) {
    throw new Error(`Airport with ICAO code ${icao} not found.`);
  }

  const data = doc.data();
  const validation = AirportDataSchema.safeParse(data);

  if (!validation.success) {
      console.error("Firestore data validation error:", validation.error.issues);
      throw new Error(`Invalid data structure for airport ${icao} in Firestore.`);
  }

  return validation.data;
}


// src/ai/tools/airport-lookup-tool.ts
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

const AirportDataSchema = z.object({
  icao: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string(),
  country: z.string(),
});
export type AirportData = z.infer<typeof AirportDataSchema>;

export async function lookupAirport(icao: string): Promise<AirportData> {
  console.log(`[lookupAirport] Received request for ICAO: ${icao}`);

  if (!adminDb) {
    console.error("[lookupAirport] CRITICAL: adminDb is null or undefined. Firebase Admin SDK likely failed to initialize.");
    throw new Error("Database connection is not available.");
  }
  
  console.log(`[lookupAirport] Querying Firestore for document: ${icao.toUpperCase()}`);
  const airportRef = adminDb.collection('airports').doc(icao.toUpperCase());
  const doc = await airportRef.get();

  if (!doc.exists) {
    console.warn(`[lookupAirport] Airport with ICAO code ${icao} not found in Firestore.`);
    throw new Error(`Airport with ICAO code ${icao} not found.`);
  }

  const data = doc.data();
  console.log(`[lookupAirport] Found data for ${icao}:`, data);
  
  const validation = AirportDataSchema.safeParse(data);
  if (!validation.success) {
      console.error(`[lookupAirport] Firestore data validation error for ${icao}:`, validation.error.issues);
      throw new Error(`Invalid data structure for airport ${icao} in Firestore.`);
  }

  console.log(`[lookupAirport] Successfully looked up and validated data for ${icao}.`);
  return validation.data;
}

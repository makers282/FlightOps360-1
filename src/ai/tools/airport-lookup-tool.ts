
import { defineTool } from '@genkit-ai/ai/tool';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

// Define the schema for the tool's input
const AirportLookupSchema = z.object({
  icao: z.string().length(4, "ICAO code must be 4 characters"),
});

// Define the schema for the tool's output
const AirportDataSchema = z.object({
  icao: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string(),
  country: z.string(),
});

export const airportLookupTool = defineTool(
  {
    name: 'airportLookup',
    description: 'Looks up airport data from Firestore based on ICAO code.',
    inputSchema: AirportLookupSchema,
    outputSchema: AirportDataSchema,
  },
  async (input) => {
    if (!adminDb) {
      throw new Error("Firestore admin instance is not initialized.");
    }
    
    const airportRef = adminDb.collection('airports').doc(input.icao.toUpperCase());
    const doc = await airportRef.get();

    if (!doc.exists) {
      throw new Error(`Airport with ICAO code ${input.icao} not found.`);
    }

    const data = doc.data();

    // Validate the fetched data against our schema
    const validation = AirportDataSchema.safeParse(data);
    if (!validation.success) {
        console.error("Firestore data validation error:", validation.error.issues);
        throw new Error(`Invalid data structure for airport ${input.icao} in Firestore.`);
    }

    return validation.data;
  }
);

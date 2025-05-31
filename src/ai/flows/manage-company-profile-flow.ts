'use server';
/**
 * @fileOverview Genkit flows for managing the company profile information using Firestore.
 * This now includes standard service and fee rates for quotes.
 *
 * - fetchCompanyProfile - Fetches the company profile.
 * - saveCompanyProfile - Saves (adds or updates) the company profile.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Define the structure for an individual service/fee rate
const ServiceFeeRateSchema = z.object({
  displayDescription: z.string().min(1, "Display description is required."),
  buy: z.number().min(0, "Buy rate must be non-negative."),
  sell: z.number().min(0, "Sell rate must be non-negative."),
  unitDescription: z.string().min(1, "Unit description is required (e.g., Per Leg, Per Service)."),
});
export type ServiceFeeRate = z.infer<typeof ServiceFeeRateSchema>;

// Define the structure for the company profile
const CompanyProfileSchema = z.object({
  id: z.string().default("main").describe("The fixed ID for the company profile document, typically 'main'."),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().optional(),
  companyPhone: z.string().optional(),
  // logoUrl: z.string().optional().describe("URL of the company logo."), // Logo handling is more complex and deferred
  serviceFeeRates: z.record(ServiceFeeRateSchema).optional().default({}).describe("A map of service/fee keys to their rate details."),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// Schemas for flow inputs and outputs
const SaveCompanyProfileInputSchema = CompanyProfileSchema;
export type SaveCompanyProfileInput = z.infer<typeof SaveCompanyProfileInputSchema>;

const FetchCompanyProfileOutputSchema = CompanyProfileSchema.nullable(); // Can be null if no profile exists
const SaveCompanyProfileOutputSchema = CompanyProfileSchema;

const COMPANY_PROFILE_COLLECTION = 'companyProfile';
const COMPANY_PROFILE_DOC_ID = 'main'; // Fixed document ID

// Exported async functions that clients will call
export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  console.log('[ManageCompanyProfileFlow Firestore] Attempting to fetch company profile.');
  return fetchCompanyProfileFlow();
}

export async function saveCompanyProfile(input: SaveCompanyProfileInput): Promise<CompanyProfile> {
  console.log('[ManageCompanyProfileFlow Firestore] Attempting to save company profile.');
  // Ensure the ID is always 'main' when saving
  const profileToSave: CompanyProfile = {
    ...input,
    id: COMPANY_PROFILE_DOC_ID,
    serviceFeeRates: input.serviceFeeRates || {}, // Ensure serviceFeeRates is an object
  };
  return saveCompanyProfileFlow(profileToSave);
}


// Genkit Flow Definitions
const fetchCompanyProfileFlow = ai.defineFlow(
  {
    name: 'fetchCompanyProfileFlow',
    outputSchema: FetchCompanyProfileOutputSchema,
  },
  async () => {
    console.log('Executing fetchCompanyProfileFlow - Firestore');
    try {
      const profileDocRef = doc(db, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const docSnap = await getDoc(profileDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const result: CompanyProfile = {
            id: COMPANY_PROFILE_DOC_ID,
            companyName: data.companyName,
            companyAddress: data.companyAddress,
            companyEmail: data.companyEmail,
            companyPhone: data.companyPhone,
            serviceFeeRates: data.serviceFeeRates || {}, // Ensure serviceFeeRates is an object
        };
        console.log('Fetched company profile from Firestore:', result);
        return result;
      } else {
        console.log('No company profile document found in Firestore.');
        // Return a default structure if no profile exists, so the app can initialize.
        return {
          id: COMPANY_PROFILE_DOC_ID,
          companyName: "FlightOps360 (Default Name)",
          companyAddress: "123 Sky Lane, Aviation City, FL 33333",
          companyEmail: "ops@example.com",
          companyPhone: "555-123-4567",
          serviceFeeRates: {}, // Initialize with empty rates
        };
      }
    } catch (error) {
      console.error('Error fetching company profile from Firestore:', error);
      throw new Error(`Failed to fetch company profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveCompanyProfileFlow = ai.defineFlow(
  {
    name: 'saveCompanyProfileFlow',
    inputSchema: SaveCompanyProfileInputSchema,
    outputSchema: SaveCompanyProfileOutputSchema,
  },
  async (profileData) => {
    console.log('Executing saveCompanyProfileFlow with input - Firestore:', profileData);
    try {
      const profileDocRef = doc(db, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const { id, ...dataToSet } = profileData; // Exclude 'id' from document fields
      // Ensure serviceFeeRates is part of dataToSet, even if empty
      const finalDataToSet = {
        ...dataToSet,
        serviceFeeRates: dataToSet.serviceFeeRates || {},
      };
      await setDoc(profileDocRef, finalDataToSet, { merge: true }); 
      console.log('Saved company profile in Firestore.');
      return profileData; // Return the full input data as per schema
    } catch (error) {
      console.error('Error saving company profile to Firestore:', error);
      throw new Error(`Failed to save company profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

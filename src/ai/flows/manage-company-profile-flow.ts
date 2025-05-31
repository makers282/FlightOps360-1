
'use server';
/**
 * @fileOverview Genkit flows for managing the company profile information using Firestore.
 *
 * - fetchCompanyProfile - Fetches the company profile.
 * - saveCompanyProfile - Saves (adds or updates) the company profile.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Define the structure for the company profile
const CompanyProfileSchema = z.object({
  id: z.string().default("main").describe("The fixed ID for the company profile document, typically 'main'."),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().optional(),
  companyPhone: z.string().optional(),
  // logoUrl: z.string().optional().describe("URL of the company logo."), // Logo handling is more complex and deferred
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
        // Exclude 'id' field from the returned data as it's the doc ID
        const { id, ...profileData } = docSnap.data() as CompanyProfile;
        const result = { id: COMPANY_PROFILE_DOC_ID, ...profileData };
        console.log('Fetched company profile from Firestore:', result);
        return result;
      } else {
        console.log('No company profile document found in Firestore.');
        return null;
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
      // We spread profileData but explicitly exclude 'id' from being written as a field within the document itself.
      // The document ID is COMPANY_PROFILE_DOC_ID.
      const { id, ...dataToSet } = profileData;
      await setDoc(profileDocRef, dataToSet, { merge: true }); // Use merge: true to handle updates
      console.log('Saved company profile in Firestore.');
      // Return the full input, including the 'id' field, consistent with schema
      return profileData;
    } catch (error) {
      console.error('Error saving company profile to Firestore:', error);
      throw new Error(`Failed to save company profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

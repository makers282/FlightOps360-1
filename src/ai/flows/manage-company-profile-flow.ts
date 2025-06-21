
'use server';
/**
 * @fileOverview Genkit flows for managing the company profile information using Firestore.
 * This now includes standard service and fee rates for quotes.
 *
 * - fetchCompanyProfile - Fetches the company profile.
 * - saveCompanyProfile - Saves (adds or updates) the company profile.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import {
  CompanyProfile,
  SaveCompanyProfileInput,
  FetchCompanyProfileOutputSchema,
  SaveCompanyProfileInputSchema,
  SaveCompanyProfileOutputSchema,
  ServiceFeeRate,
} from '@/ai/schemas/company-profile-schemas';

const COMPANY_PROFILE_COLLECTION = 'companyProfile';
const COMPANY_PROFILE_DOC_ID = 'main'; // Fixed document ID

// Exported async functions that clients will call
export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCompanyProfile (manage-company-profile-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCompanyProfile.");
  }
  console.log('[ManageCompanyProfileFlow Firestore Admin] Attempting to fetch company profile.');
  return fetchCompanyProfileFlow();
}

export async function saveCompanyProfile(input: SaveCompanyProfileInput): Promise<CompanyProfile> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCompanyProfile (manage-company-profile-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveCompanyProfile.");
  }
  console.log('[ManageCompanyProfileFlow Firestore Admin] Attempting to save company profile.');
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCompanyProfileFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchCompanyProfileFlow.");
    }
    console.log('Executing fetchCompanyProfileFlow - Firestore');
    try {
      const profileDocRef = db.collection(COMPANY_PROFILE_COLLECTION).doc(COMPANY_PROFILE_DOC_ID);
      const docSnap = await profileDocRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const processedServiceFeeRates: Record<string, ServiceFeeRate> = {};
        if (data?.serviceFeeRates) {
          for (const key in data.serviceFeeRates) {
            processedServiceFeeRates[key] = {
              ...data.serviceFeeRates[key],
              isActive: data.serviceFeeRates[key].isActive ?? true, // Default to true if missing
            };
          }
        }
        const result: CompanyProfile = {
            id: COMPANY_PROFILE_DOC_ID,
            companyName: data?.companyName,
            companyAddress: data?.companyAddress,
            companyEmail: data?.companyEmail,
            companyPhone: data?.companyPhone,
            logoUrl: data?.logoUrl,
            serviceFeeRates: processedServiceFeeRates,
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
          logoUrl: undefined,
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCompanyProfileFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveCompanyProfileFlow.");
    }
    console.log('Executing saveCompanyProfileFlow with input - Firestore:', profileData);
    try {
      const profileDocRef = db.collection(COMPANY_PROFILE_COLLECTION).doc(COMPANY_PROFILE_DOC_ID);
      const { id, ...dataToSet } = profileData; // Exclude 'id' from document fields
      
      const finalServiceFeeRates: Record<string, ServiceFeeRate> = {};
      if (dataToSet.serviceFeeRates) {
        for (const key in dataToSet.serviceFeeRates) {
          finalServiceFeeRates[key] = {
            ...dataToSet.serviceFeeRates[key],
            isActive: dataToSet.serviceFeeRates[key].isActive ?? true, // Ensure isActive is set, defaulting to true
          };
        }
      }

      const finalDataToSet = {
        ...dataToSet,
        serviceFeeRates: finalServiceFeeRates,
      };
      await profileDocRef.set(finalDataToSet, { merge: true }); 
      console.log('Saved company profile in Firestore.');
      return profileData; // Return the full input data as per schema
    } catch (error) {
      console.error('Error saving company profile to Firestore:', error);
      throw new Error(`Failed to save company profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

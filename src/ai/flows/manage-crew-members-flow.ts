'use server';
/**
 * @fileOverview Genkit flows for managing crew member data using Firestore.
 *
 * - fetchCrewMembers - Fetches all crew members, reconciling with Firebase Auth.
 * - saveCrewMember - Saves (adds or updates) a crew member.
 * - deleteCrewMember - Deletes a crew member.
 */

import { ai } from '@/ai/genkit';
import { adminApp, adminDb as db } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import {
    SaveCrewMemberInputSchema,
    SaveCrewMemberOutputSchema,
    FetchCrewMembersOutputSchema,
    DeleteCrewMemberInputSchema,
    DeleteCrewMemberOutputSchema
} from '@/ai/schemas/crew-member-schemas';
import { z } from 'zod';
import { fetchRoles } from './manage-roles-flow';

const CREW_MEMBERS_COLLECTION = 'crewMembers';

// Exported async functions that clients will call
export async function fetchCrewMembers(): Promise<CrewMember[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCrewMembers (manage-crew-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCrewMembers.");
  }
  return fetchCrewMembersFlow();
}

export async function saveCrewMember(input: SaveCrewMemberInput): Promise<CrewMember> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCrewMember (manage-crew-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveCrewMember.");
  }
  // If ID is not provided, generate one for Firestore
  const crewMemberId = input.id || db.collection(CREW_MEMBERS_COLLECTION).doc().id;
  console.log('[ManageCrewFlow Firestore Admin] Attempting to save crew member:', crewMemberId);

  // Prepare data for the flow: exclude 'id' from the data payload as it's the doc key.
  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id; // Cast to any to allow deletion of 'id'
  }
  
  // Call the internal Genkit flow with the determined ID and cleaned data
  return saveCrewMemberFlow({ crewMemberId, crewMemberData: dataToSaveInDb as Omit<SaveCrewMemberInput, 'id'> });
}

export async function deleteCrewMember(input: { crewMemberId: string }): Promise<{ success: boolean; crewMemberId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCrewMember (manage-crew-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteCrewMember.");
  }
  console.log('[ManageCrewFlow Firestore Admin] Attempting to delete crew member ID:', input.crewMemberId);
  return deleteCrewMemberFlow(input);
}


// Genkit Flow Definitions
const fetchCrewMembersFlow = ai.defineFlow(
  {
    name: 'fetchCrewMembersFlow',
    outputSchema: FetchCrewMembersOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCrewMembersFlow.");
        throw new Error("Firestore admin instance is not initialized.");
    }
    console.log('Executing fetchCrewMembersFlow - Firestore Admin with reconciliation');

    try {
        // Step 1: Fetch all necessary data concurrently
        const [authUsersList, crewDocsSnapshot, rolesList] = await Promise.all([
            getAuth(adminApp).listUsers(),
            db.collection(CREW_MEMBERS_COLLECTION).get(),
            fetchRoles(), // This helper function now seeds roles if needed
        ]);
        
        // Step 2: Find the 'Flight Crew' role ID
        const flightCrewRole = rolesList.find(r => r.name === 'Flight Crew');
        if (!flightCrewRole) {
            console.error("[fetchCrewMembersFlow] CRITICAL: 'Flight Crew' role not found in the database. Cannot determine which users are crew members.");
            return []; // Cannot proceed without this role definition
        }
        const flightCrewRoleId = flightCrewRole.id;
        
        // Step 3: Map existing crew documents by their associated userId
        const existingCrewMap = new Map<string, CrewMember>();
        crewDocsSnapshot.forEach(doc => {
            const data = doc.data();
            // Important: map by userId for reconciliation with Auth users
            if (data.userId) { 
                existingCrewMap.set(data.userId, {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
                    updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
                    licenses: data.licenses || [],
                    typeRatings: data.typeRatings || [],
                    onboardingStatus: data.onboardingStatus || 'Pending',
                } as CrewMember);
            }
        });

        // Step 4: Reconcile Auth users with Firestore crew documents
        const reconciledCrewPromises: Promise<CrewMember | null>[] = authUsersList.users.map(async (authUser) => {
            const userRoles = (authUser.customClaims?.roles as string[]) || [];

            // Check if user has the Flight Crew role
            if (userRoles.includes(flightCrewRoleId)) {
                // If they exist in our Firestore map, return that data
                if (existingCrewMap.has(authUser.uid)) {
                    return existingCrewMap.get(authUser.uid)!;
                }

                // If they DON'T exist in Firestore, they are a "missing" crew member.
                // We need to create a profile for them.
                console.log(`[fetchCrewMembersFlow] Reconciling: User ${authUser.email} has Flight Crew role but no crew profile. Creating one now.`);
                
                const [firstName, ...lastNameParts] = (authUser.displayName || 'New Crew').split(' ');
                const lastName = lastNameParts.join(' ') || 'Member';

                const newCrewMemberData: SaveCrewMemberInput = {
                    firstName,
                    lastName,
                    email: authUser.email,
                    userId: authUser.uid, // Link to the auth user
                    role: 'Other', // A default role to be updated during onboarding
                    isActive: !authUser.disabled,
                    onboardingStatus: 'Pending', // Explicitly set as Pending
                    // Other fields will use schema defaults
                };
                
                try {
                    // Use the existing saveCrewMember function to create the document in Firestore
                    const savedCrewMember = await saveCrewMember(newCrewMemberData);
                    return savedCrewMember; // Return the newly created and saved crew member
                } catch (saveError) {
                    console.error(`[fetchCrewMembersFlow] Failed to auto-create crew profile for ${authUser.email}:`, saveError);
                    return null; // Skip this user if saving fails
                }
            }
            
            return null; // Not a flight crew member
        });

        const reconciledCrewMembers = (await Promise.all(reconciledCrewPromises)).filter((c): c is CrewMember => c !== null);

        console.log(`[fetchCrewMembersFlow] Reconciled and fetched ${reconciledCrewMembers.length} crew members.`);
        return reconciledCrewMembers;

    } catch (error) {
      console.error('Error in fetchCrewMembersFlow reconciliation process:', error);
      throw new Error(`Failed to fetch and reconcile crew members: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


// Internal schema for saveCrewMemberFlow input
const InternalSaveCrewMemberInputSchema = z.object({
    crewMemberId: z.string(),
    crewMemberData: SaveCrewMemberInputSchema.omit({ id: true }), // Data without the ID field
});

const saveCrewMemberFlow = ai.defineFlow(
  {
    name: 'saveCrewMemberFlow',
    inputSchema: InternalSaveCrewMemberInputSchema, // Expects crewMemberId and the data separately
    outputSchema: SaveCrewMemberOutputSchema,
  },
  async ({ crewMemberId, crewMemberData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCrewMemberFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveCrewMemberFlow.");
    }
    console.log('Executing saveCrewMemberFlow with input - Firestore:', crewMemberId);
    try {
      const crewMemberDocRef = db.collection(CREW_MEMBERS_COLLECTION).doc(crewMemberId);
      const docSnap = await crewMemberDocRef.get();

      const dataWithTimestamps = {
        ...crewMemberData,
        licenses: crewMemberData.licenses || [], // Ensure array
        typeRatings: crewMemberData.typeRatings || [], // Ensure array
        onboardingStatus: crewMemberData.onboardingStatus || 'Pending',
        updatedAt: FieldValue.serverTimestamp(),
        // Preserve original createdAt if doc exists, otherwise set new serverTimestamp
        createdAt: docSnap.exists() && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await crewMemberDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved crew member in Firestore:', crewMemberId);
      
      // Fetch the saved document to get server-generated timestamps correctly
      const savedDoc = await crewMemberDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved crew member data from Firestore.");
      }

      return {
        id: crewMemberId,
        ...savedData,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        licenses: savedData.licenses || [],
        typeRatings: savedData.typeRatings || [],
      } as CrewMember; // Cast to ensure type match
    } catch (error) {
      console.error('Error saving crew member to Firestore:', error);
      throw new Error(`Failed to save crew member ${crewMemberId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteCrewMemberFlow = ai.defineFlow(
  {
    name: 'deleteCrewMemberFlow',
    inputSchema: DeleteCrewMemberInputSchema,
    outputSchema: DeleteCrewMemberOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCrewMemberFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteCrewMemberFlow.");
    }
    console.log('Executing deleteCrewMemberFlow for crew member ID - Firestore:', input.crewMemberId);
    try {
      const crewMemberDocRef = db.collection(CREW_MEMBERS_COLLECTION).doc(input.crewMemberId);
      await crewMemberDocRef.delete();
      console.log('Deleted crew member from Firestore:', input.crewMemberId);
      return { success: true, crewMemberId: input.crewMemberId };
    } catch (error) {
      console.error('Error deleting crew member from Firestore:', error);
      throw new Error(`Failed to delete crew member ${input.crewMemberId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
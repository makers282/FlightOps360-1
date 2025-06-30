
'use server';
/**
 * @fileOverview Genkit flows for managing crew member data using Firestore.
 *
 * - fetchCrewMembers - Fetches all crew members.
 * - saveCrewMember - Saves (adds or updates) a crew member.
 * - deleteCrewMember - Deletes a crew member.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
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

const CREW_MEMBERS_COLLECTION = 'crewMembers';

// Exported async functions that clients will call
export async function fetchCrewMembers(): Promise<CrewMember[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCrewMembers (manage-crew-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCrewMembers.");
  }
  console.log('[ManageCrewFlow Firestore Admin] Attempting to fetch all crew members.');
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
        throw new Error("Firestore admin instance (db) is not initialized in fetchCrewMembersFlow.");
    }
    console.log('Executing fetchCrewMembersFlow - Firestore');
    try {
      const crewMembersCollectionRef = db.collection(CREW_MEMBERS_COLLECTION);
      const snapshot = await crewMembersCollectionRef.get();
      if (snapshot.empty) {
        console.log('No crew members found in Firestore. Returning empty list.');
        return [];
      }
      const crewList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        // Convert Firestore Timestamps to ISO strings for client compatibility
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          // Ensure arrays are present even if undefined in DB
          licenses: data.licenses || [],
          typeRatings: data.typeRatings || [],
          onboardingStatus: data.onboardingStatus || 'Pending',
        } as CrewMember;
      });
      console.log('Fetched crew members from Firestore:', crewList.length, 'members.');
      return crewList;
    } catch (error) {
      console.error('Error fetching crew members from Firestore:', error);
      throw new Error(`Failed to fetch crew members: ${error instanceof Error ? error.message : String(error)}`);
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

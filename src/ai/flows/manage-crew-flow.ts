
'use server';
/**
 * @fileOverview Genkit flows for managing crew member data using Firestore.
 *
 * - fetchCrewMembers - Fetches all crew members.
 * - saveCrewMember - Saves (adds or updates) a crew member.
 * - deleteCrewMember - Deletes a crew member.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import {
    // CrewMemberSchema, // For validating output type if needed directly
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
  console.log('[ManageCrewFlow Firestore] Attempting to fetch all crew members.');
  return fetchCrewMembersFlow();
}

export async function saveCrewMember(input: SaveCrewMemberInput): Promise<CrewMember> {
  // If ID is not provided, generate one for Firestore
  const crewMemberId = input.id || doc(collection(db, CREW_MEMBERS_COLLECTION)).id;
  console.log('[ManageCrewFlow Firestore] Attempting to save crew member:', crewMemberId);

  // Prepare data for the flow: exclude 'id' from the data payload as it's the doc key.
  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id; // Cast to any to allow deletion of 'id'
  }
  
  // Call the internal Genkit flow with the determined ID and cleaned data
  return saveCrewMemberFlow({ crewMemberId, crewMemberData: dataToSaveInDb as Omit<SaveCrewMemberInput, 'id'> });
}

export async function deleteCrewMember(input: { crewMemberId: string }): Promise<{ success: boolean; crewMemberId: string }> {
  console.log('[ManageCrewFlow Firestore] Attempting to delete crew member ID:', input.crewMemberId);
  return deleteCrewMemberFlow(input);
}


// Genkit Flow Definitions
const fetchCrewMembersFlow = ai.defineFlow(
  {
    name: 'fetchCrewMembersFlow',
    outputSchema: FetchCrewMembersOutputSchema,
  },
  async () => {
    console.log('Executing fetchCrewMembersFlow - Firestore');
    try {
      const crewMembersCollectionRef = collection(db, CREW_MEMBERS_COLLECTION);
      const snapshot = await getDocs(crewMembersCollectionRef);
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
    console.log('Executing saveCrewMemberFlow with input - Firestore:', crewMemberId);
    try {
      const crewMemberDocRef = doc(db, CREW_MEMBERS_COLLECTION, crewMemberId);
      const docSnap = await getDoc(crewMemberDocRef);

      const dataWithTimestamps = {
        ...crewMemberData,
        licenses: crewMemberData.licenses || [], // Ensure array
        typeRatings: crewMemberData.typeRatings || [], // Ensure array
        updatedAt: serverTimestamp(),
        // Preserve original createdAt if doc exists, otherwise set new serverTimestamp
        createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(crewMemberDocRef, dataWithTimestamps, { merge: true });
      console.log('Saved crew member in Firestore:', crewMemberId);
      
      // Fetch the saved document to get server-generated timestamps correctly
      const savedDoc = await getDoc(crewMemberDocRef);
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
    console.log('Executing deleteCrewMemberFlow for crew member ID - Firestore:', input.crewMemberId);
    try {
      const crewMemberDocRef = doc(db, CREW_MEMBERS_COLLECTION, input.crewMemberId);
      await deleteDoc(crewMemberDocRef);
      console.log('Deleted crew member from Firestore:', input.crewMemberId);
      return { success: true, crewMemberId: input.crewMemberId };
    } catch (error) {
      console.error('Error deleting crew member from Firestore:', error);
      throw new Error(`Failed to delete crew member ${input.crewMemberId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

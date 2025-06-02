
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

// Mock data for testing if Firestore is empty
const mockCrewMembersList: CrewMember[] = [
  {
    id: 'mock-capt-001',
    employeeId: 'EMP001',
    firstName: 'Ava',
    lastName: 'Williams',
    role: 'Captain',
    email: 'ava.williams@example.com',
    phone: '555-0101',
    licenses: [{ type: 'ATP', number: '12345', expiryDate: '2025-12-31' }],
    typeRatings: ['C560', 'GLEX'],
    homeBase: 'KTEB',
    isActive: true,
    notes: 'Experienced captain, check airman.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-fo-002',
    employeeId: 'EMP002',
    firstName: 'Ben',
    lastName: 'Carter',
    role: 'First Officer',
    email: 'ben.carter@example.com',
    phone: '555-0102',
    licenses: [{ type: 'CPL', number: '67890', expiryDate: '2024-11-15' }],
    typeRatings: ['C560'],
    homeBase: 'KHPN',
    isActive: true,
    notes: 'Recently completed line training.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-fa-003',
    employeeId: 'EMP003',
    firstName: 'Chloe',
    lastName: 'Davis',
    role: 'Flight Attendant',
    email: 'chloe.davis@example.com',
    phone: '555-0103',
    licenses: [{ type: 'FA Cert', expiryDate: '2026-06-01' }],
    typeRatings: [],
    homeBase: 'KDAL',
    isActive: true,
    notes: 'Lead flight attendant.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-fa-004',
    employeeId: 'EMP004',
    firstName: 'David',
    lastName: 'Miller',
    role: 'Flight Attendant',
    email: 'david.miller@example.com',
    phone: '555-0104',
    licenses: [{ type: 'FA Cert', expiryDate: '2025-08-10' }],
    typeRatings: [],
    homeBase: 'KVNY',
    isActive: true,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-other-005',
    employeeId: 'EMP005',
    firstName: 'Elena',
    lastName: 'Rodriguez',
    role: 'Mechanic',
    email: 'elena.rodriguez@example.com',
    phone: '555-0105',
    licenses: [{ type: 'A&P License' }],
    typeRatings: [],
    homeBase: 'KMIA',
    isActive: false,
    notes: 'Specializes in avionics. Currently on leave.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];


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
      if (snapshot.empty) {
        console.log('No crew members found in Firestore. Returning mock data for testing.');
        return mockCrewMembersList;
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
        } as CrewMember;
      });
      console.log('Fetched crew members from Firestore:', crewList.length, 'members.');
      return crewList;
    } catch (error) {
      console.error('Error fetching crew members from Firestore:', error);
      // Optionally, return mock data on error during testing phase
      // console.log('Error occurred, returning mock data for testing.');
      // return mockCrewMembersList; 
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


'use server';
/**
 * @fileOverview Genkit flows for managing crew documents using Firestore.
 *
 * - fetchCrewDocuments - Fetches all crew documents.
 * - saveCrewDocument - Saves (adds or updates) a crew document.
 * - deleteCrewDocument - Deletes a crew document.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp, getDoc, query, orderBy } from 'firebase/firestore';
import type { CrewDocument, SaveCrewDocumentInput } from '@/ai/schemas/crew-document-schemas';
import {
    SaveCrewDocumentInputSchema,
    SaveCrewDocumentOutputSchema,
    FetchCrewDocumentsOutputSchema,
    DeleteCrewDocumentInputSchema,
    DeleteCrewDocumentOutputSchema
} from '@/ai/schemas/crew-document-schemas';
import { z } from 'zod';

const CREW_DOCUMENTS_COLLECTION = 'crewDocuments';

// Exported async functions that clients will call
export async function fetchCrewDocuments(): Promise<CrewDocument[]> {
  console.log('[ManageCrewDocumentsFlow Firestore] Attempting to fetch all crew documents.');
  return fetchCrewDocumentsFlow();
}

export async function saveCrewDocument(input: SaveCrewDocumentInput): Promise<CrewDocument> {
  const documentId = input.id || doc(collection(db, CREW_DOCUMENTS_COLLECTION)).id;
  console.log('[ManageCrewDocumentsFlow Firestore] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveCrewDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveCrewDocumentInput, 'id'> });
}

export async function deleteCrewDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
  console.log('[ManageCrewDocumentsFlow Firestore] Attempting to delete document ID:', input.documentId);
  return deleteCrewDocumentFlow(input);
}


// Genkit Flow Definitions
const fetchCrewDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchCrewDocumentsFlow',
    outputSchema: FetchCrewDocumentsOutputSchema,
  },
  async () => {
    console.log('Executing fetchCrewDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = collection(db, CREW_DOCUMENTS_COLLECTION);
      const q = query(documentsCollectionRef, orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      const documentsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as CrewDocument;
      });
      console.log('Fetched crew documents from Firestore:', documentsList.length, 'documents.');
      return documentsList;
    } catch (error) {
      console.error('Error fetching crew documents from Firestore:', error);
      throw new Error(`Failed to fetch crew documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// Internal schema for saveCrewDocumentFlow input
const InternalSaveCrewDocumentInputSchema = z.object({
    documentId: z.string(),
    documentData: SaveCrewDocumentInputSchema.omit({ id: true }), 
});

const saveCrewDocumentFlow = ai.defineFlow(
  {
    name: 'saveCrewDocumentFlow',
    inputSchema: InternalSaveCrewDocumentInputSchema,
    outputSchema: SaveCrewDocumentOutputSchema,
  },
  async ({ documentId, documentData }) => {
    console.log('Executing saveCrewDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = doc(db, CREW_DOCUMENTS_COLLECTION, documentId);
      const docSnap = await getDoc(documentDocRef);

      const dataWithTimestamps = {
        ...documentData,
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(documentDocRef, dataWithTimestamps, { merge: true });
      console.log('Saved crew document in Firestore:', documentId);
      
      const savedDoc = await getDoc(documentDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved crew document data from Firestore.");
      }

      return {
        id: documentId,
        ...savedData,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as CrewDocument;
    } catch (error) {
      console.error('Error saving crew document to Firestore:', error);
      throw new Error(`Failed to save crew document ${documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteCrewDocumentFlow = ai.defineFlow(
  {
    name: 'deleteCrewDocumentFlow',
    inputSchema: DeleteCrewDocumentInputSchema,
    outputSchema: DeleteCrewDocumentOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteCrewDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = doc(db, CREW_DOCUMENTS_COLLECTION, input.documentId);
      await deleteDoc(documentDocRef);
      console.log('Deleted crew document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting crew document from Firestore:', error);
      throw new Error(`Failed to delete crew document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

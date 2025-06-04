
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft-specific documents using Firestore.
 *
 * - fetchAircraftDocuments - Fetches all aircraft documents.
 * - saveAircraftDocument - Saves (adds or updates) an aircraft document.
 * - deleteAircraftDocument - Deletes an aircraft document.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp, getDoc, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { AircraftDocument, SaveAircraftDocumentInput } from '@/ai/schemas/aircraft-document-schemas';
import {
    SaveAircraftDocumentInputSchema,
    SaveAircraftDocumentOutputSchema,
    FetchAircraftDocumentsOutputSchema,
    DeleteAircraftDocumentInputSchema,
    DeleteAircraftDocumentOutputSchema
} from '@/ai/schemas/aircraft-document-schemas';

const AIRCRAFT_DOCUMENTS_COLLECTION = 'aircraftDocuments';

export async function fetchAircraftDocuments(): Promise<AircraftDocument[]> {
  console.log('[ManageAircraftDocumentsFlow Firestore] Attempting to fetch all aircraft documents.');
  return fetchAircraftDocumentsFlow();
}

export async function saveAircraftDocument(input: SaveAircraftDocumentInput): Promise<AircraftDocument> {
  const documentId = input.id || doc(collection(db, AIRCRAFT_DOCUMENTS_COLLECTION)).id;
  console.log('[ManageAircraftDocumentsFlow Firestore] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveAircraftDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveAircraftDocumentInput, 'id'> });
}

export async function deleteAircraftDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
  console.log('[ManageAircraftDocumentsFlow Firestore] Attempting to delete document ID:', input.documentId);
  return deleteAircraftDocumentFlow(input);
}

const fetchAircraftDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchAircraftDocumentsFlow',
    outputSchema: FetchAircraftDocumentsOutputSchema,
  },
  async () => {
    console.log('Executing fetchAircraftDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = collection(db, AIRCRAFT_DOCUMENTS_COLLECTION);
      const q = query(documentsCollectionRef, orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      const documentsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as AircraftDocument;
      });
      console.log('Fetched aircraft documents from Firestore:', documentsList.length, 'documents.');
      return documentsList;
    } catch (error) {
      console.error('Error fetching aircraft documents from Firestore:', error);
      throw new Error(`Failed to fetch aircraft documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const InternalSaveAircraftDocumentInputSchema = z.object({
    documentId: z.string(),
    documentData: SaveAircraftDocumentInputSchema.omit({ id: true }), 
});

const saveAircraftDocumentFlow = ai.defineFlow(
  {
    name: 'saveAircraftDocumentFlow',
    inputSchema: InternalSaveAircraftDocumentInputSchema,
    outputSchema: SaveAircraftDocumentOutputSchema,
  },
  async ({ documentId, documentData }) => {
    console.log('Executing saveAircraftDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = doc(db, AIRCRAFT_DOCUMENTS_COLLECTION, documentId);
      const docSnap = await getDoc(documentDocRef);

      const dataWithTimestamps = {
        ...documentData,
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data().createdAt ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(documentDocRef, dataWithTimestamps, { merge: true });
      console.log('Saved aircraft document in Firestore:', documentId);
      
      const savedDoc = await getDoc(documentDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved aircraft document data from Firestore.");
      }

      return {
        id: documentId,
        ...savedData,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as AircraftDocument;
    } catch (error) {
      console.error('Error saving aircraft document to Firestore:', error);
      throw new Error(`Failed to save aircraft document ${documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteAircraftDocumentFlow = ai.defineFlow(
  {
    name: 'deleteAircraftDocumentFlow',
    inputSchema: DeleteAircraftDocumentInputSchema,
    outputSchema: DeleteAircraftDocumentOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteAircraftDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = doc(db, AIRCRAFT_DOCUMENTS_COLLECTION, input.documentId);
      await deleteDoc(documentDocRef);
      console.log('Deleted aircraft document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting aircraft document from Firestore:', error);
      throw new Error(`Failed to delete aircraft document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


'use server';
/**
 * @fileOverview Genkit flows for managing crew documents using Firestore.
 *
 * - fetchCrewDocuments - Fetches all crew documents.
 * - saveCrewDocument - Saves (adds or updates) a crew document.
 * - deleteCrewDocument - Deletes a crew document.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCrewDocuments (manage-crew-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCrewDocuments.");
  }
  console.log('[ManageCrewDocumentsFlow Firestore Admin] Attempting to fetch all crew documents.');
  return fetchCrewDocumentsFlow();
}

export async function saveCrewDocument(input: SaveCrewDocumentInput): Promise<CrewDocument> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCrewDocument (manage-crew-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveCrewDocument.");
  }
  const documentId = input.id || db.collection(CREW_DOCUMENTS_COLLECTION).doc().id;
  console.log('[ManageCrewDocumentsFlow Firestore Admin] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveCrewDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveCrewDocumentInput, 'id'> });
}

export async function deleteCrewDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCrewDocument (manage-crew-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteCrewDocument.");
  }
  console.log('[ManageCrewDocumentsFlow Firestore Admin] Attempting to delete document ID:', input.documentId);
  return deleteCrewDocumentFlow(input);
}


// Genkit Flow Definitions
const fetchCrewDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchCrewDocumentsFlow',
    outputSchema: FetchCrewDocumentsOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCrewDocumentsFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchCrewDocumentsFlow.");
    }
    console.log('Executing fetchCrewDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = db.collection(CREW_DOCUMENTS_COLLECTION);
      const q = documentsCollectionRef.orderBy("updatedAt", "desc");
      const snapshot = await q.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCrewDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveCrewDocumentFlow.");
    }
    console.log('Executing saveCrewDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = db.collection(CREW_DOCUMENTS_COLLECTION).doc(documentId);
      const docSnap = await documentDocRef.get();

      const dataWithTimestamps = {
        ...documentData,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await documentDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved crew document in Firestore:', documentId);
      
      const savedDoc = await documentDocRef.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCrewDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteCrewDocumentFlow.");
    }
    console.log('Executing deleteCrewDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = db.collection(CREW_DOCUMENTS_COLLECTION).doc(input.documentId);
      await documentDocRef.delete();
      console.log('Deleted crew document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting crew document from Firestore:', error);
      throw new Error(`Failed to delete crew document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

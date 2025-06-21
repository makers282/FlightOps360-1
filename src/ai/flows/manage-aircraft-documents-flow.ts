
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft-specific documents using Firestore.
 *
 * - fetchAircraftDocuments - Fetches all aircraft documents.
 * - saveAircraftDocument - Saves (adds or updates) an aircraft document.
 * - deleteAircraftDocument - Deletes an aircraft document.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db, adminStorage } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AircraftDocument, SaveAircraftDocumentInput } from '@/ai/schemas/aircraft-document-schemas';
import {
    SaveAircraftDocumentInputSchema,
    SaveAircraftDocumentOutputSchema,
    FetchAircraftDocumentsOutputSchema,
    DeleteAircraftDocumentInputSchema,
    DeleteAircraftDocumentOutputSchema,
    UploadAircraftDocumentInputSchema,
    UploadAircraftDocumentOutputSchema
} from '@/ai/schemas/aircraft-document-schemas';

const AIRCRAFT_DOCUMENTS_COLLECTION = 'aircraftDocuments';

export async function fetchAircraftDocuments(): Promise<AircraftDocument[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftDocuments (manage-aircraft-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftDocuments.");
  }
  console.log('[ManageAircraftDocumentsFlow Firestore Admin] Attempting to fetch all aircraft documents.');
  return fetchAircraftDocumentsFlow();
}

export async function saveAircraftDocument(input: SaveAircraftDocumentInput): Promise<AircraftDocument> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftDocument (manage-aircraft-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveAircraftDocument.");
  }
  const documentId = input.id || db.collection(AIRCRAFT_DOCUMENTS_COLLECTION).doc().id;
  console.log('[ManageAircraftDocumentsFlow Firestore Admin] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveAircraftDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveAircraftDocumentInput, 'id'> });
}

export async function deleteAircraftDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftDocument (manage-aircraft-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftDocument.");
  }
  console.log('[ManageAircraftDocumentsFlow Firestore Admin] Attempting to delete document ID:', input.documentId);
  return deleteAircraftDocumentFlow(input);
}

export async function uploadAircraftDocument(input: z.infer<typeof UploadAircraftDocumentInputSchema>): Promise<z.infer<typeof UploadAircraftDocumentOutputSchema>> {
    return uploadAircraftDocumentFlow(input);
}

const fetchAircraftDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchAircraftDocumentsFlow',
    outputSchema: FetchAircraftDocumentsOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftDocumentsFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftDocumentsFlow.");
    }
    console.log('Executing fetchAircraftDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = db.collection(AIRCRAFT_DOCUMENTS_COLLECTION);
      const q = documentsCollectionRef.orderBy("updatedAt", "desc");
      const snapshot = await q.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveAircraftDocumentFlow.");
    }
    console.log('Executing saveAircraftDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = db.collection(AIRCRAFT_DOCUMENTS_COLLECTION).doc(documentId);
      const docSnap = await documentDocRef.get();

      const dataWithTimestamps = {
        ...documentData,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await documentDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved aircraft document in Firestore:', documentId);
      
      const savedDoc = await documentDocRef.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftDocumentFlow.");
    }
    console.log('Executing deleteAircraftDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = db.collection(AIRCRAFT_DOCUMENTS_COLLECTION).doc(input.documentId);
      await documentDocRef.delete();
      console.log('Deleted aircraft document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting aircraft document from Firestore:', error);
      throw new Error(`Failed to delete aircraft document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const uploadAircraftDocumentFlow = ai.defineFlow(
    {
        name: 'uploadAircraftDocumentFlow',
        inputSchema: UploadAircraftDocumentInputSchema,
        outputSchema: UploadAircraftDocumentOutputSchema,
    },
    async ({ path, file, contentType }) => {
        const bucket = adminStorage.bucket();
        const buffer = Buffer.from(file, 'base64');
        const fileRef = bucket.file(path);

        try {
            await fileRef.save(buffer, {
                metadata: {
                    contentType,
                },
            });

            const [url] = await fileRef.getSignedUrl({
                action: 'read',
                expires: '03-09-2491', // A long time in the future
            });

            return {
                downloadUrl: url,
            };
        } catch (error) {
            console.error('File upload process error:', error);
            throw new Error(`Failed to save file to storage. Details: ${JSON.stringify(error, null, 2)}`);
        }
    }
);

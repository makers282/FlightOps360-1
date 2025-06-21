
'use server';
/**
 * @fileOverview Genkit flows for managing company-wide documents using Firestore.
 *
 * - fetchCompanyDocuments - Fetches all company documents.
 * - saveCompanyDocument - Saves (adds or updates) a company document.
 * - deleteCompanyDocument - Deletes a company document.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { CompanyDocument, SaveCompanyDocumentInput } from '@/ai/schemas/company-document-schemas';
import {
    SaveCompanyDocumentInputSchema,
    SaveCompanyDocumentOutputSchema,
    FetchCompanyDocumentsOutputSchema,
    DeleteCompanyDocumentInputSchema,
    DeleteCompanyDocumentOutputSchema
} from '@/ai/schemas/company-document-schemas';

const COMPANY_DOCUMENTS_COLLECTION = 'companyDocuments';

// Exported async functions that clients will call
export async function fetchCompanyDocuments(): Promise<CompanyDocument[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCompanyDocuments (manage-company-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCompanyDocuments.");
  }
  console.log('[ManageCompanyDocumentsFlow Firestore Admin] Attempting to fetch all company documents.');
  return fetchCompanyDocumentsFlow();
}

export async function saveCompanyDocument(input: SaveCompanyDocumentInput): Promise<CompanyDocument> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCompanyDocument (manage-company-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveCompanyDocument.");
  }
  const documentId = input.id || db.collection(COMPANY_DOCUMENTS_COLLECTION).doc().id;
  console.log('[ManageCompanyDocumentsFlow Firestore Admin] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveCompanyDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveCompanyDocumentInput, 'id'> });
}

export async function deleteCompanyDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCompanyDocument (manage-company-documents-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteCompanyDocument.");
  }
  console.log('[ManageCompanyDocumentsFlow Firestore Admin] Attempting to delete document ID:', input.documentId);
  return deleteCompanyDocumentFlow(input);
}


// Genkit Flow Definitions
const fetchCompanyDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchCompanyDocumentsFlow',
    outputSchema: FetchCompanyDocumentsOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCompanyDocumentsFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchCompanyDocumentsFlow.");
    }
    console.log('Executing fetchCompanyDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = db.collection(COMPANY_DOCUMENTS_COLLECTION);
      const q = documentsCollectionRef.orderBy("updatedAt", "desc"); // Order by most recently updated
      const snapshot = await q.get();
      const documentsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          tags: data.tags || [], // Ensure tags is always an array
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as CompanyDocument;
      });
      console.log('Fetched company documents from Firestore:', documentsList.length, 'documents.');
      return documentsList;
    } catch (error) {
      console.error('Error fetching company documents from Firestore:', error);
      throw new Error(`Failed to fetch company documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// Internal schema for saveCompanyDocumentFlow input
const InternalSaveCompanyDocumentInputSchema = z.object({
    documentId: z.string(),
    documentData: SaveCompanyDocumentInputSchema.omit({ id: true }), 
});

const saveCompanyDocumentFlow = ai.defineFlow(
  {
    name: 'saveCompanyDocumentFlow',
    inputSchema: InternalSaveCompanyDocumentInputSchema,
    outputSchema: SaveCompanyDocumentOutputSchema,
  },
  async ({ documentId, documentData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCompanyDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveCompanyDocumentFlow.");
    }
    console.log('Executing saveCompanyDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = db.collection(COMPANY_DOCUMENTS_COLLECTION).doc(documentId);
      const docSnap = await documentDocRef.get();

      const dataWithTimestamps = {
        ...documentData,
        tags: documentData.tags || [], // Ensure tags is an array
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await documentDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved company document in Firestore:', documentId);
      
      const savedDoc = await documentDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved company document data from Firestore.");
      }

      return {
        id: documentId,
        ...savedData,
        tags: savedData.tags || [],
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as CompanyDocument;
    } catch (error) {
      console.error('Error saving company document to Firestore:', error);
      throw new Error(`Failed to save company document ${documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteCompanyDocumentFlow = ai.defineFlow(
  {
    name: 'deleteCompanyDocumentFlow',
    inputSchema: DeleteCompanyDocumentInputSchema,
    outputSchema: DeleteCompanyDocumentOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCompanyDocumentFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteCompanyDocumentFlow.");
    }
    console.log('Executing deleteCompanyDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = db.collection(COMPANY_DOCUMENTS_COLLECTION).doc(input.documentId);
      await documentDocRef.delete();
      console.log('Deleted company document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting company document from Firestore:', error);
      throw new Error(`Failed to delete company document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


'use server';
/**
 * @fileOverview Genkit flows for managing company-wide documents using Firestore.
 *
 * - fetchCompanyDocuments - Fetches all company documents.
 * - saveCompanyDocument - Saves (adds or updates) a company document.
 * - deleteCompanyDocument - Deletes a company document.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp, getDoc, query, orderBy } from 'firebase/firestore';
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
  console.log('[ManageCompanyDocumentsFlow Firestore] Attempting to fetch all company documents.');
  return fetchCompanyDocumentsFlow();
}

export async function saveCompanyDocument(input: SaveCompanyDocumentInput): Promise<CompanyDocument> {
  const documentId = input.id || doc(collection(db, COMPANY_DOCUMENTS_COLLECTION)).id;
  console.log('[ManageCompanyDocumentsFlow Firestore] Attempting to save document:', documentId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }
  
  return saveCompanyDocumentFlow({ documentId, documentData: dataToSaveInDb as Omit<SaveCompanyDocumentInput, 'id'> });
}

export async function deleteCompanyDocument(input: { documentId: string }): Promise<{ success: boolean; documentId: string }> {
  console.log('[ManageCompanyDocumentsFlow Firestore] Attempting to delete document ID:', input.documentId);
  return deleteCompanyDocumentFlow(input);
}


// Genkit Flow Definitions
const fetchCompanyDocumentsFlow = ai.defineFlow(
  {
    name: 'fetchCompanyDocumentsFlow',
    outputSchema: FetchCompanyDocumentsOutputSchema,
  },
  async () => {
    console.log('Executing fetchCompanyDocumentsFlow - Firestore');
    try {
      const documentsCollectionRef = collection(db, COMPANY_DOCUMENTS_COLLECTION);
      const q = query(documentsCollectionRef, orderBy("updatedAt", "desc")); // Order by most recently updated
      const snapshot = await getDocs(q);
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
    console.log('Executing saveCompanyDocumentFlow with input - Firestore:', documentId);
    try {
      const documentDocRef = doc(db, COMPANY_DOCUMENTS_COLLECTION, documentId);
      const docSnap = await getDoc(documentDocRef);

      const dataWithTimestamps = {
        ...documentData,
        tags: documentData.tags || [], // Ensure tags is an array
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(documentDocRef, dataWithTimestamps, { merge: true });
      console.log('Saved company document in Firestore:', documentId);
      
      const savedDoc = await getDoc(documentDocRef);
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
    console.log('Executing deleteCompanyDocumentFlow for document ID - Firestore:', input.documentId);
    try {
      const documentDocRef = doc(db, COMPANY_DOCUMENTS_COLLECTION, input.documentId);
      await deleteDoc(documentDocRef);
      console.log('Deleted company document from Firestore:', input.documentId);
      return { success: true, documentId: input.documentId };
    } catch (error) {
      console.error('Error deleting company document from Firestore:', error);
      throw new Error(`Failed to delete company document ${input.documentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

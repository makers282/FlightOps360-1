
'use server';
/**
 * @fileOverview Genkit flows for managing quotes using Firestore.
 *
 * - saveQuote - Saves (adds or updates) a quote.
 * - fetchQuotes - Fetches all quotes.
 * - fetchQuoteById - Fetches a single quote by its ID.
 * - deleteQuote - Deletes a quote.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Quote, SaveQuoteInput } from '@/ai/schemas/quote-schemas';
import { 
    QuoteSchema,
    SaveQuoteInputSchema, 
    SaveQuoteOutputSchema,
    FetchQuotesOutputSchema,
    FetchQuoteByIdInputSchema,
    DeleteQuoteInputSchema,
    DeleteQuoteOutputSchema,
} from '@/ai/schemas/quote-schemas';

const QUOTES_COLLECTION = 'quotes';

// Exported async functions that clients will call
export async function saveQuote(input: SaveQuoteInput): Promise<Quote> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveQuote (manage-quotes-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveQuote.");
  }
  console.log('[ManageQuotesFlow Firestore Admin] Attempting to save quote ID:', input.quoteId);
  // The document ID in Firestore is the user-facing quoteId for this collection
  const firestoreDocId = input.quoteId; 
  return saveQuoteFlow({ firestoreDocId, quoteData: input });
}

const InternalSaveQuoteInputSchema = z.object({
  firestoreDocId: z.string(),
  quoteData: SaveQuoteInputSchema,
});

const saveQuoteFlow = ai.defineFlow(
  {
    name: 'saveQuoteFlow',
    inputSchema: InternalSaveQuoteInputSchema,
    outputSchema: SaveQuoteOutputSchema, 
  },
  async ({ firestoreDocId, quoteData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveQuoteFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveQuoteFlow.");
    }
    console.log('Executing saveQuoteFlow with input - Firestore, Doc ID:', firestoreDocId);
    
    const quoteDocRef = db.collection(QUOTES_COLLECTION).doc(firestoreDocId);
    
    try {
      const docSnap = await quoteDocRef.get();
      let finalDataToSave;

      if (docSnap.exists) { // Corrected: .exists is a property
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, 
          createdAt: docSnap.data()?.createdAt, 
          updatedAt: FieldValue.serverTimestamp(),
        };
      } else {
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, 
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      }
      
      await quoteDocRef.set(finalDataToSave, { merge: true });
      console.log('Saved quote in Firestore:', firestoreDocId);

      const savedDoc = await quoteDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved quote data from Firestore.");
      }
      
      const outputQuote: Quote = {
        id: savedData.id,
        quoteId: savedData.quoteId,
        selectedCustomerId: savedData.selectedCustomerId,
        clientName: savedData.clientName,
        clientEmail: savedData.clientEmail,
        clientPhone: savedData.clientPhone,
        aircraftId: savedData.aircraftId,
        aircraftLabel: savedData.aircraftLabel,
        legs: savedData.legs,
        options: savedData.options,
        lineItems: savedData.lineItems,
        totalBuyCost: savedData.totalBuyCost,
        totalSellPrice: savedData.totalSellPrice,
        marginAmount: savedData.marginAmount,
        marginPercentage: savedData.marginPercentage,
        status: savedData.status,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      };
      return outputQuote;
    } catch (error) {
      console.error('Error saving quote to Firestore:', error);
      throw new Error(`Failed to save quote ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

export async function fetchQuotes(): Promise<Quote[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchQuotes (manage-quotes-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchQuotes.");
  }
  console.log('[ManageQuotesFlow Firestore Admin] Attempting to fetch all quotes.');
  return fetchQuotesFlow();
}

const fetchQuotesFlow = ai.defineFlow(
  {
    name: 'fetchQuotesFlow',
    outputSchema: FetchQuotesOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchQuotesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchQuotesFlow.");
    }
    console.log('Executing fetchQuotesFlow - Firestore');
    try {
      const quotesCollectionRef = db.collection(QUOTES_COLLECTION);
      const q = quotesCollectionRef.orderBy("createdAt", "desc");
      const snapshot = await q.get();
      const quotesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Quote;
      });
      console.log('Fetched quotes from Firestore:', quotesList.length, 'quotes.');
      return quotesList;
    } catch (error) {
      console.error('Error fetching quotes from Firestore:', error);
      throw new Error(`Failed to fetch quotes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

export async function fetchQuoteById(input: { id: string }): Promise<Quote | null> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchQuoteById (manage-quotes-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchQuoteById.");
  }
  console.log('[ManageQuotesFlow Firestore Admin] Attempting to fetch quote by ID:', input.id);
  return fetchQuoteByIdFlow(input);
}

const fetchQuoteByIdFlow = ai.defineFlow(
  {
    name: 'fetchQuoteByIdFlow',
    inputSchema: FetchQuoteByIdInputSchema,
    outputSchema: QuoteSchema.nullable(),
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchQuoteByIdFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchQuoteByIdFlow.");
    }
    console.log('Executing fetchQuoteByIdFlow - Firestore for ID:', input.id);
    try {
      const quoteDocRef = db.collection(QUOTES_COLLECTION).doc(input.id);
      const docSnap = await quoteDocRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        const quote: Quote = {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Quote; 
        console.log('Fetched quote by ID from Firestore:', quote);
        return quote;
      } else {
        console.log('No quote found with ID:', input.id);
        return null;
      }
    } catch (error) {
      console.error('Error fetching quote by ID from Firestore:', error);
      throw new Error(`Failed to fetch quote ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

export async function deleteQuote(input: { id: string }): Promise<{ success: boolean; quoteId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteQuote (manage-quotes-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteQuote.");
  }
    console.log('[ManageQuotesFlow Firestore Admin] Attempting to delete quote ID:', input.id);
    return deleteQuoteFlow(input);
}

const deleteQuoteFlow = ai.defineFlow(
  {
    name: 'deleteQuoteFlow',
    inputSchema: DeleteQuoteInputSchema, // Expects { id: string }
    outputSchema: DeleteQuoteOutputSchema, // Expects { success: boolean, quoteId: string }
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteQuoteFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteQuoteFlow.");
    }
    console.log('Executing deleteQuoteFlow for quote ID - Firestore:', input.id);
    try {
      const quoteDocRef = db.collection(QUOTES_COLLECTION).doc(input.id);
      const docSnap = await quoteDocRef.get();

      if (!docSnap.exists) {
          console.warn(`Quote with ID ${input.id} not found for deletion.`);
          return { success: true, quoteId: input.id };
      }
      
      const quoteIdForConfirmation = docSnap.data()?.quoteId || input.id;
      await quoteDocRef.delete();
      console.log('Deleted quote from Firestore:', input.id);
      return { success: true, quoteId: quoteIdForConfirmation };
    } catch (error) {
      const quoteDoc = await db.collection(QUOTES_COLLECTION).doc(input.id).get();
      const quoteIdForConfirmation = quoteDoc.exists ? (quoteDoc.data()?.quoteId || input.id) : input.id;
      throw new Error(`Failed to delete quote ${quoteIdForConfirmation}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

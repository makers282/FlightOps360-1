
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
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
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

// Exported async function that clients will call
export async function saveQuote(input: SaveQuoteInput): Promise<Quote> {
  console.log('[ManageQuotesFlow Firestore] Attempting to save quote ID:', input.quoteId);
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
    console.log('Executing saveQuoteFlow with input - Firestore, Doc ID:', firestoreDocId);
    
    const quoteDocRef = doc(db, QUOTES_COLLECTION, firestoreDocId);
    
    try {
      const docSnap = await getDoc(quoteDocRef);
      let finalDataToSave;

      if (docSnap.exists()) {
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, 
          createdAt: docSnap.data().createdAt, 
          updatedAt: serverTimestamp(),
        };
      } else {
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      }
      
      await setDoc(quoteDocRef, finalDataToSave, { merge: true });
      console.log('Saved quote in Firestore:', firestoreDocId);

      const savedDoc = await getDoc(quoteDocRef);
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
  console.log('[ManageQuotesFlow Firestore] Attempting to fetch all quotes.');
  return fetchQuotesFlow();
}

const fetchQuotesFlow = ai.defineFlow(
  {
    name: 'fetchQuotesFlow',
    outputSchema: FetchQuotesOutputSchema,
  },
  async () => {
    console.log('Executing fetchQuotesFlow - Firestore');
    try {
      const quotesCollectionRef = collection(db, QUOTES_COLLECTION);
      const q = query(quotesCollectionRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
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
  console.log('[ManageQuotesFlow Firestore] Attempting to fetch quote by ID:', input.id);
  return fetchQuoteByIdFlow(input);
}

const fetchQuoteByIdFlow = ai.defineFlow(
  {
    name: 'fetchQuoteByIdFlow',
    inputSchema: FetchQuoteByIdInputSchema,
    outputSchema: QuoteSchema.nullable(),
  },
  async (input) => {
    console.log('Executing fetchQuoteByIdFlow - Firestore for ID:', input.id);
    try {
      const quoteDocRef = doc(db, QUOTES_COLLECTION, input.id);
      const docSnap = await getDoc(quoteDocRef);

      if (docSnap.exists()) {
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
    console.log('[ManageQuotesFlow Firestore] Attempting to delete quote ID:', input.id);
    return deleteQuoteFlow(input);
}

const deleteQuoteFlow = ai.defineFlow(
  {
    name: 'deleteQuoteFlow',
    inputSchema: DeleteQuoteInputSchema, // Expects { id: string }
    outputSchema: DeleteQuoteOutputSchema, // Expects { success: boolean, quoteId: string }
  },
  async (input) => {
    console.log('Executing deleteQuoteFlow for quote ID - Firestore:', input.id);
    try {
      const quoteDocRef = doc(db, QUOTES_COLLECTION, input.id);
      const docSnap = await getDoc(quoteDocRef);

      if (!docSnap.exists()) {
          console.warn(`Quote with ID ${input.id} not found for deletion.`);
          // It's often better to return success: true if the item is already gone,
          // or success: false if strict confirmation of deletion action is needed.
          // For user feedback, confirming it's gone is usually fine.
          return { success: true, quoteId: input.id };
      }
      
      await deleteDoc(quoteDocRef);
      console.log('Deleted quote from Firestore:', input.id);
      return { success: true, quoteId: input.id };
    } catch (error) {
      console.error('Error deleting quote from Firestore:', error);
      // Return quoteId from input as the schema expects it, even on failure.
      throw new Error(`Failed to delete quote ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

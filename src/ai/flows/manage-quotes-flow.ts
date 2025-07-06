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
import { differenceInDays, parseISO } from 'date-fns';

const QUOTES_COLLECTION = 'quotes';

// Exported async functions that clients will call
export async function saveQuote(input: SaveQuoteInput): Promise<Quote> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveQuote (manage-quotes-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveQuote.");
  }
  console.log('[ManageQuotesFlow Firestore Admin] Attempting to save quote ID:', input.quoteId);
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

      if (docSnap.exists) {
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
    console.log('Executing fetchQuotesFlow with auto-expiry logic - Firestore');
    try {
      const quotesCollectionRef = db.collection(QUOTES_COLLECTION);
      const snapshot = await quotesCollectionRef.get();
      
      const now = new Date();
      const quotesToUpdate: { ref: FirebaseFirestore.DocumentReference, data: Quote }[] = [];
      const allQuotes: Quote[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let quote: Quote = {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Quote;
        
        // Auto-expiry logic
        if ((quote.status === 'Draft' || quote.status === 'Sent')) {
          const createdAtDate = parseISO(quote.createdAt);
          if (differenceInDays(now, createdAtDate) > 7) {
            console.log(`[Auto-Expiry] Quote ${quote.quoteId} is older than 7 days. Marking as Expired.`);
            quote.status = 'Expired'; // Update status in memory for immediate return
            quotesToUpdate.push({ ref: docSnapshot.ref, data: quote });
          }
        }
        allQuotes.push(quote);
      }

      // If there are quotes to update, commit them in a batch.
      if (quotesToUpdate.length > 0) {
        const batch = db.batch();
        quotesToUpdate.forEach(({ ref }) => {
          batch.update(ref, { status: 'Expired', updatedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit();
        console.log(`[Auto-Expiry] Committed updates for ${quotesToUpdate.length} expired quotes.`);
      }

      // Sort the final list before returning
      allQuotes.sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());

      console.log('Fetched and processed quotes from Firestore:', allQuotes.length, 'quotes.');
      return allQuotes;
      
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
      
      await quoteDocRef.delete();
      console.log('Deleted quote from Firestore:', input.id);
      return { success: true, quoteId: input.id };
    } catch (error) {
      console.error('Error deleting quote from Firestore:', error);
      // Return quoteId from input as the schema expects it, even on failure.
      throw new Error(`Failed to delete quote ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

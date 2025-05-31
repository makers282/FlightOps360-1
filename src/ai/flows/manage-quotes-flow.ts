
'use server';
/**
 * @fileOverview Genkit flows for managing quotes using Firestore.
 *
 * - saveQuote - Saves (adds or updates) a quote.
 * - fetchQuotes - Fetches all quotes (future use).
 * - fetchQuoteById - Fetches a single quote by its ID (future use).
 * - deleteQuote - Deletes a quote (future use).
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Quote, SaveQuoteInput } from '@/ai/schemas/quote-schemas';
import { 
    SaveQuoteInputSchema, 
    SaveQuoteOutputSchema,
    // FetchQuotesOutputSchema, // For future use
    // FetchQuoteByIdInputSchema, // For future use
    // DeleteQuoteInputSchema, // For future use
    // DeleteQuoteOutputSchema, // For future use
} from '@/ai/schemas/quote-schemas';

const QUOTES_COLLECTION = 'quotes';

// Exported async function that clients will call
export async function saveQuote(input: SaveQuoteInput): Promise<Quote> {
  console.log('[ManageQuotesFlow Firestore] Attempting to save quote ID:', input.quoteId);
  // The document ID will be the quoteId for simplicity here
  const quoteToSaveInDb = {
    ...input,
    createdAt: Timestamp.now(), // Use Firestore Timestamp for creation
    updatedAt: Timestamp.now(), // Use Firestore Timestamp for update
  };
  return saveQuoteFlow(quoteToSaveInDb as any); // Cast because flow expects serverTimestamp structure conceptually
}

// Genkit Flow Definition
const saveQuoteFlow = ai.defineFlow(
  {
    name: 'saveQuoteFlow',
    inputSchema: SaveQuoteInputSchema.extend({ // Conceptually, flow receives data that includes server timestamps
        createdAt: z.any(), // Allow Timestamp type from Firestore
        updatedAt: z.any(),
    }),
    outputSchema: SaveQuoteOutputSchema,
  },
  async (quoteDataWithTimestamps) => {
    console.log('Executing saveQuoteFlow with input - Firestore:', quoteDataWithTimestamps.quoteId);
    
    // Convert Firestore Timestamps to ISO strings for the final output object
    // as the QuoteSchema expects strings for createdAt/updatedAt.
    const convertTimestampToString = (timestamp: any): string | undefined => {
        if (timestamp instanceof Timestamp) {
            return timestamp.toDate().toISOString();
        }
        if (typeof timestamp === 'string') return timestamp; // Already a string
        return undefined;
    };
    
    const dataForFirestore = {
      ...quoteDataWithTimestamps,
      // Timestamps are already in the correct Firestore format
    };
    
    // The document ID in Firestore will be the quoteData.quoteId
    const quoteDocRef = doc(db, QUOTES_COLLECTION, quoteDataWithTimestamps.quoteId);
    
    try {
      await setDoc(quoteDocRef, dataForFirestore, { merge: true }); // Use merge to handle updates if ID exists
      console.log('Saved quote in Firestore:', quoteDataWithTimestamps.quoteId);

      // Prepare the output to match QuoteSchema (timestamps as ISO strings)
      const outputQuote: Quote = {
        ...quoteDataWithTimestamps,
        id: quoteDataWithTimestamps.quoteId, // Set the id field from quoteId
        createdAt: convertTimestampToString(quoteDataWithTimestamps.createdAt),
        updatedAt: convertTimestampToString(quoteDataWithTimestamps.updatedAt),
      };
      return outputQuote;
    } catch (error) {
      console.error('Error saving quote to Firestore:', error);
      throw new Error(`Failed to save quote ${quoteDataWithTimestamps.quoteId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// Future flows (stubs for now)
/*
export async function fetchQuotes(): Promise<Quote[]> {
  console.log('[ManageQuotesFlow Firestore] Attempting to fetch all quotes.');
  // return fetchQuotesFlow();
  return []; // Placeholder
}

export async function fetchQuoteById(input: { quoteId: string }): Promise<Quote | null> {
  console.log('[ManageQuotesFlow Firestore] Attempting to fetch quote by ID:', input.quoteId);
  // return fetchQuoteByIdFlow(input);
  return null; // Placeholder
}

export async function deleteQuote(input: { quoteId: string }): Promise<{ success: boolean; quoteId: string }> {
    console.log('[ManageQuotesFlow Firestore] Attempting to delete quote ID:', input.quoteId);
    // return deleteQuoteFlow(input);
    return { success: false, quoteId: input.quoteId }; // Placeholder
}
*/

// Placeholder Genkit flow definitions for future use
/*
const fetchQuotesFlow = ai.defineFlow(
  {
    name: 'fetchQuotesFlow',
    outputSchema: FetchQuotesOutputSchema,
  },
  async () => {
    // Implementation to fetch all quotes
    return [];
  }
);

const fetchQuoteByIdFlow = ai.defineFlow(
  {
    name: 'fetchQuoteByIdFlow',
    inputSchema: FetchQuoteByIdInputSchema,
    outputSchema: QuoteSchema.nullable(),
  },
  async (input) => {
    // Implementation to fetch a single quote
    return null;
  }
);

const deleteQuoteFlow = ai.defineFlow(
  {
    name: 'deleteQuoteFlow',
    inputSchema: DeleteQuoteInputSchema,
    outputSchema: DeleteQuoteOutputSchema,
  },
  async (input) => {
    // Implementation to delete a quote
    return { success: false, quoteId: input.quoteId };
  }
);
*/

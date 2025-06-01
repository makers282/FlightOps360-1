
'use server';
/**
 * @fileOverview Genkit flows for managing quotes using Firestore.
 *
 * - saveQuote - Saves (adds or updates) a quote.
 * - fetchQuotes - Fetches all quotes.
 * - fetchQuoteById - Fetches a single quote by its ID.
 * - deleteQuote - Deletes a quote (future use).
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore';
import { z } from 'zod'; // Ensure z is imported
import type { Quote, SaveQuoteInput } from '@/ai/schemas/quote-schemas';
import { 
    QuoteSchema, // Used for output type
    SaveQuoteInputSchema, 
    SaveQuoteOutputSchema,
    FetchQuotesOutputSchema,
    FetchQuoteByIdInputSchema, // For fetching a single quote
    // DeleteQuoteInputSchema, // For future use
    // DeleteQuoteOutputSchema, // For future use
} from '@/ai/schemas/quote-schemas';

const QUOTES_COLLECTION = 'quotes';

// Exported async function that clients will call
export async function saveQuote(input: SaveQuoteInput): Promise<Quote> {
  console.log('[ManageQuotesFlow Firestore] Attempting to save quote ID:', input.quoteId);
  // The document ID in Firestore will be the input.quoteId for simplicity of retrieval using user-facing ID.
  const firestoreDocId = input.quoteId; 
  return saveQuoteFlow({ firestoreDocId, quoteData: input });
}

// Internal schema for the flow, including the Firestore document ID
const InternalSaveQuoteInputSchema = z.object({
  firestoreDocId: z.string(),
  quoteData: SaveQuoteInputSchema,
});


// Genkit Flow Definition
const saveQuoteFlow = ai.defineFlow(
  {
    name: 'saveQuoteFlow',
    inputSchema: InternalSaveQuoteInputSchema,
    outputSchema: SaveQuoteOutputSchema, // This is QuoteSchema
  },
  async ({ firestoreDocId, quoteData }) => {
    console.log('Executing saveQuoteFlow with input - Firestore, Doc ID:', firestoreDocId);
    
    const quoteDocRef = doc(db, QUOTES_COLLECTION, firestoreDocId);
    
    try {
      const docSnap = await getDoc(quoteDocRef);
      let finalDataToSave;

      if (docSnap.exists()) {
        // Document exists, merge data and update timestamp
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, // Ensure ID is part of the document data
          createdAt: docSnap.data().createdAt, // Preserve original createdAt
          updatedAt: serverTimestamp(),
        };
      } else {
        // Document does not exist, set createdAt and updatedAt
        finalDataToSave = {
          ...quoteData,
          id: firestoreDocId, // Ensure ID is part of the document data
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      }
      
      await setDoc(quoteDocRef, finalDataToSave, { merge: true }); // Use merge true to handle updates smoothly
      console.log('Saved quote in Firestore:', firestoreDocId);

      // Fetch the document again to get server-generated timestamps
      const savedDoc = await getDoc(quoteDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved quote data from Firestore.");
      }
      
      // Prepare the output to match QuoteSchema (timestamps as ISO strings)
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

// Fetch all quotes
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
      // Order by createdAt in descending order to get newest quotes first
      const q = query(quotesCollectionRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const quotesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, // This is the Firestore document ID
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

// Fetch a single quote by its Firestore document ID
export async function fetchQuoteById(input: { id: string }): Promise<Quote | null> {
  console.log('[ManageQuotesFlow Firestore] Attempting to fetch quote by ID:', input.id);
  return fetchQuoteByIdFlow(input);
}

const fetchQuoteByIdFlow = ai.defineFlow(
  {
    name: 'fetchQuoteByIdFlow',
    inputSchema: FetchQuoteByIdInputSchema, // Expects { id: string }
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
        } as Quote; // Type assertion
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


// Future flows (stubs for now)
/*
export async function deleteQuote(input: { quoteId: string }): Promise<{ success: boolean; quoteId: string }> {
    console.log('[ManageQuotesFlow Firestore] Attempting to delete quote ID:', input.quoteId);
    // return deleteQuoteFlow(input);
    return { success: false, quoteId: input.quoteId }; // Placeholder
}
*/

// Placeholder Genkit flow definitions for future use
/*
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


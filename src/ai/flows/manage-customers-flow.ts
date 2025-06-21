
'use server';
/**
 * @fileOverview Genkit flows for managing customer data using Firestore.
 *
 * - fetchCustomers - Fetches all customers.
 * - saveCustomer - Saves (adds or updates) a customer.
 * - deleteCustomer - Deletes a customer.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';
import { 
    CustomerSchema,
    SaveCustomerInputSchema, 
    SaveCustomerOutputSchema,
    FetchCustomersOutputSchema,
    DeleteCustomerInputSchema,
    DeleteCustomerOutputSchema
} from '@/ai/schemas/customer-schemas';
import { z } from 'zod';

const CUSTOMERS_COLLECTION = 'customers';

// Exported async functions that clients will call
export async function fetchCustomers(): Promise<Customer[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCustomers (manage-customers-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchCustomers.");
  }
  console.log('[ManageCustomersFlow Firestore Admin] Attempting to fetch all customers.');
  return fetchCustomersFlow();
}

export async function saveCustomer(input: SaveCustomerInput): Promise<Customer> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCustomer (manage-customers-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveCustomer.");
  }
  console.log('[ManageCustomersFlow Firestore Admin] Attempting to save customer:', input.id || 'new customer');
  // If ID is not provided, generate one for Firestore
  const customerId = input.id || db.collection(CUSTOMERS_COLLECTION).doc().id;
  
  const dataToSaveInDb = {
    ...input,
    isActive: input.isActive === undefined ? true : input.isActive, // Default isActive to true if not provided
    // Timestamps are handled by serverTimestamp in the flow
  };
  // Remove id from data if it was passed in, as it's the doc key
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id; // Cast to any to allow deletion of 'id' for type safety with spread
  }

  return saveCustomerFlow({ customerId, customerData: dataToSaveInDb as Omit<SaveCustomerInput, 'id'> });
}

export async function deleteCustomer(input: { customerId: string }): Promise<{ success: boolean; customerId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCustomer (manage-customers-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteCustomer.");
  }
  console.log('[ManageCustomersFlow Firestore Admin] Attempting to delete customer ID:', input.customerId);
  return deleteCustomerFlow(input);
}


// Genkit Flow Definitions
const fetchCustomersFlow = ai.defineFlow(
  {
    name: 'fetchCustomersFlow',
    outputSchema: FetchCustomersOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchCustomersFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchCustomersFlow.");
    }
    console.log('Executing fetchCustomersFlow - Firestore');
    try {
      const customersCollectionRef = db.collection(CUSTOMERS_COLLECTION);
      const snapshot = await customersCollectionRef.get();
      const customersList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        // Convert Firestore Timestamps to ISO strings
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          isActive: data.isActive === undefined ? true : data.isActive, // Ensure isActive has a default for older data
        } as Customer;
      });
      console.log('Fetched customers from Firestore:', customersList.length, 'customers.');
      return customersList;
    } catch (error) {
      console.error('Error fetching customers from Firestore:', error);
      throw new Error(`Failed to fetch customers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const InternalSaveCustomerInputSchema = z.object({
    customerId: z.string(),
    customerData: SaveCustomerInputSchema.omit({id: true}), // Data without the ID field
});

const saveCustomerFlow = ai.defineFlow(
  {
    name: 'saveCustomerFlow',
    inputSchema: InternalSaveCustomerInputSchema, // Expects customerId and the data separately
    outputSchema: SaveCustomerOutputSchema,
  },
  async ({ customerId, customerData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveCustomerFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveCustomerFlow.");
    }
    console.log('Executing saveCustomerFlow with input - Firestore:', customerId);
    try {
      const customerDocRef = db.collection(CUSTOMERS_COLLECTION).doc(customerId);
      
      const docSnap = await customerDocRef.get();
      const dataWithTimestamps = {
        ...customerData,
        isActive: customerData.isActive === undefined ? true : customerData.isActive, // Default again before saving
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(), // Preserve original createdAt if doc exists
      };

      await customerDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved customer in Firestore:', customerId);
      
      const savedDoc = await customerDocRef.get();
      const savedData = savedDoc.data();

      return {
        id: customerId,
        ...savedData,
        createdAt: (savedData?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData?.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        isActive: savedData?.isActive === undefined ? true : savedData.isActive,
      } as Customer; 
    } catch (error) {
      console.error('Error saving customer to Firestore:', error);
      throw new Error(`Failed to save customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteCustomerFlow = ai.defineFlow(
  {
    name: 'deleteCustomerFlow',
    inputSchema: DeleteCustomerInputSchema,
    outputSchema: DeleteCustomerOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteCustomerFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteCustomerFlow.");
    }
    console.log('Executing deleteCustomerFlow for customer ID - Firestore:', input.customerId);
    try {
      const customerDocRef = db.collection(CUSTOMERS_COLLECTION).doc(input.customerId);
      await customerDocRef.delete();
      console.log('Deleted customer from Firestore:', input.customerId);
      return { success: true, customerId: input.customerId };
    } catch (error) {
      console.error('Error deleting customer from Firestore:', error);
      throw new Error(`Failed to delete customer ${input.customerId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

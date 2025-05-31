
/**
 * @fileOverview Zod schemas and TypeScript types for customer data.
 */
import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the customer."),
  name: z.string().min(1, "Customer name is required."),
  company: z.string().optional().describe("Company name, if applicable."),
  email: z.string().email("Invalid email format."),
  phone: z.string().optional().describe("Contact phone number."),
  notes: z.string().optional().describe("General notes about the customer."),
  lastActivity: z.string().optional().describe("Timestamp of last interaction or activity."), // Keeping for now, can be enhanced later
  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type Customer = z.infer<typeof CustomerSchema>;

// Schema for saving a customer (input to the flow)
// id is optional: if provided, it's an update; if not, it's a new customer.
// createdAt and updatedAt will be handled by the server.
export const SaveCustomerInputSchema = CustomerSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), // ID is optional for creation, required for update by assigning it before calling save
});
export type SaveCustomerInput = z.infer<typeof SaveCustomerInputSchema>;

// Schema for the output of the save operation (the full customer with server fields)
export const SaveCustomerOutputSchema = CustomerSchema;

// For fetching multiple customers (output schema)
export const FetchCustomersOutputSchema = z.array(CustomerSchema);

// For deleting a customer
export const DeleteCustomerInputSchema = z.object({
  customerId: z.string(),
});
export const DeleteCustomerOutputSchema = z.object({
  success: z.boolean(),
  customerId: z.string(),
});

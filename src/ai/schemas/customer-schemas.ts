
/**
 * @fileOverview Zod schemas and TypeScript types for customer data.
 */
import { z } from 'zod';

export const customerTypes = ["Charter", "Owner", "Internal", "Retail", "Broker", "Other"] as const;

export const CustomerSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the customer."),
  name: z.string().min(1, "Customer name is required (can be company or individual)."),
  customerType: z.enum(customerTypes).default("Charter").describe("Type of customer."),
  
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  
  email: z.string().email("Invalid email format.").optional().or(z.literal('')), // Main email can be optional if contact person has one
  email2: z.string().email("Invalid email format.").optional().or(z.literal('')),
  
  phone: z.string().optional(), // Main phone
  phone2: z.string().optional(),

  streetAddress1: z.string().optional(),
  streetAddress2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(), // Or province
  postalCode: z.string().optional(),
  country: z.string().optional(),

  startDate: z.string().optional().describe("YYYY-MM-DD format, when the customer record started or became active."),
  isActive: z.boolean().default(true).describe("Whether the customer is currently active."),
  
  internalNotes: z.string().optional().describe("General internal notes about the customer."),
  crewNotes: z.string().optional().describe("Specific notes for crew regarding this customer."),

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


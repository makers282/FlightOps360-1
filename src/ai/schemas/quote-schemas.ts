
/**
 * @fileOverview Zod schemas and TypeScript types for quotes.
 */
import { z } from 'zod';
// Removed import of legTypes from client component

// Define legTypes here
export const legTypes = [ 
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

// Schema for individual line items in the cost breakdown
export const QuoteLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  buyRate: z.number(),
  sellRate: z.number(),
  unitDescription: z.string(),
  quantity: z.number(),
  buyTotal: z.number(),
  sellTotal: z.number(),
});
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

// Schema for individual legs within a quote
export const QuoteLegSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDateTime: z.string().optional().describe("ISO string format"), // Store as ISO string
  legType: z.enum(legTypes),
  passengerCount: z.number().int().min(0),
  originFbo: z.string().optional(),
  destinationFbo: z.string().optional(),
  originTaxiTimeMinutes: z.number().min(0).optional(),
  destinationTaxiTimeMinutes: z.number().min(0).optional(),
  flightTimeHours: z.number().min(0).optional(),
  calculatedBlockTimeHours: z.number().min(0).optional(),
});
export type QuoteLeg = z.infer<typeof QuoteLegSchema>;

export const quoteStatuses = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Booked", "Cancelled"] as const;

// Main schema for a quote document
export const QuoteSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the quote."), // This is the Firestore doc ID
  quoteId: z.string().describe("User-facing Quote ID (might be same as id or a custom format)."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string(),
  clientEmail: z.string().email(),
  clientPhone: z.string().optional(),
  
  aircraftId: z.string().optional(),
  aircraftLabel: z.string().optional().describe("Display label for the aircraft, e.g., N123AB - Cessna CJ3"),

  legs: z.array(QuoteLegSchema),
  
  options: z.object({
    medicsRequested: z.boolean().optional(),
    cateringRequested: z.boolean().optional(),
    includeLandingFees: z.boolean().optional(),
    estimatedOvernights: z.number().int().min(0).optional(),
    fuelSurchargeRequested: z.boolean().optional(),
    cateringNotes: z.string().optional(),
    notes: z.string().optional(),
    sellPriceFuelSurchargePerHour: z.number().optional(),
    sellPriceMedics: z.number().optional(),
    sellPriceCatering: z.number().optional(),
    sellPriceLandingFeePerLeg: z.number().optional(),
    sellPriceOvernight: z.number().optional(),
  }),

  lineItems: z.array(QuoteLineItemSchema),
  totalBuyCost: z.number(),
  totalSellPrice: z.number(),
  marginAmount: z.number(),
  marginPercentage: z.number(),

  status: z.enum(quoteStatuses).default("Draft"),
  createdAt: z.string().describe("ISO string format, server-generated timestamp."), 
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."), 
  // userId: z.string().optional().describe("ID of the user who created the quote."), // For future use
});
export type Quote = z.infer<typeof QuoteSchema>;

// Schema for saving a quote (input to the flow)
// id, createdAt and updatedAt will be handled by the server
export const SaveQuoteInputSchema = QuoteSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type SaveQuoteInput = z.infer<typeof SaveQuoteInputSchema>;

// Schema for the output of the save operation (the full quote with server fields)
export const SaveQuoteOutputSchema = QuoteSchema;

// For fetching multiple quotes (output schema)
export const FetchQuotesOutputSchema = z.array(QuoteSchema);

// For fetching a single quote by ID (input schema)
export const FetchQuoteByIdInputSchema = z.object({
  id: z.string(), // Using the Firestore document ID here
});

// For deleting a quote
export const DeleteQuoteInputSchema = z.object({
  id: z.string(),  // Using the Firestore document ID here
});
export const DeleteQuoteOutputSchema = z.object({
  success: z.boolean(),
  quoteId: z.string(), // Return the user-facing quoteId for confirmation
});

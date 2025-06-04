
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft-specific document data.
 */
import { z } from 'zod';

export const aircraftDocumentTypes = [
  "Registration", "Airworthiness Certificate", "Insurance Policy",
  "Maintenance Log Summary", "Weight & Balance", "MEL (Minimum Equipment List)",
  "Radio Station License", "Noise Certificate", "Other"
] as const;
export type AircraftDocumentType = typeof aircraftDocumentTypes[number];

export const AircraftDocumentSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the aircraft document."),
  aircraftId: z.string().min(1, "Aircraft ID is required."),
  aircraftTailNumber: z.string().optional().describe("Denormalized tail number for easier display."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(aircraftDocumentTypes).default("Other").describe("Type of the document."),
  
  issueDate: z.string().optional().describe("YYYY-MM-DD format, when the document was issued."),
  expiryDate: z.string().optional().describe("YYYY-MM-DD format, when the document expires."),
  
  fileUrl: z.string().optional().describe("Placeholder for the actual file URL (future implementation)."),
  notes: z.string().optional().describe("Any notes related to the document."),

  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type AircraftDocument = z.infer<typeof AircraftDocumentSchema>;

// Schema for saving a document (input to the flow)
export const SaveAircraftDocumentInputSchema = AircraftDocumentSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), // ID is optional for creation
});
export type SaveAircraftDocumentInput = z.infer<typeof SaveAircraftDocumentInputSchema>;

// Schema for the output of the save operation
export const SaveAircraftDocumentOutputSchema = AircraftDocumentSchema;

// For fetching multiple documents
export const FetchAircraftDocumentsOutputSchema = z.array(AircraftDocumentSchema);

// For deleting a document
export const DeleteAircraftDocumentInputSchema = z.object({
  documentId: z.string(),
});
export const DeleteAircraftDocumentOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
});

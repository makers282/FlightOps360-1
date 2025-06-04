
/**
 * @fileOverview Zod schemas and TypeScript types for crew document data.
 */
import { z } from 'zod';

export const documentTypes = [
  "License", "Medical", "Passport", "Visa", "Training Certificate", 
  "Type Rating", "Company ID", "Airport ID", 
  "Recurrency Check", "Proficiency Check", "Line Check", "Medical Clearance for Duty", // Added currency types
  "Other"
] as const;
export type CrewDocumentType = typeof documentTypes[number];

export const CrewDocumentSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the crew document."),
  crewMemberId: z.string().min(1, "Crew member ID is required."),
  crewMemberName: z.string().optional().describe("Denormalized name of the crew member for easier display."),
  documentName: z.string().min(1, "Document name is required (e.g., ATP License, Class 1 Medical)."),
  documentType: z.enum(documentTypes).default("Other").describe("Type of the document."),
  
  issueDate: z.string().optional().describe("YYYY-MM-DD format, when the document was issued."),
  expiryDate: z.string().optional().describe("YYYY-MM-DD format, when the document expires."),
  
  fileUrl: z.string().optional().describe("Placeholder for the actual file URL (future implementation)."),
  notes: z.string().optional().describe("Any notes related to the document."),

  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type CrewDocument = z.infer<typeof CrewDocumentSchema>;

// Schema for saving a document (input to the flow)
export const SaveCrewDocumentInputSchema = CrewDocumentSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), // ID is optional for creation
});
export type SaveCrewDocumentInput = z.infer<typeof SaveCrewDocumentInputSchema>;

// Schema for the output of the save operation
export const SaveCrewDocumentOutputSchema = CrewDocumentSchema;

// For fetching multiple documents
export const FetchCrewDocumentsOutputSchema = z.array(CrewDocumentSchema);

// For deleting a document
export const DeleteCrewDocumentInputSchema = z.object({
  documentId: z.string(),
});
export const DeleteCrewDocumentOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
});


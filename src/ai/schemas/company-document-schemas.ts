
/**
 * @fileOverview Zod schemas and TypeScript types for company-wide document data.
 */
import { z } from 'zod';

export const companyDocumentTypes = [
  "Manual", "Policy", "Procedure", "Template", 
  "Compliance Record", "Legal Document", "Safety Bulletin", "Training Material", "Other"
] as const;
export type CompanyDocumentType = typeof companyDocumentTypes[number];

export const CompanyDocumentSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the company document."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(companyDocumentTypes).default("Other").describe("Type of the document."),
  description: z.string().optional().describe("A brief description of the document's purpose or content."),
  version: z.string().optional().describe("Document version number, e.g., 1.0, 2.1a."),
  
  effectiveDate: z.string().optional().describe("YYYY-MM-DD format, when the document becomes effective."),
  reviewDate: z.string().optional().describe("YYYY-MM-DD format, next scheduled review date."),
  
  fileUrl: z.string().optional().describe("Placeholder for the actual file URL (future implementation)."),
  tags: z.array(z.string()).optional().default([]).describe("Keywords or tags for easier searching."),

  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type CompanyDocument = z.infer<typeof CompanyDocumentSchema>;

// Schema for saving a document (input to the flow)
export const SaveCompanyDocumentInputSchema = CompanyDocumentSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), // ID is optional for creation
});
export type SaveCompanyDocumentInput = z.infer<typeof SaveCompanyDocumentInputSchema>;

// Schema for the output of the save operation
export const SaveCompanyDocumentOutputSchema = CompanyDocumentSchema;

// For fetching multiple documents
export const FetchCompanyDocumentsOutputSchema = z.array(CompanyDocumentSchema);

// For deleting a document
export const DeleteCompanyDocumentInputSchema = z.object({
  documentId: z.string(),
});
export const DeleteCompanyDocumentOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
});

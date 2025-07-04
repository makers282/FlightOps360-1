
/**
 * @fileOverview Zod schemas and TypeScript types for crew member block-out events.
 */
import { z } from 'zod';

export const crewBlockOutReasons = ["Medical Leave", "Sick", "Training", "Vacation", "Personal", "Other"] as const;

export const CrewBlockOutSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the block-out event."),
  crewMemberId: z.string().min(1, "Crew member ID is required."),
  crewMemberName: z.string().optional().describe("Denormalized name for easier display."),
  reason: z.enum(crewBlockOutReasons).describe("The reason for the block-out period."),
  notes: z.string().optional().describe("Additional notes about the block-out."),
  startDate: z.string().datetime({ message: "Start date must be a valid ISO date string." }).describe("Full ISO 8601 date-time string for the block-out start."),
  endDate: z.string().datetime({ message: "End date must be a valid ISO date string." }).describe("Full ISO 8601 date-time string for the block-out end."),
  createdAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
});
export type CrewBlockOut = z.infer<typeof CrewBlockOutSchema>;

export const SaveCrewBlockOutInputSchema = CrewBlockOutSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  id: z.string().optional(),
});
export type SaveCrewBlockOutInput = z.infer<typeof SaveCrewBlockOutInputSchema>;

export const SaveCrewBlockOutOutputSchema = CrewBlockOutSchema;
export const FetchCrewBlockOutsOutputSchema = z.array(CrewBlockOutSchema);

export const DeleteCrewBlockOutInputSchema = z.object({ blockOutId: z.string() });
export const DeleteCrewBlockOutOutputSchema = z.object({
  success: z.boolean(),
  blockOutId: z.string(),
});

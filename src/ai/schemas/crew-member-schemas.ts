
/**
 * @fileOverview Zod schemas and TypeScript types for crew member data.
 */
import { z } from 'zod';

export const crewRoles = ["Captain", "First Officer", "Flight Attendant", "Flight Medic", "Mechanic", "Loadmaster", "Other"] as const;
export type CrewRole = typeof crewRoles[number];

export const CrewMemberSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the crew member."),
  employeeId: z.string().optional().describe("Employee ID or similar internal identifier."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  role: z.enum(crewRoles).default("Other").describe("Primary role of the crew member."),
  
  email: z.string().email("Invalid email format.").optional().or(z.literal('')),
  phone: z.string().optional(),
  
  licenses: z.array(z.object({
    type: z.string().min(1, "License type is required."),
    number: z.string().optional(),
    expiryDate: z.string().optional().describe("YYYY-MM-DD format, if applicable."),
  })).optional().default([]).describe("List of licenses held by the crew member."),
  
  typeRatings: z.array(z.string()).optional().default([]).describe("List of aircraft type ratings, e.g., C525, GLEX"),
  
  homeBase: z.string().optional().describe("Crew member's home base airport code (e.g., KTEB)."),
  isActive: z.boolean().default(true).describe("Whether the crew member is currently active."),
  
  notes: z.string().optional().describe("Internal notes about the crew member."),

  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;

// Schema for saving a crew member (input to the flow)
export const SaveCrewMemberInputSchema = CrewMemberSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), // ID is optional for creation
});
export type SaveCrewMemberInput = z.infer<typeof SaveCrewMemberInputSchema>;

// Schema for the output of the save operation
export const SaveCrewMemberOutputSchema = CrewMemberSchema;

// For fetching multiple crew members
export const FetchCrewMembersOutputSchema = z.array(CrewMemberSchema);

// For deleting a crew member
export const DeleteCrewMemberInputSchema = z.object({
  crewMemberId: z.string(),
});
export const DeleteCrewMemberOutputSchema = z.object({
  success: z.boolean(),
  crewMemberId: z.string(),
});


/**
 * @fileOverview Zod schemas and TypeScript types for crew member data.
 */
import { z } from 'zod';

export const crewRoles = ["Pilot in Command (PIC)", "Second in Command (SIC)", "Flight Attendant", "Flight Nurse", "Flight Paramedic", "Dispatcher", "Maintenance Technician", "Line Service Technician"] as const;
export type CrewRole = (typeof crewRoles)[number];

export const employmentTypes = ["Full-Time", "Part-Time", "Contractor"] as const;
export type EmploymentType = typeof employmentTypes[number];

// Schema for the onboarding wizard data structure
export const OnboardingDataSchema = z.object({
  // Step 1: Personal & Contact
  dateOfBirth: z.string().optional(),
  address: z.object({
    street1: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),

  // Step 2: Employment & Role
  employmentType: z.enum(employmentTypes).optional(),
  roles: z.array(z.string()).optional().default([]),
  aircraftQualifications: z.array(z.string()).optional().default([]),
  priaEligible: z.boolean().optional().default(false),
  
  // Step 4: Training
  assignedTrainings: z.array(z.string()).optional().default([]),
});

export const CrewMemberSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the crew member."),
  userId: z.string().optional().describe("The ID of the associated system user account, if any."),
  employeeId: z.string().optional().describe("Employee ID or similar internal identifier."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  
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

  onboardingStatus: z.enum(['Pending', 'Completed']).default('Pending').describe("The status of the crew member's onboarding process."),
  onboardingData: OnboardingDataSchema.optional(),

  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;

// Schema for saving a crew member (input to the flow)
// id, userId, createdAt, and updatedAt will be handled by the server or linking process.
export const SaveCrewMemberInputSchema = CrewMemberSchema.omit({ createdAt: true, updatedAt: true, id: true, userId: true }).extend({
  id: z.string().optional(), // ID is optional for creation
  userId: z.string().optional(), // userId is also optional on input, can be set by a linking process later
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

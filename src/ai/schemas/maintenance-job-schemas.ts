
/**
 * @fileOverview Zod schemas and TypeScript types for maintenance jobs (work orders).
 */
import { z } from 'zod';

export const maintenanceJobStatuses = ["Opened", "Accepted", "In Progress", "Completed", "Closed", "Canceled"] as const;
export type MaintenanceJobStatus = typeof maintenanceJobStatuses[number];

export const MaintenanceJobSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the job."),
  aircraftId: z.string().describe("The ID of the aircraft this job is for."),
  tailNumber: z.string().describe("The tail number of the aircraft."),
  workOrderNumber: z.string().min(1, "Work Order # is required."),
  shopName: z.string().min(1, "Shop Name is required."),
  status: z.enum(maintenanceJobStatuses).default("Opened"),
  dateIssued: z.string().datetime({ message: "Issue date must be a valid date." }).describe("ISO string format"),
  dateDue: z.string().datetime({ message: "Due date must be a valid date." }).optional().describe("ISO string format"),
  notes: z.string().optional(),
  createdAt: z.string().datetime({ message: "Creation date must be a valid date." }).describe("ISO string format"),
  updatedAt: z.string().datetime({ message: "Update date must be a valid date." }).describe("ISO string format"),
});
export type MaintenanceJob = z.infer<typeof MaintenanceJobSchema>;

export const SaveMaintenanceJobInputSchema = MaintenanceJobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().optional(), // Optional for creation, provided for updates
});
export type SaveMaintenanceJobInput = z.infer<typeof SaveMaintenanceJobInputSchema>;

export const FetchMaintenanceJobsOutputSchema = z.array(MaintenanceJobSchema);
export const SaveMaintenanceJobOutputSchema = MaintenanceJobSchema;

export const DeleteMaintenanceJobInputSchema = z.object({
  jobId: z.string(),
});
export const DeleteMaintenanceJobOutputSchema = z.object({
  success: z.boolean(),
  jobId: z.string(),
});

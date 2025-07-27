
import { z } from 'zod';

export const MaintenanceTaskSchema = z.object({
  id: z.string().describe("Unique identifier for the maintenance task (document ID)."),
  aircraftId: z.string().describe("Identifier of the aircraft this task belongs to."),
  itemTitle: z.string().min(1, "Item title is required"),
  referenceNumber: z.string().optional(),
  partNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  itemType: z.enum(["Inspection", "Service Bulletin", "Airworthiness Directive", "Component Replacement", "Overhaul", "Life Limited Part", "Other"]),
  associatedComponent: z.string().optional(),
  details: z.string().optional(),
  isActive: z.boolean().default(true),
  trackType: z.enum(["Interval", "One Time", "Dont Alert"]).default("Interval"),
  isTripsNotAffected: z.boolean().default(false),
  
  lastCompletedDate: z.string().optional().describe("YYYY-MM-DD format"),
  lastCompletedHours: z.number().nonnegative().optional(),
  lastCompletedCycles: z.number().nonnegative().int().optional(),
  lastCompletedNotes: z.string().optional(),

  isHoursDueEnabled: z.boolean().default(false),
  hoursDue: z.number().positive("Must be positive when enabled.").optional(),
  hoursTolerance: z.number().min(0, "Cannot be negative").optional(),
  alertHoursPrior: z.number().min(0, "Cannot be negative").optional(),

  isCyclesDueEnabled: z.boolean().default(false),
  cyclesDue: z.number().positive("Must be positive when enabled.").int().optional(),
  cyclesTolerance: z.number().min(0, "Cannot be negative").int().optional(),
  alertCyclesPrior: z.number().min(0, "Cannot be negative").int().optional(),

  isDaysDueEnabled: z.boolean().default(false),
  daysIntervalType: z.enum(["days", "months_specific_day", "months_eom", "years_specific_day"]).optional(),
  daysDueValue: z.string().optional().describe("Can be number of days for interval, or YYYY-MM-DD for one-time"),
  daysTolerance: z.number().min(0, "Cannot be negative").int().optional(),
  alertDaysPrior: z.number().min(0, "Cannot be negative").int().optional(),
});
export type MaintenanceTask = z.infer<typeof MaintenanceTaskSchema>;

export const FetchTasksInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft for which to fetch tasks."),
});
export type FetchTasksInput = z.infer<typeof FetchTasksInputSchema>;

export const SaveTaskInputSchema = MaintenanceTaskSchema; // The whole task object is needed for saving
export type SaveTaskInput = z.infer<typeof SaveTaskInputSchema>;

export const DeleteTaskInputSchema = z.object({
  taskId: z.string().describe("The ID of the maintenance task to delete."),
});
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

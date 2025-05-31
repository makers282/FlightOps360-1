
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft maintenance tasks using Firestore.
 * Tasks are associated with specific aircraft from the fleet.
 *
 * - fetchMaintenanceTasksForAircraft - Fetches all tasks for a given aircraft.
 * - saveMaintenanceTask - Saves (adds or updates) a maintenance task.
 * - deleteMaintenanceTask - Deletes a maintenance task.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';

// This schema should align closely with MaintenanceTaskFormData from the modal,
// plus an 'id' for the task itself and 'aircraftId' for association.
const MaintenanceTaskSchema = z.object({
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

const FetchTasksInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft for which to fetch tasks."),
});
export type FetchTasksInput = z.infer<typeof FetchTasksInputSchema>;

const SaveTaskInputSchema = MaintenanceTaskSchema; // The whole task object is needed for saving
export type SaveTaskInput = z.infer<typeof SaveTaskInputSchema>;

const DeleteTaskInputSchema = z.object({
  taskId: z.string().describe("The ID of the maintenance task to delete."),
  // aircraftId is not strictly needed for deletion if taskId is globally unique, but can be good for namespacing or validation
});
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

const FetchTasksOutputSchema = z.array(MaintenanceTaskSchema);
const SaveTaskOutputSchema = MaintenanceTaskSchema; // Returns the saved task
const DeleteTaskOutputSchema = z.object({
  success: z.boolean(),
  taskId: z.string(),
});

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

// Exported async functions that clients will call
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
  console.log('[ManageMaintenanceTasksFlow Firestore] Attempting to fetch tasks for aircraft ID:', input.aircraftId);
  return fetchMaintenanceTasksForAircraftFlow(input);
}

export async function saveMaintenanceTask(input: SaveTaskInput): Promise<MaintenanceTask> {
  console.log('[ManageMaintenanceTasksFlow Firestore] Attempting to save task ID:', input.id, 'for aircraft ID:', input.aircraftId);
  return saveMaintenanceTaskFlow(input);
}

export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
  console.log('[ManageMaintenanceTasksFlow Firestore] Attempting to delete task ID:', input.taskId);
  return deleteMaintenanceTaskFlow(input);
}


// Genkit Flow Definitions
const fetchMaintenanceTasksForAircraftFlow = ai.defineFlow(
  {
    name: 'fetchMaintenanceTasksForAircraftFlow',
    inputSchema: FetchTasksInputSchema,
    outputSchema: FetchTasksOutputSchema,
  },
  async (input) => {
    console.log('Executing fetchMaintenanceTasksForAircraftFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const tasksCollectionRef = collection(db, MAINTENANCE_TASKS_COLLECTION);
      const q = query(tasksCollectionRef, where("aircraftId", "==", input.aircraftId));
      const snapshot = await getDocs(q);
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
      console.log('Fetched', tasksList.length, 'tasks for aircraft from Firestore:', input.aircraftId);
      return tasksList;
    } catch (error) {
      console.error('Error fetching tasks from Firestore for aircraft', input.aircraftId, ':', error);
      throw new Error(`Failed to fetch tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveMaintenanceTaskFlow = ai.defineFlow(
  {
    name: 'saveMaintenanceTaskFlow',
    inputSchema: SaveTaskInputSchema,
    outputSchema: SaveTaskOutputSchema,
  },
  async (taskData) => {
    console.log('Executing saveMaintenanceTaskFlow with input - Firestore:', JSON.stringify(taskData));
    try {
      // The taskData.id should be the Firestore document ID.
      const taskDocRef = doc(db, MAINTENANCE_TASKS_COLLECTION, taskData.id);
      // Firestore will create the document if it doesn't exist, or update it if it does.
      // We spread taskData but explicitly exclude 'id' from being written as a field within the document itself.
      const { id, ...dataToSet } = taskData;
      await setDoc(taskDocRef, dataToSet); 
      console.log('Saved maintenance task in Firestore:', taskData.id);
      return taskData; // Return the full input object as it was passed (and saved)
    } catch (error) {
      console.error('Error saving maintenance task to Firestore:', error);
      throw new Error(`Failed to save task ${taskData.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteMaintenanceTaskFlow = ai.defineFlow(
  {
    name: 'deleteMaintenanceTaskFlow',
    inputSchema: DeleteTaskInputSchema,
    outputSchema: DeleteTaskOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteMaintenanceTaskFlow for task ID - Firestore:', input.taskId);
    try {
      const taskDocRef = doc(db, MAINTENANCE_TASKS_COLLECTION, input.taskId);
      const docSnap = await getDoc(taskDocRef); // Check if it exists before deleting

      if (!docSnap.exists()) {
          console.warn(`Maintenance task with ID ${input.taskId} not found for deletion in Firestore.`);
          // Depending on desired behavior, could return success: false or throw an error.
          // For now, let's say deletion of a non-existent item is "successful" in that it's not there.
          // Or, to be stricter: return { success: false, taskId: input.taskId };
          throw new Error(`Task ${input.taskId} not found.`);
      }
      
      await deleteDoc(taskDocRef);
      console.log('Deleted maintenance task from Firestore:', input.taskId);
      return { success: true, taskId: input.taskId };
    } catch (error) {
      console.error('Error deleting maintenance task from Firestore:', error);
      throw new Error(`Failed to delete task ${input.taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

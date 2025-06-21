
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
import {z, generate} from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { fetchFleetAircraft } from './manage-fleet-flow';
import { gemini15Flash } from '@genkit-ai/googleai';

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

const GenerateWorkOrderInputSchema = z.object({
    aircraftId: z.string(),
    taskIds: z.array(z.string()),
    });
export type GenerateWorkOrderInput = z.infer<typeof GenerateWorkOrderInputSchema>;

const GenerateWorkOrderOutputSchema = z.object({
    workOrderText: z.string(),
});

const FetchTasksOutputSchema = z.array(MaintenanceTaskSchema);
const SaveTaskOutputSchema = MaintenanceTaskSchema; // Returns the saved task
const DeleteTaskOutputSchema = z.object({
  success: z.boolean(),
  taskId: z.string(),
});

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

// Exported async functions that clients will call
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to fetch tasks for aircraft ID:', input.aircraftId);
  return fetchMaintenanceTasksForAircraftFlow(input);
}

export async function saveMaintenanceTask(input: SaveTaskInput): Promise<MaintenanceTask> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTask.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to save task ID:', input.id, 'for aircraft ID:', input.aircraftId);
  return saveMaintenanceTaskFlow(input);
}

export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteMaintenanceTask.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to delete task ID:', input.taskId);
  return deleteMaintenanceTaskFlow(input);
}

export async function generateMaintenanceWorkOrder(input: GenerateWorkOrderInput): Promise<string> {
    if (!db) {
        throw new Error("Firestore admin instance is not initialized.");
    }
    return generateMaintenanceWorkOrderFlow(input);
}


// Genkit Flow Definitions
const fetchMaintenanceTasksForAircraftFlow = ai.defineFlow(
  {
    name: 'fetchMaintenanceTasksForAircraftFlow',
    inputSchema: FetchTasksInputSchema,
    outputSchema: FetchTasksOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraftFlow.");
    }
    console.log('Executing fetchMaintenanceTasksForAircraftFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
      const q = tasksCollectionRef.where("aircraftId", "==", input.aircraftId);
      const snapshot = await q.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
    }
    console.log('Executing saveMaintenanceTaskFlow with input - Firestore:', JSON.stringify(taskData));
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(taskData.id);
      const { id, ...dataToSet } = taskData;
      await taskDocRef.set(dataToSet, { merge: true }); 
      console.log('Saved maintenance task in Firestore:', taskData.id);
      return taskData;
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMaintenanceTaskFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteMaintenanceTaskFlow.");
    }
    console.log('Executing deleteMaintenanceTaskFlow for task ID - Firestore:', input.taskId);
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(input.taskId);
      const docSnap = await taskDocRef.get();

      if (!docSnap.exists()) {
          console.warn(`Maintenance task with ID ${input.taskId} not found for deletion in Firestore.`);
          throw new Error(`Task ${input.taskId} not found.`);
      }
      
      await taskDocRef.delete();
      console.log('Deleted maintenance task from Firestore:', input.taskId);
      return { success: true, taskId: input.taskId };
    } catch (error) {
      console.error('Error deleting maintenance task from Firestore:', error);
      throw new Error(`Failed to delete task ${input.taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const generateMaintenanceWorkOrderFlow = ai.defineFlow(
    {
        name: 'generateMaintenanceWorkOrderFlow',
        inputSchema: GenerateWorkOrderInputSchema,
        outputSchema: z.string(),
    },
    async ({ aircraftId, taskIds }) => {
        if (!db) {
            throw new Error("Firestore admin instance is not initialized for work order generation.");
        }
        const [allAircraft, allTasks] = await Promise.all([
            fetchFleetAircraft(),
            fetchMaintenanceTasksForAircraft({ aircraftId }),
        ]);

        const aircraft = allAircraft.find(ac => ac.id === aircraftId);
        if (!aircraft) {
            throw new Error(`Aircraft with ID ${aircraftId} not found.`);
        }

        const selectedTasks = allTasks.filter(task => taskIds.includes(task.id));
        if (selectedTasks.length === 0) {
            return "No tasks selected or found for work order.";
        }

        const workOrderPrompt = `
Generate a formal maintenance work order with the following information.
The output should be in clean, well-structured Markdown format.

**Work Order Header:**
- **Work Order Number:** WO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${aircraft.tailNumber.replace('N', '')}
- **Date:** ${new Date().toLocaleDateString()}
- **Aircraft:** ${aircraft.model}
- **Tail Number:** ${aircraft.tailNumber}
- **Serial Number:** ${aircraft.serialNumber || 'N/A'}

**Tasks to be Performed:**

${selectedTasks.map((task, index) => `
**Task ${index + 1}: ${task.itemTitle}**
- **Type:** ${task.itemType}
- **Associated Component:** ${task.associatedComponent || 'N/A'}
- **Reference/Part Number:** ${task.referenceNumber || 'N/A'} / ${task.partNumber || 'N/A'}
- **Details:** ${task.details || 'No additional details provided.'}
- **Last Completed:** ${task.lastCompletedDate ? `${task.lastCompletedDate} at ${task.lastCompletedHours || 'N/A'} hours` : 'N/A'}
`).join('')}

**Sign-off Section:**
- **Completed By (Name):** _________________________
- **Signature:** _________________________
- **Date:** _________________________
- **Certificate Number:** _________________________

**Notes:**
- All work to be performed in accordance with applicable FAA regulations and manufacturer's maintenance manuals.
`;

        const workOrderResponse = await generate({
            model: gemini15Flash,
            prompt: workOrderPrompt,
            output: { format: 'text' },
        });

        return workOrderResponse.text();
    }
);

    
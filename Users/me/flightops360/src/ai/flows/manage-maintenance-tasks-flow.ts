
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
import {
    SaveTaskInputSchema,
    MaintenanceTask,
    FetchTasksInputSchema,
    FetchTasksOutputSchema,
    DeleteTaskInputSchema,
    DeleteTaskOutputSchema,
    GenerateWorkOrderInputSchema,
} from '@/ai/schemas/maintenance-task-schemas';

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

// Exported async functions that clients will call
export async function fetchMaintenanceTasksForAircraft(input: { aircraftId: string }): Promise<MaintenanceTask[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft.");
  }
  return fetchMaintenanceTasksForAircraftFlow(input);
}

export async function saveMaintenanceTask(input: MaintenanceTask): Promise<MaintenanceTask> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTask.");
  }
  return saveMaintenanceTaskFlow(input);
}

export async function deleteMaintenanceTask(input: { taskId: string }): Promise<{ success: boolean; taskId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteMaintenanceTask.");
  }
  return deleteMaintenanceTaskFlow(input);
}

export async function generateMaintenanceWorkOrder(input: z.infer<typeof GenerateWorkOrderInputSchema>): Promise<string> {
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
    try {
      const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
      const q = tasksCollectionRef.where("aircraftId", "==", input.aircraftId);
      const snapshot = await q.get();
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
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
    outputSchema: MaintenanceTask,
  },
  async (taskData) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
    }
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(taskData.id);
      const { id, ...dataToSet } = taskData;
      await taskDocRef.set(dataToSet, { merge: true }); 
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
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(input.taskId);
      const docSnap = await taskDocRef.get();

      if (!docSnap.exists) {
          throw new Error(`Task with ID ${input.taskId} not found for deletion.`);
      }
      
      await taskDocRef.delete();
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

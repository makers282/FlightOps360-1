
'use server';
/**
 * @fileOverview A standard async function for copying selected maintenance tasks from one aircraft to others.
 */

import { z } from 'zod';
import { runFlow } from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import type { MaintenanceTask, SaveTaskInput } from '@/ai/schemas/maintenance-task-schemas';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask } from './maintenance-task-service';

const CopyTasksInputSchema = z.object({
  sourceAircraftId: z.string().describe("The ID of the aircraft to copy tasks from."),
  taskIds: z.array(z.string()).min(1, "At least one task must be selected to copy."),
  targetAircraftIds: z.array(z.string()).min(1, "At least one target aircraft must be selected."),
});
export type CopyTasksInput = z.infer<typeof CopyTasksInputSchema>;

const CopyTasksOutputSchema = z.object({
  success: z.boolean(),
  copiedTasksCount: z.number(),
  targetAircraftCount: z.number(),
  status: z.string(),
});
export type CopyTasksOutput = z.infer<typeof CopyTasksOutputSchema>;

// This is a standard async function, not a Genkit flow definition.
// This resolves the previous invocation issues.
export async function copyMaintenanceTasks(
  { sourceAircraftId, taskIds, targetAircraftIds }: CopyTasksInput
): Promise<CopyTasksOutput> {
  console.log(`[CopyLogic] Starting copy for ${taskIds.length} tasks from ${sourceAircraftId} to ${targetAircraftIds.length} aircraft.`);
  
  try {
    const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
    // CRITICAL FIX: Filter the tasks based on the user's selection (taskIds).
    const tasksToCopy = allSourceTasks.filter(task => taskIds.includes(task.id));

    if (tasksToCopy.length === 0) {
      console.warn(`[CopyLogic] No matching tasks found on source aircraft ${sourceAircraftId} for given IDs.`);
      return {
          success: false,
          copiedTasksCount: 0,
          targetAircraftCount: targetAircraftIds.length,
          status: "Error: The selected tasks could not be found on the source aircraft. They may have been deleted.",
      };
    }
    
    const copyPromises: Promise<any>[] = [];

    for (const targetId of targetAircraftIds) {
      if (targetId === sourceAircraftId) continue;

      for (const sourceTask of tasksToCopy) {
        // Correctly prepare a new task object for saving.
        const { id: originalId, lastCompletedDate, lastCompletedHours, lastCompletedCycles, lastCompletedNotes, ...restOfTask } = sourceTask;
        
        const newTaskForTarget: SaveTaskInput = {
          ...restOfTask,
          id: db.collection('maintenanceTasks').doc().id, // Generate new unique ID
          aircraftId: targetId,
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,
        };
        copyPromises.push(saveMaintenanceTask(newTaskForTarget));
      }
    }
    
    await Promise.all(copyPromises);
    
    const successMessage = `Successfully copied ${tasksToCopy.length} task(s) to ${targetAircraftIds.length} aircraft. A total of ${copyPromises.length} new tasks were created.`;
    console.log(`[CopyLogic] Success: ${successMessage}`);
    
    return {
      success: true,
      targetAircraftCount: targetAircraftIds.length,
      copiedTasksCount: tasksToCopy.length, // Correctly report the count of unique tasks copied
      status: successMessage,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("CRITICAL ERROR in copyMaintenanceTasksLogic:", errorMessage);
    // This error will be caught by the API route's catch block and returned to the client.
    throw new Error(`Failed to copy tasks: ${errorMessage}`);
  }
}

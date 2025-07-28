
'use server';
/**
 * @fileOverview A server function for copying selected maintenance tasks from one aircraft to others.
 */

import { z } from 'zod';
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

// This is now a standard async server function, not a Genkit flow.
export async function copyMaintenanceTasks(input: CopyTasksInput): Promise<CopyTasksOutput> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  
  const { sourceAircraftId, taskIds, targetAircraftIds } = CopyTasksInputSchema.parse(input);

  console.log(`[CopyFunction] Starting copy for ${taskIds.length} tasks from ${sourceAircraftId} to ${targetAircraftIds.length} aircraft.`);
    
  try {
    const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
    const tasksToCopy = allSourceTasks.filter(task => taskIds.includes(task.id));

    if (tasksToCopy.length === 0) {
      console.warn(`[CopyFunction] No matching tasks found on source aircraft ${sourceAircraftId} for given IDs.`);
      return {
          success: false,
          copiedTasksCount: 0,
          targetAircraftCount: targetAircraftIds.length,
          status: "No matching tasks found on source aircraft to copy.",
      };
    }
    
    const copyPromises: Promise<any>[] = [];

    for (const targetId of targetAircraftIds) {
      if (targetId === sourceAircraftId) continue;

      for (const sourceTask of tasksToCopy) {
        // Destructure to omit instance-specific fields and the original ID
        const { id: originalId, lastCompletedDate, lastCompletedHours, lastCompletedCycles, lastCompletedNotes, ...restOfTask } = sourceTask;
        
        const newTaskForTarget: SaveTaskInput = {
          ...restOfTask,
          id: db.collection('maintenanceTasks').doc().id, // Generate new unique ID
          aircraftId: targetId,
          // Reset completion details to undefined
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,
        };
        // Add the promise returned by the save function to our array
        copyPromises.push(saveMaintenanceTask(newTaskForTarget));
      }
    }
    
    // Concurrently await all save operations
    await Promise.all(copyPromises);
    
    const successMessage = `Successfully copied ${tasksToCopy.length} task(s) to ${targetAircraftIds.length} aircraft. A total of ${copyPromises.length} new tasks were created.`;
    console.log(`[CopyFunction] Success: ${successMessage}`);
    return {
      success: true,
      targetAircraftCount: targetAircraftIds.length,
      copiedTasksCount: tasksToCopy.length,
      status: successMessage,
    };

  } catch (error) {
    console.error("CRITICAL ERROR in copyMaintenanceTasks function:", error);
    // Re-throw a user-friendly error to be caught by the client-side caller
    throw new Error(`Failed to copy tasks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

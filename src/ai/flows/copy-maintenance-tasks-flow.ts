
'use server';
/**
 * @fileOverview A Genkit flow for copying selected maintenance tasks from one aircraft to others.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { runFlow } from 'genkit'; // Correctly import runFlow
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

// This is the exported wrapper function that the client calls.
// It now correctly uses runFlow to execute the registered Genkit flow.
export async function copyMaintenanceTasks(input: CopyTasksInput): Promise<CopyTasksOutput> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return await runFlow(copyMaintenanceTasksFlow, input);
}

// The Genkit flow is defined here but NOT exported.
// runFlow will find it by its object reference.
const copyMaintenanceTasksFlow = ai.defineFlow(
  {
    name: 'copyMaintenanceTasksFlow', // The name used by runFlow
    inputSchema: CopyTasksInputSchema,
    outputSchema: CopyTasksOutputSchema,
  },
  async ({ sourceAircraftId, taskIds, targetAircraftIds }) => {
    console.log(`[CopyFlow] Starting copy for ${taskIds.length} tasks from ${sourceAircraftId} to ${targetAircraftIds.length} aircraft.`);
    
    try {
      const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
      const tasksToCopy = allSourceTasks.filter(task => taskIds.includes(task.id));

      if (tasksToCopy.length === 0) {
        const message = "No matching tasks found on source aircraft to copy.";
        console.warn(`[CopyFlow] ${message}`);
        return {
            success: false,
            copiedTasksCount: 0,
            targetAircraftCount: targetAircraftIds.length,
            status: message,
        };
      }
      
      const copyPromises: Promise<any>[] = [];

      for (const targetId of targetAircraftIds) {
        if (targetId === sourceAircraftId) continue;

        for (const sourceTask of tasksToCopy) {
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
      console.log(`[CopyFlow] Success: ${successMessage}`);
      
      return {
        success: true,
        targetAircraftCount: targetAircraftIds.length,
        copiedTasksCount: tasksToCopy.length,
        status: successMessage,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("CRITICAL ERROR in copyMaintenanceTasksFlow:", errorMessage);
      // Re-throw the error so runFlow reports a failure state
      throw new Error(`Failed to copy tasks: ${errorMessage}`);
    }
  }
);

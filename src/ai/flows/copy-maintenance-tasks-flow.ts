
'use server';
/**
 * @fileOverview A Genkit flow for copying selected maintenance tasks from one aircraft to others.
 */

import { ai } from '@/ai/genkit';
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
  sourceAircraftId: z.string(),
  targetAircraftCount: z.number(),
  copiedTasksCount: z.number(),
  status: z.string(),
});
export type CopyTasksOutput = z.infer<typeof CopyTasksOutputSchema>;

// Exported async function that clients will call
export async function copyMaintenanceTasks(input: CopyTasksInput): Promise<CopyTasksOutput> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return copyMaintenanceTasksFlow(input);
}

const copyMaintenanceTasksFlow = ai.defineFlow(
  {
    name: 'copyMaintenanceTasksFlow',
    inputSchema: CopyTasksInputSchema,
    outputSchema: CopyTasksOutputSchema,
  },
  async ({ sourceAircraftId, taskIds, targetAircraftIds }) => {
    if (!db) {
        throw new Error("Firestore admin instance (db) is not initialized in copyMaintenanceTasksFlow.");
    }
    console.log(`[CopyFlow] Starting copy for ${taskIds.length} tasks from ${sourceAircraftId} to ${targetAircraftIds.length} aircraft.`);

    try {
        // 1. Fetch all tasks from the source aircraft to filter from
        const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
        
        // 2. CRITICAL FIX: Filter the fetched tasks to get only the ones the user selected
        const tasksToCopy = allSourceTasks.filter(task => taskIds.includes(task.id));

        if (tasksToCopy.length === 0) {
        console.warn(`[CopyFlow] No matching tasks found on source aircraft ${sourceAircraftId} for given IDs.`);
        return {
            sourceAircraftId,
            targetAircraftCount: targetAircraftIds.length,
            copiedTasksCount: 0,
            status: "No matching tasks found on source aircraft to copy.",
        };
        }
        
        let totalTasksCreated = 0;

        // 3. Loop through each target aircraft
        for (const targetId of targetAircraftIds) {
          if (targetId === sourceAircraftId) continue; // Skip copying to itself

          // 4. Loop through each selected source task and create a new one for the target
          for (const sourceTask of tasksToCopy) {
            
            const { 
                id: originalId, // We will generate a new one
                lastCompletedDate, 
                lastCompletedHours, 
                lastCompletedCycles, 
                lastCompletedNotes, 
                ...restOfTask 
            } = sourceTask;

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

            // 5. Save the new task using the service.
            await saveMaintenanceTask(newTaskForTarget);
            totalTasksCreated++;
          }
        }
        
        const successMessage = `Successfully copied ${tasksToCopy.length} task(s) to ${targetAircraftIds.length} aircraft. A total of ${totalTasksCreated} new tasks were created.`;
        console.log(`[CopyFlow] Success: ${successMessage}`);
        return {
          sourceAircraftId,
          targetAircraftCount: targetAircraftIds.length,
          copiedTasksCount: tasksToCopy.length,
          status: successMessage,
        };

    } catch (error) {
        console.error("CRITICAL ERROR in copyMaintenanceTasksFlow:", error);
        throw new Error(`Failed to copy tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
    

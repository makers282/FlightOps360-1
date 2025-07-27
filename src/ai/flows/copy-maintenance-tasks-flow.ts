
'use server';
/**
 * @fileOverview A Genkit flow for copying selected maintenance tasks from one aircraft to others.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb as db } from '@/lib/firebase-admin';
import type { MaintenanceTask, SaveTaskInput } from './manage-maintenance-tasks-flow'; // Correctly import types
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask } from './manage-maintenance-tasks-flow';

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

    // 1. Fetch all tasks from the source aircraft to filter from
    const sourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
    const tasksToCopy = sourceTasks.filter(task => taskIds.includes(task.id));

    if (tasksToCopy.length === 0) {
      return {
        sourceAircraftId,
        targetAircraftCount: targetAircraftIds.length,
        copiedTasksCount: 0,
        status: "No matching tasks found on source aircraft to copy.",
      };
    }
    
    let totalCopiedTasks = 0;

    // 2. Loop through each target aircraft
    for (const targetId of targetAircraftIds) {
      if (targetId === sourceAircraftId) continue; // Skip copying to itself

      // 3. Loop through each selected source task and create a new one for the target
      for (const sourceTask of tasksToCopy) {
        // Create a new task object, resetting completion details and letting Firestore generate a new ID.
        // The `saveMaintenanceTask` expects the full task object, so we provide it.
        const { id, lastCompletedDate, lastCompletedHours, lastCompletedCycles, lastCompletedNotes, ...restOfTask } = sourceTask;

        const newTaskForTarget: SaveTaskInput = {
          ...restOfTask,
          id: db.collection('maintenanceTasks').doc().id, // Generate a new Firestore ID
          aircraftId: targetId,
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,
        };

        // 4. Save the new task.
        await saveMaintenanceTask(newTaskForTarget);
        totalCopiedTasks++;
      }
    }

    return {
      sourceAircraftId,
      targetAircraftCount: targetAircraftIds.length,
      copiedTasksCount: tasksToCopy.length, // tasks copied per aircraft
      status: `Successfully copied ${tasksToCopy.length} tasks to ${targetAircraftIds.length} aircraft. Total tasks created: ${totalCopiedTasks}.`,
    };
  }
);

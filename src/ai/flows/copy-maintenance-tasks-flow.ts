
'use server';
/**
 * @fileOverview A Genkit flow for copying maintenance tasks from one aircraft to others.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminDb as db } from '@/lib/firebase-admin';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask, type MaintenanceTask } from './manage-maintenance-tasks-flow';

const CopyTasksInputSchema = z.object({
  sourceAircraftId: z.string().describe("The ID of the aircraft to copy tasks from."),
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
  async ({ sourceAircraftId, targetAircraftIds }) => {
    if (!db) {
        throw new Error("Firestore admin instance (db) is not initialized in copyMaintenanceTasksFlow.");
    }

    // 1. Fetch all tasks from the source aircraft
    const sourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });

    if (sourceTasks.length === 0) {
      return {
        sourceAircraftId,
        targetAircraftCount: targetAircraftIds.length,
        copiedTasksCount: 0,
        status: "No tasks found on source aircraft to copy.",
      };
    }
    
    let totalCopiedTasks = 0;

    // 2. Loop through each target aircraft
    for (const targetId of targetAircraftIds) {
      if (targetId === sourceAircraftId) continue; // Skip copying to itself

      // 3. Loop through each source task and create a new one for the target
      for (const sourceTask of sourceTasks) {
        const newTaskForTarget: Omit<MaintenanceTask, 'id'> & { id?: string } = {
          ...sourceTask,
          aircraftId: targetId,
          // Reset last completed details
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,
        };
        
        // Remove the original ID to let Firestore generate a new one
        delete newTaskForTarget.id; 

        // 4. Save the new task. saveMaintenanceTask is designed to handle new task creation.
        // It generates a new ID internally if one isn't provided.
        await saveMaintenanceTask(newTaskForTarget as MaintenanceTask);
        totalCopiedTasks++;
      }
    }

    return {
      sourceAircraftId,
      targetAircraftCount: targetAircraftIds.length,
      copiedTasksCount: sourceTasks.length, // tasks copied per aircraft
      status: `Successfully copied ${sourceTasks.length} tasks to ${targetAircraftIds.length} aircraft.`,
    };
  }
);

'use server';
/**
 * @fileOverview A standard async function for copying selected maintenance tasks from one aircraft to others.
 */

import { z } from 'zod';
import { adminDb as db } from '@/lib/firebase-admin';
import type { MaintenanceTask, SaveTaskInput } from '@/ai/schemas/maintenance-task-schemas';
import { MaintenanceTaskSchema } from '@/ai/schemas/maintenance-task-schemas';
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
export async function copyMaintenanceTasks(
  { sourceAircraftId, taskIds, targetAircraftIds }: CopyTasksInput
): Promise<CopyTasksOutput> {
  console.log(`[CopyLogic] Starting copy for ${taskIds.length} tasks from ${sourceAircraftId} to ${targetAircraftIds.length} aircraft.`);
  
  try {
    const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });
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
        // Explicitly map fields to prevent extra properties from causing errors.
        // This is a more robust way to create the new task object.
        const newTaskForTarget: SaveTaskInput = {
          id: db.collection('maintenanceTasks').doc().id, // Generate new unique ID
          aircraftId: targetId, // Set new aircraft ID
          
          // Copy all other fields from the schema
          itemTitle: sourceTask.itemTitle,
          referenceNumber: sourceTask.referenceNumber,
          partNumber: sourceTask.partNumber,
          serialNumber: sourceTask.serialNumber,
          itemType: sourceTask.itemType,
          associatedComponent: sourceTask.associatedComponent,
          details: sourceTask.details,
          isActive: sourceTask.isActive,
          trackType: sourceTask.trackType,
          isTripsNotAffected: sourceTask.isTripsNotAffected,
          
          // Reset history fields
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,

          // Copy tracking settings
          isHoursDueEnabled: sourceTask.isHoursDueEnabled,
          hoursDue: sourceTask.hoursDue,
          hoursTolerance: sourceTask.hoursTolerance,
          alertHoursPrior: sourceTask.alertHoursPrior,
          isCyclesDueEnabled: sourceTask.isCyclesDueEnabled,
          cyclesDue: sourceTask.cyclesDue,
          cyclesTolerance: sourceTask.cyclesTolerance,
          alertCyclesPrior: sourceTask.alertCyclesPrior,
          isDaysDueEnabled: sourceTask.isDaysDueEnabled,
          daysIntervalType: sourceTask.daysIntervalType,
          daysDueValue: sourceTask.daysDueValue,
          daysTolerance: sourceTask.daysTolerance,
          alertDaysPrior: sourceTask.alertDaysPrior,
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
      copiedTasksCount: tasksToCopy.length,
      status: successMessage,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("CRITICAL ERROR in copyMaintenanceTasksLogic:", errorMessage);
    // This error will be caught by the API route's catch block and returned to the client.
    throw new Error(`Failed to copy tasks: ${errorMessage}`);
  }
}
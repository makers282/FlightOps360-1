'use server';

import { z } from 'zod';
import { adminDb as db } from '@/lib/firebase-admin';
import type { MaintenanceTask, SaveTaskInput } from '@/ai/schemas/maintenance-task-schemas';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask } from './maintenance-task-service';

const CopyTasksInputSchema = z.object({
  sourceAircraftId: z.string(),
  taskIds: z.array(z.string()).min(1),
  targetAircraftIds: z.array(z.string()).min(1),
});
export type CopyTasksInput = z.infer<typeof CopyTasksInputSchema>;

export async function copyMaintenanceTasks(
  { sourceAircraftId, taskIds, targetAircraftIds }: CopyTasksInput
) {
  console.log('🛠️ [copyMaintenanceTasks] Function called');
  console.log('🔧 Received input:', {
    sourceAircraftId,
    taskIds,
    targetAircraftIds,
  });

  try {
    console.log(`[🔍] Fetching tasks for aircraft ${sourceAircraftId}...`);
    const allSourceTasks = await fetchMaintenanceTasksForAircraft({ aircraftId: sourceAircraftId });

    if (!Array.isArray(allSourceTasks)) {
      console.error('❌ [copyMaintenanceTasks] fetchMaintenanceTasksForAircraft returned non-array:', allSourceTasks);
      throw new Error('Unexpected response from fetchMaintenanceTasksForAircraft');
    }

    const tasksToCopy = allSourceTasks.filter(task => taskIds.includes(task.id));
    console.log(`📦 Found ${tasksToCopy.length} matching task(s) to copy`);

    if (tasksToCopy.length === 0) {
      console.warn(`[⚠️] No tasks matched the selected IDs on source aircraft ${sourceAircraftId}`);
      return {
        success: false,
        copiedTasksCount: 0,
        targetAircraftCount: targetAircraftIds.length,
        status: "No tasks matched the selected IDs on the source aircraft.",
      };
    }

    const copyPromises: Promise<any>[] = [];

    for (const targetId of targetAircraftIds) {
      if (targetId === sourceAircraftId) {
        console.log(`[⏩] Skipping self-copy for ${targetId}`);
        continue;
      }

      console.log(`[🛫] Copying tasks to ${targetId}`);

      for (const sourceTask of tasksToCopy) {
        const newTaskId = db.collection('maintenanceTasks').doc().id;

        const newTask: SaveTaskInput = {
          id: newTaskId,
          aircraftId: targetId,
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

          // Reset usage
          lastCompletedDate: undefined,
          lastCompletedHours: undefined,
          lastCompletedCycles: undefined,
          lastCompletedNotes: undefined,

          // Tracking
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

        console.log(`[📄] Queuing task copy for ${targetId}:`, {
          title: newTask.itemTitle,
          id: newTask.id,
        });

        copyPromises.push(saveMaintenanceTask(newTask));
      }
    }

    console.log(`[📨] Awaiting ${copyPromises.length} save operations...`);
    await Promise.all(copyPromises);
    console.log(`[✅] All tasks saved.`);

    return {
      success: true,
      copiedTasksCount: tasksToCopy.length,
      targetAircraftCount: targetAircraftIds.length,
      status: `Copied ${tasksToCopy.length} task(s) to ${targetAircraftIds.length} aircraft.`,
    };

  } catch (error) {
    console.error('❌ [copyMaintenanceTasks] Caught error:', error);
    throw new Error(`Failed to copy tasks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

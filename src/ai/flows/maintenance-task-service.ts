
'use server';
/**
 * @fileOverview A dedicated service file for handling Firestore operations for maintenance tasks.
 * This helps avoid circular dependencies between different flows that might both need to
 * fetch or save maintenance tasks.
 */

import { adminDb as db } from '@/lib/firebase-admin';
import type { MaintenanceTask, SaveTaskInput, FetchTasksInput, DeleteTaskInput } from '@/ai/schemas/maintenance-task-schemas';

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

/**
 * Fetches all maintenance tasks for a given aircraft from Firestore.
 */
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized in fetchMaintenanceTasksForAircraft (service).");
  }
  console.log('Executing fetchMaintenanceTasksForAircraft (service) for aircraftId:', input.aircraftId);
  try {
    const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
    const q = tasksCollectionRef.where("aircraftId", "==", input.aircraftId);
    const snapshot = await q.get();
    const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
    console.log('Fetched', tasksList.length, 'tasks for aircraft from service:', input.aircraftId);
    return tasksList;
  } catch (error) {
    console.error('Error fetching tasks from Firestore (service) for aircraft', input.aircraftId, ':', error);
    throw new Error(`Failed to fetch tasks from service: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Saves (creates or updates) a maintenance task in Firestore.
 */
export async function saveMaintenanceTask(taskData: SaveTaskInput): Promise<MaintenanceTask> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized in saveMaintenanceTask (service).");
  }
  console.log('[saveTask] Attempting to save task with ID:', taskData.id, 'for aircraft:', taskData.aircraftId);
  console.log('[saveTask] Data to be written:', JSON.stringify(taskData, null, 2));

  try {
    const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(taskData.id);
    const { id, ...dataToSet } = taskData;
    
    // Explicitly return the promise from the set operation
    await taskDocRef.set(dataToSet); 
    
    console.log('[saveTask] Successfully saved maintenance task in Firestore:', taskData.id);
    return taskData; // Return the full input object as it was passed (and saved)
  } catch (error) {
    console.error(`[saveTask] CRITICAL Firestore Error while saving task ${taskData.id}:`, error);
    throw new Error(`Failed to save task ${taskData.id} via service: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Deletes a maintenance task from Firestore.
 */
export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
    if (!db) {
        throw new Error("Firestore admin instance is not initialized in deleteMaintenanceTask (service).");
    }
    console.log('Executing deleteMaintenanceTask (service) for task ID:', input.taskId);
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(input.taskId);
      await taskDocRef.delete();
      console.log('Deleted maintenance task from Firestore via service:', input.taskId);
      return { success: true, taskId: input.taskId };
    } catch (error) {
      console.error('Error deleting maintenance task from Firestore (service):', error);
      throw new Error(`Failed to delete task ${input.taskId} via service: ${error instanceof Error ? error.message : String(error)}`);
    }
}

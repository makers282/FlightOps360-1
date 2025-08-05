
'use server';

import { z } from 'zod';
import { adminDb as db } from '@/lib/firebase-admin';
import { MaintenanceTaskSchema, SaveTaskInputSchema } from '@/ai/schemas/maintenance-task-schemas';
import type { MaintenanceTask, SaveTaskInput, FetchTasksInput, DeleteTaskInput } from '@/ai/schemas/maintenance-task-schemas';

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

/**
 * Recursively cleans an object or array by converting `undefined` values to `null`.
 * This is crucial for Firestore compatibility, as the SDK ignores `undefined` fields.
 * @param obj The object or array to clean.
 * @returns The cleaned object or array.
 */
function cleanUndefineds(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefineds);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key as keyof SaveTaskInput] = value === undefined ? null : cleanUndefineds(value);
      return acc;
    }, {} as { [key: string]: any });
  }
  return obj;
}

/**
 * Fetches all maintenance tasks for a given aircraft from Firestore.
 */
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized in fetchMaintenanceTasksForAircraft (service).");
  }
  try {
    const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
    const q = tasksCollectionRef.where("aircraftId", "==", input.aircraftId);
    const snapshot = await q.get();
    const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
    return tasksList;
  } catch (error) {
    console.error('Error fetching tasks from Firestore (service) for aircraft', input.aircraftId, ':', error);
    throw new Error(`Failed to fetch tasks from service: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Saves (creates or updates) a maintenance task in Firestore.
 * It cleans the input data to ensure Firestore compatibility and validates against the schema.
 */
export async function saveMaintenanceTask(taskData: SaveTaskInput): Promise<MaintenanceTask> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }

  const firestoreId = taskData.id || db.collection(MAINTENANCE_TASKS_COLLECTION).doc().id;
  const docRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(firestoreId);
  const now = new Date().toISOString();

  // Clean the object to convert all undefined values to null recursively
  const cleanedData = cleanUndefineds({
    ...taskData,
    id: firestoreId,
    updatedAt: now,
    createdAt: taskData.createdAt || now, // Set createdAt only if it's new
  });

  // Validate the cleaned data against the Zod schema before saving
  const validationResult = MaintenanceTaskSchema.safeParse(cleanedData);
  if (!validationResult.success) {
    console.error("Zod validation failed before saving maintenance task:", validationResult.error.flatten());
    throw new Error("Validation failed for the task data being saved.");
  }
  
  // Use the validated data for the Firestore operation
  await docRef.set(validationResult.data, { merge: true });

  const savedDoc = await docRef.get();
  if (!savedDoc.exists) {
    throw new Error(`Failed to save or retrieve maintenance task with ID: ${firestoreId}`);
  }

  return savedDoc.data() as MaintenanceTask;
}


/**
 * Deletes a maintenance task from Firestore.
 */
export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
    if (!db) {
        throw new Error("Firestore admin instance is not initialized in deleteMaintenanceTask (service).");
    }
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(input.taskId);
      await taskDocRef.delete();
      return { success: true, taskId: input.taskId };
    } catch (error) {
      console.error('Error deleting maintenance task from Firestore (service):', error);
      throw new Error(`Failed to delete task ${input.taskId} via service: ${error instanceof Error ? error.message : String(error)}`);
    }
}

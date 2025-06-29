
'use server';
/**
 * @fileOverview A dedicated Genkit flow for creating notifications to avoid circular dependencies.
 */

import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Notification, SaveNotificationInput } from '@/ai/schemas/notification-schemas';

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Removes properties with undefined values from an object.
 * This is crucial for Firestore, which does not allow 'undefined' as a field value.
 * @param obj The object to clean.
 * @returns A new object with undefined properties removed.
 */
function removeUndefined(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

export async function createNotification(input: SaveNotificationInput): Promise<Notification> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in createNotification.");
    throw new Error("Firestore admin instance is not initialized.");
  }
  
  const notificationId = input.id || db.collection(NOTIFICATIONS_COLLECTION).doc().id;
  const { id, ...notificationData } = input;

  const dataToSave = {
      ...notificationData,
      type: notificationData.type || 'info',
      title: notificationData.title,
      message: notificationData.message,
      timestamp: notificationData.timestamp || new Date().toISOString(),
      isRead: notificationData.isRead || false,
      link: notificationData.link,
      userId: notificationData.userId, // This might be undefined
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
  };

  const cleanedDataToSave = removeUndefined(dataToSave);

  const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  try {
      await notificationDocRef.set(cleanedDataToSave);
      
      // Fetch the document snapshot to confirm the write and get the stored data
      const docSnap = await notificationDocRef.get();
      if (!docSnap.exists) {
        // This is a critical error, as the write operation we just performed should have created the document.
        console.error(`[createNotification] CRITICAL: Document with ID ${notificationId} not found immediately after write operation.`);
        throw new Error("Notification not found after write.");
      }
      
      const data = docSnap.data()!;

      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
      } as Notification;

  } catch (error) {
      console.error(`Error creating notification ${notificationId}:`, error);
      throw new Error(`Failed to create notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

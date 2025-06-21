'use server';
/**
 * @fileOverview A dedicated Genkit flow for creating notifications to avoid circular dependencies.
 */

import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Notification, SaveNotificationInput } from '@/ai/schemas/notification-schemas';

const NOTIFICATIONS_COLLECTION = 'notifications';

// This function can be called by other backend flows/services to create a notification.
export async function createNotification(input: SaveNotificationInput): Promise<Notification> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in createNotification. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in createNotification.");
  }
  const notificationId = input.id || db.collection(NOTIFICATIONS_COLLECTION).doc().id;
  const { id, ...notificationData } = input; // remove id if present

  const dataToSave: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      ...notificationData,
      type: notificationData.type || 'info',
      title: notificationData.title,
      message: notificationData.message,
      timestamp: notificationData.timestamp || new Date().toISOString(),
      isRead: notificationData.isRead || false,
      link: notificationData.link,
      userId: notificationData.userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
  };

  const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  try {
      await notificationDocRef.set(dataToSave);
      const savedDocSnap = await notificationDocRef.get();
      if (!savedDocSnap.exists()) {
          throw new Error("Notification not found after creation.");
      }
      const savedData = savedDocSnap.data()!;
      return {
          id: savedDocSnap.id,
          ...savedData,
          timestamp: (savedData.timestamp as Timestamp)?.toDate().toISOString(),
          createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString(),
          updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString(),
      } as Notification;
  } catch (error) {
      console.error(`Error creating notification ${notificationId}:`, error);
      throw new Error(`Failed to create notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

    
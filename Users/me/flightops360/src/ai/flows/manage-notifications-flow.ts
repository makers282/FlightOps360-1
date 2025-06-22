
'use server';
/**
 * @fileOverview Genkit flows for managing user-facing notifications using Firestore.
 * This file handles fetching and marking notifications as read.
 * The generation of system-wide notifications is handled by a separate flow
 * to prevent circular dependencies.
 *
 * - fetchNotifications - Fetches notifications for display.
 * - markNotificationAsRead - Marks a specific notification as read or unread.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Notification } from '@/ai/schemas/notification-schemas';
import { 
    FetchNotificationsOutputSchema, 
    MarkNotificationReadInputSchema,
    MarkNotificationReadOutputSchema,
} from '@/ai/schemas/notification-schemas';
import { generateDynamicNotifications } from './generate-system-notifications-flow';

const NOTIFICATIONS_COLLECTION = 'notifications';

// Exported async function that clients will call to get notifications
export async function fetchNotifications(): Promise<Notification[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchNotifications. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance is not initialized.");
  }
  return fetchNotificationsFlow();
}

const fetchNotificationsFlow = ai.defineFlow(
  {
    name: 'fetchNotificationsFlow',
    outputSchema: FetchNotificationsOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchNotificationsFlow.");
        throw new Error("Firestore admin instance is not initialized.");
    }
    try {
      // For a robust system, this should be run by a scheduled job (e.g., cron).
      // For this example, we trigger the generation on-the-fly when notifications are fetched.
      // This ensures the user sees the latest alerts without needing a separate process.
      await generateDynamicNotifications();

      const notificationsCollectionRef = db.collection(NOTIFICATIONS_COLLECTION);
      // In a multi-user system, you would add: .where("userId", "==", currentUserId)
      const q = notificationsCollectionRef.orderBy("createdAt", "desc").limit(50);
      const snapshot = await q.get();

      if (snapshot.empty) {
        return [];
      }

      const notificationsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          // Ensure timestamps are consistently converted to ISO strings for the client
          timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Notification; 
      });
      return notificationsList;
    } catch (error) {
      console.error('Error fetching notifications from Firestore:', error);
      throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// Exported async function for marking notifications as read
export async function markNotificationAsRead(input: { notificationId: string; isRead: boolean }): Promise<Notification> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in markNotificationAsRead. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance is not initialized.");
  }
  return markNotificationReadFlow(input);
}

const markNotificationReadFlow = ai.defineFlow(
    {
        name: 'markNotificationReadFlow',
        inputSchema: MarkNotificationReadInputSchema,
        outputSchema: MarkNotificationReadOutputSchema,
    },
    async ({ notificationId, isRead }) => {
        if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in markNotificationReadFlow.");
        throw new Error("Firestore admin instance is not initialized.");
    }
        const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
        try {
            await notificationDocRef.update({
                isRead: isRead,
                updatedAt: FieldValue.serverTimestamp(),
            });
            const updatedDocSnap = await notificationDocRef.get();
            if (!updatedDocSnap.exists) {
                throw new Error("Notification not found after update.");
            }
            const data = updatedDocSnap.data()!;
            return {
                id: updatedDocSnap.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString(),
            } as Notification;
        } catch (error) {
            console.error(`Error updating notification ${notificationId}:`, error);
            throw new Error(`Failed to update notification: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
);

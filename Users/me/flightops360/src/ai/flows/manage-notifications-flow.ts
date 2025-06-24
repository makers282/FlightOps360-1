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

// Fetch notifications for display
export async function fetchNotifications(): Promise<Notification[]> {
  if (!db) {
    console.error('Firestore admin instance not initialized in fetchNotifications.');
    throw new Error('Firestore admin instance not initialized.');
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
      console.error('Firestore admin instance not initialized in fetchNotificationsFlow.');
      throw new Error('Firestore admin instance not initialized.');
    }

    try {
      // Ensure dynamic notifications are generated before fetching
      await generateDynamicNotifications();

      const colRef = db.collection(NOTIFICATIONS_COLLECTION);
      const q = colRef.orderBy('createdAt', 'desc').limit(50);
      const snapshot = await q.get();
      if (snapshot.empty) {
        return [];
      }

      const notificationsList: Notification[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const rawTimestamp = data.timestamp;
        const rawCreated = data.createdAt;
        const rawUpdated = data.updatedAt;

        const timestamp = (rawTimestamp instanceof Timestamp)
          ? rawTimestamp.toDate().toISOString()
          : (rawCreated instanceof Timestamp)
            ? rawCreated.toDate().toISOString()
            : new Date(0).toISOString();

        const createdAt = (rawCreated instanceof Timestamp)
          ? rawCreated.toDate().toISOString()
          : new Date(0).toISOString();

        const updatedAt = (rawUpdated instanceof Timestamp)
          ? rawUpdated.toDate().toISOString()
          : new Date(0).toISOString();

        return {
          id: docSnap.id,
          ...data,
          timestamp,
          createdAt,
          updatedAt,
        } as Notification;
      });

      return notificationsList;
    } catch (err) {
      console.error('Error fetching notifications from Firestore:', err);
      throw new Error(`Failed to fetch notifications: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
);

// Mark a notification as read/unread
export async function markNotificationAsRead(
  input: { notificationId: string; isRead: boolean }
): Promise<Notification> {
  if (!db) {
    console.error('Firestore admin instance not initialized in markNotificationAsRead.');
    throw new Error('Firestore admin instance not initialized.');
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
      console.error('Firestore admin instance not initialized in markNotificationReadFlow.');
      throw new Error('Firestore admin instance not initialized.');
    }

    const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
    try {
      await docRef.update({
        isRead,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updatedSnap = await docRef.get();
      if (!updatedSnap.exists) {
        throw new Error('Notification not found after update.');
      }

      const data = updatedSnap.data()!;
      const rawTimestamp = data.timestamp;
      const rawCreated = data.createdAt;
      const rawUpdated = data.updatedAt;

      const timestamp = (rawTimestamp instanceof Timestamp)
        ? rawTimestamp.toDate().toISOString()
        : (rawCreated instanceof Timestamp)
          ? rawCreated.toDate().toISOString()
          : new Date(0).toISOString();

      const createdAt = (rawCreated instanceof Timestamp)
        ? rawCreated.toDate().toISOString()
        : new Date(0).toISOString();

      const updatedAt = (rawUpdated instanceof Timestamp)
        ? rawUpdated.toDate().toISOString()
        : new Date(0).toISOString();

      return {
        id: updatedSnap.id,
        ...data,
        timestamp,
        createdAt,
        updatedAt,
      } as Notification;
    } catch (err) {
      console.error(`Error updating notification ${notificationId}:`, err);
      throw new Error(`Failed to update notification: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
);

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

// Fetch notifications flow
export async function fetchNotifications(): Promise<Notification[]> {
  if (!db) throw new Error('Firestore admin instance is not initialized.');
  return fetchNotificationsFlow();
}

const fetchNotificationsFlow = ai.defineFlow(
  {
    name: 'fetchNotificationsFlow',
    outputSchema: FetchNotificationsOutputSchema,
  },
  async () => {
    if (!db) throw new Error('Firestore admin instance is not initialized.');
    // Generate any dynamic alerts first
    await generateDynamicNotifications();

    const colRef = db.collection(NOTIFICATIONS_COLLECTION);
    const q = colRef.orderBy('createdAt', 'desc').limit(50);
    const snapshot = await q.get();

    if (snapshot.empty) return [];

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      // fallback chain: timestamp → createdAt → epoch
      const timestamp =
        (data.timestamp as Timestamp)?.toDate().toISOString() ??
        (data.createdAt as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      const createdAt =
        (data.createdAt as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      const updatedAt =
        (data.updatedAt as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      return {
        id: docSnap.id,
        ...data,
        timestamp,
        createdAt,
        updatedAt,
      } as Notification;
    });
  }
);

// Mark-as-read flow
export async function markNotificationAsRead(input: {
  notificationId: string;
  isRead: boolean;
}): Promise<Notification> {
  if (!db) throw new Error('Firestore admin instance is not initialized.');
  return markNotificationReadFlow(input);
}

const markNotificationReadFlow = ai.defineFlow(
  {
    name: 'markNotificationReadFlow',
    inputSchema: MarkNotificationReadInputSchema,
    outputSchema: MarkNotificationReadOutputSchema,
  },
  async ({ notificationId, isRead }) => {
    if (!db) throw new Error('Firestore admin instance is not initialized.');

    const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
    try {
      await docRef.update({
        isRead,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updatedSnap = await docRef.get();
      if (!updatedSnap.exists) {
        throw new Error(`Notification ${notificationId} not found after update.`);
      }

      const data = updatedSnap.data()!;
      const timestamp =
        (data.timestamp as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      const createdAt =
        (data.createdAt as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      const updatedAt =
        (data.updatedAt as Timestamp)?.toDate().toISOString() ??
        new Date(0).toISOString();

      return {
        id: updatedSnap.id,
        ...data,
        timestamp,
        createdAt,
        updatedAt,
      } as Notification;
    } catch (err) {
      console.error(`Error updating notification ${notificationId}:`, err);
      throw new Error(
        `Failed to update notification: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
);

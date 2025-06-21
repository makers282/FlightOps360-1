
'use server';
/**
 * @fileOverview Genkit flows for managing notifications using Firestore.
 *
 * - fetchNotifications - Fetches notifications.
 * - markNotificationAsRead - Marks a notification as read.
 * - generateDynamicNotifications - Scans data and creates notifications for events.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Notification, SaveNotificationInput } from '@/ai/schemas/notification-schemas';
import { 
    FetchNotificationsOutputSchema, 
    MarkNotificationReadInputSchema,
    MarkNotificationReadOutputSchema,
} from '@/ai/schemas/notification-schemas';
import { z } from 'zod';
import { fetchAircraftDocuments } from './manage-aircraft-documents-flow';
import { fetchBulletins } from './manage-bulletins-flow';
import { fetchFleetAircraft } from './manage-fleet-flow';
import { fetchMaintenanceTasksForAircraft } from './manage-maintenance-tasks-flow';
import { differenceInDays, parseISO, subHours } from 'date-fns';
import { createNotification } from './create-notification-flow'; // Import from new dedicated file

const NOTIFICATIONS_COLLECTION = 'notifications';

// This function can be called by a scheduled job (e.g., cron) to generate notifications.
export async function generateDynamicNotifications(): Promise<{ createdCount: number }> {
    return generateDynamicNotificationsFlow();
}

const generateDynamicNotificationsFlow = ai.defineFlow(
    {
        name: 'generateDynamicNotificationsFlow',
        outputSchema: z.object({ createdCount: z.number() }),
    },
    async () => {
        if (!db) {
          console.error("CRITICAL: Firestore admin instance (db) is not initialized in generateDynamicNotificationsFlow.");
          return { createdCount: 0 };
        }
        let createdCount = 0;
        const today = new Date();

        // 1. Check for expiring aircraft documents
        try {
            const aircraftDocs = await fetchAircraftDocuments();
            for (const doc of aircraftDocs) {
                if (doc.expiryDate) {
                    const expiry = parseISO(doc.expiryDate);
                    const daysUntilExpiry = differenceInDays(expiry, today);

                    if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
                        const notificationId = `doc-expiry-${doc.id}`;
                        const notification = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
                        if (!notification.exists) {
                            await createNotification({
                                id: notificationId,
                                type: 'alert',
                                title: `Document Expiring: ${doc.documentName}`,
                                message: `The document "${doc.documentName}" for aircraft ${doc.aircraftTailNumber || doc.aircraftId} expires in ${daysUntilExpiry} days on ${doc.expiryDate}.`,
                                link: `/aircraft/documents`,
                            });
                            createdCount++;
                        }
                    }
                }
            }
        } catch (e) { console.error("Error generating aircraft document notifications:", e); }

        // 2. Check for new company bulletins
        try {
            const bulletins = await fetchBulletins();
            const twentyFourHoursAgo = subHours(today, 24);
            for (const bulletin of bulletins) {
                if (bulletin.isActive && parseISO(bulletin.publishedAt) > twentyFourHoursAgo) {
                    const notificationId = `new-bulletin-${bulletin.id}`;
                    const notification = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
                    if (!notification.exists) {
                        await createNotification({
                            id: notificationId,
                            type: 'info',
                            title: `New Bulletin: ${bulletin.title}`,
                            message: `A new company bulletin has been published.`,
                            link: `/settings/company`,
                        });
                        createdCount++;
                    }
                }
            }
        } catch (e) { console.error("Error generating bulletin notifications:", e); }
        
        // 3. Check for due maintenance tasks
        try {
            const allAircraft = await fetchFleetAircraft();
            for (const aircraft of allAircraft) {
                if (aircraft.isMaintenanceTracked) {
                    const tasks = await fetchMaintenanceTasksForAircraft({ aircraftId: aircraft.id });
                    for (const task of tasks) {
                        if (task.isDaysDueEnabled && task.daysDueValue && parseISO(task.daysDueValue) < today) {
                            const notificationId = `maintenance-due-${task.id}`;
                            const notification = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
                            if (!notification.exists) {
                                await createNotification({
                                    id: notificationId,
                                    type: 'alert',
                                    title: `Maintenance Due: ${task.itemTitle}`,
                                    message: `The maintenance task "${task.itemTitle}" for aircraft ${aircraft.tailNumber} was due on ${task.daysDueValue}.`,
                                    link: `/aircraft/currency/${aircraft.tailNumber}`,
                                });
                                createdCount++;
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error("Error generating maintenance notifications:", e); }

        return { createdCount };
    }
);


// Exported async function that clients will call
export async function fetchNotifications(): Promise<Notification[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchNotifications (manage-notifications-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchNotifications.");
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
        throw new Error("Firestore admin instance (db) is not initialized in fetchNotificationsFlow.");
    }
    try {
      // In a production system, you would use a scheduled job (cron) to call generateDynamicNotifications().
      // For this example, we generate them on-the-fly when they are fetched.
      await generateDynamicNotifications();

      const notificationsCollectionRef = db.collection(NOTIFICATIONS_COLLECTION);
      const q = notificationsCollectionRef.orderBy("timestamp", "desc").limit(50);
      const snapshot = await q.get();

      if (snapshot.empty) {
        return []; // Return empty if no notifications exist after generation attempt.
      }

      const notificationsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
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

// Placeholder for marking notification as read
export async function markNotificationAsRead(input: { notificationId: string; isRead: boolean }): Promise<Notification> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in markNotificationAsRead (manage-notifications-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in markNotificationAsRead.");
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
        throw new Error("Firestore admin instance (db) is not initialized in markNotificationReadFlow.");
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

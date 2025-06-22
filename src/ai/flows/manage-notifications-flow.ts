
'use server';
/**
 * @fileOverview Genkit flows for managing notifications using Firestore.
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

const NOTIFICATIONS_COLLECTION = 'notifications';

function removeUndefined(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      newObj[key] = removeUndefined(obj[key]);
    }
  }
  return newObj;
}

export async function generateDynamicNotifications(): Promise<{ createdCount: number }> {
    return generateDynamicNotificationsFlow();
}

const generateDynamicNotificationsFlow = ai.defineFlow(
    {
        name: 'generateDynamicNotificationsFlow',
        outputSchema: z.object({ createdCount: z.number() }),
    },
    async () => {
        let createdCount = 0;
        const today = new Date();

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
                            await createNotification({ id: notificationId, type: 'alert', title: `Document Expiring: ${doc.documentName}`, message: `The document "${doc.documentName}" for aircraft ${doc.aircraftTailNumber || doc.aircraftId} expires in ${daysUntilExpiry} days on ${doc.expiryDate}.`, link: `/aircraft/documents` });
                            createdCount++;
                        }
                    }
                }
            }

            const bulletins = await fetchBulletins();
            const twentyFourHoursAgo = subHours(today, 24);
            for (const bulletin of bulletins) {
                if (bulletin.isActive && parseISO(bulletin.publishedAt) > twentyFourHoursAgo) {
                    const notificationId = `new-bulletin-${bulletin.id}`;
                    const notification = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
                    if (!notification.exists) {
                        await createNotification({ id: notificationId, type: 'info', title: `New Bulletin: ${bulletin.title}`, message: `A new company bulletin has been published.`, link: `/settings/company` });
                        createdCount++;
                    }
                }
            }
        
            const allAircraft = await fetchFleetAircraft();
            for (const aircraft of allAircraft) {
                if (aircraft.isMaintenanceTracked) {
                    const tasks = await fetchMaintenanceTasksForAircraft({ aircraftId: aircraft.id });
                    for (const task of tasks) {
                        if (task.isDaysDueEnabled && task.daysDueValue && parseISO(task.daysDueValue) < today) {
                            const notificationId = `maintenance-due-${task.id}`;
                            const notification = await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).get();
                            if (!notification.exists) {
                                await createNotification({ id: notificationId, type: 'alert', title: `Maintenance Due: ${task.itemTitle}`, message: `Task "${task.itemTitle}" for ${aircraft.tailNumber} was due.`, link: `/aircraft/currency/${aircraft.tailNumber}` });
                                createdCount++;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error during notification generation:", error);
            // Don't rethrow, allow fetching existing notifications to proceed
        }

        return { createdCount };
    }
);

export async function fetchNotifications(): Promise<Notification[]> {
  return fetchNotificationsFlow();
}

const fetchNotificationsFlow = ai.defineFlow(
  {
    name: 'fetchNotificationsFlow',
    outputSchema: FetchNotificationsOutputSchema,
  },
  async () => {
    try {
      await generateDynamicNotifications();

      const notificationsCollectionRef = db.collection(NOTIFICATIONS_COLLECTION);
      const q = notificationsCollectionRef.orderBy("timestamp", "desc").limit(50);
      const snapshot = await q.get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        // Robustly handle timestamp conversion
        let timestampStr = new Date(0).toISOString();
        if (data.timestamp) {
            if (typeof data.timestamp.toDate === 'function') { // It's a Firestore Timestamp
                timestampStr = data.timestamp.toDate().toISOString();
            } else if (typeof data.timestamp === 'string') { // It's already an ISO string
                timestampStr = data.timestamp;
            }
        }
        return {
          id: docSnapshot.id,
          ...data,
          timestamp: timestampStr,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
        } as Notification; 
      });
    } catch (error) {
      console.error('Error fetching notifications from Firestore:', error);
      throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

export async function markNotificationAsRead(input: { notificationId: string; isRead: boolean }): Promise<Notification> {
  return markNotificationReadFlow(input);
}

const markNotificationReadFlow = ai.defineFlow(
    {
        name: 'markNotificationReadFlow',
        inputSchema: MarkNotificationReadInputSchema,
        outputSchema: MarkNotificationReadOutputSchema,
    },
    async ({ notificationId, isRead }) => {
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

export async function createNotification(input: SaveNotificationInput): Promise<Notification> {
    const notificationId = input.id || db.collection(NOTIFICATIONS_COLLECTION).doc().id;
    const { id, ...notificationData } = input;

    // Use FieldValue.serverTimestamp() for timestamp to ensure correct data type
    const dataToSave = {
        ...notificationData,
        type: notificationData.type || 'info',
        timestamp: FieldValue.serverTimestamp(), // Correctly use server timestamp
        isRead: notificationData.isRead || false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    const cleanedData = removeUndefined(dataToSave);
    const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    try {
        await notificationDocRef.set(cleanedData);
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

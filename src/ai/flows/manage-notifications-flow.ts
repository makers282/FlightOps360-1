
'use server';
/**
 * @fileOverview Genkit flows for managing notifications using Firestore.
 *
 * - fetchNotifications - Fetches notifications.
 * - (Future) markNotificationAsRead - Marks a notification as read.
 * - (Future) createNotification - Creates a new notification.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp, where, getDoc, setDoc } from 'firebase/firestore';
import type { Notification, SaveNotificationInput } from '@/ai/schemas/notification-schemas';
import { 
    FetchNotificationsOutputSchema, 
    NotificationSchema, // For return type assurance
    MarkNotificationReadInputSchema,
    MarkNotificationReadOutputSchema,
    SaveNotificationInputSchema
} from '@/ai/schemas/notification-schemas';
import { z } from 'zod';

const NOTIFICATIONS_COLLECTION = 'notifications';

const mockNotificationsData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { type: 'alert', title: 'Maintenance Due: N123AB', message: 'A-Check for N123AB is due in 7 days.', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), isRead: false, link: '/aircraft/currency/N123AB' },
  { type: 'info', title: 'Flight Plan Updated: TRP-004', message: 'TRP-004 (KJFK-KLAX) has a new ATC advised route due to weather.', timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), isRead: false, link: '/trips/details/TRP-004-mock' }, // Assume TRP-004-mock is a valid Firestore ID for a trip
  { type: 'success', title: 'Crew Assignment Confirmed', message: 'Capt. Miller and FO Davis confirmed for TRP-005.', timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), isRead: true, link: '/trips/details/TRP-005-mock' },
  { type: 'system', title: 'System Update Scheduled', message: 'SkyBase will undergo scheduled maintenance on Dec 25, 02:00 UTC.', timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), isRead: true },
  { type: 'training', title: 'Recurrency Expiring Soon', message: 'Pilot Jane Doe - Recurrent training expires in 30 days.', timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), isRead: false, link: '/crew/documents' },
  { type: 'compliance', title: 'New Document Acknowledgment Required', message: 'Flight Operations Manual v3.2 requires your review and acknowledgment.', timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), isRead: false, link: '/documents' },
];

// Exported async function that clients will call
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
      const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
      // For now, fetch all, order by timestamp descending, limit to e.g., 50
      // Later, this could be user-specific or filter for unread, etc.
      const q = query(notificationsCollectionRef, orderBy("timestamp", "desc"), limit(50));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log("No notifications found in Firestore, returning mock data for UI development.");
        const processedMockNotifications: Notification[] = mockNotificationsData.map((n, index) => ({
            ...n,
            id: \`mock-\${index + 1}\`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));
        return processedMockNotifications;
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
      throw new Error(\`Failed to fetch notifications: \${error instanceof Error ? error.message : String(error)}\`);
    }
  }
);

// Placeholder for marking notification as read
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
        const notificationDocRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        try {
            await updateDoc(notificationDocRef, {
                isRead: isRead,
                updatedAt: serverTimestamp(),
            });
            const updatedDocSnap = await getDoc(notificationDocRef);
            if (!updatedDocSnap.exists()) {
                throw new Error("Notification not found after update.");
            }
            const data = updatedDocSnap.data();
            return {
                id: updatedDocSnap.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString(),
            } as Notification;
        } catch (error) {
            console.error(\`Error updating notification \${notificationId}:\`, error);
            throw new Error(\`Failed to update notification: \${error instanceof Error ? error.message : String(error)}\`);
        }
    }
);


// Internal function for creating notifications - not directly exposed to client yet
// This would be called by other backend flows/services
export async function createNotification(input: SaveNotificationInput): Promise<Notification> {
    const notificationId = input.id || doc(collection(db, NOTIFICATIONS_COLLECTION)).id;
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const notificationDocRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    try {
        await setDoc(notificationDocRef, dataToSave);
        const savedDocSnap = await getDoc(notificationDocRef);
        if (!savedDocSnap.exists()) {
            throw new Error("Notification not found after creation.");
        }
        const savedData = savedDocSnap.data();
        return {
            id: savedDocSnap.id,
            ...savedData,
            timestamp: (savedData.timestamp as Timestamp)?.toDate().toISOString(),
            createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString(),
            updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString(),
        } as Notification;
    } catch (error) {
        console.error(\`Error creating notification \${notificationId}:\`, error);
        throw new Error(\`Failed to create notification: \${error instanceof Error ? error.message : String(error)}\`);
    }
}

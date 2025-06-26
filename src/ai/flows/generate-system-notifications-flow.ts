
'use server';
/**
 * @fileOverview A dedicated Genkit flow for generating system-wide dynamic notifications.
 * This flow scans various data sources (documents, bulletins, maintenance) and creates
 * notifications for relevant events like expirations or new items. It is designed to
 * be called by other services or scheduled jobs without creating circular dependencies.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { z } from 'zod';
import { differenceInDays, parseISO, subHours, isValid } from 'date-fns';
import { fetchBulletins } from '@/ai/flows/manage-bulletins-flow';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchMaintenanceTasksForAircraft } from '@/ai/flows/manage-maintenance-tasks-flow';
import { createNotification } from '@/ai/flows/create-notification-flow';
import { fetchAircraftDocuments } from '@/ai/flows/manage-aircraft-documents-flow';

const NOTIFICATIONS_COLLECTION = 'notifications';

// The main exported function that can be called by a scheduled job or another service.
export async function generateDynamicNotifications(): Promise<{ createdCount: number }> {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized. Cannot generate dynamic notifications.");
        throw new Error("Firestore admin instance is not initialized.");
    }
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
                        const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
                        const notification = await notificationDocRef.get();
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
                if (bulletin.isActive && isValid(parseISO(bulletin.publishedAt)) && parseISO(bulletin.publishedAt) > twentyFourHoursAgo) {
                    const notificationId = `new-bulletin-${bulletin.id}`;
                    const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
                    const notification = await notificationDocRef.get();
                    if (!notification.exists) {
                        await createNotification({
                            id: notificationId,
                            type: 'info',
                            title: `New Bulletin: ${bulletin.title}`,
                            message: `A new company bulletin has been published. Check the dashboard for details.`,
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
                        // Check for overdue date-based tasks
                        if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue)) && parseISO(task.daysDueValue) < today) {
                            const notificationId = `maintenance-due-${task.id}`;
                            const notificationDocRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
                            const notification = await notificationDocRef.get();
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

        console.log(`[generateDynamicNotificationsFlow] Finished generation. Created ${createdCount} new notifications.`);
        return { createdCount };
    }
);


/**
 * @fileOverview Zod schemas and TypeScript types for notifications.
 */
import { z } from 'zod';

export const notificationTypes = ['alert', 'info', 'success', 'system', 'maintenance', 'training', 'compliance'] as const;
export type NotificationType = typeof notificationTypes[number];

export const NotificationSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the notification."),
  type: z.enum(notificationTypes).default('info').describe("Type of notification, influences icon and potentially styling."),
  title: z.string().min(1, "Notification title is required."),
  message: z.string().min(1, "Notification message is required."),
  timestamp: z.string().datetime({ message: "Timestamp must be a valid ISO date string." }).describe("ISO string format of when the notification was generated or occurred."),
  isRead: z.boolean().default(false).describe("Indicates if the notification has been read by the user."),
  link: z.string().url().optional().describe("Optional URL to navigate to related content (e.g., a specific trip, document, or maintenance item)."),
  userId: z.string().optional().describe("ID of the user this notification is for, if specific. Otherwise, global."),
  createdAt: z.string().datetime().optional().describe("ISO string format, server-generated Firestore timestamp."),
  updatedAt: z.string().datetime().optional().describe("ISO string format, server-generated Firestore timestamp."),
});
export type Notification = z.infer<typeof NotificationSchema>;

// Schema for saving a notification (input to a potential createNotificationFlow)
// id, createdAt, updatedAt are typically handled by the server/Firestore.
export const SaveNotificationInputSchema = NotificationSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  id: z.string().optional(), // Optional for creation, required for update if passed
});
export type SaveNotificationInput = z.infer<typeof SaveNotificationInputSchema>;

// Output schema for fetching notifications
export const FetchNotificationsOutputSchema = z.array(NotificationSchema);

// Input for marking a notification as read
export const MarkNotificationReadInputSchema = z.object({
  notificationId: z.string(),
  isRead: z.boolean(),
});
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>;

// Output for marking a notification as read
export const MarkNotificationReadOutputSchema = NotificationSchema; // Returns the updated notification

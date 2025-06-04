
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, AlertTriangle, Info, CheckCircle2, Settings, Trash2, Loader2, MailOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fetchNotifications, markNotificationAsRead } from '@/ai/flows/manage-notifications-flow';
import type { Notification, NotificationType } from '@/ai/schemas/notification-schemas';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';

const NotificationIcon = ({ type }: { type: NotificationType }) => {
  switch (type) {
    case 'alert': return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'info': return <Info className="h-5 w-5 text-blue-500" />;
    case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'system': return <Settings className="h-5 w-5 text-gray-500" />;
    case 'maintenance': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    case 'training': return <Bell className="h-5 w-5 text-purple-500" />;
    case 'compliance': return <CheckCircle2 className="h-5 w-5 text-teal-500" />;
    default: return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, startUpdateTransition] = useTransition();
  const { toast } = useToast();

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const fetchedNotifications = await fetchNotifications();
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      toast({
        title: "Error Loading Notifications",
        description: error instanceof Error ? error.message : "Could not fetch notifications.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsReadUnread = (notificationId: string, currentIsRead: boolean) => {
    startUpdateTransition(async () => {
      try {
        const updatedNotification = await markNotificationAsRead({ notificationId, isRead: !currentIsRead });
        setNotifications(prevNotifications =>
          prevNotifications.map(n => (n.id === notificationId ? updatedNotification : n))
        );
        toast({
          title: `Notification ${!currentIsRead ? 'Marked as Read' : 'Marked as Unread'}`,
          description: updatedNotification.title,
        });
      } catch (error) {
        console.error("Failed to update notification status:", error);
        toast({
          title: "Error Updating Notification",
          description: error instanceof Error ? error.message : "Could not update status.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleMarkAllAsRead = () => {
    startUpdateTransition(async () => {
        const unreadNotifications = notifications.filter(n => !n.isRead);
        if (unreadNotifications.length === 0) {
            toast({ title: "No Unread Notifications", description: "All notifications are already marked as read.", variant: "default"});
            return;
        }
        try {
            const updatePromises = unreadNotifications.map(n => markNotificationAsRead({ notificationId: n.id, isRead: true }));
            await Promise.all(updatePromises);
            // Optimistically update UI or re-fetch
            await loadNotifications(); 
            toast({ title: "All Marked as Read", description: `${unreadNotifications.length} notifications have been marked as read.`, variant: "default"});
        } catch (error) {
            console.error("Failed to mark all as read:", error);
            toast({ title: "Error Marking All As Read", description: (error instanceof Error ? error.message : "Could not update all notifications."), variant: "destructive"});
        }
    });
  };


  return (
    <>
      <PageHeader 
        title="Notifications" 
        description="View all system alerts, updates, and important communications."
        icon={Bell}
        actions={
            <div className="flex gap-2">
                <Button variant="outline" onClick={handleMarkAllAsRead} disabled={isUpdating || notifications.every(n => n.isRead)}>
                  {isUpdating && notifications.some(n => !n.isRead) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailOpen className="mr-2 h-4 w-4" />}
                  Mark all as read
                </Button>
                {/* Future: <Button variant="destructive" size="icon" disabled><Trash2 className="h-4 w-4" /></Button> */}
            </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>Stay informed about critical updates and reminders.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No new notifications</h3>
              <p className="mt-1 text-sm text-muted-foreground">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 rounded-lg border ${notification.isRead ? 'bg-card opacity-70 hover:opacity-100' : 'bg-primary/10 border-primary/50'} flex items-start gap-4 hover:shadow-sm transition-shadow`}
                >
                  <NotificationIcon type={notification.type} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <h4 className={`font-semibold ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{notification.title}</h4>
                        {!notification.isRead && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
                    </div>
                    <p className={`text-sm ${!notification.isRead ? 'text-foreground/80' : 'text-muted-foreground'}`}>{notification.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {isValid(parseISO(notification.timestamp)) ? `${formatDistanceToNow(parseISO(notification.timestamp), { addSuffix: true })}` : 'Invalid date'}
                      </p>
                      {notification.link && (
                        <Button variant="link" size="xs" className="p-0 h-auto text-xs" asChild>
                          <Link href={notification.link}>View Details</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleMarkAsReadUnread(notification.id, notification.isRead)}
                    disabled={isUpdating}
                    className={notification.isRead ? 'opacity-70 hover:opacity-100' : ''}
                  >
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {notification.isRead ? 'Mark Unread' : 'Mark Read'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

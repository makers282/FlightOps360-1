import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, AlertTriangle, Info, CheckCircle2, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const notificationsData: Notification[] = [
  { id: '1', type: 'alert', title: 'Maintenance Alert: N123AB', message: 'Aircraft N123AB requires unscheduled maintenance for landing gear inspection.', timestamp: '2 hours ago', read: false },
  { id: '2', type: 'info', title: 'Flight Plan Updated: TRP-004', message: 'Flight TRP-004 (KJFK-KLAX) has a new ATC advised route due to weather.', timestamp: '5 hours ago', read: false },
  { id: '3', type: 'success', title: 'Crew Assignment Confirmed', message: 'Capt. Miller and FO Davis confirmed for TRP-005.', timestamp: '1 day ago', read: true },
  { id: '4', type: 'system', title: 'System Update Scheduled', message: 'SkyBase will undergo scheduled maintenance on Aug 20, 02:00 UTC.', timestamp: '2 days ago', read: true },
  { id: '5', type: 'alert', title: 'Duty Time Exceeded Warning', message: 'Pilot John Smith is approaching maximum duty hours.', timestamp: '3 days ago', read: true },
];

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'alert': return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'info': return <Info className="h-5 w-5 text-blue-500" />;
    case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'system': return <Settings className="h-5 w-5 text-gray-500" />;
    default: return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function NotificationsPage() {
  return (
    <>
      <PageHeader 
        title="Notifications" 
        description="View all system alerts, updates, and important communications."
        icon={Bell}
        actions={
            <div className="flex gap-2">
                <Button variant="outline">Mark all as read</Button>
                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
            </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>Stay informed about critical updates and reminders.</CardDescription>
        </CardHeader>
        <CardContent>
          {notificationsData.length === 0 ? (
            <div className="text-center py-10">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No new notifications</h3>
              <p className="mt-1 text-sm text-muted-foreground">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notificationsData.map((notification) => (
                <div key={notification.id} className={`p-4 rounded-lg border ${notification.read ? 'bg-card' : 'bg-primary/10 border-primary/50'} flex items-start gap-4 hover:shadow-sm transition-shadow`}>
                  <NotificationIcon type={notification.type} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <h4 className={`font-semibold ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>{notification.title}</h4>
                        {!notification.read && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
                    </div>
                    <p className={`text-sm ${!notification.read ? 'text-foreground/80' : 'text-muted-foreground'}`}>{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.timestamp}</p>
                  </div>
                  <Button variant="ghost" size="sm" className={notification.read ? 'opacity-50' : ''}>
                    {notification.read ? 'Mark Unread' : 'Mark Read'}
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

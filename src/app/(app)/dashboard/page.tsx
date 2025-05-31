
"use client"; // Added "use client" as we'll use hooks

import React, { useState, useEffect } from 'react'; // Added useState, useEffect
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { AlertTriangle, Plane, Milestone, FileText, ShieldAlert, Bell, LayoutDashboard, Megaphone, UserCheck, CalendarClock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; // Import fleet flow
import { useToast } from '@/hooks/use-toast'; // Import useToast

// Static data for sections not yet dynamic
const tripData = [
  { id: 'TRP-001', origin: 'KHPN', destination: 'KMIA', aircraft: 'N123AB', status: 'Scheduled', departure: '2024-08-15 10:00 EDT' },
  { id: 'TRP-002', origin: 'KTEB', destination: 'KSDL', aircraft: 'N456CD', status: 'En Route', departure: '2024-08-14 14:30 EDT' },
  { id: 'TRP-004', origin: 'KDAL', destination: 'KAPA', aircraft: 'N123AB', status: 'Awaiting Closeout', departure: '2024-08-15 18:00 CDT' },
  { id: 'TRP-003', origin: 'KLAX', destination: 'KLAS', aircraft: 'N789EF', status: 'Completed', departure: '2024-08-13 09:00 PDT' },
];

const bulletinData = [
  { id: 'B001', title: 'Upcoming System Maintenance', message: 'Scheduled maintenance on Sunday at 02:00 UTC. Expect brief downtime.', date: '2024-08-20', type: 'warning' as 'info' | 'warning' | 'critical' },
  { id: 'B002', title: 'New Catering Policy Effective Sept 1st', message: 'Please review the updated catering guidelines in the document hub.', date: '2024-08-18', type: 'info' as 'info' | 'warning' | 'critical' },
  { id: 'B003', title: 'Mandatory Safety Briefing', message: 'All flight crew attend safety briefing on Aug 25th, 10:00 local.', date: '2024-08-17', type: 'critical' as 'info' | 'warning' | 'critical' },
];

const crewAlertData = [
  { id: 'CAL001', type: 'training' as 'training' | 'certification' | 'document', severity: 'warning' as 'info' | 'warning' | 'critical', title: 'Recurrency Due Soon', message: 'Capt. Ava Williams - Recurrency training due in 15 days.', icon: CalendarClock },
  { id: 'CAL002', type: 'certification' as 'training' | 'certification' | 'document', severity: 'critical' as 'info' | 'warning' | 'critical', title: 'Medical Expired', message: 'FO Ben Carter - Medical certificate expired yesterday.', icon: AlertCircle },
  { id: 'CAL003', type: 'document' as 'training' | 'certification' | 'document', severity: 'info' as 'info' | 'warning' | 'critical', title: 'Passport Updated', message: 'FA Chloe Davis - Passport updated in system.', icon: CheckCircle2 },
];


const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
    case 'completed':
    case 'off duty':
      return 'default';
    case 'in flight':
    case 'en route':
    case 'on duty':
      return 'secondary';
    case 'maintenance':
    case 'scheduled':
    case 'awaiting closeout':
    case 'standby':
      return 'outline';
    default:
      return 'default';
  }
};

const getBulletinBadgeVariant = (type: 'info' | 'warning' | 'critical') => {
  switch (type) {
    case 'info':
      return 'default';
    case 'warning':
      return 'outline';
    case 'critical':
      return 'destructive';
    default:
      return 'default';
  }
};

const getAlertIcon = (alert: typeof crewAlertData[0]) => {
  const Icon = alert.icon;
  let iconColorClass = "text-primary";
  if (alert.severity === 'warning') iconColorClass = "text-yellow-500";
  if (alert.severity === 'critical') iconColorClass = "text-destructive";
  if (alert.severity === 'info') iconColorClass = "text-blue-500";
  return <Icon className={`h-5 w-5 ${iconColorClass}`} />;
}

export default function DashboardPage() {
  const [aircraftList, setAircraftList] = useState<FleetAircraft[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadAircraft = async () => {
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        setAircraftList(fleet);
      } catch (error) {
        console.error("Failed to load aircraft for dashboard:", error);
        toast({
          title: "Error Loading Aircraft",
          description: "Could not fetch aircraft status for the dashboard.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraft();
  }, [toast]);

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      <Card className="mb-6 shadow-md border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Company Bulletin Board</CardTitle>
          <CardDescription>Latest news and announcements for all personnel. (Static Data)</CardDescription>
        </CardHeader>
        <CardContent>
          <List>
            {bulletinData.map((item, index) => (
              <React.Fragment key={item.id}>
                <ListItem className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3">
                  <div className="flex-1 mb-2 sm:mb-0">
                    <p className="font-semibold">{item.title} <span className="text-xs text-muted-foreground font-normal">- {item.date}</span></p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                  </div>
                  <Badge variant={getBulletinBadgeVariant(item.type)} className="capitalize">{item.type}</Badge>
                </ListItem>
                {index < bulletinData.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Milestone className="h-5 w-5 text-primary" />Trip Status</CardTitle>
            <CardDescription>Overview of current and upcoming trips. (Static Data)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip ID</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Departure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tripData.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.id}</TableCell>
                    <TableCell>{trip.origin} &rarr; {trip.destination}</TableCell>
                    <TableCell>{trip.aircraft}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(trip.status)}>{trip.status}</Badge></TableCell>
                    <TableCell>{trip.departure}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Aircraft Status</CardTitle>
            <CardDescription>Current status of all operational aircraft.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAircraft ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading aircraft status...</p>
              </div>
            ) : aircraftList.length === 0 ? (
              <p className="text-muted-foreground text-center py-5">No aircraft found in fleet.</p>
            ) : (
              <div className="space-y-4">
                {aircraftList.map((aircraft) => (
                  <div key={aircraft.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Image 
                      src={`https://placehold.co/80x53.png`} // Example placeholder, AI hint can be used for actual image search
                      alt={aircraft.model} 
                      width={80} 
                      height={53} 
                      className="rounded-md aspect-video object-cover" 
                      data-ai-hint={`${aircraft.model.split(' ')[0] || 'jet'} private`} // Simple AI hint
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{aircraft.tailNumber} <span className="text-sm text-muted-foreground font-normal">- {aircraft.model}</span></p>
                      <p className="text-sm text-muted-foreground">Base: {aircraft.baseLocation || 'N/A'}</p>
                    </div>
                    {/* A true "Status" (e.g., Available, In Flight) would require more complex logic or another data source */}
                    <Badge variant={getStatusBadgeVariant(aircraft.isMaintenanceTracked ? 'Available' : 'Check Status')}>
                      {aircraft.isMaintenanceTracked ? 'Active' : 'Needs Review'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Crew Alerts</CardTitle>
            <CardDescription>Important crew notifications. (Static Data)</CardDescription>
          </CardHeader>
          <CardContent>
            <List>
              {crewAlertData.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem className="flex items-start gap-3 py-2">
                    {getAlertIcon(alert)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                     <Badge variant={getBulletinBadgeVariant(alert.severity)} className="capitalize text-xs">{alert.severity}</Badge>
                  </ListItem>
                  {index < crewAlertData.length - 1 && <Separator />}
                </React.Fragment>
              ))}
               {crewAlertData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No crew alerts at this time.</p>
              )}
            </List>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Active System Alerts</CardTitle>
            <CardDescription>Critical system notifications. (Static Data)</CardDescription>
          </CardHeader>
          <CardContent>
            <List>
              <ListItem className="flex justify-between items-center">
                <div>
                  <p className="font-medium">N789EF Maintenance Due</p>
                  <p className="text-sm text-muted-foreground">Scheduled A-Check approaching.</p>
                </div>
                <Badge variant="destructive">High</Badge>
              </ListItem>
              <Separator className="my-2" />
              <ListItem className="flex justify-between items-center">
                <div>
                  <p className="font-medium">TRP-004 Weather Alert</p>
                  <p className="text-sm text-muted-foreground">Thunderstorms forecasted for KDEN.</p>
                </div>
                <Badge variant="outline">Medium</Badge>
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Document Hub</CardTitle>
            <CardDescription>(Static Link)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Access flight and compliance documents.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />FRAT</CardTitle>
            <CardDescription>(Static Link)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Flight Risk Assessment Tool status.</p>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
    

    
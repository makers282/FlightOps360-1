
import React from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { AlertTriangle, Plane, Milestone, Users, FileText, ShieldAlert, Bell, LayoutDashboard, Megaphone, UsersRound } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


const aircraftData = [
  { id: 'N123AB', type: 'Cessna Citation CJ3', status: 'Available', location: 'KHPN', imageUrl: 'https://placehold.co/600x400.png', dataAiHint: 'private jet' },
  { id: 'N456CD', type: 'Bombardier Global 6000', status: 'In Flight', location: 'KTEB -> KSDL', imageUrl: 'https://placehold.co/600x400.png', dataAiHint: 'business jet' },
  { id: 'N789EF', type: 'Gulfstream G650ER', status: 'Maintenance', location: 'KDAL', imageUrl: 'https://placehold.co/600x400.png', dataAiHint: 'luxury jet' },
];

const tripData = [
  { id: 'TRP-001', origin: 'KHPN', destination: 'KMIA', aircraft: 'N123AB', status: 'Scheduled', departure: '2024-08-15 10:00 EDT' },
  { id: 'TRP-002', origin: 'KTEB', destination: 'KSDL', aircraft: 'N456CD', status: 'En Route', departure: '2024-08-14 14:30 EDT' },
  { id: 'TRP-003', origin: 'KLAX', destination: 'KLAS', aircraft: 'N789EF', status: 'Completed', departure: '2024-08-13 09:00 PDT' },
];

const bulletinData = [
  { id: 'B001', title: 'Upcoming System Maintenance', message: 'Scheduled maintenance on Sunday at 02:00 UTC. Expect brief downtime.', date: '2024-08-20', type: 'warning' as 'info' | 'warning' | 'critical' },
  { id: 'B002', title: 'New Catering Policy Effective Sept 1st', message: 'Please review the updated catering guidelines in the document hub.', date: '2024-08-18', type: 'info' as 'info' | 'warning' | 'critical' },
  { id: 'B003', title: 'Mandatory Safety Briefing', message: 'All flight crew attend safety briefing on Aug 25th, 10:00 local.', date: '2024-08-17', type: 'critical' as 'info' | 'warning' | 'critical' },
];

const crewData = [
  { id: 'CRW001', name: 'Capt. Ava Williams', role: 'Pilot', status: 'On Duty', assignment: 'FL123 (KMIA)', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'pilot portrait female' },
  { id: 'CRW002', name: 'FO Ben Carter', role: 'First Officer', status: 'Standby', assignment: 'KHPN Base', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'copilot portrait male' },
  { id: 'CRW003', name: 'FA Chloe Davis', role: 'Flight Attendant', status: 'Off Duty', assignment: '-', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'attendant portrait female' },
  { id: 'CRW004', name: 'Eng. Mike Brown', role: 'Engineer', status: 'Maintenance', assignment: 'N789EF Hangar 3', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'engineer man serious' },
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


export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      <Card className="mb-6 shadow-md border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Company Bulletin Board</CardTitle>
          <CardDescription>Latest news and announcements for all personnel.</CardDescription>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Aircraft Status</CardTitle>
            <CardDescription>Current status of all operational aircraft.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aircraftData.map((aircraft) => (
                <div key={aircraft.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Image src={aircraft.imageUrl} alt={aircraft.type} width={80} height={53} className="rounded-md aspect-video object-cover" data-ai-hint={aircraft.dataAiHint} />
                  <div className="flex-1">
                    <p className="font-semibold">{aircraft.id} <span className="text-sm text-muted-foreground font-normal">- {aircraft.type}</span></p>
                    <p className="text-sm text-muted-foreground">{aircraft.location}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(aircraft.status)}>{aircraft.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Active Alerts</CardTitle>
            <CardDescription>Critical notifications and warnings.</CardDescription>
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
               <Separator className="my-2" />
              <ListItem className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Pilot Certification Expiring</p>
                  <p className="text-sm text-muted-foreground">Capt. Smith - Recurrency due</p>
                </div>
                <Badge variant="outline">Low</Badge>
              </ListItem>
            </List>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Crew Status</CardTitle>
            <CardDescription>Current status and assignments of crew members.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {crewData.map((crew) => (
                <div key={crew.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={crew.avatarUrl} alt={crew.name} data-ai-hint={crew.dataAiHint} />
                    <AvatarFallback>{crew.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{crew.name} <span className="text-sm text-muted-foreground font-normal">- {crew.role}</span></p>
                    <p className="text-sm text-muted-foreground">Assignment: {crew.assignment}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(crew.status)}>{crew.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Milestone className="h-5 w-5 text-primary" />Trip Status</CardTitle>
            <CardDescription>Overview of current and upcoming trips.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage user roles and permissions.</p>
            {/* Placeholder for user management summary */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Document Hub</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Access flight and compliance documents.</p>
            {/* Placeholder for document hub summary */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />FRAT</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Flight Risk Assessment Tool status.</p>
            {/* Placeholder for FRAT summary */}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
    

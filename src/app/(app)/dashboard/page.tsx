
"use client"; 

import React, { useState, useEffect } from 'react'; 
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { AlertTriangle, Plane, Milestone, FileText, ShieldAlert, Bell, LayoutDashboard, Megaphone, UserCheck, CalendarClock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; 
import { fetchTrips, type Trip, type TripStatus } from '@/ai/flows/manage-trips-flow';
import { fetchBulletins, type Bulletin } from '@/ai/flows/manage-bulletins-flow'; // Import bulletin flow
import { useToast } from '@/hooks/use-toast'; 
import { format, parseISO, isValid } from 'date-fns';


const crewAlertData = [ // This remains static for now
  { id: 'CAL001', type: 'training' as 'training' | 'certification' | 'document', severity: 'warning' as 'info' | 'warning' | 'critical', title: 'Recurrency Due Soon', message: 'Capt. Ava Williams - Recurrency training due in 15 days.', icon: CalendarClock },
  { id: 'CAL002', type: 'certification' as 'training' | 'certification' | 'document', severity: 'critical' as 'info' | 'warning' | 'critical', title: 'Medical Expired', message: 'FO Ben Carter - Medical certificate expired yesterday.', icon: AlertCircle },
  { id: 'CAL003', type: 'document' as 'training' | 'certification' | 'document', severity: 'info' as 'info' | 'warning' | 'critical', title: 'Passport Updated', message: 'FA Chloe Davis - Passport updated in system.', icon: CheckCircle2 },
];


const getStatusBadgeVariant = (status?: TripStatus | 'Active' | 'Needs Review'): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'available':
    case 'completed':
    case 'off duty':
    case 'active':
    case 'confirmed':
      return 'default';
    case 'in flight':
    case 'en route':
    case 'on duty':
      return 'secondary';
    case 'maintenance':
    case 'scheduled':
    case 'awaiting closeout':
    case 'standby':
    case 'needs review':
      return 'outline';
    case 'cancelled':
    case 'diverted':
      return 'destructive';
    default:
      return 'default';
  }
};

const getBulletinBadgeVariant = (type: Bulletin['type']) => {
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
  const [dashboardTrips, setDashboardTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]); // State for dynamic bulletins
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true); // Loading state for bulletins
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true; 
    const loadAircraft = async () => {
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        if (isMounted) setAircraftList(fleet);
      } catch (error) { /* ... error handling ... */ } 
      finally { if (isMounted) setIsLoadingAircraft(false); }
    };

    const loadTrips = async () => {
      setIsLoadingTrips(true);
      try {
        const fetchedTrips = await fetchTrips();
        if (isMounted) {
          const sortedTrips = fetchedTrips.sort((a, b) => {
            const dateA = a.legs?.[0]?.departureDateTime ? parseISO(a.legs[0].departureDateTime).getTime() : 0;
            const dateB = b.legs?.[0]?.departureDateTime ? parseISO(b.legs[0].departureDateTime).getTime() : 0;
            return dateB - dateA;
          });
          setDashboardTrips(sortedTrips.slice(0, 5));
        }
      } catch (error) { /* ... error handling ... */ } 
      finally { if (isMounted) setIsLoadingTrips(false); }
    };

    const loadBulletins = async () => {
      setIsLoadingBulletins(true);
      try {
        const fetchedBulletins = await fetchBulletins();
        if (isMounted) {
          // Filter for active bulletins and sort by publishedAt (most recent first), take top 3-5 for dashboard
          const activeAndSorted = fetchedBulletins
            .filter(b => b.isActive)
            .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime())
            .slice(0, 5); // Show up to 5 active bulletins
          setBulletins(activeAndSorted);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load bulletins for dashboard:", error);
          toast({
            title: "Error Loading Bulletins",
            description: "Could not fetch company bulletins.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) setIsLoadingBulletins(false);
      }
    };

    loadAircraft();
    loadTrips();
    loadBulletins(); // Load dynamic bulletins

    return () => { isMounted = false; };
  }, [toast]);

  const getRouteDisplay = (legs: Trip['legs']) => { /* ... (remains the same) ... */ 
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    return `${origin} -> ${destination}`;
  };

  const formatDate = (dateString?: string) => { /* ... (remains the same) ... */ 
    if (!dateString) return 'N/A';
    try { const date = parseISO(dateString); return isValid(date) ? format(date, 'MM/dd HH:mm zz') : 'Invalid Date'; } 
    catch (e) { return 'Invalid Date Format'; }
  };

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      <Card className="mb-6 shadow-md border-primary/50">
        <Accordion type="single" collapsible defaultValue="bulletin-board-item" className="w-full">
          <AccordionItem value="bulletin-board-item" className="border-b-0">
            <CardHeader className="p-0">
              <AccordionTrigger className="flex flex-1 items-center justify-between p-4 hover:no-underline">
                <div className="text-left">
                    <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Company Bulletin Board</CardTitle>
                    <CardDescription className="mt-1">Latest news and announcements from Firestore.</CardDescription>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-0 pb-4 px-4">
                {isLoadingBulletins ? (
                  <div className="flex items-center justify-center py-5">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading bulletins...</p>
                  </div>
                ) : bulletins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No active company bulletins.</p>
                ) : (
                  <List>
                    {bulletins.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3">
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-semibold">{item.title} 
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                - {item.publishedAt && isValid(parseISO(item.publishedAt)) ? format(parseISO(item.publishedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.message}</p>
                          </div>
                          <Badge variant={getBulletinBadgeVariant(item.type)} className="capitalize">{item.type}</Badge>
                        </ListItem>
                        {index < bulletins.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Trip Status Card ... (remains the same) ... */}
      <Card className="md:col-span-2 lg:col-span-3 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Milestone className="h-5 w-5 text-primary" />Trip Status</CardTitle>
            <CardDescription>Overview of recent and upcoming trips.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTrips ? (
               <div className="flex items-center justify-center py-10"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading trip data...</p> </div>
            ) : dashboardTrips.length === 0 ? ( <p className="text-muted-foreground text-center py-5">No trips to display.</p> ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Trip ID</TableHead><TableHead>Route</TableHead><TableHead>Aircraft</TableHead><TableHead>Status</TableHead><TableHead>Departure (First Leg)</TableHead></TableRow></TableHeader>
              <TableBody>{dashboardTrips.map((trip) => ( <TableRow key={trip.id}> <TableCell className="font-medium">{trip.tripId || trip.id}</TableCell> <TableCell>{getRouteDisplay(trip.legs)}</TableCell> <TableCell>{trip.aircraftLabel || trip.aircraftId}</TableCell> <TableCell><Badge variant={getStatusBadgeVariant(trip.status)}>{trip.status}</Badge></TableCell> <TableCell>{formatDate(trip.legs?.[0]?.departureDateTime)}</TableCell> </TableRow> ))}</TableBody>
            </Table>
            )}
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Aircraft Status Card ... (remains the same) ... */}
        <Card className="lg:col-span-2">
          <CardHeader> <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Aircraft Status</CardTitle> <CardDescription>Current status of all operational aircraft.</CardDescription> </CardHeader>
          <CardContent>
            {isLoadingAircraft ? ( <div className="flex items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading aircraft status...</p> </div>
            ) : aircraftList.length === 0 ? ( <p className="text-muted-foreground text-center py-5">No aircraft found in fleet.</p>
            ) : (
               <Table>
                <TableHeader><TableRow><TableHead>Tail Number</TableHead><TableHead>Model</TableHead><TableHead>Base</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{aircraftList.map((aircraft) => ( <TableRow key={aircraft.id}> <TableCell className="font-medium">{aircraft.tailNumber}</TableCell> <TableCell>{aircraft.model}</TableCell> <TableCell>{aircraft.baseLocation || 'N/A'}</TableCell> <TableCell> <Badge variant={getStatusBadgeVariant(aircraft.isMaintenanceTracked ? 'Active' : 'Needs Review')}> {aircraft.isMaintenanceTracked ? 'Active' : 'Needs Review'} </Badge> </TableCell> </TableRow> ))} </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        {/* Crew Alerts Card ... (remains the same with static data) ... */}
        <Card>
          <CardHeader> <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Crew Alerts</CardTitle> <CardDescription>Important crew notifications. (Static Data)</CardDescription> </CardHeader>
          <CardContent> <List> {crewAlertData.map((alert, index) => ( <React.Fragment key={alert.id}> <ListItem className="flex items-start gap-3 py-2"> {getAlertIcon(alert)} <div className="flex-1"> <p className="font-medium text-sm">{alert.title}</p> <p className="text-xs text-muted-foreground">{alert.message}</p> </div> <Badge variant={getBulletinBadgeVariant(alert.severity)} className="capitalize text-xs">{alert.severity}</Badge> </ListItem> {index < crewAlertData.length - 1 && <Separator />} </React.Fragment> ))} {crewAlertData.length === 0 && ( <p className="text-sm text-muted-foreground text-center py-4">No crew alerts.</p> )} </List> </CardContent>
        </Card>
        
        {/* Active System Alerts Card ... (remains the same with static data) ... */}
        <Card>
          <CardHeader> <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Active System Alerts</CardTitle> <CardDescription>Critical system notifications. (Static Data)</CardDescription> </CardHeader>
          <CardContent> <List> <ListItem className="flex justify-between items-center"> <div> <p className="font-medium">N789EF Maintenance Due</p> <p className="text-sm text-muted-foreground">Scheduled A-Check approaching.</p> </div> <Badge variant="destructive">High</Badge> </ListItem> <Separator className="my-2" /> <ListItem className="flex justify-between items-center"> <div> <p className="font-medium">TRP-004 Weather Alert</p> <p className="text-sm text-muted-foreground">Thunderstorms forecasted for KDEN.</p> </div> <Badge variant="outline">Medium</Badge> </ListItem> </List> </CardContent>
        </Card>

        {/* Document Hub & FRAT Cards ... (remain the same) ... */}
        <Card> <CardHeader> <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Document Hub</CardTitle> <CardDescription>(Static Link)</CardDescription> </CardHeader> <CardContent> <p className="text-sm text-muted-foreground">Access flight and compliance documents.</p> </CardContent> </Card>
        <Card> <CardHeader> <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />FRAT</CardTitle> <CardDescription>(Static Link)</CardDescription> </CardHeader> <CardContent> <p className="text-sm text-muted-foreground">Flight Risk Assessment Tool status.</p> </CardContent> </Card>
      </div>
    </>
  );
}

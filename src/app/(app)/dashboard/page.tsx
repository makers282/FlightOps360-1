
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, Plane, CalendarDays, LayoutDashboard, Info, UserX as UserXIcon, Briefcase, Clock, Users, FileText as QuoteIcon, ShieldAlert, PlaneTakeoff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription as ModalAlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, addDays } from 'date-fns';
import { auth } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAircraftDiscrepancies } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import { fetchMaintenanceTasksForAircraft } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchNotifications } from '@/ai/flows/manage-notifications-flow';
import { fetchQuotes } from '@/ai/flows/manage-quotes-flow';

interface AircraftStatusDetail {
    label: "Active" | "Maintenance" | "Info";
    variant: "default" | "secondary" | "destructive" | "outline";
    details?: string;
}

interface SystemAlert {
  id: string;
  type: 'aircraft' | 'system' | 'maintenance' | 'training' | 'compliance';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link?: string;
  icon?: React.ElementType;
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [greeting, setGreeting] = useState<string>('');
  
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);

  const [currentTrips, setCurrentTrips] = useState<Trip[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);

  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);

  const [aircraftStatusDetails, setAircraftStatusDetails] = useState<Map<string, AircraftStatusDetail>>(new Map());
  const [isLoadingAircraftStatusDetails, setIsLoadingAircraftStatusDetails] = useState(true);

  const [activeSystemAlerts, setActiveSystemAlerts] = useState<SystemAlert[]>([]);
  
  const [kpiStats, setKpiStats] = useState({
      activeTrips: 0,
      pendingQuotes: 0,
      pendingQuotesValue: 0,
      aircraftDue: 0,
      alertNotices: 0,
  });
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const generateGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    setGreeting(generateGreeting());
    const interval = setInterval(() => setGreeting(generateGreeting()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, [generateGreeting]);
  
  const getBulletinTypeBadgeVariant = (type: BulletinType): "default" | "destructive" | "secondary" => {
    switch (type) {
      case 'Urgent': return 'destructive';
      case 'Important': return 'secondary';
      default: return 'default';
    }
  };

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    setIsBulletinModalOpen(true);
  };

  const loadData = useCallback(async () => {
    setIsLoadingKpis(true);
    setIsLoadingBulletins(true);
    setIsLoadingTrips(true);
    setIsLoadingFleet(true);
    setIsLoadingAircraftStatusDetails(true);

    try {
        const [
            fetchedBulletins,
            fetchedTripsData,
            fetchedFleet,
            fetchedQuotes,
            fetchedNotifications
        ] = await Promise.all([
            fetchBulletins(),
            fetchTrips(),
            fetchFleetAircraft(),
            fetchQuotes(),
            fetchNotifications(),
        ]);

        const now = new Date();

        const fetchedCurrent = fetchedTripsData.filter(trip => trip.status === 'Active');
        const fetchedUpcoming = fetchedTripsData.filter(trip => trip.legs?.[0]?.departureDateTime && parseISO(trip.legs[0].departureDateTime) > now && trip.status !== 'Active');


        // Process data for KPIs
        const pendingQuoteStatuses = ["Draft", "Sent"];
        const pendingQuotesList = fetchedQuotes.filter(q => pendingQuoteStatuses.includes(q.status));
        
        let dueCount = 0;
        for (const ac of fetchedFleet) {
            if (ac.isMaintenanceTracked) {
                const tasks = await fetchMaintenanceTasksForAircraft({ aircraftId: ac.id });
                if (tasks.some(t => t.isDaysDueEnabled && t.daysDueValue && parseISO(t.daysDueValue) < addDays(now, 30))) {
                    dueCount++;
                }
            }
        }

        setKpiStats({
            activeTrips: fetchedCurrent.length,
            pendingQuotes: pendingQuotesList.length,
            pendingQuotesValue: pendingQuotesList.reduce((acc, q) => acc + (q.totalSellPrice || 0), 0),
            aircraftDue: dueCount,
            alertNotices: fetchedNotifications.filter(n => !n.isRead).length,
        });

        // Process data for dashboard sections
        setBulletins(fetchedBulletins.filter(b => b.isActive).sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime()));
        
        setCurrentTrips(fetchedCurrent.map(trip => ({...trip, aircraftLabel: fetchedFleet.find(ac => ac.id === trip.aircraftId)?.tailNumber || trip.aircraftId})));
        setUpcomingTrips(fetchedUpcoming.map(trip => ({...trip, aircraftLabel: fetchedFleet.find(ac => ac.id === trip.aircraftId)?.tailNumber || trip.aircraftId})));
        
        setFleetList(fetchedFleet);

        const statusMap = new Map<string, AircraftStatusDetail>();
        let alerts: SystemAlert[] = [];
        for (const ac of fetchedFleet) {
            if (!ac.isMaintenanceTracked) {
                statusMap.set(ac.id, { label: "Info", variant: "outline", details: "Not Tracked" });
                continue;
            }
            const discrepancies = await fetchAircraftDiscrepancies({ aircraftId: ac.id });
            if (discrepancies.some(d => d.status === 'Open')) {
                 statusMap.set(ac.id, { label: "Maintenance", variant: "destructive", details: "Grounded (Open Write-up)" });
                 alerts.push({ id: `alert-disc-${ac.id}`, type: 'aircraft', severity: 'critical', title: `Grounded: ${ac.tailNumber}`, message: 'Aircraft has an open discrepancy.', link: `/aircraft/currency/${ac.tailNumber}`, icon: AlertTriangle });
            } else {
                 statusMap.set(ac.id, { label: "Active", variant: "default", details: "All Clear" });
            }
        }
        
        alerts = alerts.concat(fetchedNotifications
            .filter(n => !n.isRead)
            .map(n => ({
                id: n.id,
                type: n.type as SystemAlert['type'] || 'system',
                severity: n.type === 'alert' ? 'warning' : 'info',
                title: n.title,
                message: n.message,
                link: n.link,
                icon: Info,
            })));
        setAircraftStatusDetails(statusMap);
        setActiveSystemAlerts(alerts);
        
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast({ title: "Error Loading Dashboard", variant: "destructive" });
    } finally {
      setIsLoadingKpis(false);
      setIsLoadingBulletins(false);
      setIsLoadingTrips(false);
      setIsLoadingFleet(false);
      setIsLoadingAircraftStatusDetails(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const kpiCardData = [
    { title: "Pending Quotes", value: kpiStats.pendingQuotes, icon: QuoteIcon, details: `$${(kpiStats.pendingQuotesValue / 1000).toFixed(1)}K total value`, link: "/quotes" },
    { title: "Aircraft Due", value: kpiStats.aircraftDue, icon: Plane, details: "Maintenance items", link: "/aircraft/currency" },
    { title: "Alert Notices", value: kpiStats.alertNotices, icon: ShieldAlert, details: "Unread notifications", link: "/notifications" },
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {currentUser?.displayName?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your operations today.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/trips/list" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.activeTrips}</div>
              <p className="text-xs text-muted-foreground">Trips currently in progress</p>
            </CardContent>
          </Link>
        </Card>
        {kpiCardData.map((stat, index) => (
          <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
            <Link href={stat.link || "#"} className="block h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.details}</p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
      
      <Card className="mb-6 shadow-md">
        <Accordion type="single" collapsible defaultValue="bulletin-item" className="w-full">
            <AccordionItem value="bulletin-item" className="border-b-0">
                <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline [&[data-state=open]>svg]:text-primary">
                    <div className="flex items-center gap-2 text-left flex-grow"><Megaphone className="h-5 w-5 text-primary" /><CardTitle>Company Bulletin Board</CardTitle></div>
                </AccordionTrigger>
                <AccordionContent className="pt-0"><CardContent className="pb-4 px-4">{
                    isLoadingBulletins ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                    bulletins.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No active company bulletins.</p> :
                    <List>{bulletins.map((item, index) => (<React.Fragment key={item.id}><ListItem onClick={() => handleBulletinClick(item)} className="cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2 py-3 flex justify-between items-center"><p className="font-semibold">{item.title}</p><Badge variant={getBulletinTypeBadgeVariant(item.type)}>{item.type}</Badge></ListItem>{index < bulletins.length - 1 && <Separator />}</React.Fragment>))}</List>
                }</CardContent></AccordionContent>
            </AccordionItem>
        </Accordion>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PlaneTakeoff className="h-5 w-5 text-primary" />
                        <CardTitle>Current Trips</CardTitle>
                    </div>
                    <Badge variant="secondary">{currentTrips.length} Ongoing</Badge>
                </div>
            </CardHeader>
            <CardContent>
                {isLoadingTrips ? (
                    <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : currentTrips.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">No trips currently in progress.</p>
                ) : (
                    <List>
                        {currentTrips.slice(0, 5).map(trip => (
                            <ListItem key={trip.id} className="py-2 border-b last:border-b-0">
                                <Link href={`/trips/details/${trip.id}`} className="flex justify-between items-center hover:bg-muted/50 rounded-md -mx-2 px-2 py-1">
                                    <div>
                                        <p className="font-semibold">{trip.tripId} ({trip.clientName})</p>
                                        <p className="text-xs text-muted-foreground">{trip.legs?.[0]?.origin} &rarr; {trip.legs?.[trip.legs.length -1]?.destination} on {trip.aircraftLabel}</p>
                                    </div>
                                    <Badge variant="default">Released</Badge>
                                </Link>
                            </ListItem>
                        ))}
                    </List>
                )}
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        <CardTitle>Upcoming Trips</CardTitle>
                    </div>
                    <Badge variant="outline">{upcomingTrips.length} Departing Soon</Badge>
                </div>
            </CardHeader>
            <CardContent>
                 {isLoadingTrips ? (
                    <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : upcomingTrips.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">No upcoming trips scheduled.</p>
                ) : (
                     <List>
                        {upcomingTrips.slice(0, 5).map(trip => (
                            <ListItem key={trip.id} className="py-2 border-b last:border-b-0">
                                <Link href={`/trips/details/${trip.id}`} className="flex justify-between items-center hover:bg-muted/50 rounded-md -mx-2 px-2 py-1">
                                    <div>
                                        <p className="font-semibold">{trip.tripId} ({trip.clientName})</p>
                                        <p className="text-xs text-muted-foreground">Departs {format(parseISO(trip.legs[0].departureDateTime!), 'MM/dd HH:mm')}</p>
                                    </div>
                                    <Badge variant="outline">{trip.status}</Badge>
                                </Link>
                            </ListItem>
                        ))}
                    </List>
                )}
            </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader><div className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /><CardTitle>Aircraft Status Overview</CardTitle></div><CardDescription>Simplified aircraft operational readiness.</CardDescription></CardHeader>
          <CardContent>{
            (isLoadingFleet || isLoadingAircraftStatusDetails) ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin"/></div> :
            fleetList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No aircraft in fleet.</p> :
            <Table>
                <TableHeader><TableRow><TableHead>Tail #</TableHead><TableHead>Model</TableHead><TableHead>Base</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>{
                    fleetList.slice(0, 5).map(ac => {
                        const status = aircraftStatusDetails.get(ac.id) || { label: "Info", variant: "outline", details: "Loading..." };
                        return (
                            <TableRow key={ac.id}>
                                <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="text-primary hover:underline">{ac.tailNumber}</Link></TableCell>
                                <TableCell>{ac.model}</TableCell>
                                <TableCell>{ac.baseLocation || 'N/A'}</TableCell>
                                <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{status.details}</TableCell>
                            </TableRow>
                        );
                    })
                }</TableBody>
            </Table>
          }</CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md">
          <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Active System Alerts</CardTitle></div><CardDescription>Items requiring immediate attention.</CardDescription></CardHeader>
          <CardContent>{
            isLoadingAircraftStatusDetails ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin"/></div> :
            activeSystemAlerts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No critical system alerts.</p> :
            <List>{
                activeSystemAlerts.slice(0, 5).map(alert => (
                    <ListItem key={alert.id} className="py-2 border-b last:border-b-0">
                        <Link href={alert.link || "#"} className="flex items-start gap-2 hover:underline">
                            {alert.icon && <alert.icon className={`h-5 w-5 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'}`} />}
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{alert.title}</p>
                                <p className="text-xs text-muted-foreground">{alert.message}</p>
                                {alert.link && <span className="text-xs text-primary hover:underline cursor-pointer">View Details</span>}
                            </div>
                    </Link></ListItem>
                ))
            }</List>
          }</CardContent>
        </Card>
      </div>

      {selectedBulletin && (
        <AlertDialog open={isBulletinModalOpen} onOpenChange={setIsBulletinModalOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Badge variant={getBulletinTypeBadgeVariant(selectedBulletin.type)}>{selectedBulletin.type}</Badge>{selectedBulletin.title}</AlertDialogTitle>
              <ModalAlertDialogDescription className="text-xs text-muted-foreground pt-1">Published: {format(parseISO(selectedBulletin.publishedAt), 'PPP HH:mm')}</ModalAlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] mt-2"><div className="whitespace-pre-wrap p-1 text-sm">{selectedBulletin.message}</div></ScrollArea>
            <AlertDialogFooter className="mt-4"><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

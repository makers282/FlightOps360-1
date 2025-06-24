"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, Plane, CalendarDays, Info, PlaneTakeoff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription as ModalAlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addDays } from 'date-fns';
import { auth } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchCurrentTrips, fetchUpcomingTrips, type Trip } from '@/ai/flows/manage-trips-flow';
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
  const [greeting, setGreeting] = useState('');
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
    const unsub = auth.onAuthStateChanged(user => setCurrentUser(user));
    return () => unsub();
  }, []);

  const generateGreeting = useCallback(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  useEffect(() => {
    setGreeting(generateGreeting());
    const iv = setInterval(() => setGreeting(generateGreeting()), 60000);
    return () => clearInterval(iv);
  }, [generateGreeting]);

  const getBulletinBadge = (type: BulletinType) =>
    type === 'Urgent' ? 'destructive' : type === 'Important' ? 'secondary' : 'default';

  const loadData = useCallback(async () => {
    setIsLoadingKpis(true);
    setIsLoadingBulletins(true);
    setIsLoadingTrips(true);
    setIsLoadingFleet(true);
    setIsLoadingAircraftStatusDetails(true);

    try {
      const [
        fetchedBulletins,
        fetchedCurrent,
        fetchedUpcoming,
        fetchedFleet,
        fetchedQuotes,
        fetchedNotifications
      ] = await Promise.all([
        fetchBulletins(),
        fetchCurrentTrips(),
        fetchUpcomingTrips(),
        fetchFleetAircraft(),
        fetchQuotes(),
        fetchNotifications(),
      ]);

      const now = new Date();
      const pending = fetchedQuotes.filter(q => ['Draft','Sent'].includes(q.status));
      let due = 0;
      for (const ac of fetchedFleet) {
        if (ac.isMaintenanceTracked) {
          const tasks = await fetchMaintenanceTasksForAircraft({ aircraftId: ac.id });
          if (tasks.some(t => t.isDaysDueEnabled && t.daysDueValue && parseISO(t.daysDueValue) < addDays(now,30))) {
            due++;
          }
        }
      }

      setKpiStats({
        activeTrips: fetchedCurrent.length,
        pendingQuotes: pending.length,
        pendingQuotesValue: pending.reduce((sum,q) => sum + (q.totalSellPrice||0),0),
        aircraftDue: due,
        alertNotices: fetchedNotifications.filter(n=>!n.isRead).length,
      });

      setBulletins(fetchedBulletins.filter(b=>b.isActive).sort((a,b)=>parseISO(b.publishedAt).getTime()-parseISO(a.publishedAt).getTime()));
      setCurrentTrips(fetchedCurrent.map(t=>({...t,aircraftLabel: fetchedFleet.find(ac=>ac.id===t.aircraftId)?.tailNumber||t.aircraftId})));
      setUpcomingTrips(fetchedUpcoming.map(t=>({...t,aircraftLabel: fetchedFleet.find(ac=>ac.id===t.aircraftId)?.tailNumber||t.aircraftId})));
      setFleetList(fetchedFleet);

      const statusMap = new Map<string,AircraftStatusDetail>();
      const alerts: SystemAlert[] = [];
      for (const ac of fetchedFleet) {
        if (!ac.isMaintenanceTracked) {
          statusMap.set(ac.id,{label:"Info",variant:"outline",details:"Not Tracked"});
        } else {
          const d = await fetchAircraftDiscrepancies({ aircraftId: ac.id });
          if (d.some(x=>x.status==='Open')) {
            statusMap.set(ac.id,{label:"Maintenance",variant:"destructive",details:"Grounded"});
            alerts.push({id:`disc-${ac.id}`,type:'aircraft',severity:'critical',title:`Grounded ${ac.tailNumber}`,message:'Open discrepancy',link:`/aircraft/currency/${ac.tailNumber}`,icon:AlertTriangle});
          } else {
            statusMap.set(ac.id,{label:"Active",variant:"default",details:"All Clear"});
          }
        }
      }
      alerts.push(...fetchedNotifications.filter(n=>!n.isRead).map(n=>({
        id:n.id,type:n.type as SystemAlert['type'],severity:'info',title:n.title,message:n.message,link:n.link,icon:Info
      })));
      setAircraftStatusDetails(statusMap);
      setActiveSystemAlerts(alerts);
    } catch (e) {
      console.error(e);
      toast({ title:"Error loading dashboard", variant:"destructive" });
    } finally {
      setIsLoadingKpis(false);
      setIsLoadingBulletins(false);
      setIsLoadingTrips(false);
      setIsLoadingFleet(false);
      setIsLoadingAircraftStatusDetails(false);
    }
  },[toast]);

  useEffect(() => { loadData(); },[loadData]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{greeting}, {currentUser?.displayName?.split(' ')[0]||'User'}!</h1>
        <p className="text-muted-foreground">Here’s what’s happening today.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="shadow-md hover:shadow-lg">
          <Link href="/trips/list" className="block h-full">
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm">Active Trips</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.activeTrips}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="shadow-md hover:shadow-lg">
          <Link href="/quotes" className="block h-full">
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm">Pending Quotes</CardTitle>
              <Plane className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.pendingQuotes}</div>
              <p className="text-xs text-muted-foreground">${(kpiStats.pendingQuotesValue/1000).toFixed(1)}K</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="shadow-md hover:shadow-lg">
          <Link href="/aircraft/currency" className="block h-full">
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm">Aircraft Due</CardTitle>
              <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.aircraftDue}</div>
              <p className="text-xs text-muted-foreground">Maintenance</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="shadow-md hover:shadow-lg">
          <Link href="/notifications" className="block h-full">
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm">Alerts</CardTitle>
              <Info className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.alertNotices}</div>
              <p className="text-xs text-muted-foreground">Unread</p>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card className="mb-6 shadow-md">
        <Accordion type="single" collapsible defaultValue="b">
          <AccordionItem value="b">
            <AccordionTrigger className="flex justify-between p-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <CardTitle>Bulletins</CardTitle>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                {isLoadingBulletins
                  ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  : bulletins.length === 0
                  ? <p className="text-center py-3 text-sm text-muted-foreground">No active bulletins.</p>
                  : <List>
                      {bulletins.map((b,i)=>(
                        <React.Fragment key={b.id}>
                          <ListItem onClick={()=>{setSelectedBulletin(b);setIsBulletinModalOpen(true)}} className="cursor-pointer hover:bg-muted/50 px-2 py-3 flex justify-between">
                            <p className="font-semibold">{b.title}</p>
                            <Badge variant={getBulletinBadge(b.type)}>{b.type}</Badge>
                          </ListItem>
                          {i<bulletins.length-1 && <Separator />}
                        </React.Fragment>
                      ))}
                    </List>
                }
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
          <CardHeader className="flex justify-between items-center pb-2">
            <div className="flex items-center gap-2">
              <PlaneTakeoff className="h-5 w-5 text-primary" />
              <CardTitle>Current Trips</CardTitle>
            </div>
            <Badge variant="secondary">{currentTrips.length} Ongoing</Badge>
          </CardHeader>
          <CardContent>
            {isLoadingTrips
              ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : currentTrips.length === 0
              ? <p className="py-3 text-center text-sm text-muted-foreground">No trips in progress.</p>
              : <List>
                  {currentTrips.slice(0,5).map(t=>(
                    <ListItem key={t.id} className="py-2 border-b last:border-b-0">
                      <Link href={`/trips/details/${t.id}`} className="flex justify-between items-center px-2 py-1 hover:bg-muted/50 rounded">
                        <div>
                          <p className="font-semibold">{t.tripId} ({t.clientName})</p>
                          <p className="text-xs text-muted-foreground">
                            {t.legs?.[0]?.origin} → {t.legs?.[t.legs.length-1]?.destination}
                          </p>
                        </div>
                        <Badge variant="default">Released</Badge>
                      </Link>
                    </ListItem>
                  ))}
                </List>
            }
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex justify-between items-center pb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Upcoming Trips</CardTitle>
            </div>
            <Badge variant="outline">{upcomingTrips.length} Departing Soon</Badge>
          </CardHeader>
          <CardContent>
            {isLoadingTrips
              ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : upcomingTrips.length === 0
              ? <p className="py-3 text-center text-sm text-muted-foreground">No upcoming trips.</p>
              : <List>
                  {upcomingTrips.slice(0,5).map(t=>(
                    <ListItem key={t.id} className="py-2 border-b last:border-b-0">
                      <Link href={`/trips/details/${t.id}`} className="flex justify-between items-center px-2 py-1 hover:bg-muted/50 rounded">
                        <div>
                          <p className="font-semibold">{t.tripId} ({t.clientName})</p>
                          <p className="text-xs text-muted-foreground">
                            Departs {format(parseISO(t.legs[0].departureDateTime!), 'MM/dd HH:mm')}
                          </p>
                        </div>
                        <Badge variant="outline">{t.status}</Badge>
                      </Link>
                    </ListItem>
                  ))}
                </List>
            }
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader className="flex items-center gap-2 pb-2">
            <Plane className="h-5 w-5 text-primary" />
            <CardTitle>Aircraft Status</CardTitle>
          </CardHeader>
          <CardContent>
            {(isLoadingFleet||isLoadingAircraftStatusDetails)
              ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : fleetList.length === 0
              ? <p className="py-3 text-center text-sm text-muted-foreground">No aircraft.</p>
              : <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tail #</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleetList.slice(0,5).map(ac=>{
                      const s = aircraftStatusDetails.get(ac.id)!;
                      return (
                        <TableRow key={ac.id}>
                          <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="hover:underline text-primary">{ac.tailNumber}</Link></TableCell>
                          <TableCell>{ac.model}</TableCell>
                          <TableCell>{ac.baseLocation||'N/A'}</TableCell>
                          <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.details}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            }
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex items-center gap-2 pb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>System Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAircraftStatusDetails
              ? <div className="text-center py-5"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : activeSystemAlerts.length === 0
              ? <p className="py-3 text-center text-sm text-muted-foreground">No alerts.</p>
              : <List>
                  {activeSystemAlerts.slice(0,5).map(a=>(
                    <ListItem key={a.id} className="py-2 border-b last:border-b-0">
                      <Link href={a.link||'#'} className="flex items-start gap-2 hover:underline">
                        {a.icon && <a.icon className={`h-5 w-5 mt-0.5 ${a.severity==='critical'?'text-destructive':'text-yellow-500'}`} />}
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.message}</p>
                        </div>
                      </Link>
                    </ListItem>
                  ))}
                </List>
            }
          </CardContent>
        </Card>
      </div>

      {selectedBulletin && (
        <AlertDialog open={isBulletinModalOpen} onOpenChange={setIsBulletinModalOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Badge variant={getBulletinBadge(selectedBulletin.type)}>{selectedBulletin.type}</Badge>
                {selectedBulletin.title}
              </AlertDialogTitle>
              <ModalAlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Published: {format(parseISO(selectedBulletin.publishedAt),'PPP HH:mm')}
              </ModalAlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] mt-2">
              <div className="whitespace-pre-wrap p-1 text-sm">{selectedBulletin.message}</div>
            </ScrollArea>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

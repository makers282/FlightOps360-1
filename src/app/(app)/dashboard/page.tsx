
"use client"; 

import React, { useState, useEffect, useCallback } from 'react'; 
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { AlertTriangle, Plane, Milestone, FileText, ShieldAlert, Bell, LayoutDashboard, Megaphone, UserCheck, CalendarClock, AlertCircle, CheckCircle2, Loader2, ExternalLink, Wrench, InfoIcon as InfoIconLucide } from 'lucide-react'; // Renamed InfoIcon to avoid conflict
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; 
import { fetchTrips, type Trip, type TripStatus } from '@/ai/flows/manage-trips-flow';
import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow'; 
import { useToast } from '@/hooks/use-toast'; 
import { format, parseISO, isValid, addDays, differenceInCalendarDays, endOfMonth, addMonths, addYears } from 'date-fns';

import { fetchComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { fetchAircraftDiscrepancies, type AircraftDiscrepancy } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import { fetchMaintenanceTasksForAircraft, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
// type DisplayMaintenanceItem is not directly used from the other page, but similar logic is applied here

const crewAlertData = [ 
  { id: 'CAL001', type: 'training' as 'training' | 'certification' | 'document', severity: 'warning' as 'info' | 'warning' | 'critical', title: 'Recurrency Due Soon', message: 'Capt. Ava Williams - Recurrency training due in 15 days.', icon: CalendarClock },
  { id: 'CAL002', type: 'certification' as 'training' | 'certification' | 'document', severity: 'critical' as 'info' | 'warning' | 'critical', title: 'Medical Expired', message: 'FO Ben Carter - Medical certificate expired yesterday.', icon: AlertCircle },
  { id: 'CAL003', type: 'document' as 'training' | 'certification' | 'document', severity: 'info' as 'info' | 'warning' | 'critical', title: 'Passport Updated', message: 'FA Chloe Davis - Passport updated in system.', icon: CheckCircle2 },
];


const getTripStatusBadgeVariant = (status?: TripStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'confirmed':
      return 'default';
    case 'en route':
      return 'secondary';
    case 'scheduled':
    case 'awaiting closeout':
      return 'outline';
    case 'cancelled':
    case 'diverted':
      return 'destructive';
    default:
      return 'default';
  }
};

const getBulletinTypeBadgeVariant = (type: BulletinType): "default" | "destructive" | "secondary" => {
  switch (type) {
    case 'Urgent': return 'destructive';
    case 'Important': return 'secondary';
    default: return 'default'; // General
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

// Types for detailed aircraft status (kept for calculation logic)
interface AircraftStatusDetail {
  icon: JSX.Element; // Still useful for internal logic, but might not be directly rendered on dashboard
  label: string; // The detailed label like "Grounded", "OK", "Due Soon"
  colorClass: string; // Color class for detailed view (might map to badge variant)
  reason?: string;
  mostUrgentTaskDescription?: string;
  toGoText?: string;
}

interface DashboardDisplayMaintenanceItem extends FlowMaintenanceTask {
  dueAtDate?: string;
  dueAtHours?: number;
  dueAtCycles?: number;
}

// Simplified status type for dashboard display
interface SimplifiedDashboardStatus {
  label: "Active" | "Maintenance" | "Info";
  variant: "default" | "secondary" | "destructive" | "outline";
  details?: string;
}

const calculateDisplayFieldsForDashboardTask = (task: FlowMaintenanceTask): DashboardDisplayMaintenanceItem => {
  let dueAtDate: string | undefined = undefined;
  let dueAtHours: number | undefined = undefined;
  let dueAtCycles: number | undefined = undefined;
  const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate)) ? parseISO(task.lastCompletedDate) : new Date();
  const actualLastCompletedHours = Number(task.lastCompletedHours || 0);
  const actualLastCompletedCycles = Number(task.lastCompletedCycles || 0);

  if (task.trackType === "Interval") {
    if (task.isDaysDueEnabled && task.daysDueValue && task.daysIntervalType) {
      const intervalValue = Number(task.daysDueValue);
      if (!isNaN(intervalValue) && intervalValue > 0) {
        switch (task.daysIntervalType) {
          case 'days': dueAtDate = format(addDays(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
          case 'months_specific_day': dueAtDate = format(addMonths(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
          case 'months_eom': dueAtDate = format(endOfMonth(addMonths(actualLastCompletedDateObj, intervalValue)), 'yyyy-MM-dd'); break;
          case 'years_specific_day': dueAtDate = format(addYears(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
        }
      }
    }
    if (task.isHoursDueEnabled && typeof task.hoursDue === 'number') { dueAtHours = actualLastCompletedHours + Number(task.hoursDue); }
    if (task.isCyclesDueEnabled && typeof task.cyclesDue === 'number') { dueAtCycles = actualLastCompletedCycles + Number(task.cyclesDue); }
  } else if (task.trackType === "One Time") {
    if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue))) { dueAtDate = task.daysDueValue; }
    if (task.isHoursDueEnabled && typeof task.hoursDue === 'number') dueAtHours = Number(task.hoursDue);
    if (task.isCyclesDueEnabled && typeof task.cyclesDue === 'number') dueAtCycles = Number(task.cyclesDue);
  }
  return { ...task, dueAtDate, dueAtHours, dueAtCycles };
};

const calculateToGoForDashboard = (
  item: Pick<DashboardDisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles' | 'associatedComponent'>,
  componentTimes: AircraftComponentTimes | null,
  defaultComponent: string = "Airframe"
): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate && isValid(parseISO(item.dueAtDate))) {
    const dueDate = parseISO(item.dueAtDate);
    const daysRemaining = differenceInCalendarDays(dueDate, now);
    return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  }
  const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") ? item.associatedComponent.trim() : defaultComponent;
  const timesForComponent = componentTimes ? componentTimes[componentNameToUse] : null;
  const currentRelevantTime = timesForComponent?.time ?? 0;
  const currentRelevantCycles = timesForComponent?.cycles ?? 0;

  if (!timesForComponent && (item.dueAtHours != null || item.dueAtCycles != null)) {
    return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: (item.dueAtHours != null ? 'hrs' : 'cycles'), isOverdue: false };
  }
  if (typeof currentRelevantTime === 'number' && item.dueAtHours != null) {
    const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
    return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (typeof currentRelevantCycles === 'number' && item.dueAtCycles != null) {
    const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
    return { text: `${cyclesRemaining.toLocaleString()} cyc`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  }
  return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
};

const getDetailedAircraftStatus = (
  toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } | undefined,
  hasOpenDiscrepancies: boolean,
  hasDeferredDiscrepancies: boolean,
  task?: DashboardDisplayMaintenanceItem
): AircraftStatusDetail => { // Renamed from getReleaseStatusForDashboard for clarity
  if (hasOpenDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Grounded', reason: '(Open Write-up)' };
  }
  if (hasDeferredDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500 dark:text-orange-400', label: 'Attention', reason: '(Deferred Item)' };
  }
  if (toGo?.text.startsWith('N/A (No time for') || toGo?.text.startsWith('N/A (Comp. data missing')) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
  }
  if (toGo?.isOverdue) {
    let withinGrace = false;
    if (task && toGo) {
      const numericOverdueAmount = Math.abs(toGo.numeric);
      if (toGo.unit === 'days' && typeof task.daysTolerance === 'number' && numericOverdueAmount <= task.daysTolerance) withinGrace = true;
      else if (toGo.unit === 'hrs' && typeof task.hoursTolerance === 'number' && numericOverdueAmount <= task.hoursTolerance) withinGrace = true;
      else if (toGo.unit === 'cycles' && typeof task.cyclesTolerance === 'number' && numericOverdueAmount <= task.cyclesTolerance) withinGrace = true;
    }
    if (withinGrace) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-600 dark:text-yellow-500', label: 'Grace Period', reason: '(Maintenance)' };
    return { icon: <Wrench className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Overdue', reason: '(Maintenance)' };
  }
  if (task && toGo) {
    const daysAlertThreshold = task.alertDaysPrior ?? 30; const hoursAlertThreshold = task.alertHoursPrior ?? 25; const cyclesAlertThreshold = task.alertCyclesPrior ?? 50;
    if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <CalendarClock className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon', reason: '(Maintenance)' };
    if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <CalendarClock className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon', reason: '(Maintenance)' };
    if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <CalendarClock className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon', reason: '(Maintenance)' };
  }
  if (toGo?.text === 'N/A' || toGo?.text === 'Invalid Date') return { icon: <InfoIconLucide className="h-5 w-5" />, colorClass: 'text-gray-400 dark:text-gray-500', label: 'Check Due Info' };
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500 dark:text-green-400', label: 'OK' };
};

const getSimplifiedDashboardStatus = (detailedStatus: AircraftStatusDetail): SimplifiedDashboardStatus => {
    switch (detailedStatus.label) {
        case 'Grounded':
        case 'Overdue':
            return { label: "Maintenance", variant: "destructive", details: detailedStatus.reason || detailedStatus.mostUrgentTaskDescription };
        case 'Attention':
        case 'Due Soon':
        case 'Grace Period':
        case 'Missing Comp. Time':
            return { label: "Maintenance", variant: "secondary", details: detailedStatus.reason || detailedStatus.mostUrgentTaskDescription };
        case 'OK':
            return { label: "Active", variant: "default", details: "All Clear" };
        case 'Not Tracked':
        case 'Data Error':
        case 'Check Due Info':
        default:
            return { label: "Info", variant: "outline", details: detailedStatus.reason || detailedStatus.label };
    }
};


export default function DashboardPage() {
  const [aircraftList, setAircraftList] = useState<FleetAircraft[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [dashboardTrips, setDashboardTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]); 
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true); 
  const { toast } = useToast();

  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);

  const [isBulletinAccordionOpen, setIsBulletinAccordionOpen] = useState(true);
  const [isTripAccordionOpen, setIsTripAccordionOpen] = useState(true);
  
  const [aircraftStatusDetails, setAircraftStatusDetails] = useState<Map<string, AircraftStatusDetail>>(new Map());
  const [isLoadingAircraftStatusDetails, setIsLoadingAircraftStatusDetails] = useState(true);


  useEffect(() => {
    let isMounted = true; 
    const loadInitialDashboardData = async () => {
      setIsLoadingAircraft(true);
      setIsLoadingTrips(true);
      setIsLoadingBulletins(true);
      setIsLoadingAircraftStatusDetails(true);

      try {
        const [fetchedFleet, fetchedTrips, fetchedBulletins] = await Promise.all([
          fetchFleetAircraft(),
          fetchTrips(),
          fetchBulletins(),
        ]);

        if (isMounted) {
          setAircraftList(fetchedFleet);
          const sortedTrips = fetchedTrips.sort((a, b) => {
            const dateA = a.legs?.[0]?.departureDateTime ? parseISO(a.legs[0].departureDateTime).getTime() : 0;
            const dateB = b.legs?.[0]?.departureDateTime ? parseISO(b.legs[0].departureDateTime).getTime() : 0;
            return dateB - dateA; // Most recent first
          });
          setDashboardTrips(sortedTrips.slice(0, 5));

          const activeAndSortedBulletins = fetchedBulletins
            .filter(b => b.isActive)
            .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime())
            .slice(0, 5); 
          setBulletins(activeAndSortedBulletins);

          const statusPromises = fetchedFleet.map(async (ac) => {
            if (!ac.isMaintenanceTracked) {
              return [ac.id, { icon: <InfoIconLucide className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Not Tracked', reason: '(Maintenance Tracking Disabled)' }];
            }
            try {
              const [compTimes, discrepancies, tasks] = await Promise.all([
                fetchComponentTimesForAircraft({ aircraftId: ac.id }),
                fetchAircraftDiscrepancies({ aircraftId: ac.id }),
                fetchMaintenanceTasksForAircraft({ aircraftId: ac.id }),
              ]);
              const hasOpenDisc = discrepancies.some(d => d.status === "Open");
              const hasDeferredDisc = discrepancies.some(d => d.status === "Deferred");
              
              const activeTasks = tasks.filter(t => t.isActive && t.trackType !== "Dont Alert");
              
              let mostUrgentMaintenanceTask: DashboardDisplayMaintenanceItem | undefined;
              let toGoDataForMostUrgent: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } | undefined;

              if (activeTasks.length > 0) {
                const tasksWithDisplayFields = activeTasks.map(task => calculateDisplayFieldsForDashboardTask(task));
                const tasksWithToGo = tasksWithDisplayFields.map(task => ({
                  ...task,
                  toGoData: calculateToGoForDashboard(task, compTimes, ac.trackedComponentNames?.[0] || "Airframe"),
                }));
                tasksWithToGo.sort((a, b) => {
                  if (a.toGoData.isOverdue && !b.toGoData.isOverdue) return -1;
                  if (!a.toGoData.isOverdue && b.toGoData.isOverdue) return 1;
                  return a.toGoData.numeric - b.toGoData.numeric;
                });
                mostUrgentMaintenanceTask = tasksWithToGo[0];
                toGoDataForMostUrgent = mostUrgentMaintenanceTask.toGoData;
              }
              
              const detailedStatus = getDetailedAircraftStatus(toGoDataForMostUrgent, hasOpenDisc, hasDeferredDisc, mostUrgentMaintenanceTask);
              return [ac.id, { ...detailedStatus, mostUrgentTaskDescription: mostUrgentMaintenanceTask?.itemTitle, toGoText: toGoDataForMostUrgent?.text }];

            } catch (detailError) {
              console.error(`Error fetching details for aircraft ${ac.id}:`, detailError);
              return [ac.id, { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Data Error', reason: '(Could not load details)' }];
            }
          });
          
          const resolvedStatuses = await Promise.all(statusPromises);
          const newStatusMap = new Map(resolvedStatuses as [string, AircraftStatusDetail][]);
          if(isMounted) setAircraftStatusDetails(newStatusMap);

        }
      } catch (error) { 
        if (isMounted) {
           console.error("Failed to load dashboard data:", error);
           toast({ title: "Error Loading Dashboard", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
        }
      } 
      finally { 
        if (isMounted) {
          setIsLoadingAircraft(false); 
          setIsLoadingTrips(false);
          setIsLoadingBulletins(false);
          setIsLoadingAircraftStatusDetails(false);
        }
      }
    };

    loadInitialDashboardData(); 
    return () => { isMounted = false; };
  }, [toast]);

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    setIsBulletinModalOpen(true);
  };

  const getRouteDisplay = (legs: Trip['legs']) => { 
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    return `${origin} -> ${destination}`;
  };

  const formatDate = (dateString?: string) => { 
    if (!dateString) return 'N/A';
    try { const date = parseISO(dateString); return isValid(date) ? format(date, 'MM/dd HH:mm zz') : 'Invalid Date'; } 
    catch (e) { return 'Invalid Date Format'; }
  };

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      <Card className="mb-6 shadow-md border-primary/50">
        <Accordion 
          type="single" 
          collapsible 
          value={isBulletinAccordionOpen ? "bulletin-board-item" : ""}
          onValueChange={(value) => setIsBulletinAccordionOpen(value === "bulletin-board-item")}
          className="w-full"
        >
          <AccordionItem value="bulletin-board-item" className="border-b-0">
            <CardHeader className="p-0">
              <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                <div className="text-left flex-grow">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-primary" />
                      <CardTitle>Company Bulletin Board</CardTitle>
                      {!isBulletinAccordionOpen && bulletins.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{bulletins.length}</Badge>
                      )}
                    </div>
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
                        <ListItem
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                          onClick={() => handleBulletinClick(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBulletinClick(item);}}
                        >
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-semibold">{item.title} 
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                - {item.publishedAt && isValid(parseISO(item.publishedAt)) ? format(parseISO(item.publishedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-prose">{item.message}</p>
                          </div>
                          <Badge variant={getBulletinTypeBadgeVariant(item.type)} className="capitalize">{item.type}</Badge>
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

      <Card className="md:col-span-2 lg:col-span-3 mb-6 shadow-md">
        <Accordion 
          type="single" 
          collapsible 
          value={isTripAccordionOpen ? "trip-status-item" : ""}
          onValueChange={(value) => setIsTripAccordionOpen(value === "trip-status-item")}
          className="w-full"
        >
            <AccordionItem value="trip-status-item">
                <CardHeader className="p-0">
                    <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                        <div className="text-left flex-grow">
                            <div className="flex items-center gap-2">
                              <Milestone className="h-5 w-5 text-primary" />
                              <CardTitle>Trip Status</CardTitle>
                              {!isTripAccordionOpen && dashboardTrips.length > 0 && (
                                <Badge variant="secondary" className="ml-2">{dashboardTrips.length}</Badge>
                              )}
                            </div>
                            <CardDescription className="mt-1">Overview of recent and upcoming trips.</CardDescription>
                        </div>
                    </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                    <CardContent className="pt-0 pb-4 px-4">
                        {isLoadingTrips ? (
                        <div className="flex items-center justify-center py-10"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading trip data...</p> </div>
                        ) : dashboardTrips.length === 0 ? ( <p className="text-muted-foreground text-center py-5">No trips to display.</p> ) : (
                        <Table>
                        <TableHeader><TableRow><TableHead>Trip ID</TableHead><TableHead>Route</TableHead><TableHead>Aircraft</TableHead><TableHead>Status</TableHead><TableHead>Departure (First Leg)</TableHead></TableRow></TableHeader>
                        <TableBody>{dashboardTrips.map((trip) => (
                            <TableRow key={trip.id}>
                            <TableCell className="font-medium">
                                <Link href={`/trips/details/${trip.id}`} className="text-primary hover:underline">
                                {trip.tripId || trip.id}
                                </Link>
                            </TableCell>
                            <TableCell>{getRouteDisplay(trip.legs)}</TableCell>
                            <TableCell>{trip.aircraftLabel || trip.aircraftId}</TableCell>
                            <TableCell><Badge variant={getTripStatusBadgeVariant(trip.status)}>{trip.status}</Badge></TableCell>
                            <TableCell>{formatDate(trip.legs?.[0]?.departureDateTime)}</TableCell>
                            </TableRow>
                        ))}</TableBody>
                        </Table>
                        )}
                    </CardContent>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader> <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Aircraft Status</CardTitle> <CardDescription>High-level overview of aircraft operational readiness.</CardDescription> </CardHeader>
          <CardContent>
            {isLoadingAircraft || isLoadingAircraftStatusDetails ? ( <div className="flex items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading aircraft status...</p> </div>
            ) : aircraftList.length === 0 ? ( <p className="text-muted-foreground text-center py-5">No aircraft found in fleet.</p>
            ) : (
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tail Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {aircraftList.map((aircraft) => {
                    const detailedStatusInfo = aircraftStatusDetails.get(aircraft.id) || { icon: <Loader2 className="h-5 w-5 animate-spin" />, label: 'Loading...', colorClass: 'text-muted-foreground', reason: '', mostUrgentTaskDescription: '' };
                    const simplifiedStatus = getSimplifiedDashboardStatus(detailedStatusInfo);
                    return (
                    <TableRow key={aircraft.id}>
                        <TableCell className="font-medium">
                            <Link href={`/aircraft/currency/${encodeURIComponent(aircraft.tailNumber)}`} className="text-primary hover:underline">
                                {aircraft.tailNumber}
                            </Link>
                        </TableCell>
                        <TableCell>{aircraft.model}</TableCell>
                        <TableCell>{aircraft.baseLocation || 'N/A'}</TableCell>
                        <TableCell>
                            <Badge variant={simplifiedStatus.variant} className="capitalize">{simplifiedStatus.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            {simplifiedStatus.details || (detailedStatusInfo.mostUrgentTaskDescription && `${detailedStatusInfo.mostUrgentTaskDescription} (${detailedStatusInfo.toGoText || 'N/A'})`)}
                        </TableCell>
                    </TableRow>
                    );
                })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader> <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Crew Alerts</CardTitle> <CardDescription>Important crew notifications. (Static Data)</CardDescription> </CardHeader>
          <CardContent> <List> {crewAlertData.map((alert, index) => ( <React.Fragment key={alert.id}> <ListItem className="flex items-start gap-3 py-2"> {getAlertIcon(alert)} <div className="flex-1"> <p className="font-medium text-sm">{alert.title}</p> <p className="text-xs text-muted-foreground">{alert.message}</p> </div> <Badge variant={getBulletinTypeBadgeVariant(alert.severity as BulletinType)} className="capitalize text-xs">{alert.severity}</Badge> </ListItem> {index < crewAlertData.length - 1 && <Separator />} </React.Fragment> ))} {crewAlertData.length === 0 && ( <p className="text-sm text-muted-foreground text-center py-4">No crew alerts.</p> )} </List> </CardContent>
        </Card>
        
        <Card>
          <CardHeader> <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Active System Alerts</CardTitle> <CardDescription>Critical system notifications. (Static Data)</CardDescription> </CardHeader>
          <CardContent> <List> <ListItem className="flex justify-between items-center"> <div> <p className="font-medium">N789EF Maintenance Due</p> <p className="text-sm text-muted-foreground">Scheduled A-Check approaching.</p> </div> <Badge variant="destructive">High</Badge> </ListItem> <Separator className="my-2" /> <ListItem className="flex justify-between items-center"> <div> <p className="font-medium">TRP-004 Weather Alert</p> <p className="text-sm text-muted-foreground">Thunderstorms forecasted for KDEN.</p> </div> <Badge variant="outline">Medium</Badge> </ListItem> </List> </CardContent>
        </Card>

        <Link href="/documents" className="block hover:shadow-lg transition-shadow rounded-lg">
          <Card className="h-full hover:border-primary/50"> 
            <CardHeader> <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Document Hub</CardTitle> <CardDescription>Access flight and compliance documents.</CardDescription> </CardHeader> 
            <CardContent> <p className="text-sm text-muted-foreground">Find all company manuals, policies, and regulatory documents here.</p> </CardContent> 
          </Card>
        </Link>
        <Link href="/frat" className="block hover:shadow-lg transition-shadow rounded-lg">
          <Card className="h-full hover:border-primary/50"> 
            <CardHeader> <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />FRAT Integration</CardTitle> <CardDescription>Flight Risk Assessment Tool.</CardDescription> </CardHeader> 
            <CardContent> <p className="text-sm text-muted-foreground">Review and submit FRATs to ensure operational safety.</p> </CardContent> 
          </Card>
        </Link>
      </div>

      {selectedBulletin && (
        <AlertDialog open={isBulletinModalOpen} onOpenChange={setIsBulletinModalOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Badge variant={getBulletinTypeBadgeVariant(selectedBulletin.type)} className="capitalize text-xs mr-2">{selectedBulletin.type}</Badge>
                {selectedBulletin.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Published: {selectedBulletin.publishedAt && isValid(parseISO(selectedBulletin.publishedAt)) ? format(parseISO(selectedBulletin.publishedAt), 'PPP HH:mm') : 'N/A'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] mt-2">
                <div className="whitespace-pre-wrap p-1 text-sm">
                    {selectedBulletin.message}
                </div>
            </ScrollArea>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel onClick={() => setIsBulletinModalOpen(false)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

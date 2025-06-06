
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, CheckCircle2, InfoIcon as InfoIconLucide, Plane, CalendarDays, LayoutDashboard, Users as UsersIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, differenceInCalendarDays, addDays, addMonths, addYears, endOfMonth } from 'date-fns';

import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { fetchMaintenanceTasksForAircraft, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchAircraftDiscrepancies, type AircraftDiscrepancy } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import type { DisplayMaintenanceItem } from '@/app/(app)/aircraft/currency/[tailNumber]/page'; // Assuming this type is correctly defined here

interface SystemAlert {
  id: string;
  type: 'aircraft' | 'bulletin' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link?: string;
  icon?: React.ElementType;
  timestamp?: string;
}

interface AircraftStatusDetail {
  icon: JSX.Element;
  label: string;
  colorClass: string;
  reason?: string;
  mostUrgentTaskDescription?: string;
  toGoText?: string;
}

const calculateDisplayFieldsForDashboardTask = (task: FlowMaintenanceTask): DisplayMaintenanceItem => {
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
  item: Pick<DisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles' | 'associatedComponent'>,
  currentComponentTimes: AircraftComponentTimes | null,
  defaultComponent: string = "Airframe"
): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate && isValid(parseISO(item.dueAtDate))) {
    const dueDate = parseISO(item.dueAtDate);
    const daysRemaining = differenceInCalendarDays(dueDate, now);
    return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  }

  const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") ? item.associatedComponent.trim() : defaultComponent;
  const timesForComponent = currentComponentTimes ? currentComponentTimes[componentNameToUse] : null;

  if (!timesForComponent && (item.dueAtHours != null || item.dueAtCycles != null)) {
    return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: item.dueAtHours != null ? 'hrs' : 'cycles', isOverdue: false };
  }

  const currentRelevantTime = timesForComponent?.time ?? 0;
  const currentRelevantCycles = timesForComponent?.cycles ?? 0;

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

const getReleaseStatusForDashboard = (
  toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } | undefined,
  task: DisplayMaintenanceItem | undefined,
  hasOpenDiscrepancies: boolean,
  hasDeferredDiscrepancies: boolean,
): AircraftStatusDetail => {
  if (hasOpenDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Grounded', colorClass: 'text-red-500 dark:text-red-400', reason: '(Open Write-up)' };
  }
  if (hasDeferredDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Attention', colorClass: 'text-orange-500 dark:text-orange-400', reason: '(Deferred Item)' };
  }
  if (!task || !toGo) {
    return { icon: <CheckCircle2 className="h-5 w-5" />, label: 'OK', colorClass: 'text-green-500 dark:text-green-400', reason: '(No Urgent Maint.)' };
  }
  if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (Comp. data missing')) {
    return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Missing Comp. Time', colorClass: 'text-orange-500' };
  }
  if (toGo.isOverdue) {
    let withinGrace = false;
    const numericOverdueAmount = Math.abs(toGo.numeric);
    if (toGo.unit === 'days' && typeof task.daysTolerance === 'number' && numericOverdueAmount <= task.daysTolerance) { withinGrace = true; }
    else if (toGo.unit === 'hrs' && typeof task.hoursTolerance === 'number' && numericOverdueAmount <= task.hoursTolerance) { withinGrace = true; }
    else if (toGo.unit === 'cycles' && typeof task.cyclesTolerance === 'number' && numericOverdueAmount <= task.cyclesTolerance) { withinGrace = true; }
    if (withinGrace) { return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Grace Period', colorClass: 'text-yellow-600 dark:text-yellow-500', reason: '(Maintenance)' }; }
    return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Overdue', colorClass: 'text-red-500 dark:text-red-400', reason: '(Maintenance)' };
  }
  const daysAlertThreshold = task.alertDaysPrior ?? 30;
  const hoursAlertThreshold = task.alertHoursPrior ?? 25;
  const cyclesAlertThreshold = task.alertCyclesPrior ?? 50;
  if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Due Soon', colorClass: 'text-yellow-500 dark:text-yellow-400', reason: '(Maintenance)' };
  if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Due Soon', colorClass: 'text-yellow-500 dark:text-yellow-400', reason: '(Maintenance)' };
  if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, label: 'Due Soon', colorClass: 'text-yellow-500 dark:text-yellow-400', reason: '(Maintenance)' };
  if (toGo.text === 'N/A' || toGo.text === 'Invalid Date') return { icon: <InfoIconLucide className="h-5 w-5" />, label: 'Check Due Info', colorClass: 'text-gray-400 dark:text-gray-500' };
  return { icon: <CheckCircle2 className="h-5 w-5" />, label: 'OK', colorClass: 'text-green-500 dark:text-green-400' };
};


export default function DashboardPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [isBulletinAccordionOpen, setIsBulletinAccordionOpen] = useState(true);
  
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  
  const [aircraftList, setAircraftList] = useState<FleetAircraft[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  
  const [aircraftStatusDetails, setAircraftStatusDetails] = useState<Map<string, AircraftStatusDetail>>(new Map());
  const [isLoadingAircraftStatusDetails, setIsLoadingAircraftStatusDetails] = useState(true);
  
  const [activeSystemAlerts, setActiveSystemAlerts] = useState<SystemAlert[]>([]);
  
  const { toast } = useToast();

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

  const getSimplifiedDashboardStatus = (detail: AircraftStatusDetail): { label: "Active" | "Maintenance" | "Info"; variant: "default" | "secondary" | "destructive" | "outline"; details?: string } => {
    if (detail.label === "Grounded" || detail.label === "Overdue") {
      return { label: "Maintenance", variant: "destructive", details: `${detail.label} ${detail.reason || ''}`.trim() };
    }
    if (detail.label === "Attention" || detail.label === "Due Soon" || detail.label === "Grace Period" || detail.label === "Missing Comp. Time") {
      return { label: "Maintenance", variant: "secondary", details: `${detail.label} ${detail.reason || ''}`.trim() };
    }
    if (detail.label === "OK") {
      return { label: "Active", variant: "default", details: "All Clear" };
    }
    return { label: "Info", variant: "outline", details: detail.label };
  };

  const loadInitialDashboardData = useCallback(async () => {
    setIsLoadingBulletins(true);
    setIsLoadingTrips(true);
    setIsLoadingAircraft(true);
    setIsLoadingAircraftStatusDetails(true);

    try {
      const [fetchedBulletins, fetchedTrips, fetchedFleet] = await Promise.all([
        fetchBulletins(),
        fetchTrips(),
        fetchFleetAircraft(),
      ]);

      // Process Bulletins
      const activeAndSortedBulletins = fetchedBulletins
        .filter(b => b.isActive)
        .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime())
        .slice(0, 5);
      setBulletins(activeAndSortedBulletins);
      setIsLoadingBulletins(false);

      // Process Trips
      const now = new Date();
      const sortedUpcomingTrips = fetchedTrips
        .filter(trip => trip.legs?.[0]?.departureDateTime && parseISO(trip.legs[0].departureDateTime) >= now)
        .sort((a, b) => parseISO(a.legs![0].departureDateTime!).getTime() - parseISO(b.legs![0].departureDateTime!).getTime())
        .slice(0, 5);
      setUpcomingTrips(sortedUpcomingTrips);
      setIsLoadingTrips(false);

      // Process Aircraft List
      setAircraftList(fetchedFleet.filter(ac => ac.isMaintenanceTracked));
      setIsLoadingAircraft(false);

      // Process Aircraft Status Details & System Alerts
      const tempAircraftStatusDetails = new Map<string, AircraftStatusDetail>();
      const tempSystemAlerts: SystemAlert[] = [];

      for (const aircraft of fetchedFleet.filter(ac => ac.isMaintenanceTracked)) {
        try {
          const [compTimes, discrepancies, tasks] = await Promise.all([
            fetchComponentTimesForAircraft({ aircraftId: aircraft.id }),
            fetchAircraftDiscrepancies({ aircraftId: aircraft.id }),
            fetchMaintenanceTasksForAircraft({ aircraftId: aircraft.id }),
          ]);

          const hasOpenDiscrepancies = discrepancies.some(d => d.status === "Open");
          const hasDeferredDiscrepancies = discrepancies.some(d => d.status === "Deferred" && !hasOpenDiscrepancies);

          let mostUrgentTask: DisplayMaintenanceItem | undefined = undefined;
          let mostUrgentTaskToGo: ReturnType<typeof calculateToGoForDashboard> | undefined = undefined;

          if (tasks && tasks.length > 0) {
            const processedTasks = tasks.map(task => calculateDisplayFieldsForDashboardTask(task));
            const tasksWithToGo = processedTasks.map(task => ({
              ...task,
              toGoData: calculateToGoForDashboard(task, compTimes, aircraft.trackedComponentNames?.[0] || "Airframe")
            })).filter(t => t.isActive && t.toGoData);
            
            tasksWithToGo.sort((a, b) => {
              if (a.toGoData!.isOverdue && !b.toGoData!.isOverdue) return -1;
              if (!a.toGoData!.isOverdue && b.toGoData!.isOverdue) return 1;
              return a.toGoData!.numeric - b.toGoData!.numeric;
            });
            if (tasksWithToGo.length > 0) {
              mostUrgentTask = tasksWithToGo[0];
              mostUrgentTaskToGo = tasksWithToGo[0].toGoData;
            }
          }
          
          const statusDetail = getReleaseStatusForDashboard(mostUrgentTaskToGo, mostUrgentTask, hasOpenDiscrepancies, hasDeferredDiscrepancies);
          tempAircraftStatusDetails.set(aircraft.id, {
            ...statusDetail,
            mostUrgentTaskDescription: mostUrgentTask?.itemTitle,
            toGoText: mostUrgentTaskToGo?.text
          });

          // Generate System Alerts based on status
          if (statusDetail.label === "Grounded" || statusDetail.label === "Overdue") {
            tempSystemAlerts.push({
              id: `ac_alert_crit_${aircraft.id}`, type: 'aircraft', severity: 'critical',
              title: `Aircraft ${statusDetail.label}: ${aircraft.tailNumber}`,
              message: `${statusDetail.reason || ''} ${mostUrgentTask ? `- ${mostUrgentTask.itemTitle} (${mostUrgentTaskToGo?.text})` : ''}`.trim(),
              link: `/aircraft/currency/${aircraft.tailNumber}`, icon: AlertTriangle,
              timestamp: new Date().toISOString()
            });
          } else if (statusDetail.label === "Attention" || statusDetail.label === "Due Soon" || statusDetail.label === "Grace Period" || statusDetail.label === "Missing Comp. Time") {
             tempSystemAlerts.push({
              id: `ac_alert_warn_${aircraft.id}`, type: 'aircraft', severity: 'warning',
              title: `Aircraft Alert: ${aircraft.tailNumber} - ${statusDetail.label}`,
              message: `${statusDetail.reason || ''} ${mostUrgentTask ? `- ${mostUrgentTask.itemTitle} (${mostUrgentTaskToGo?.text})` : ''}`.trim(),
              link: `/aircraft/currency/${aircraft.tailNumber}`, icon: AlertTriangle,
              timestamp: new Date().toISOString()
            });
          }

        } catch (detailError) {
          console.error(`Failed to fetch details for aircraft ${aircraft.tailNumber}:`, detailError);
          tempAircraftStatusDetails.set(aircraft.id, { icon: <AlertTriangle className="h-5 w-5 text-destructive" />, label: 'Data Error', colorClass: 'text-destructive' });
           tempSystemAlerts.push({
              id: `ac_alert_err_${aircraft.id}`, type: 'aircraft', severity: 'warning',
              title: `Data Error: ${aircraft.tailNumber}`,
              message: "Could not load full status details for this aircraft.",
              link: `/aircraft/currency/${aircraft.tailNumber}`, icon: AlertTriangle,
              timestamp: new Date().toISOString()
            });
        }
      }
      setAircraftStatusDetails(tempAircraftStatusDetails);
      // Sort alerts: critical first, then by timestamp (newest first)
      tempSystemAlerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return parseISO(b.timestamp!).getTime() - parseISO(a.timestamp!).getTime();
      });
      setActiveSystemAlerts(tempSystemAlerts.slice(0, 5)); // Limit to top 5

    } catch (error) {
      console.error("Failed to load initial dashboard data:", error);
      toast({ title: "Error Loading Dashboard", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
    } finally {
      setIsLoadingAircraftStatusDetails(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialDashboardData();
  }, [loadInitialDashboardData]);

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Company Bulletin Board Card - Corrected Structure */}
        <Card className="lg:col-span-1 mb-6 shadow-md border-primary/50">
            <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <CardTitle>Company Bulletin Board</CardTitle>
                {bulletins.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{bulletins.length}</Badge>
                )}
                </div>
            </div>
            <CardDescription className="mt-1">Latest news and announcements from Firestore.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
            <Accordion
                type="single"
                collapsible
                defaultValue="bulletin-item" 
                className="w-full"
            >
                <AccordionItem value="bulletin-item" className="border-none">
                <AccordionContent className="pt-2">
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
                </AccordionContent>
                </AccordionItem>
            </Accordion>
            </CardContent>
        </Card>

        {/* Upcoming Trips Card */}
        <Card className="lg:col-span-2 mb-6 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Upcoming Trips</CardTitle>
            </div>
            <CardDescription>Next 5 scheduled trips from Firestore.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTrips ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading upcoming trips...</p>
              </div>
            ) : upcomingTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No upcoming trips scheduled.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Aircraft</TableHead>
                    <TableHead>Departure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell><Link href={`/trips/details/${trip.id}`} className="text-primary hover:underline">{trip.tripId}</Link></TableCell>
                      <TableCell>{trip.clientName}</TableCell>
                      <TableCell>{trip.legs?.[0]?.origin} - {trip.legs?.[trip.legs.length -1]?.destination}</TableCell>
                      <TableCell>{trip.aircraftLabel || trip.aircraftId}</TableCell>
                      <TableCell>{trip.legs?.[0]?.departureDateTime && isValid(parseISO(trip.legs[0].departureDateTime)) ? format(parseISO(trip.legs[0].departureDateTime), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-0">
        {/* Aircraft Status Card */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              <CardTitle>Aircraft Status Overview</CardTitle>
            </div>
            <CardDescription>At-a-glance summary of fleet operational readiness from Firestore.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAircraft || isLoadingAircraftStatusDetails ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading aircraft status...</p>
              </div>
            ) : aircraftList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No aircraft configured for tracking.</p>
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
                  {aircraftList.map(ac => {
                    const statusInfo = aircraftStatusDetails.get(ac.id) || { icon: <InfoIconLucide className="h-5 w-5 text-muted-foreground" />, label: 'Loading...', colorClass: 'text-muted-foreground' };
                    const simplifiedStatus = getSimplifiedDashboardStatus(statusInfo);
                    return (
                      <TableRow key={ac.id}>
                        <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="text-primary hover:underline">{ac.tailNumber}</Link></TableCell>
                        <TableCell>{ac.model}</TableCell>
                        <TableCell>{ac.baseLocation || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={simplifiedStatus.variant} className="capitalize">{simplifiedStatus.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {simplifiedStatus.details || statusInfo.mostUrgentTaskDescription || statusInfo.reason || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Active System Alerts Card */}
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Active System Alerts</CardTitle>
            </div>
            <CardDescription>Critical items needing attention.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAircraftStatusDetails ? (
                <div className="flex items-center justify-center py-5">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading alerts...</p>
                </div>
            ) : activeSystemAlerts.length === 0 ? (
              <div className="text-center py-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No critical system alerts at this time.
              </div>
            ) : (
              <List>
                {activeSystemAlerts.map((alert) => (
                  <ListItem key={alert.id} className="py-2 border-b last:border-b-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {alert.icon ? <alert.icon className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'}`} /> : <InfoIconLucide className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${alert.severity === 'critical' ? 'text-destructive-foreground' : ''}`}>{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                        {alert.link && (
                          <Button variant="link" size="xs" asChild className="p-0 h-auto text-xs mt-0.5">
                            <Link href={alert.link}>View Details</Link>
                          </Button>
                        )}
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs capitalize">{alert.severity}</Badge>
                    </div>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
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

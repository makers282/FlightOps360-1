
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, Plane, CalendarDays, LayoutDashboard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
// The following imports are needed for the detailed status logic if it's re-enabled later,
// but for the immediate reversion, they might not be fully used in the simplified Aircraft Status card.
import { fetchComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { fetchAircraftDiscrepancies, type AircraftDiscrepancy } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import { fetchMaintenanceTasksForAircraft, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import type { DisplayMaintenanceItem } from '@/app/(app)/aircraft/currency/[tailNumber]/page'; // Assuming this type is correctly defined for detailed status

interface SimplifiedAircraftStatus {
  label: "Active" | "Maintenance" | "Info";
  variant: "default" | "secondary" | "destructive" | "outline";
  details?: string;
}

interface AircraftStatusDetail extends SimplifiedAircraftStatus {
    mostUrgentTaskDescription?: string;
    toGoText?: string;
    colorClass?: string; // for text/icon coloring
    icon?: React.ElementType; // for status icon
    reason?: string; // for sub-text under status label
}

// Placeholder SystemAlert type, expand as needed
interface SystemAlert {
  id: string;
  type: 'aircraft' | 'system' | 'maintenance';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link?: string;
  icon?: React.ElementType;
}

export default function DashboardPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [isBulletinAccordionOpen, setIsBulletinAccordionOpen] = useState(true); // Keep it open by default

  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  
  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);

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

  // Simplified status logic from aircraft currency page - adapt as needed for dashboard
  const calculateDisplayFieldsForDashboardTask = (task: FlowMaintenanceTask): DisplayMaintenanceItem => {
      let dueAtDate: string | undefined = undefined;
      let dueAtHours: number | undefined = undefined;
      let dueAtCycles: number | undefined = undefined;
      const { addDays, addMonths, endOfMonth, addYears } = require('date-fns'); // Local import

      const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate))
      ? parseISO(task.lastCompletedDate)
      : new Date(0); // Use a very past date if no valid last completion
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
                  default: dueAtDate = format(addDays(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break; 
                }
              }
          }
          if (task.isHoursDueEnabled && task.hoursDue) {
              dueAtHours = actualLastCompletedHours + Number(task.hoursDue);
          }
          if (task.isCyclesDueEnabled && task.cyclesDue) {
              dueAtCycles = actualLastCompletedCycles + Number(task.cyclesDue);
          }
      } else if (task.trackType === "One Time") {
          if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue))) {
              dueAtDate = task.daysDueValue;
          }
          if (task.isHoursDueEnabled && task.hoursDue) dueAtHours = Number(task.hoursDue);
          if (task.isCyclesDueEnabled && task.cyclesDue) dueAtCycles = Number(task.cyclesDue);
      }
      // This is partial, toGoData would need calculateToGoForDashboard
      return { ...task, dueAtDate, dueAtHours, dueAtCycles, toGoData: { text: 'Calc...', numeric: Infinity, unit: 'N/A', isOverdue: false} };
  };

  const calculateToGoForDashboard = (
    item: Pick<DisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles' | 'associatedComponent'>,
    componentTimes: AircraftComponentTimes | null,
    defaultComponent: string = "Airframe"
  ): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
    const now = new Date();
    const { differenceInCalendarDays } = require('date-fns'); // Local import

    if (item.dueAtDate && isValid(parseISO(item.dueAtDate))) {
      const dueDate = parseISO(item.dueAtDate);
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    }

    const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") 
        ? item.associatedComponent.trim() 
        : defaultComponent;
    
    const currentTimes = componentTimes ? componentTimes[componentNameToUse] : null;

    if (!currentTimes && (item.dueAtHours != null || item.dueAtCycles != null)) {
      const msg = `N/A (No time for ${componentNameToUse})`;
      const unitType = item.dueAtHours != null ? 'hrs' : 'cycles';
      return { text: msg, numeric: Infinity, unit: unitType, isOverdue: false };
    }
    
    const currentRelevantTime = currentTimes?.time ?? 0;
    const currentRelevantCycles = currentTimes?.cycles ?? 0;

    if (item.dueAtHours != null) { 
      const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
      return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
    }
    if (item.dueAtCycles != null) { 
      const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
      return { text: `${cyclesRemaining.toLocaleString()} cycles`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
    }
    return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
  };

  const getReleaseStatusForDashboard = (
    aircraftId: string,
    hasOpenDiscrepancies: boolean,
    hasDeferredDiscrepancies: boolean,
    mostUrgentTask?: DisplayMaintenanceItem,
    componentTimes?: AircraftComponentTimes | null,
    trackedComponentNames?: string[]
  ): AircraftStatusDetail => {
    const defaultComp = trackedComponentNames?.[0] || "Airframe";
    const toGoData = mostUrgentTask ? calculateToGoForDashboard(mostUrgentTask, componentTimes || null, defaultComp) : undefined;

    if (hasOpenDiscrepancies) {
      return { label: "Maintenance", variant: "destructive", details: "Grounded (Open Write-up)", mostUrgentTaskDescription: "Open Discrepancy", toGoText: "Immediate Attention", colorClass: "text-red-500", icon: AlertTriangle, reason: '(Open Write-up)' };
    }
    if (hasDeferredDiscrepancies) {
      return { label: "Maintenance", variant: "secondary", details: "Attention (Deferred Item)", mostUrgentTaskDescription: "Deferred Discrepancy", toGoText: "Requires Tracking", colorClass: "text-orange-500", icon: AlertTriangle, reason: '(Deferred Item)' };
    }
    
    if (!mostUrgentTask || !toGoData) {
        return { label: "Info", variant: "outline", details: "No Maintenance Tracked or Data Error", colorClass: "text-gray-500", icon: Info };
    }
    if (toGoData.text.startsWith('N/A (No time for') || toGoData.text.startsWith('N/A (Comp. data missing')) {
        return { label: "Info", variant: "outline", details: `Missing Time for ${mostUrgentTask.associatedComponent || defaultComp}`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: toGoData.text, colorClass: "text-orange-500", icon: AlertTriangle, reason: '(Missing Comp. Time)' };
    }
    if (toGoData.isOverdue) {
      let withinGrace = false;
      const numericOverdueAmount = Math.abs(toGoData.numeric);
      if (toGoData.unit === 'days' && typeof mostUrgentTask.daysTolerance === 'number' && numericOverdueAmount <= mostUrgentTask.daysTolerance) { withinGrace = true; }
      else if (toGoData.unit === 'hrs' && typeof mostUrgentTask.hoursTolerance === 'number' && numericOverdueAmount <= mostUrgentTask.hoursTolerance) { withinGrace = true; }
      else if (toGoData.unit === 'cycles' && typeof mostUrgentTask.cyclesTolerance === 'number' && numericOverdueAmount <= mostUrgentTask.cyclesTolerance) { withinGrace = true; }
      
      if (withinGrace) {
        return { label: "Maintenance", variant: "secondary", details: `Grace Period (${mostUrgentTask.itemTitle})`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: `${toGoData.text} (Grace)`, colorClass: "text-yellow-600", icon: AlertTriangle, reason: '(Grace Period)' };
      }
      return { label: "Maintenance", variant: "destructive", details: `Overdue (${mostUrgentTask.itemTitle})`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: `${toGoData.text} (Overdue)`, colorClass: "text-red-500", icon: AlertTriangle, reason: '(Maintenance Overdue)' };
    }

    const daysAlertThreshold = mostUrgentTask.alertDaysPrior ?? 30;
    const hoursAlertThreshold = mostUrgentTask.alertHoursPrior ?? 25;
    const cyclesAlertThreshold = mostUrgentTask.alertCyclesPrior ?? 50;
    if (toGoData.unit === 'days' && toGoData.numeric < daysAlertThreshold) return { label: "Maintenance", variant: "secondary", details: `Due Soon (${mostUrgentTask.itemTitle})`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: toGoData.text, colorClass: "text-yellow-500", icon: AlertTriangle, reason: '(Maintenance Due Soon)' };
    if (toGoData.unit === 'hrs' && toGoData.numeric < hoursAlertThreshold) return { label: "Maintenance", variant: "secondary", details: `Due Soon (${mostUrgentTask.itemTitle})`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: toGoData.text, colorClass: "text-yellow-500", icon: AlertTriangle, reason: '(Maintenance Due Soon)' };
    if (toGoData.unit === 'cycles' && toGoData.numeric < cyclesAlertThreshold) return { label: "Maintenance", variant: "secondary", details: `Due Soon (${mostUrgentTask.itemTitle})`, mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: toGoData.text, colorClass: "text-yellow-500", icon: AlertTriangle, reason: '(Maintenance Due Soon)' };

    if (toGoData.text === 'N/A' || toGoData.text === 'Invalid Date') {
       return { label: "Info", variant: "outline", details: "Check Due Info", mostUrgentTaskDescription: mostUrgentTask.itemTitle, toGoText: toGoData.text, colorClass: "text-gray-500", icon: Info, reason: '(Check Due Info)' };
    }
    
    return { label: "Active", variant: "default", details: "All Clear", mostUrgentTaskDescription: "All Systems Go", toGoText: "Current", colorClass: "text-green-500", icon: Plane };
  };

  const getSimplifiedDashboardStatus = (statusDetail: AircraftStatusDetail): SimplifiedAircraftStatus => {
    const { label, variant, details, mostUrgentTaskDescription, toGoText } = statusDetail;
    let simplifiedDetails = details;

    if (label === "Maintenance") {
        if (details?.includes("Grounded")) return { label: "Maintenance", variant: "destructive", details: `Grounded: ${mostUrgentTaskDescription || "Open Write-up"}` };
        if (details?.includes("Overdue")) return { label: "Maintenance", variant: "destructive", details: `Overdue: ${mostUrgentTaskDescription || "Task"} (${toGoText || ''})` };
        if (details?.includes("Attention") || details?.includes("Due Soon") || details?.includes("Grace Period") || details?.includes("Missing Time")) {
            return { label: "Maintenance", variant: "secondary", details: `${mostUrgentTaskDescription || "Item"} (${toGoText || 'Needs Attention'})` };
        }
    }
    if (label === "Active") return { label: "Active", variant: "default", details: "All Clear" };
    return { label: "Info", variant: "outline", details: details || "Status Unknown" };
  };


  const loadInitialDashboardData = useCallback(async () => {
    setIsLoadingBulletins(true);
    setIsLoadingTrips(true);
    setIsLoadingFleet(true);
    setIsLoadingAircraftStatusDetails(true);
    setActiveSystemAlerts([]); 

    try {
      const [fetchedBulletins, fetchedTrips, fetchedFleetList] = await Promise.all([
        fetchBulletins(),
        fetchTrips(),
        fetchFleetAircraft(),
      ]);

      const activeAndSortedBulletins = fetchedBulletins
        .filter(b => b.isActive)
        .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime());
      setBulletins(activeAndSortedBulletins);
      setFleetList(fetchedFleetList);

      const now = new Date();
      const sortedUpcomingTrips = fetchedTrips
        .filter(trip => trip.legs?.[0]?.departureDateTime && parseISO(trip.legs[0].departureDateTime) >= now)
        .map(trip => {
          const aircraftInfo = fetchedFleetList.find(ac => ac.id === trip.aircraftId);
          return {
            ...trip,
            aircraftLabel: aircraftInfo ? `${aircraftInfo.tailNumber} - ${aircraftInfo.model}` : trip.aircraftLabel || trip.aircraftId,
          };
        })
        .sort((a, b) => parseISO(a.legs![0].departureDateTime!).getTime() - parseISO(b.legs![0].departureDateTime!).getTime())
        .slice(0, 5);
      setUpcomingTrips(sortedUpcomingTrips);

      const newStatusDetailsMap = new Map<string, AircraftStatusDetail>();
      const tempSystemAlerts: SystemAlert[] = [];

      for (const ac of fetchedFleetList) {
        if (!ac.id) continue; 
        
        let detailStatus: AircraftStatusDetail = { label: "Info", variant: "outline", details: "Data Loading..." };
        if (ac.isMaintenanceTracked) {
          try {
            const [compTimes, discrepancies, tasks] = await Promise.all([
              fetchComponentTimesForAircraft({ aircraftId: ac.id }),
              fetchAircraftDiscrepancies({ aircraftId: ac.id }),
              fetchMaintenanceTasksForAircraft({ aircraftId: ac.id }),
            ]);

            const hasOpenDisc = discrepancies.some(d => d.status === "Open");
            const hasDeferredDisc = discrepancies.some(d => d.status === "Deferred" && !hasOpenDisc);
            
            let mostUrgentTask: DisplayMaintenanceItem | undefined = undefined;
            if (tasks.length > 0) {
              const processedTasks = tasks
                .filter(t => t.isActive && t.trackType !== "Dont Alert")
                .map(t => {
                    const displayTask = calculateDisplayFieldsForDashboardTask(t);
                    return { ...displayTask, toGoData: calculateToGoForDashboard(displayTask, compTimes, ac.trackedComponentNames?.[0]) };
                });
              
              processedTasks.sort((a, b) => (a.toGoData?.numeric ?? Infinity) - (b.toGoData?.numeric ?? Infinity));
              if (processedTasks.length > 0) mostUrgentTask = processedTasks[0];
            }
            detailStatus = getReleaseStatusForDashboard(ac.id, hasOpenDisc, hasDeferredDisc, mostUrgentTask, compTimes, ac.trackedComponentNames);
          } catch (statusError) {
            console.error(`Error fetching status details for ${ac.tailNumber}:`, statusError);
            detailStatus = { label: "Info", variant: "outline", details: "Error loading status", icon: AlertTriangle, colorClass: "text-orange-500" };
          }
        } else {
          detailStatus = { label: "Info", variant: "outline", details: "Not Tracked", icon: Info, colorClass: "text-gray-500" };
        }
        newStatusDetailsMap.set(ac.id, detailStatus);

        // Populate Active System Alerts
        if (detailStatus.label === "Maintenance" && (detailStatus.variant === "destructive" || detailStatus.details?.toLowerCase().includes("grounded"))) {
            tempSystemAlerts.push({
                id: `ac_alert_crit_${ac.id}`, type: 'aircraft', severity: 'critical',
                title: `Aircraft ${detailStatus.variant === "destructive" ? "Grounded/Overdue" : "Attention"}: ${ac.tailNumber}`,
                message: detailStatus.details || "Requires immediate attention.",
                link: `/aircraft/currency/${ac.tailNumber}`, icon: AlertTriangle,
            });
        } else if (detailStatus.label === "Maintenance" && detailStatus.variant === "secondary") {
            tempSystemAlerts.push({
                id: `ac_alert_warn_${ac.id}`, type: 'aircraft', severity: 'warning',
                title: `Aircraft Warning: ${ac.tailNumber}`,
                message: detailStatus.details || "Requires attention.",
                link: `/aircraft/currency/${ac.tailNumber}`, icon: AlertTriangle,
            });
        }
      }
      setAircraftStatusDetails(newStatusDetailsMap);
      // Sort alerts: critical first, then warning, then by title
      tempSystemAlerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        if (a.severity === 'warning' && b.severity !== 'warning') return -1;
        if (a.severity !== 'warning' && b.severity === 'warning') return 1;
        return a.title.localeCompare(b.title);
      });
      setActiveSystemAlerts(tempSystemAlerts.slice(0, 5));


    } catch (error) {
      console.error("Failed to load initial dashboard data:", error);
      toast({ title: "Error Loading Dashboard Data", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
    } finally {
      setIsLoadingBulletins(false);
      setIsLoadingTrips(false);
      setIsLoadingFleet(false);
      setIsLoadingAircraftStatusDetails(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialDashboardData();
  }, [loadInitialDashboardData]);

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      {/* Row 1: Company Bulletin Board (Full Width) */}
      <Card className="mb-6 shadow-md border-primary/50">
        <Accordion
          type="single"
          collapsible
          value={isBulletinAccordionOpen ? "bulletin-item" : ""}
          onValueChange={(value) => setIsBulletinAccordionOpen(value === "bulletin-item")}
          className="w-full"
        >
          <AccordionItem value="bulletin-item" className="border-b-0">
            <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline [&[data-state=open]>svg]:text-primary">
              <div className="text-left flex-grow">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Company Bulletin Board</CardTitle>
                  {!isBulletinAccordionOpen && bulletins.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{bulletins.length}</Badge>
                  )}
                </div>
                <CardDescription className="mt-1 text-sm">Latest news and announcements from Firestore.</CardDescription>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0 pb-4 px-4">
                {isLoadingBulletins ? (
                  <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading bulletins...</p></div>
                ) : bulletins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No active company bulletins.</p>
                ) : (
                  <List>
                    {bulletins.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                          onClick={() => handleBulletinClick(item)} role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBulletinClick(item);}}
                        >
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-semibold">{item.title}
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                - {item.publishedAt && isValid(parseISO(item.publishedAt)) ? format(parseISO(item.publishedAt), 'MMM d, yy HH:mm') : 'N/A'}
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

      {/* Row 2: Upcoming Trips Card (Full Width) */}
      <Card className="mb-6 shadow-md">
        <CardHeader>
           <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Upcoming Trips</CardTitle>
            </div>
          <CardDescription>Next 5 scheduled trips from Firestore.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrips || isLoadingFleet ? (
            <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading trips...</p></div>
          ) : upcomingTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No upcoming trips.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Trip ID</TableHead><TableHead>Client</TableHead><TableHead>Route</TableHead><TableHead>Aircraft</TableHead><TableHead>Departure</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcomingTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell><Link href={`/trips/details/${trip.id}`} className="text-primary hover:underline">{trip.tripId}</Link></TableCell>
                    <TableCell>{trip.clientName}</TableCell>
                    <TableCell>{trip.legs?.[0]?.origin} - {trip.legs?.[trip.legs.length -1]?.destination}</TableCell>
                    <TableCell>{trip.aircraftLabel}</TableCell> 
                    <TableCell>{trip.legs?.[0]?.departureDateTime && isValid(parseISO(trip.legs[0].departureDateTime)) ? format(parseISO(trip.legs[0].departureDateTime), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                    <TableCell><Badge variant={trip.status === "Scheduled" ? "outline" : "default"}>{trip.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Aircraft Status & System Alerts - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /><CardTitle>Aircraft Status Overview</CardTitle></div>
            <CardDescription>Simplified aircraft operational readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFleet || isLoadingAircraftStatusDetails ? (
                <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading aircraft status...</p></div>
            ) : fleetList.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-3">No aircraft in fleet to display status for.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Tail #</TableHead><TableHead>Model</TableHead><TableHead>Base</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fleetList.filter(ac => aircraftStatusDetails.has(ac.id)).slice(0, 5).map(ac => {
                    const detailedStatus = aircraftStatusDetails.get(ac.id) || { label: "Info", variant: "outline", details: "Status Unavailable" };
                    const simplifiedStatus = getSimplifiedDashboardStatus(detailedStatus);
                    return (
                      <TableRow key={ac.id}>
                        <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="text-primary hover:underline">{ac.tailNumber}</Link></TableCell>
                        <TableCell>{ac.model}</TableCell>
                        <TableCell>{ac.baseLocation || 'N/A'}</TableCell>
                        <TableCell><Badge variant={simplifiedStatus.variant}>{simplifiedStatus.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{simplifiedStatus.details}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {fleetList.filter(ac => aircraftStatusDetails.has(ac.id)).length > 5 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 5 aircraft. More on currency page.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Active System Alerts</CardTitle></div>
            <CardDescription>Important system notifications requiring attention.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingAircraftStatusDetails ? (
                <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading alerts...</p></div>
             ) : activeSystemAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No critical system alerts at this time.</p>
             ) : (
                <List>
                    {activeSystemAlerts.map(alert => (
                        <ListItem key={alert.id} className="py-2 border-b last:border-b-0">
                            <div className="flex items-start gap-2">
                                {alert.icon && <alert.icon className={`h-5 w-5 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'}`} />}
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{alert.title}</p>
                                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                                    {alert.link && <Link href={alert.link} className="text-xs text-primary hover:underline">View Details</Link>}
                                </div>
                                {alert.severity && <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="capitalize text-xs">{alert.severity}</Badge>}
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
            <ScrollArea className="max-h-[60vh] mt-2"><div className="whitespace-pre-wrap p-1 text-sm">{selectedBulletin.message}</div></ScrollArea>
            <AlertDialogFooter className="mt-4"><AlertDialogCancel onClick={() => setIsBulletinModalOpen(false)}>Close</AlertDialogCancel></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

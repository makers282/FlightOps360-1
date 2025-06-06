
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Wrench, CheckCircle2, XCircle as XCircleIcon, AlertTriangle, Eye, Loader2, InfoIcon } from 'lucide-react'; // Added InfoIcon
import { format, differenceInCalendarDays, parse, parseISO, isValid, addDays, addMonths, addYears, endOfMonth } from 'date-fns';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; 
import { fetchMaintenanceTasksForAircraft, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { fetchAircraftDiscrepancies } from '@/ai/flows/manage-aircraft-discrepancies-flow'; // Added
import { useToast } from '@/hooks/use-toast';
import type { DisplayMaintenanceItem } from './[tailNumber]/page';

interface AggregatedMaintenanceDisplayItem {
  fleetAircraftId: string; 
  tailNumber: string;
  aircraftModel: string;
  currentAirframeTime: number; 
  currentAirframeCycles: number; 
  nextDueItemDescription: string;
  dueAtDate?: string; 
  dueAtHours?: number; 
  dueAtCycles?: number; 
  notes?: string;
  rawTask?: DisplayMaintenanceItem; 
  _componentTimesMap?: AircraftComponentTimes | null;
  hasOpenDiscrepancies: boolean;
  hasDeferredDiscrepancies: boolean; // New field
}


export const calculateToGo = (
  item: Pick<DisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles' | 'associatedComponent'>, 
  componentTimes: AircraftComponentTimes | null,
  defaultComponent: string = "Airframe"
): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate) {
    try {
      const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    } catch (e) {
      return { text: 'Invalid Date', numeric: Infinity, unit: 'N/A', isOverdue: true };
    }
  }

  const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") 
      ? item.associatedComponent.trim() 
      : defaultComponent;
  
  const currentTimes = componentTimes ? componentTimes[componentNameToUse] : null;
  const currentRelevantTime = currentTimes?.time ?? 0;
  const currentRelevantCycles = currentTimes?.cycles ?? 0;

  if (!currentTimes && (item.dueAtHours != null || item.dueAtCycles != null)) {
    const msg = `N/A (No time for ${componentNameToUse})`;
    const unitType = item.dueAtHours != null ? 'hrs' : 'cycles';
    return { text: msg, numeric: Infinity, unit: unitType, isOverdue: false };
  }

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

export const getReleaseStatus = (
  toGo: { numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean; text: string } | undefined,
  hasOpenDiscrepancies: boolean,
  hasDeferredDiscrepancies: boolean, // New parameter
  task?: DisplayMaintenanceItem
): { icon: JSX.Element; colorClass: string; label: string } => {
  
  if (hasOpenDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Not Dispatchable (Open Write-up)' };
  }
  if (hasDeferredDiscrepancies) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500 dark:text-orange-400', label: 'Attention (Deferred Item)' };
  }
  
  if (toGo?.text.startsWith('N/A (No time for') || toGo?.text.startsWith('N/A (Comp. data missing')) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
  }

  if (toGo?.isOverdue) {
    if (task) {
      let withinGrace = false;
      const numericOverdueAmount = Math.abs(toGo.numeric);

      if (toGo.unit === 'days' && typeof task.daysTolerance === 'number' && numericOverdueAmount <= task.daysTolerance) {
        withinGrace = true;
      } else if (toGo.unit === 'hrs' && typeof task.hoursTolerance === 'number' && numericOverdueAmount <= task.hoursTolerance) {
        withinGrace = true;
      } else if (toGo.unit === 'cycles' && typeof task.cyclesTolerance === 'number' && numericOverdueAmount <= task.cyclesTolerance) {
        withinGrace = true;
      }

      if (withinGrace) {
        return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-600 dark:text-yellow-500', label: 'Grace Period' };
      }
    }
    return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Overdue' };
  }
  
  if (task && toGo) {
    const daysAlertThreshold = task.alertDaysPrior ?? 30;
    const hoursAlertThreshold = task.alertHoursPrior ?? 25;
    const cyclesAlertThreshold = task.alertCyclesPrior ?? 50;
    if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) {
      return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    }
    if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) {
      return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    }
    if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) { 
      return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    }
  }

  if (toGo?.text === 'N/A' || toGo?.text === 'Invalid Date') {
    return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400 dark:text-gray-500', label: 'Check Due Info' };
  }
  
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500 dark:text-green-400', label: 'OK' };
};

const calculateDisplayFieldsForOverview = (task: FlowMaintenanceTask): DisplayMaintenanceItem => {
    let dueAtDate: string | undefined = undefined;
    let dueAtHours: number | undefined = undefined;
    let dueAtCycles: number | undefined = undefined;

    const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate))
    ? parseISO(task.lastCompletedDate)
    : new Date();
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
    return { ...task, dueAtDate, dueAtHours, dueAtCycles };
};


export default function AircraftCurrencyPage() {
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const { toast } = useToast();
  const [aggregatedData, setAggregatedData] = useState<AggregatedMaintenanceDisplayItem[]>([]);
  const [isLoadingAggregated, setIsLoadingAggregated] = useState(true);

  useEffect(() => {
    const loadFleetAndAggregate = async () => {
      setIsLoadingFleet(true);
      setIsLoadingAggregated(true);
      try {
        const fetchedFleet = await fetchFleetAircraft();
        setFleet(fetchedFleet);

        const trackedFleet = fetchedFleet.filter(ac => ac.isMaintenanceTracked);
        const aggregatedItemsPromises = trackedFleet.map(async (fleetAc) => {
          let componentTimesMap: AircraftComponentTimes | null = null;
          try {
            componentTimesMap = await fetchComponentTimesForAircraft({ aircraftId: fleetAc.id });
          } catch (compTimeError) {
            console.warn(`Failed to fetch component times for ${fleetAc.tailNumber}:`, compTimeError);
          }
          
          const currentAirframeTime = componentTimesMap?.['Airframe']?.time ?? 0;
          const currentAirframeCycles = componentTimesMap?.['Airframe']?.cycles ?? 0;
          
          let itemsForThisAircraft: DisplayMaintenanceItem[] = [];
          try {
            const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId: fleetAc.id });
            itemsForThisAircraft = tasksFromDb.map(task => calculateDisplayFieldsForOverview(task));
          } catch (taskError) {
             console.error(`Failed to fetch tasks for ${fleetAc.tailNumber}:`, taskError);
          }
          
          let discrepanciesForAircraft = [];
          try {
            discrepanciesForAircraft = await fetchAircraftDiscrepancies({ aircraftId: fleetAc.id });
          } catch (discError) {
            console.warn(`Failed to fetch discrepancies for ${fleetAc.tailNumber}:`, discError);
          }
          const hasOpenDisc = discrepanciesForAircraft.some(d => d.status === "Open");
          const hasDeferredDisc = discrepanciesForAircraft.some(d => d.status === "Deferred");

          if (itemsForThisAircraft.length > 0) {
            const sortedItems = [...itemsForThisAircraft].sort((a, b) => {
              const toGoA = calculateToGo(a, componentTimesMap, fleetAc.trackedComponentNames?.[0] || "Airframe");
              const toGoB = calculateToGo(b, componentTimesMap, fleetAc.trackedComponentNames?.[0] || "Airframe");
              if (toGoA.isOverdue && !toGoB.isOverdue) return -1;
              if (!toGoA.isOverdue && toGoB.isOverdue) return 1;
              if (toGoA.isOverdue && toGoB.isOverdue) return toGoA.numeric - toGoB.numeric; 
              return toGoA.numeric - toGoB.numeric;
            });
            const mostUrgentItem = sortedItems[0];
            return {
              fleetAircraftId: fleetAc.id,
              tailNumber: fleetAc.tailNumber,
              aircraftModel: fleetAc.model,
              currentAirframeTime,
              currentAirframeCycles,
              nextDueItemDescription: mostUrgentItem.itemTitle,
              dueAtDate: mostUrgentItem.dueAtDate,
              dueAtHours: mostUrgentItem.dueAtHours,
              dueAtCycles: mostUrgentItem.dueAtCycles,
              notes: mostUrgentItem.details,
              rawTask: mostUrgentItem,
              _componentTimesMap: componentTimesMap,
              hasOpenDiscrepancies: hasOpenDisc,
              hasDeferredDiscrepancies: hasDeferredDisc,
            };
          } else {
            return {
              fleetAircraftId: fleetAc.id,
              tailNumber: fleetAc.tailNumber,
              aircraftModel: fleetAc.model,
              currentAirframeTime,
              currentAirframeCycles,
              nextDueItemDescription: 'No items tracked',
              _componentTimesMap: componentTimesMap,
              hasOpenDiscrepancies: hasOpenDisc,
              hasDeferredDiscrepancies: hasDeferredDisc,
            };
          }
        });

        const resolvedAggregatedItems = await Promise.all(aggregatedItemsPromises);
        setAggregatedData(resolvedAggregatedItems.filter(item => item !== null) as AggregatedMaintenanceDisplayItem[]);

      } catch (error) {
        console.error("Failed to fetch fleet or aggregate maintenance data:", error);
        toast({ title: "Error", description: "Could not load aircraft fleet for currency page.", variant: "destructive" });
      } finally {
        setIsLoadingFleet(false);
        setIsLoadingAggregated(false);
      }
    };
    loadFleetAndAggregate();
  }, [toast]);


  return (
    <>
      <PageHeader
        title="Aircraft Maintenance Currency"
        description="Track and manage aircraft maintenance status and upcoming items. Overview shows most urgent item per tracked aircraft."
        icon={Wrench}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Maintenance Overview</CardTitle>
          <CardDescription>Most urgent maintenance item per tracked aircraft. Click tail number for complete details.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFleet || isLoadingAggregated ? (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading aircraft maintenance overview...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tail Number</TableHead>
                  <TableHead className="text-right">Airframe Time</TableHead>
                  <TableHead className="text-right">Airframe Cycles</TableHead>
                  <TableHead>Next Due Item</TableHead>
                  <TableHead className="text-center">Due At</TableHead>
                  <TableHead className="text-center">To Go</TableHead>
                  <TableHead className="text-center">Release Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedData.length === 0 && !isLoadingAggregated ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No aircraft being tracked for maintenance or no maintenance items found. Check Company Settings.
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregatedData.map((item) => {
                    const toGoData = item.nextDueItemDescription === 'No items tracked' || !item.rawTask
                      ? undefined
                      : calculateToGo(item.rawTask, item._componentTimesMap, item.rawTask.associatedComponent || "Airframe");
                    
                    const status = getReleaseStatus(toGoData, item.hasOpenDiscrepancies, item.hasDeferredDiscrepancies, item.rawTask);
                    
                    let dueAtDisplay = 'N/A';
                    if (item.nextDueItemDescription === 'No items tracked') {
                        dueAtDisplay = 'N/A';
                    } else if (item.dueAtDate) {
                        try { dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy'); } 
                        catch { dueAtDisplay = "Invalid Date"; }
                    } else if (item.dueAtHours != null) {
                        dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
                    } else if (item.dueAtCycles != null) {
                        dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cycles`;
                    }

                    return (
                      <TableRow key={item.fleetAircraftId} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link href={`/aircraft/currency/${encodeURIComponent(item.tailNumber)}`} className="hover:underline text-primary">
                            {item.tailNumber}
                          </Link>
                          <span className="block text-xs text-muted-foreground">({item.aircraftModel})</span>
                        </TableCell>
                        <TableCell className="text-right">{item.currentAirframeTime.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1})}</TableCell>
                        <TableCell className="text-right">{item.currentAirframeCycles.toLocaleString()}</TableCell>
                        <TableCell>{item.nextDueItemDescription}</TableCell>
                        <TableCell className="text-center">{dueAtDisplay}</TableCell>
                        <TableCell className={`text-center font-medium ${status.colorClass}`}>{toGoData?.text || 'N/A'}</TableCell>
                        <TableCell className={`text-center ${status.colorClass}`}><div className="flex flex-col items-center">{status.icon}<span className="text-xs mt-1">{status.label}</span></div></TableCell>
                         <TableCell className="text-center">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/aircraft/currency/${encodeURIComponent(item.tailNumber)}`}><Eye className="mr-1 h-4 w-4" /> View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}


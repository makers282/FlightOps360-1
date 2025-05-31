
"use client"; 

import React, { useState, useEffect } from 'react';
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
import { Wrench, CheckCircle2, XCircle as XCircleIcon, AlertTriangle, Eye, Loader2 } from 'lucide-react'; // Renamed XCircle to XCircleIcon
import { format, differenceInCalendarDays, parse, parseISO, isValid } from 'date-fns';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; 
import { fetchMaintenanceTasksForAircraft, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow'; // Import new flow
import { useToast } from '@/hooks/use-toast';
import type { DisplayMaintenanceItem } from './[tailNumber]/page'; // Import type from detail page

// Remove sampleMaintenanceData as it's now fetched from Firestore
// export const sampleMaintenanceData: MaintenanceItem[] = [ ... ];

// This type is now for the data structure after aggregation for the overview page
interface AggregatedMaintenanceDisplayItem {
  fleetAircraftId: string; 
  tailNumber: string;
  aircraftModel: string;
  currentAirframeTime: number; // Still from mock for now
  currentAirframeCycles: number; // Still from mock for now
  nextDueItemDescription: string;
  dueAtDate?: string; 
  dueAtHours?: number; 
  dueAtCycles?: number; 
  notes?: string;
  // Raw task fields if needed for deeper calculation, but generally covered by DisplayMaintenanceItem
  rawTask?: DisplayMaintenanceItem; 
}

// MOCK_COMPONENT_VALUES_DATA remains client-side for now for airframe times
const MOCK_COMPONENT_VALUES_DATA: Record<string, Record<string, { time?: number; cycles?: number }>> = {
  'N123AB': { 'Airframe': { time: 1200.5, cycles: 850 } },
  'N456CD': { 'Airframe': { time: 2500.0, cycles: 1200 } },
  'N630MW': { 'Airframe': { time: 12540.0, cycles: 8978 } },
  'N789EF': { 'Airframe': { time: 350.0, cycles: 120 } },
};


export const calculateToGo = (
  item: Pick<DisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles'>, 
  currentAirframeTime: number, 
  currentAirframeCycles: number
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
  if (item.dueAtHours != null) { 
    const hoursRemaining = parseFloat((item.dueAtHours - currentAirframeTime).toFixed(1));
    return { text: `${hoursRemaining} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (item.dueAtCycles != null) { 
    const cyclesRemaining = item.dueAtCycles - currentAirframeCycles;
    return { text: `${cyclesRemaining} cycles`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  }
  return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
};

export const getReleaseStatus = (toGo: { numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
  if (toGo.isOverdue) {
    return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
  }
  if (toGo.unit === 'days' && toGo.numeric < 30) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  }
   if (toGo.unit === 'hrs' && toGo.numeric < 25) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  }
  if (toGo.unit === 'cycles' && toGo.numeric < 50) { 
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  }
  if (toGo.text === 'N/A') {
    return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'N/A' };
  }
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
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
        const aggregatedItems: AggregatedMaintenanceDisplayItem[] = [];

        for (const fleetAc of trackedFleet) {
          const currentAirframeTime = MOCK_COMPONENT_VALUES_DATA[fleetAc.id]?.Airframe?.time ?? 0;
          const currentAirframeCycles = MOCK_COMPONENT_VALUES_DATA[fleetAc.id]?.Airframe?.cycles ?? 0;
          
          let itemsForThisAircraft: DisplayMaintenanceItem[] = [];
          try {
            const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId: fleetAc.id });
            // This is the function from the detail page, we need to define it here or import it if moved to a util
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
                            // ... other cases from detail page
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
            itemsForThisAircraft = tasksFromDb.map(calculateDisplayFieldsForOverview);
          } catch (taskError) {
             console.error(`Failed to fetch tasks for ${fleetAc.tailNumber}:`, taskError);
             // Continue, this aircraft will show "No items tracked" or an error indicator
          }
          
          if (itemsForThisAircraft.length > 0) {
            const sortedItems = [...itemsForThisAircraft].sort((a, b) => {
              const toGoA = calculateToGo(a, currentAirframeTime, currentAirframeCycles);
              const toGoB = calculateToGo(b, currentAirframeTime, currentAirframeCycles);
              if (toGoA.isOverdue && !toGoB.isOverdue) return -1;
              if (!toGoA.isOverdue && toGoB.isOverdue) return 1;
              if (toGoA.isOverdue && toGoB.isOverdue) return toGoA.numeric - toGoB.numeric;
              return toGoA.numeric - toGoB.numeric;
            });
            const mostUrgentItem = sortedItems[0];
            aggregatedItems.push({
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
            });
          } else {
            aggregatedItems.push({
              fleetAircraftId: fleetAc.id,
              tailNumber: fleetAc.tailNumber,
              aircraftModel: fleetAc.model,
              currentAirframeTime,
              currentAirframeCycles,
              nextDueItemDescription: 'No items tracked',
            });
          }
        }
        setAggregatedData(aggregatedItems);

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
                    const toGoData = calculateToGo(item, item.currentAirframeTime, item.currentAirframeCycles);
                    const status = getReleaseStatus(toGoData);
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
                        <TableCell className={`text-center font-medium ${status.colorClass}`}>{toGoData.text}</TableCell>
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

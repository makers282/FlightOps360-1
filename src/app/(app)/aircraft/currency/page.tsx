
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
import { Wrench, CheckCircle2, XCircle, AlertTriangle, Eye, Loader2 } from 'lucide-react';
import { format, differenceInCalendarDays, parse, addDays, addHours as addDateHours, addMonths, addYears } from 'date-fns';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; 
import { useToast } from '@/hooks/use-toast';


export interface MaintenanceItem {
  id: string;
  tailNumber: string; 
  aircraftModel: string; 
  currentAirframeTime: number;
  currentAirframeCycles: number;
  nextDueItemDescription: string;
  dueAtDate?: string; // yyyy-MM-dd
  dueAtHours?: number; 
  dueAtCycles?: number; 
  notes?: string;
}

// This sample data represents the actual maintenance log entries.
export const sampleMaintenanceData: MaintenanceItem[] = [
  { id: 'MX001', tailNumber: 'N123AB', aircraftModel: 'Cessna Citation CJ3', currentAirframeTime: 1200.5, currentAirframeCycles: 850, nextDueItemDescription: 'Phase A Inspection', dueAtDate: '2024-09-15', notes: 'Scheduled with Cessna Service.' },
  { id: 'MX010', tailNumber: 'N123AB', aircraftModel: 'Cessna Citation CJ3', currentAirframeTime: 1200.5, currentAirframeCycles: 850, nextDueItemDescription: 'Engine #1 Hot Section', dueAtHours: 1500 },
  
  { id: 'MX002', tailNumber: 'N456CD', aircraftModel: 'Bombardier Global 6000', currentAirframeTime: 2500.0, currentAirframeCycles: 1200, nextDueItemDescription: "Annual Inspection", dueAtDate: '2025-02-28' },
  { id: 'MX011', tailNumber: 'N456CD', aircraftModel: 'Bombardier Global 6000', currentAirframeTime: 2500.0, currentAirframeCycles: 1200, nextDueItemDescription: 'Landing Gear Overhaul', dueAtCycles: 2000, notes: 'Check torque links.' },

  { id: 'MX003', tailNumber: 'N630MW', aircraftModel: 'Pilatus PC-12 NG', currentAirframeTime: 12540.0, currentAirframeCycles: 8978, nextDueItemDescription: '50 Hour Inspection', dueAtHours: 12590.0 }, 
  { id: 'MX006', tailNumber: 'N789EF', aircraftModel: 'Gulfstream G650ER', currentAirframeTime: 350.0, currentAirframeCycles: 120, nextDueItemDescription: '12 Month Check', dueAtDate: '2025-01-31' },
  { id: 'MX007', tailNumber: 'N789EF', aircraftModel: 'Gulfstream G650ER', currentAirframeTime: 350.0, currentAirframeCycles: 120, nextDueItemDescription: 'Engine Oil Change', dueAtHours: 450 },
];

interface AggregatedMaintenanceDisplayItem extends MaintenanceItem {
  fleetAircraftId: string; 
}

const getAggregatedMaintenanceData = (
  allFleetAircraft: FleetAircraft[], 
  allMaintenanceItems: MaintenanceItem[]
): AggregatedMaintenanceDisplayItem[] => {
  const trackedFleet = allFleetAircraft.filter(ac => ac.isMaintenanceTracked);
  const aggregated: AggregatedMaintenanceDisplayItem[] = [];

  trackedFleet.forEach(fleetAc => {
    const itemsForThisAircraft = allMaintenanceItems.filter(item => item.tailNumber === fleetAc.tailNumber);

    if (itemsForThisAircraft.length > 0) {
      const sortedItems = itemsForThisAircraft.sort((a, b) => {
        const toGoA = calculateToGo(a);
        const toGoB = calculateToGo(b);
        if (toGoA.isOverdue && !toGoB.isOverdue) return -1;
        if (!toGoA.isOverdue && toGoB.isOverdue) return 1;
        if (toGoA.isOverdue && toGoB.isOverdue) return toGoA.numeric - toGoB.numeric; 
        return toGoA.numeric - toGoB.numeric; 
      });
      
      const mostUrgentItem = sortedItems[0];
      aggregated.push({
        ...mostUrgentItem,
        aircraftModel: fleetAc.model, 
        fleetAircraftId: fleetAc.id,
      });
    } else {
      aggregated.push({
        id: `NO_MX_${fleetAc.id}`,
        tailNumber: fleetAc.tailNumber,
        aircraftModel: fleetAc.model,
        currentAirframeTime: 0, 
        currentAirframeCycles: 0, 
        nextDueItemDescription: 'No items tracked',
        fleetAircraftId: fleetAc.id,
      });
    }
  });
  return aggregated;
};


export const calculateToGo = (item: MaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate) {
    try {
      const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    } catch (e) {
      console.error("Error parsing dueAtDate:", item.dueAtDate, e);
      return { text: 'Invalid Date', numeric: Infinity, unit: 'N/A', isOverdue: true };
    }
  }
  // Ensure currentAirframeTime and currentAirframeCycles are numbers
  const currentHours = typeof item.currentAirframeTime === 'number' ? item.currentAirframeTime : 0;
  const currentCycles = typeof item.currentAirframeCycles === 'number' ? item.currentAirframeCycles : 0;

  if (item.dueAtHours != null && typeof item.dueAtHours === 'number') { 
    const hoursRemaining = parseFloat((item.dueAtHours - currentHours).toFixed(1));
    return { text: `${hoursRemaining} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (item.dueAtCycles != null && typeof item.dueAtCycles === 'number') { 
    const cyclesRemaining = item.dueAtCycles - currentCycles;
    return { text: `${cyclesRemaining} cycles`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  }
  return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
};

export const getReleaseStatus = (toGo: { numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
  if (toGo.isOverdue) {
    return { icon: <XCircle className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
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

  useEffect(() => {
    const loadFleetAndAggregate = async () => {
      setIsLoadingFleet(true);
      try {
        const fetchedFleet = await fetchFleetAircraft();
        setFleet(fetchedFleet);
        // Pass a copy of sampleMaintenanceData to avoid direct modification if getAggregatedMaintenanceData sorts it
        const newAggregatedData = getAggregatedMaintenanceData(fetchedFleet, [...sampleMaintenanceData]);
        setAggregatedData(newAggregatedData);
      } catch (error) {
        console.error("Failed to fetch fleet aircraft:", error);
        toast({ title: "Error", description: "Could not load aircraft fleet for currency page.", variant: "destructive" });
      } finally {
        setIsLoadingFleet(false);
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
          {isLoadingFleet ? (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading aircraft fleet...</p>
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
                {aggregatedData.length === 0 && !isLoadingFleet ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No aircraft being tracked for maintenance or no maintenance items found. Check Company Settings.
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregatedData.map((item) => {
                    const toGoData = calculateToGo(item);
                    const status = getReleaseStatus(toGoData);
                    let dueAtDisplay = 'N/A';
                    
                    if (item.nextDueItemDescription === 'No items tracked') {
                        dueAtDisplay = 'N/A';
                    } else if (item.dueAtDate) {
                        try {
                            dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy');
                        } catch {
                            dueAtDisplay = "Invalid Date";
                        }
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
                        <TableCell className="text-right">{item.currentAirframeTime.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.currentAirframeCycles.toLocaleString()}</TableCell>
                        <TableCell>{item.nextDueItemDescription}</TableCell>
                        <TableCell className="text-center">{dueAtDisplay}</TableCell>
                        <TableCell className={`text-center font-medium ${status.colorClass}`}>
                          {toGoData.text}
                        </TableCell>
                        <TableCell className={`text-center ${status.colorClass}`}>
                          <div className="flex flex-col items-center">
                             {status.icon}
                             <span className="text-xs mt-1">{status.label}</span>
                          </div>
                        </TableCell>
                         <TableCell className="text-center">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/aircraft/currency/${encodeURIComponent(item.tailNumber)}`}>
                              <Eye className="mr-1 h-4 w-4" /> View
                            </Link>
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

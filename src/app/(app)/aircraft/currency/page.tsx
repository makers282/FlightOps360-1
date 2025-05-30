
"use client"; 

import React from 'react';
import Link from 'next/link'; // Added Link
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
import { Wrench, PlusCircle, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';

export interface MaintenanceItem { // Exported for use in detail page
  id: string;
  tailNumber: string;
  aircraftModel: string;
  currentAirframeTime: number;
  currentAirframeCycles: number;
  nextDueItemDescription: string;
  dueAtDate?: string; 
  dueAtHours?: number; 
  dueAtCycles?: number; 
  notes?: string;
}

// Updated sample data for more illustrative detail pages
export const sampleMaintenanceData: MaintenanceItem[] = [
  { id: 'MX001', tailNumber: 'N121RB', aircraftModel: 'Cirrus SR-22', currentAirframeTime: 330.3, currentAirframeCycles: 200, nextDueItemDescription: 'IFR Pitot Static System', dueAtDate: '2023-07-31', notes: 'Performed by ACME Avionics.' },
  { id: 'MX008', tailNumber: 'N121RB', aircraftModel: 'Cirrus SR-22', currentAirframeTime: 330.3, currentAirframeCycles: 200, nextDueItemDescription: 'Annual Inspection', dueAtDate: '2024-12-15', notes: 'Scheduled with Cirrus Service Center.' },
  { id: 'MX009', tailNumber: 'N121RB', aircraftModel: 'Cirrus SR-22', currentAirframeTime: 330.3, currentAirframeCycles: 200, nextDueItemDescription: 'Oil Change', dueAtHours: 350 },
  
  { id: 'MX002', tailNumber: 'N1327J', aircraftModel: 'Cessna Citation CJ', currentAirframeTime: 7050.0, currentAirframeCycles: 6049, nextDueItemDescription: "AIR DUCT O'HEAT light", dueAtHours: 7060 },
  { id: 'MX010', tailNumber: 'N1327J', aircraftModel: 'Cessna Citation CJ', currentAirframeTime: 7050.0, currentAirframeCycles: 6049, nextDueItemDescription: 'Phase 1 Inspection', dueAtCycles: 6100, notes: 'Check landing gear torque.' },

  { id: 'MX003', tailNumber: 'N630MW', aircraftModel: 'Piper Cheyenne PA-31T2', currentAirframeTime: 12540.0, currentAirframeCycles: 8978, nextDueItemDescription: '50 Hour Inspection', dueAtHours: 12550.3 },
  { id: 'MX004', tailNumber: 'N89TB', aircraftModel: 'LearJet 35A', currentAirframeTime: 16728.2, currentAirframeCycles: 11695, nextDueItemDescription: 'Fuel leak address', dueAtDate: '2024-07-15' },
  { id: 'MX005', tailNumber: 'N907DK', aircraftModel: 'Cessna Citation CJ', currentAirframeTime: 5361.4, currentAirframeCycles: 5476, nextDueItemDescription: 'Inspection Document 36', dueAtDate: '2025-07-14' },
  { id: 'MX006', tailNumber: 'N456CD', aircraftModel: 'Bombardier Global 6000', currentAirframeTime: 1200.5, currentAirframeCycles: 850, nextDueItemDescription: 'Annual Inspection', dueAtDate: '2025-01-31' },
  { id: 'MX007', tailNumber: 'N789EF', aircraftModel: 'Gulfstream G650ER', currentAirframeTime: 350.0, currentAirframeCycles: 120, nextDueItemDescription: 'Engine Oil Change', dueAtHours: 400 },
];

// Aggregate data for the main overview table (shows only the most pressing item per aircraft)
const getAggregatedMaintenanceData = (data: MaintenanceItem[]): MaintenanceItem[] => {
  const aircraftMap = new Map<string, MaintenanceItem[]>();
  data.forEach(item => {
    if (!aircraftMap.has(item.tailNumber)) {
      aircraftMap.set(item.tailNumber, []);
    }
    aircraftMap.get(item.tailNumber)!.push(item);
  });

  const aggregated: MaintenanceItem[] = [];
  aircraftMap.forEach((items, tailNumber) => {
    // Sort items by urgency (overdue first, then by smallest 'to go' value)
    const sortedItems = items.sort((a, b) => {
      const toGoA = calculateToGo(a);
      const toGoB = calculateToGo(b);
      if (toGoA.isOverdue && !toGoB.isOverdue) return -1;
      if (!toGoA.isOverdue && toGoB.isOverdue) return 1;
      if (toGoA.isOverdue && toGoB.isOverdue) return toGoA.numeric - toGoB.numeric; // Both overdue, sort by how much
      return toGoA.numeric - toGoB.numeric; // Neither overdue, sort by smallest remaining
    });
    if (sortedItems.length > 0) {
      aggregated.push(sortedItems[0]); // Push the most urgent item
    }
  });
  return aggregated;
};


export const calculateToGo = (item: MaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate) {
    const dueDate = new Date(item.dueAtDate);
    const daysRemaining = differenceInCalendarDays(dueDate, now);
    return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  }
  if (item.dueAtHours != null) { // Check for null or undefined
    const hoursRemaining = parseFloat((item.dueAtHours - item.currentAirframeTime).toFixed(1));
    return { text: `${hoursRemaining} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (item.dueAtCycles != null) { // Check for null or undefined
    const cyclesRemaining = item.dueAtCycles - item.currentAirframeCycles;
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
  if (toGo.unit === 'cycles' && toGo.numeric < 50) { // Example threshold for cycles
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  }
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
};

export default function AircraftCurrencyPage() {
  const aggregatedData = getAggregatedMaintenanceData(sampleMaintenanceData);

  return (
    <>
      <PageHeader
        title="Aircraft Maintenance Currency"
        description="Track and manage aircraft maintenance status and upcoming items."
        icon={Wrench}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Maintenance Overview</CardTitle>
          <CardDescription>Most urgent maintenance item per aircraft. Click tail number for complete details.</CardDescription>
        </CardHeader>
        <CardContent>
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
              {aggregatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No aircraft maintenance data available. Add tracked items to begin.
                  </TableCell>
                </TableRow>
              ) : (
                aggregatedData.map((item) => {
                  const toGoData = calculateToGo(item);
                  const status = getReleaseStatus(toGoData);
                  let dueAtDisplay = 'N/A';
                  if (item.dueAtDate) dueAtDisplay = format(new Date(item.dueAtDate), 'MM/dd/yyyy');
                  else if (item.dueAtHours != null) dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
                  else if (item.dueAtCycles != null) dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cycles`;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
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
        </CardContent>
      </Card>
    </>
  );
}

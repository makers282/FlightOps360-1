
"use client"; // For date calculations and potential client-side interactions

import React from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Plane, PlusCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInCalendarDays } from 'date-fns';

interface MaintenanceItem {
  id: string;
  tailNumber: string;
  aircraftModel: string;
  currentAirframeTime: number;
  currentAirframeCycles: number;
  nextDueItemDescription: string;
  dueAtDate?: string; // YYYY-MM-DD for date-based items
  dueAtHours?: number; // For hour-based items
  dueAtCycles?: number; // For cycle-based items
}

const sampleMaintenanceData: MaintenanceItem[] = [
  { id: 'MX001', tailNumber: 'N121RB', aircraftModel: 'Cirrus SR-22', currentAirframeTime: 330.3, currentAirframeCycles: 0, nextDueItemDescription: 'IFR Pitot Static System', dueAtDate: '2023-07-31' },
  { id: 'MX002', tailNumber: 'N1327J', aircraftModel: 'Cessna Citation CJ', currentAirframeTime: 7050.0, currentAirframeCycles: 6049, nextDueItemDescription: "AIR DUCT O'HEAT light illuminated and Air con inspection", dueAtHours: 7060 }, // Example: due in 10 hours
  { id: 'MX003', tailNumber: 'N630MW', aircraftModel: 'Piper Cheyenne PA-31T2', currentAirframeTime: 12540.0, currentAirframeCycles: 8978, nextDueItemDescription: '50 Hour Inspection', dueAtHours: 12550.3 },
  { id: 'MX004', tailNumber: 'N89TB', aircraftModel: 'LearJet 35A', currentAirframeTime: 16728.2, currentAirframeCycles: 11695, nextDueItemDescription: 'Aircraft has multiple fuel leaks that need to be addressed', dueAtDate: '2024-07-15' }, // Example: due very soon
  { id: 'MX005', tailNumber: 'N907DK', aircraftModel: 'Cessna Citation CJ', currentAirframeTime: 5361.4, currentAirframeCycles: 5476, nextDueItemDescription: 'Inspection Document 36', dueAtDate: '2025-07-14' },
  { id: 'MX006', tailNumber: 'N456CD', aircraftModel: 'Bombardier Global 6000', currentAirframeTime: 1200.5, currentAirframeCycles: 850, nextDueItemDescription: 'Annual Inspection', dueAtDate: '2025-01-31' },
  { id: 'MX007', tailNumber: 'N789EF', aircraftModel: 'Gulfstream G650ER', currentAirframeTime: 350.0, currentAirframeCycles: 120, nextDueItemDescription: 'Engine Oil Change', dueAtHours: 400 },
];

const calculateToGo = (item: MaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate) {
    const dueDate = new Date(item.dueAtDate);
    const daysRemaining = differenceInCalendarDays(dueDate, now);
    return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  }
  if (item.dueAtHours) {
    const hoursRemaining = parseFloat((item.dueAtHours - item.currentAirframeTime).toFixed(1));
    return { text: `${hoursRemaining} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (item.dueAtCycles) {
    const cyclesRemaining = item.dueAtCycles - item.currentAirframeCycles;
    return { text: `${cyclesRemaining} cycles`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  }
  return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
};

const getReleaseStatus = (toGo: { numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string } => {
  if (toGo.isOverdue) {
    return { icon: <XCircle className="h-5 w-5" />, colorClass: 'text-red-500' };
  }
  if (toGo.unit === 'days' && toGo.numeric < 30) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500' };
  }
   if (toGo.unit === 'hrs' && toGo.numeric < 25) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500' };
  }
  if (toGo.unit === 'cycles' && toGo.numeric < 50) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500' };
  }
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500' };
};

export default function AircraftCurrencyPage() {
  return (
    <>
      <PageHeader
        title="Aircraft Maintenance Currency"
        description="Track and manage aircraft maintenance status and upcoming items."
        icon={Wrench}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Tracked Item
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Maintenance Overview</CardTitle>
          <CardDescription>Click on an aircraft below for complete currency details.</CardDescription>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleMaintenanceData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No aircraft maintenance data available. Add tracked items to begin.
                  </TableCell>
                </TableRow>
              ) : (
                sampleMaintenanceData.map((item) => {
                  const toGoData = calculateToGo(item);
                  const status = getReleaseStatus(toGoData);
                  let dueAtDisplay = 'N/A';
                  if (item.dueAtDate) dueAtDisplay = format(new Date(item.dueAtDate), 'MM/dd/yyyy');
                  else if (item.dueAtHours) dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
                  else if (item.dueAtCycles) dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cycles`;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {item.tailNumber}
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
                        {status.icon}
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

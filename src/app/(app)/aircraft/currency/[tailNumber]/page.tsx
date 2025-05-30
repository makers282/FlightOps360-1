
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
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
import { Wrench, PlusCircle, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, PlaneIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { sampleMaintenanceData, calculateToGo, getReleaseStatus, type MaintenanceItem } from '../page';

interface AircraftComponentTime {
  componentName: string;
  currentTime: number;
  currentCycles: number;
}

// Mock data for the "Current Hours & Cycles" display for different aircraft
const aircraftComponentTimesData: Record<string, AircraftComponentTime[]> = {
  'N630MW': [
    { componentName: 'Airframe', currentTime: 12540.0, currentCycles: 8978 },
    { componentName: 'Engine One', currentTime: 12471.2, currentCycles: 9058 },
    { componentName: 'Engine Two', currentTime: 12439.9, currentCycles: 10721 },
    { componentName: 'Propeller 1', currentTime: 245.3, currentCycles: 88 },
    { componentName: 'Propeller 2', currentTime: 245.3, currentCycles: 89 },
  ],
  'N121RB': [
    { componentName: 'Airframe', currentTime: 330.3, currentCycles: 200 },
    { componentName: 'Engine One', currentTime: 330.3, currentCycles: 200 },
  ],
  'N1327J': [
    { componentName: 'Airframe', currentTime: 7050.0, currentCycles: 6049 },
    { componentName: 'Engine One', currentTime: 7045.0, currentCycles: 6040 },
    { componentName: 'Engine Two', currentTime: 7048.0, currentCycles: 6042 },
  ],
  'N456CD': [
    { componentName: 'Airframe', currentTime: 1200.5, currentCycles: 850 },
    { componentName: 'Engine One', currentTime: 1200.5, currentCycles: 850 },
    { componentName: 'Engine Two', currentTime: 1200.5, currentCycles: 850 },
  ],
  'N789EF': [
    { componentName: 'Airframe', currentTime: 350.0, currentCycles: 120 },
    { componentName: 'Engine One', currentTime: 350.0, currentCycles: 120 },
    { componentName: 'Engine Two', currentTime: 350.0, currentCycles: 120 },
  ],
  // Default/fallback for aircraft not explicitly listed
  'DEFAULT': [
    { componentName: 'Airframe', currentTime: 0, currentCycles: 0 },
    { componentName: 'Engine One', currentTime: 0, currentCycles: 0 },
  ]
};


export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;

  const aircraftMaintenanceTasks = tailNumber 
    ? sampleMaintenanceData.filter(item => item.tailNumber === tailNumber) 
    : [];
  
  const aircraftDisplayDetails = aircraftMaintenanceTasks.length > 0 ? aircraftMaintenanceTasks[0] : null;
  const componentTimes = tailNumber ? (aircraftComponentTimesData[tailNumber] || aircraftComponentTimesData['DEFAULT']) : aircraftComponentTimesData['DEFAULT'];


  if (!tailNumber || !aircraftDisplayDetails) {
    return (
      <>
        <PageHeader title="Aircraft Not Found" icon={Wrench} />
        <Card>
          <CardContent className="pt-6">
            <p>The aircraft with tail number "{tailNumber}" could not be found or has no maintenance items.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/aircraft/currency">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Maintenance Overview
              </Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Maintenance Details for ${aircraftDisplayDetails.tailNumber}`}
        description={`Tracked items & component status for ${aircraftDisplayDetails.aircraftModel} (${aircraftDisplayDetails.tailNumber}).`}
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/aircraft/currency">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
              </Link>
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item for {aircraftDisplayDetails.tailNumber}
            </Button>
          </div>
        }
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <PlaneIcon className="h-6 w-6 text-primary" />
          <CardTitle>Current Hours & Cycles</CardTitle>
        </CardHeader>
        <CardContent>
          {componentTimes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Current Time</TableHead>
                  <TableHead className="text-right">Current Cycles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {componentTimes.map((comp) => (
                  <TableRow key={comp.componentName}>
                    <TableCell className="font-medium">{comp.componentName}</TableCell>
                    <TableCell className="text-right">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</TableCell>
                    <TableCell className="text-right">{comp.currentCycles.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No component time data available for this aircraft.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Tracked Maintenance Items</CardTitle>
          <CardDescription>Detailed list of maintenance items for {aircraftDisplayDetails.tailNumber}. Overall Airframe Time: {aircraftDisplayDetails.currentAirframeTime.toLocaleString()} hrs / {aircraftDisplayDetails.currentAirframeCycles.toLocaleString()} cycles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Due At</TableHead>
                <TableHead className="text-center">To Go</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aircraftMaintenanceTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No maintenance items tracked for this aircraft.
                  </TableCell>
                </TableRow>
              ) : (
                aircraftMaintenanceTasks.map((item) => {
                  const toGoData = calculateToGo(item);
                  const status = getReleaseStatus(toGoData);
                  let dueAtDisplay = 'N/A';
                  let dueType = 'N/A';

                  if (item.dueAtDate) {
                    // Ensure item.dueAtDate is a valid string like "yyyy-MM-dd"
                    try {
                        dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy');
                        dueType = 'Date';
                    } catch (e) {
                        console.error("Error parsing date for maintenance item:", item.dueAtDate, e);
                        dueAtDisplay = "Invalid Date";
                        dueType = 'Date';
                    }
                  } else if (item.dueAtHours != null) {
                    dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
                    dueType = 'Hours';
                  } else if (item.dueAtCycles != null) {
                    dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cycles`;
                    dueType = 'Cycles';
                  }

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{item.nextDueItemDescription}</TableCell>
                      <TableCell>{dueType}</TableCell>
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
                      <TableCell className="text-xs text-muted-foreground">{item.notes || '-'}</TableCell>
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


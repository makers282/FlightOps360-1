
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
import { Wrench, PlusCircle, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { sampleMaintenanceData, calculateToGo, getReleaseStatus, type MaintenanceItem } from '../page'; // Import from parent

export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;

  const aircraftItems = tailNumber 
    ? sampleMaintenanceData.filter(item => item.tailNumber === tailNumber) 
    : [];
  
  const aircraftDetails = aircraftItems.length > 0 ? aircraftItems[0] : null;

  if (!tailNumber || !aircraftDetails) {
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
        title={`Maintenance Details for ${aircraftDetails.tailNumber}`}
        description={`All tracked items for ${aircraftDetails.aircraftModel} (${aircraftDetails.tailNumber}). Current Airframe: ${aircraftDetails.currentAirframeTime.toLocaleString()} hrs / ${aircraftDetails.currentAirframeCycles.toLocaleString()} cycles.`}
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/aircraft/currency">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
              </Link>
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item for {aircraftDetails.tailNumber}
            </Button>
          </div>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Tracked Maintenance Items</CardTitle>
          <CardDescription>Detailed list of maintenance items for {aircraftDetails.tailNumber}.</CardDescription>
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
              {aircraftItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No maintenance items tracked for this aircraft.
                  </TableCell>
                </TableRow>
              ) : (
                aircraftItems.map((item) => {
                  const toGoData = calculateToGo(item);
                  const status = getReleaseStatus(toGoData);
                  let dueAtDisplay = 'N/A';
                  let dueType = 'N/A';

                  if (item.dueAtDate) {
                    dueAtDisplay = format(new Date(item.dueAtDate), 'MM/dd/yyyy');
                    dueType = 'Date';
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

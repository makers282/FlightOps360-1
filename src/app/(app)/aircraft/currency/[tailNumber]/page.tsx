
"use client";

import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Save } from 'lucide-react';
import { format, parse } from 'date-fns';
import { sampleMaintenanceData, calculateToGo, getReleaseStatus, type MaintenanceItem } from '../page';
import { useToast } from '@/hooks/use-toast';

interface AircraftComponentTime {
  componentName: string;
  currentTime: number;
  currentCycles: number;
}

// Mock data for the "Current Hours & Cycles" display for different aircraft
const MOCK_AIRCRAFT_COMPONENT_TIMES_DATA: Record<string, AircraftComponentTime[]> = {
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
  const { toast } = useToast();

  const [editableComponentTimes, setEditableComponentTimes] = useState<AircraftComponentTime[]>([]);

  useEffect(() => {
    if (tailNumber) {
      const initialTimes = MOCK_AIRCRAFT_COMPONENT_TIMES_DATA[tailNumber] || MOCK_AIRCRAFT_COMPONENT_TIMES_DATA['DEFAULT'];
      setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy
    }
  }, [tailNumber]);

  const aircraftMaintenanceTasks = tailNumber 
    ? sampleMaintenanceData.filter(item => item.tailNumber === tailNumber) 
    : [];
  
  const aircraftDisplayDetails = aircraftMaintenanceTasks.length > 0 ? aircraftMaintenanceTasks[0] : null;

  const handleComponentTimeChange = (index: number, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) || value === '') {
      setEditableComponentTimes(prevTimes => {
        const newTimes = [...prevTimes];
        newTimes[index] = { ...newTimes[index], [field]: value === '' ? 0 : numericValue };
        return newTimes;
      });
    }
  };

  const handleSaveComponentTimes = () => {
    // In a real app, this would save to a backend.
    console.log("Saving component times for", tailNumber, editableComponentTimes);
    toast({
      title: "Component Times Saved (Simulated)",
      description: `Times for ${tailNumber} logged to console.`,
    });
  };

  if (!tailNumber) {
    return (
      <>
        <PageHeader title="Aircraft Not Found" icon={Wrench} />
        <Card>
          <CardContent className="pt-6">
            <p>Invalid aircraft tail number provided.</p>
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
  
  if (!aircraftDisplayDetails && editableComponentTimes.length === 0) {
     return (
      <>
        <PageHeader title={`Data for ${tailNumber}`} icon={Wrench} />
        <Card>
          <CardContent className="pt-6">
            <p>No maintenance or component time data found for aircraft "{tailNumber}".</p>
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
        title={`Maintenance Details for ${tailNumber}`}
        description={`Tracked items & component status for ${aircraftDisplayDetails?.aircraftModel || 'Unknown Model'} (${tailNumber}).`}
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/aircraft/currency">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
              </Link>
            </Button>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item for {tailNumber}
            </Button>
          </div>
        }
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
                <PlaneIcon className="h-6 w-6 text-primary" />
                <CardTitle>Current Hours & Cycles</CardTitle>
            </div>
        </CardHeader>
        <CardContent>
          {editableComponentTimes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="w-1/3 text-right">Current Time (hrs)</TableHead>
                  <TableHead className="w-1/3 text-right">Current Cycles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableComponentTimes.map((comp, index) => (
                  <TableRow key={comp.componentName}>
                    <TableCell className="font-medium">{comp.componentName}</TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number"
                        step="0.1"
                        value={comp.currentTime}
                        onChange={(e) => handleComponentTimeChange(index, 'currentTime', e.target.value)}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input 
                        type="number"
                        step="1"
                        value={comp.currentCycles}
                        onChange={(e) => handleComponentTimeChange(index, 'currentCycles', e.target.value)}
                        className="text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No component time data available for this aircraft. Configure in Company Settings.</p>
          )}
        </CardContent>
        {editableComponentTimes.length > 0 && (
            <div className="p-6 pt-0 flex justify-end">
                <Button onClick={handleSaveComponentTimes}>
                    <Save className="mr-2 h-4 w-4" /> Save Component Times
                </Button>
            </div>
        )}
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Tracked Maintenance Items</CardTitle>
          <CardDescription>
            Detailed list of maintenance items for {tailNumber}. 
            {aircraftDisplayDetails && ` Overall Airframe Time: ${aircraftDisplayDetails.currentAirframeTime.toLocaleString()} hrs / ${aircraftDisplayDetails.currentAirframeCycles.toLocaleString()} cycles.`}
          </CardDescription>
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


    
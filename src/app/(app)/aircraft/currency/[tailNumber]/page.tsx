
"use client";

import React, { useState, useEffect, useTransition } from 'react';
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
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';

import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Edit, Loader2, InfoIcon, Phone, UserCircle, MapPin, Save, XCircle } from 'lucide-react';
import { format, parse } from 'date-fns';
import { sampleMaintenanceData, calculateToGo, getReleaseStatus, type MaintenanceItem } from '../page';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, type FleetAircraft, type EngineDetail } from '@/ai/flows/manage-fleet-flow';

interface ComponentTimeData {
  componentName: string;
  currentTime: number;
  currentCycles: number;
}

// MOCK_COMPONENT_VALUES_DATA should ideally come from a backend or be managed more centrally.
// For now, it's a local constant.
const MOCK_COMPONENT_VALUES_DATA: Record<string, Record<string, { time?: number; cycles?: number }>> = {
  'N123AB': { 'Airframe': { time: 1200.5, cycles: 850 }, 'Engine One': { time: 1190.2, cycles: 840 }, 'Engine Two': { time: 1185.7, cycles: 835 }, 'APU': { time: 300.1, cycles: 400 } },
  'N456CD': { 'Airframe': { time: 2500.0, cycles: 1200 }, 'Engine One': { time: 2450.0, cycles: 1180 }, 'Engine Two': { time: 2440.0, cycles: 1170 }, 'APU': { time: 550.5, cycles: 600 } },
  'N789EF': { 'Airframe': { time: 350.0, cycles: 120 }, 'Engine One': { time: 345.0, cycles: 118 }, 'Engine Two': { time: 340.0, cycles: 115 }, 'APU': { time: 80.2, cycles: 90 }, 'Air Conditioning': { time: 150.5, cycles: 75 } },
  'N630MW': { 'Airframe': { time: 12540.0, cycles: 8978 }, 'Engine One': { time: 12471.2, cycles: 9058 }, 'Propeller 1': { time: 245.3, cycles: 88 } },
};

const aircraftInfoEditSchema = z.object({
  model: z.string().min(1, "Model is required."),
  serialNumber: z.string().optional(),
  baseLocation: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactPhone: z.string().optional(),
});
type AircraftInfoEditFormData = z.infer<typeof aircraftInfoEditSchema>;


export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [componentTimes, setComponentTimes] = useState<ComponentTimeData[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);

  const aircraftInfoForm = useForm<AircraftInfoEditFormData>({
    resolver: zodResolver(aircraftInfoEditSchema),
  });

  useEffect(() => {
    const loadAircraftDetails = async () => {
      if (!tailNumber) {
        setIsLoadingAircraft(false);
        return;
      }
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        const foundAircraft = fleet.find(ac => ac.tailNumber === tailNumber);
        if (foundAircraft) {
          setCurrentAircraft(foundAircraft);
          aircraftInfoForm.reset({
            model: foundAircraft.model,
            serialNumber: foundAircraft.serialNumber || '',
            baseLocation: foundAircraft.baseLocation || '',
            primaryContactName: foundAircraft.primaryContactName || '',
            primaryContactPhone: foundAircraft.primaryContactPhone || '',
          });

          const mockValuesForTail = MOCK_COMPONENT_VALUES_DATA[foundAircraft.id] || MOCK_COMPONENT_VALUES_DATA[foundAircraft.tailNumber] || {};
          const initialTimes = (foundAircraft.trackedComponentNames || ['Airframe', 'Engine 1']).map(name => ({
            componentName: name,
            currentTime: mockValuesForTail[name]?.time ?? 0,
            currentCycles: mockValuesForTail[name]?.cycles ?? 0,
          }));
          setComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy for editability
        } else {
          setCurrentAircraft(null);
          setComponentTimes([]);
          toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" });
        }
      } catch (error) {
        console.error("Failed to load aircraft details:", error);
        toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" });
        setCurrentAircraft(null);
        setComponentTimes([]);
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraftDetails();
  }, [tailNumber, toast, aircraftInfoForm]);

  const aircraftMaintenanceTasks = tailNumber
    ? sampleMaintenanceData.filter(item => item.tailNumber === tailNumber)
    : [];

  const handleEditComponentTimes = () => {
    console.log("Edit Component Times clicked for", tailNumber);
    toast({
      title: "Edit Component Times (Placeholder)",
      description: `Functionality to edit times for ${tailNumber} will be implemented here. A modal or inline editing could be used.`,
    });
  };

  const onSubmitAircraftInfo: SubmitHandler<AircraftInfoEditFormData> = (data) => {
    if (!currentAircraft) return;
    startSavingAircraftInfoTransition(async () => {
      try {
        const updatedAircraftData: FleetAircraft = {
          ...currentAircraft,
          ...data,
        };
        await saveFleetAircraft(updatedAircraftData);
        setCurrentAircraft(updatedAircraftData); // Update local state
        setIsEditingAircraftInfo(false);
        toast({ title: "Success", description: "Aircraft information updated." });
      } catch (error) {
        console.error("Failed to save aircraft information:", error);
        toast({ title: "Error", description: "Could not save aircraft information.", variant: "destructive" });
      }
    });
  };


  if (isLoadingAircraft) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Loading aircraft details...</p>
      </div>
    );
  }

  if (!tailNumber || !currentAircraft) {
    return (
      <>
        <PageHeader title="Aircraft Not Found" icon={Wrench} />
        <Card>
          <CardContent className="pt-6">
            <p>Aircraft "{tailNumber || 'Unknown'}" not found or invalid tail number provided.</p>
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

  if (!currentAircraft.isMaintenanceTracked && componentTimes.length === 0 ) {
     return (
      <>
        <PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} />
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Aircraft Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p>
            <p className="text-sm text-muted-foreground">Serial Number: {currentAircraft.serialNumber || 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p>Maintenance tracking is not enabled for aircraft "{currentAircraft.tailNumber}". Component times and maintenance items are not displayed.</p>
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
        title={`Maintenance Details for ${currentAircraft.tailNumber}`}
        description={`Tracked items & component status for ${currentAircraft.model} (${currentAircraft.tailNumber}).`}
        icon={Wrench}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/aircraft/currency">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
              </Link>
            </Button>
            {currentAircraft.isMaintenanceTracked && (
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Task for {currentAircraft.tailNumber}
              </Button>
            )}
          </div>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <PlaneIcon className="h-6 w-6 text-primary" />
                    <CardTitle>Current Hours & Cycles</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={handleEditComponentTimes}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Component Times
                </Button>
            </CardHeader>
            <CardContent>
            {componentTimes.length > 0 ? (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Current Time (hrs)</TableHead>
                    <TableHead className="text-right">Current Cycles</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {componentTimes.map((comp) => (
                    <TableRow key={comp.componentName}>
                        <TableCell className="font-medium">{comp.componentName}</TableCell>
                        <TableCell className="text-right">
                        {comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}
                        </TableCell>
                        <TableCell className="text-right">
                        {comp.currentCycles.toLocaleString()}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            ) : (
                <p className="text-muted-foreground">No specific components configured for time/cycle tracking for this aircraft in Company Settings, or no values recorded.</p>
            )}
            </CardContent>
        </Card>

        <Card className="shadow-lg lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
                <InfoIcon className="h-6 w-6 text-primary" />
                <CardTitle>Aircraft Information</CardTitle>
            </div>
            {!isEditingAircraftInfo && (
              <Button variant="outline" size="sm" onClick={() => setIsEditingAircraftInfo(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Aircraft Info
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isEditingAircraftInfo ? (
              <Form {...aircraftInfoForm}>
                <form onSubmit={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} className="space-y-4">
                  <div>
                    <span className="text-muted-foreground">Tail Number:</span>
                    <span className="font-medium ml-2">{currentAircraft.tailNumber}</span>
                  </div>
                  <FormField
                    control={aircraftInfoForm.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={aircraftInfoForm.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={aircraftInfoForm.control}
                    name="baseLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Location</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={aircraftInfoForm.control}
                    name="primaryContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={aircraftInfoForm.control}
                    name="primaryContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Phone</FormLabel>
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={isSavingAircraftInfo}>
                      {isSavingAircraftInfo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Changes
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setIsEditingAircraftInfo(false); aircraftInfoForm.reset({ model: currentAircraft.model, serialNumber: currentAircraft.serialNumber || '', baseLocation: currentAircraft.baseLocation || '', primaryContactName: currentAircraft.primaryContactName || '', primaryContactPhone: currentAircraft.primaryContactPhone || '' }); }}>
                      <XCircle className="mr-2 h-4 w-4" />Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Tail Number:</span>
                    <span className="font-medium">{currentAircraft.tailNumber}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-medium">{currentAircraft.model}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Serial Number:</span>
                    <span className="font-medium">{currentAircraft.serialNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Location:</span>
                    <span className="font-medium">{currentAircraft.baseLocation || 'N/A'}</span>
                </div>
                {currentAircraft.engineDetails && currentAircraft.engineDetails.length > 0 && (
                    <div>
                        <h4 className="font-medium text-muted-foreground mt-2 mb-1">Engine Details:</h4>
                        {currentAircraft.engineDetails.map((engine, idx) => (
                            <div key={idx} className="pl-2 text-xs border-l ml-2 mb-1">
                                <p><strong>Engine {idx + 1} Model:</strong> {engine.model || 'N/A'}</p>
                                <p><strong>Engine {idx + 1} S/N:</strong> {engine.serialNumber || 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                )}
                 {(currentAircraft.primaryContactName || currentAircraft.primaryContactPhone) && (
                    <div className="pt-2 border-t mt-3">
                        {currentAircraft.primaryContactName && (
                             <div className="flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-muted-foreground"/>
                                <span>{currentAircraft.primaryContactName}</span>
                            </div>
                        )}
                        {currentAircraft.primaryContactPhone && (
                             <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground"/>
                                <span>{currentAircraft.primaryContactPhone}</span>
                            </div>
                        )}
                    </div>
                 )}
              </>
            )}
          </CardContent>
        </Card>
      </div>


      {currentAircraft.isMaintenanceTracked ? (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle>Tracked Maintenance Items</CardTitle>
            <CardDescription>
              Detailed list of maintenance items for {currentAircraft.tailNumber}.
              {componentTimes.find(c => c.componentName === 'Airframe') &&
                ` Overall Airframe Time: ${componentTimes.find(c => c.componentName === 'Airframe')?.currentTime.toLocaleString()} hrs / ${componentTimes.find(c => c.componentName === 'Airframe')?.currentCycles.toLocaleString()} cycles.`}
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
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Maintenance Tracking Not Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Maintenance item tracking is not enabled for {currentAircraft.tailNumber}. This can be configured in Company Settings.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}


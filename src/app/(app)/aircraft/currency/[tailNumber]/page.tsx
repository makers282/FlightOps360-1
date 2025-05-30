
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { AddMaintenanceTaskModal, type MaintenanceTaskFormData } from './components/add-maintenance-task-modal';

import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Edit, Loader2, InfoIcon, Phone, UserCircle, MapPin, Save, XCircle, Edit2, Edit3 } from 'lucide-react';
import { format, parse, addDays, isValid, addMonths, addYears, endOfMonth } from 'date-fns';
import { sampleMaintenanceData, calculateToGo, getReleaseStatus, type MaintenanceItem } from '../page';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, type FleetAircraft, type EngineDetail } from '@/ai/flows/manage-fleet-flow';

export const MOCK_COMPONENT_VALUES_DATA: Record<string, Record<string, { time?: number; cycles?: number }>> = {
  'N123AB': { 'Airframe': { time: 1200.5, cycles: 850 }, 'Engine 1': { time: 1190.2, cycles: 840 }, 'Engine 2': { time: 1185.7, cycles: 835 }, 'APU': { time: 300.1, cycles: 400 } },
  'N456CD': { 'Airframe': { time: 2500.0, cycles: 1200 }, 'Engine 1': { time: 2450.0, cycles: 1180 }, 'Engine 2': { time: 2440.0, cycles: 1170 }, 'APU': { time: 550.5, cycles: 600 } },
  'N789EF': {
    'Airframe': { time: 350.0, cycles: 120 },
    'Engine 1': { time: 345.0, cycles: 118 },
    'Engine 2': { time: 340.0, cycles: 115 },
    'APU': { time: 80.2, cycles: 90 },
    'Air Conditioning': { time: 150.5, cycles: 75 }
  },
  'N630MW': {
    'Airframe': { time: 12540.0, cycles: 8978 },
    'Engine 1': { time: 12471.2, cycles: 9058 },
    // 'Engine 2': { time: 12439.9, cycles: 10721 }, // PC-12 is single engine
    'Propeller 1': { time: 245.3, cycles: 88 },
  },
};


const aircraftInfoEditSchema = z.object({
  model: z.string().min(1, "Model is required."),
  serialNumber: z.string().optional(),
  baseLocation: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactPhone: z.string().optional(),
});
type AircraftInfoEditFormData = z.infer<typeof aircraftInfoEditSchema>;


const createOrUpdateMaintenanceItem = (
  formData: MaintenanceTaskFormData,
  aircraft: FleetAircraft,
  componentValues: typeof MOCK_COMPONENT_VALUES_DATA, // Still here but not used for due date calc
  existingItemId?: string
): MaintenanceItem => {
  let dueAtDate: string | undefined = undefined;
  let dueAtHours: number | undefined = undefined;
  let dueAtCycles: number | undefined = undefined;

  const actualLastCompletedDateObj = formData.lastCompletedDate && isValid(parse(formData.lastCompletedDate, 'yyyy-MM-dd', new Date()))
    ? parse(formData.lastCompletedDate, 'yyyy-MM-dd', new Date())
    : new Date(); // Default to today if no valid date, critical for interval calcs
  const actualLastCompletedHours = Number(formData.lastCompletedHours || 0);
  const actualLastCompletedCycles = Number(formData.lastCompletedCycles || 0);

  if (formData.trackType === "Interval") {
    if (formData.isDaysDueEnabled && formData.daysDueValue && formData.daysIntervalType) {
      const intervalValue = Number(formData.daysDueValue);
      if (!isNaN(intervalValue) && intervalValue > 0) {
        if (formData.daysIntervalType === 'days') {
          dueAtDate = format(addDays(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd');
        } else if (formData.daysIntervalType === 'calendar_months_eom') {
          dueAtDate = format(endOfMonth(addMonths(actualLastCompletedDateObj, intervalValue)), 'yyyy-MM-dd');
        } else if (formData.daysIntervalType === 'calendar_years') {
          dueAtDate = format(addYears(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd');
        }
      }
    }
    if (formData.isHoursDueEnabled && formData.hoursDue) {
      const intervalHours = Number(formData.hoursDue);
      if (!isNaN(intervalHours) && intervalHours > 0) {
        dueAtHours = actualLastCompletedHours + intervalHours;
      }
    }
    if (formData.isCyclesDueEnabled && formData.cyclesDue) {
      const intervalCycles = Number(formData.cyclesDue);
      if (!isNaN(intervalCycles) && intervalCycles > 0) {
        dueAtCycles = actualLastCompletedCycles + intervalCycles;
      }
    }
  } else if (formData.trackType === "One Time") {
    if (formData.isDaysDueEnabled && formData.daysDueValue && isValid(parse(formData.daysDueValue, 'yyyy-MM-dd', new Date()))) {
      dueAtDate = formData.daysDueValue;
    }
    if (formData.isHoursDueEnabled && formData.hoursDue) {
      dueAtHours = Number(formData.hoursDue);
    }
    if (formData.isCyclesDueEnabled && formData.cyclesDue) {
      dueAtCycles = Number(formData.cyclesDue);
    }
  }

  const aircraftKey = aircraft.id || aircraft.tailNumber;
  // Use the current airframe time/cycles from the MOCK_COMPONENT_VALUES_DATA for display, 
  // not for calculating the 'dueAt' values which are based on last completion + interval.
  const currentAirframeTimeForTask = MOCK_COMPONENT_VALUES_DATA[aircraftKey]?.['Airframe']?.time || 0;
  const currentAirframeCyclesForTask = MOCK_COMPONENT_VALUES_DATA[aircraftKey]?.['Airframe']?.cycles || 0;


  return {
    id: existingItemId || `MX-${Date.now()}`,
    tailNumber: aircraft.tailNumber,
    aircraftModel: aircraft.model,
    currentAirframeTime: currentAirframeTimeForTask, // This is the current state of the aircraft
    currentAirframeCycles: currentAirframeCyclesForTask, // This is the current state of the aircraft
    nextDueItemDescription: formData.itemTitle,
    dueAtDate, // Calculated based on last completed + interval or specific date
    dueAtHours, // Calculated based on last completed + interval or specific hours
    dueAtCycles, // Calculated based on last completed + interval or specific cycles
    notes: formData.details || formData.lastCompletedNotes || '',
  };
};


export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [editableComponentTimes, setEditableComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);
  const [originalComponentTimes, setOriginalComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);

  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);
  const [isEditingComponentTimes, setIsEditingComponentTimes] = useState(false);


  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceItem[]>([]);
  const [isSavingComponentTimes, startSavingComponentTimesTransition] = useTransition();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskOriginalId, setEditingTaskOriginalId] = useState<string | null>(null);
  const [initialModalFormData, setInitialModalFormData] = useState<Partial<MaintenanceTaskFormData> | null>(null);


  const aircraftInfoForm = useForm<AircraftInfoEditFormData>({
    resolver: zodResolver(aircraftInfoEditSchema),
  });

  const initializeComponentTimes = useCallback((aircraft: FleetAircraft | null) => {
    if (!aircraft) {
      setEditableComponentTimes([]);
      setOriginalComponentTimes([]);
      return;
    }
    const aircraftKeyInMock = aircraft.id || aircraft.tailNumber; // Use ID first, then tailNumber
    const componentValuesForAircraft = MOCK_COMPONENT_VALUES_DATA[aircraftKeyInMock] || {};
    // Use trackedComponentNames from the aircraft object to build the table
    const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1']; 
    
    const initialTimes = trackedComponents.map(name => ({
      componentName: name,
      currentTime: componentValuesForAircraft[name]?.time ?? 0,
      currentCycles: componentValuesForAircraft[name]?.cycles ?? 0,
    }));
    
    setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy
    setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy
  }, []);


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

          initializeComponentTimes(foundAircraft);

          // Filter sampleMaintenanceData for tasks related to this specific tailNumber
          const tasksForAircraft = sampleMaintenanceData.filter(item => item.tailNumber === tailNumber);
          setMaintenanceTasks(tasksForAircraft);

        } else {
          setCurrentAircraft(null);
          setMaintenanceTasks([]);
          initializeComponentTimes(null);
          toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" });
        }
      } catch (error) {
        console.error("Failed to load aircraft details:", error);
        toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" });
        setCurrentAircraft(null);
        setMaintenanceTasks([]);
        initializeComponentTimes(null);
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraftDetails();
  }, [tailNumber, toast, aircraftInfoForm, initializeComponentTimes]);


  const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return; // Allow empty string to clear, but not invalid chars

    setEditableComponentTimes(prevTimes =>
      prevTimes.map(comp =>
        comp.componentName === componentName
          ? { ...comp, [field]: isNaN(numericValue) ? 0 : numericValue } // Default to 0 if cleared or invalid
          : comp
      )
    );
  };

  const handleSaveComponentTimes = () => {
    if (!currentAircraft) return;
    startSavingComponentTimesTransition(() => {
      // In a real app, this would be an API call.
      // For now, we update the MOCK_AIRCRAFT_COMPONENT_TIMES_DATA client-side.
      const currentAircraftId = currentAircraft.id || currentAircraft.tailNumber;
      if (currentAircraftId) {
        const newComponentValues: Record<string, { time?: number; cycles?: number }> = {};
        editableComponentTimes.forEach(comp => {
          newComponentValues[comp.componentName] = { time: comp.currentTime, cycles: comp.currentCycles };
        });
        MOCK_COMPONENT_VALUES_DATA[currentAircraftId] = newComponentValues;
        setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes))); // Update original on save
      }
      setIsEditingComponentTimes(false);
      toast({
        title: "Component Times Saved (Mock)",
        description: `Updated component times for ${currentAircraftId} in client-side mock data.`,
      });
    });
  };

  const handleCancelEditComponentTimes = () => {
    setEditableComponentTimes(JSON.parse(JSON.stringify(originalComponentTimes))); // Revert to original
    setIsEditingComponentTimes(false);
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

  const handleOpenAddTaskModal = () => {
    setEditingTaskOriginalId(null);
    setInitialModalFormData(null); 
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (taskToEdit: MaintenanceItem) => {
    setEditingTaskOriginalId(taskToEdit.id);
    // For MVP edit, we primarily pre-fill descriptive fields.
    // Complex reverse-engineering of due criteria is avoided for now.
    // User will need to re-enter due criteria if they wish to change them.
    const formData: Partial<MaintenanceTaskFormData> = {
      itemTitle: taskToEdit.nextDueItemDescription,
      details: taskToEdit.notes,
      // TODO: Potentially add more fields here if they are stored on MaintenanceItem
      // and can be easily mapped back to MaintenanceTaskFormData.
      // For now, rely on defaultMaintenanceTaskFormValues for most tracking settings.
    };
    setInitialModalFormData(formData);
    setIsTaskModalOpen(true);
  };


  const handleSaveTask = (taskFormData: MaintenanceTaskFormData) => {
    if (!currentAircraft) return;

    const newItem = createOrUpdateMaintenanceItem(
      taskFormData,
      currentAircraft,
      MOCK_COMPONENT_VALUES_DATA,
      editingTaskOriginalId || undefined 
    );

    if (editingTaskOriginalId) {
      setMaintenanceTasks(prevTasks =>
        prevTasks.map(task => (task.id === editingTaskOriginalId ? newItem : task))
      );
      // Update the global sampleMaintenanceData as well if it's the source of truth for this view
      const globalIndex = sampleMaintenanceData.findIndex(t => t.id === editingTaskOriginalId);
      if (globalIndex > -1) sampleMaintenanceData[globalIndex] = newItem;

      toast({
        title: "Task Updated (Client-Side)",
        description: `Task "${newItem.nextDueItemDescription}" updated for ${currentAircraft.tailNumber}.`,
      });
    } else {
      // Add to global sample data for persistence in this demo session
      sampleMaintenanceData.push(newItem); 
      setMaintenanceTasks(prev => [...prev, newItem]);
      toast({
        title: "New Task Added (Client-Side)",
        description: `Task "${newItem.nextDueItemDescription}" added for ${currentAircraft.tailNumber}.`,
      });
    }

    setIsTaskModalOpen(false);
    setEditingTaskOriginalId(null);
    setInitialModalFormData(null);
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

  if (!currentAircraft.isMaintenanceTracked) {
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
            <AddMaintenanceTaskModal
              aircraft={currentAircraft}
              onSave={handleSaveTask}
              isOpen={isTaskModalOpen}
              setIsOpen={setIsTaskModalOpen}
              initialData={initialModalFormData} 
              isEditing={!!editingTaskOriginalId} 
            >
              <Button className="w-full sm:w-auto" onClick={handleOpenAddTaskModal}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Task
              </Button>
            </AddMaintenanceTaskModal>
          </div>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
           <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-center gap-2">
              <PlaneIcon className="h-6 w-6 text-primary" />
              <CardTitle>Current Hours & Cycles</CardTitle>
            </div>
            {!isEditingComponentTimes && (
              <Button variant="outline" size="sm" onClick={() => setIsEditingComponentTimes(true)}>
                <Edit3 className="mr-2 h-4 w-4" /> Edit Times
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editableComponentTimes.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Current Time (hrs)</TableHead>
                      <TableHead className="text-right">Current Cycles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableComponentTimes.map((comp) => (
                      <TableRow key={comp.componentName}>
                        <TableCell className="font-medium">{comp.componentName}</TableCell>
                        <TableCell className="text-right">
                          {isEditingComponentTimes ? (
                            <Input
                              type="number"
                              value={comp.currentTime}
                              onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentTime', e.target.value)}
                              className="w-24 text-right h-8"
                              step="0.1"
                            />
                          ) : (
                            <span className="tabular-nums">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditingComponentTimes ? (
                            <Input
                              type="number"
                              value={comp.currentCycles}
                              onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentCycles', e.target.value)}
                              className="w-24 text-right h-8"
                            />
                          ) : (
                            <span className="tabular-nums">{comp.currentCycles.toLocaleString()}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {isEditingComponentTimes && (
                  <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={handleSaveComponentTimes} size="sm" disabled={isSavingComponentTimes}>
                      {isSavingComponentTimes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Component Times
                    </Button>
                     <Button variant="outline" size="sm" onClick={handleCancelEditComponentTimes} disabled={isSavingComponentTimes}>
                      <XCircle className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
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
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <span>{currentAircraft.primaryContactName}</span>
                      </div>
                    )}
                    {currentAircraft.primaryContactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{currentAircraft.primaryContactPhone}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                   {!isEditingAircraftInfo && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingAircraftInfo(true)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Aircraft Info
                    </Button>
                  )}
                </div>
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
              {editableComponentTimes.find(c => c.componentName === 'Airframe') &&
                ` Overall Airframe Time: ${editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs / ${editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentCycles.toLocaleString()} cycles.`}
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No maintenance items tracked for this aircraft. Click "Add New Task" to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  maintenanceTasks.map((item) => {
                    const aircraftId = currentAircraft.id || currentAircraft.tailNumber;
                    const airframeComponent = editableComponentTimes.find(c => c.componentName === 'Airframe');
                    const itemCurrentAirframeTime = airframeComponent?.currentTime ?? item.currentAirframeTime;
                    const itemCurrentAirframeCycles = airframeComponent?.currentCycles ?? item.currentAirframeCycles;


                    const toGoData = calculateToGo({
                      ...item,
                      currentAirframeTime: itemCurrentAirframeTime,
                      currentAirframeCycles: itemCurrentAirframeCycles
                    });

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
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleOpenEditTaskModal(item) }>
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit Item</span>
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

    
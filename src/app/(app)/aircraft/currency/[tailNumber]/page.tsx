
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
// import { PageHeader } from '@/components/page-header'; // Keep PageHeader commented for now
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
import { AddMaintenanceTaskModal, type MaintenanceTaskFormData, defaultMaintenanceTaskFormValues } from './components/add-maintenance-task-modal';

import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Edit, Loader2, InfoIcon, Phone, UserCircle, MapPin, Save, XCircle, Edit2, Edit3, AlertTriangle, CheckCircle2, XCircle as XCircleIcon } from 'lucide-react';
import { format, parse, addDays, isValid, addMonths, addYears, endOfMonth, parseISO, differenceInCalendarDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask, deleteMaintenanceTask, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import { PageHeader } from '@/components/page-header'; // Uncommented PageHeader

// MOCK_COMPONENT_VALUES_DATA remains client-side for now
export const MOCK_COMPONENT_VALUES_DATA: Record<string, Record<string, { time?: number; cycles?: number }>> = {
  'N123AB': { 'Airframe': { time: 1200.5, cycles: 850 }, 'Engine 1': { time: 1190.2, cycles: 840 }, 'Engine 2': { time: 1185.7, cycles: 835 }, 'APU': { time: 300.1, cycles: 400 } },
  'N456CD': { 'Airframe': { time: 2500.0, cycles: 1200 }, 'Engine 1': { time: 2450.0, cycles: 1180 }, 'Engine 2': { time: 2440.0, cycles: 1170 }, 'APU': { time: 550.5, cycles: 600 } },
  'N789EF': { 'Airframe': { time: 350.0, cycles: 120 }, 'Engine 1': { time: 345.0, cycles: 118 }, 'Engine 2': { time: 340.0, cycles: 115 }, 'APU': { time: 80.2, cycles: 90 }, 'Air Conditioning': { time: 150.5, cycles: 75 } },
  'N630MW': { 'Airframe': { time: 12540.0, cycles: 8978 }, 'Engine 1': { time: 12471.2, cycles: 8978 }, 'Propeller 1': { time: 245.3, cycles: 888 } },
};

// This is the type for tasks displayed in the UI, including calculated due dates.
export interface DisplayMaintenanceItem extends FlowMaintenanceTask {
  // Calculated fields for display:
  dueAtDate?: string; // yyyy-MM-dd
  dueAtHours?: number;
  dueAtCycles?: number;
}


// const aircraftInfoEditSchema = z.object({
//   model: z.string().min(1, "Model is required."),
//   serialNumber: z.string().optional(),
//   baseLocation: z.string().optional(),
//   primaryContactName: z.string().optional(),
//   primaryContactPhone: z.string().optional(),
// });
// type AircraftInfoEditFormData = z.infer<typeof aircraftInfoEditSchema>;


export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<DisplayMaintenanceItem[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const [editableComponentTimes, setEditableComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);
  const [originalComponentTimes, setOriginalComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);

  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);
  const [isEditingComponentTimes, setIsEditingComponentTimes] = useState(false);
  const [isSavingComponentTimes, startSavingComponentTimesTransition] = useTransition();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskOriginalId, setEditingTaskOriginalId] = useState<string | null>(null); // This is the Firestore document ID
  const [initialModalFormData, setInitialModalFormData] = useState<Partial<MaintenanceTaskFormData> | null>(null);

  // const aircraftInfoForm = useForm<AircraftInfoEditFormData>({ resolver: zodResolver(aircraftInfoEditSchema) });

  const calculateDisplayFields = useCallback((task: FlowMaintenanceTask): DisplayMaintenanceItem => {
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
  }, []);

  const initializeComponentTimes = useCallback((aircraft: FleetAircraft | null) => {
    if (!aircraft) {
      setEditableComponentTimes([]);
      setOriginalComponentTimes([]);
      return;
    }
  
    const aircraftKeyInMock = aircraft.id || aircraft.tailNumber;
    const componentValuesForAircraft = MOCK_COMPONENT_VALUES_DATA[aircraftKeyInMock] || {};
    const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
  
    const initialTimes = trackedComponents.map(name => {
      const trimmedName = name.trim();
      const mockDataForComponent = componentValuesForAircraft[trimmedName] || 
                                   Object.entries(componentValuesForAircraft)
                                         .find(([key, _]) => key.trim() === trimmedName)?.[1];
      
      return {
        componentName: trimmedName,
        currentTime: mockDataForComponent?.time ?? 0,
        currentCycles: mockDataForComponent?.cycles ?? 0,
      };
    });
  
    setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy
    setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimes))); // Deep copy
  }, []);


  const loadMaintenanceTasks = useCallback(async (aircraftId: string) => {
    setIsLoadingTasks(true);
    try {
      const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId });
      setMaintenanceTasks(tasksFromDb.map(calculateDisplayFields));
    } catch (error) {
      console.error("Failed to load maintenance tasks:", error);
      toast({ title: "Error", description: "Could not load maintenance tasks.", variant: "destructive" });
      setMaintenanceTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [toast, calculateDisplayFields]);

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
          // aircraftInfoForm.reset({
          //   model: foundAircraft.model,
          //   serialNumber: foundAircraft.serialNumber || '',
          //   baseLocation: foundAircraft.baseLocation || '',
          //   primaryContactName: foundAircraft.primaryContactName || '',
          //   primaryContactPhone: foundAircraft.primaryContactPhone || '',
          // });
          initializeComponentTimes(foundAircraft);
          await loadMaintenanceTasks(foundAircraft.id);
        } else {
          setCurrentAircraft(null);
          setMaintenanceTasks([]);
          initializeComponentTimes(null);
          toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" });
        }
      } catch (error) {
        console.error("Failed to load aircraft details:", error);
        toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" });
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraftDetails();
  }, [tailNumber, toast, /*aircraftInfoForm,*/ initializeComponentTimes, loadMaintenanceTasks]);

  const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return; // Allow clearing the input
    setEditableComponentTimes(prev => 
        prev.map(c => 
            c.componentName === componentName 
            ? { ...c, [field]: isNaN(numericValue) ? 0 : numericValue } 
            : c
        )
    );
  };

  const handleSaveComponentTimes = () => {
    if (!currentAircraft) return;
    startSavingComponentTimesTransition(() => {
      // This is where you would typically save to a backend/Firestore
      // For now, it updates MOCK_COMPONENT_VALUES_DATA (client-side)
      const currentAircraftId = currentAircraft.id || currentAircraft.tailNumber; // Use the aircraft's actual ID
      const newValues: Record<string, { time?: number; cycles?: number }> = {};
      editableComponentTimes.forEach(comp => newValues[comp.componentName] = { time: comp.currentTime, cycles: comp.currentCycles });
      MOCK_COMPONENT_VALUES_DATA[currentAircraftId] = newValues; // Update the mock data for THIS aircraft
      
      // Also update originalComponentTimes to reflect the "saved" state
      setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes)));
      setIsEditingComponentTimes(false);
      toast({ title: "Component Times Saved (Mock)", description: `Updated for ${currentAircraftId}. This data is client-side only.` });
      console.log("Mock saving component times for:", currentAircraftId, MOCK_COMPONENT_VALUES_DATA[currentAircraftId]);
    });
  };

  const handleCancelEditComponentTimes = () => {
    setEditableComponentTimes(JSON.parse(JSON.stringify(originalComponentTimes)));
    setIsEditingComponentTimes(false);
  };

  // const onSubmitAircraftInfo: SubmitHandler<AircraftInfoEditFormData> = (data) => {
  //   if (!currentAircraft) return;
  //   startSavingAircraftInfoTransition(async () => {
  //     try {
  //       const updatedAircraftData: FleetAircraft = { ...currentAircraft, ...data };
  //       await saveFleetAircraft(updatedAircraftData);
  //       setCurrentAircraft(updatedAircraftData);
  //       setIsEditingAircraftInfo(false);
  //       toast({ title: "Success", description: "Aircraft information updated." });
  //     } catch (error) {
  //       console.error("Failed to save aircraft info:", error);
  //       toast({ title: "Error", description: "Could not save aircraft information.", variant: "destructive" });
  //     }
  //   });
  // };

  const handleOpenAddTaskModal = () => {
    setEditingTaskOriginalId(null);
    setInitialModalFormData(defaultMaintenanceTaskFormValues);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (taskToEdit: FlowMaintenanceTask) => {
    setEditingTaskOriginalId(taskToEdit.id); // This is the Firestore Document ID
    const formData: MaintenanceTaskFormData = {
      itemTitle: taskToEdit.itemTitle,
      referenceNumber: taskToEdit.referenceNumber || '',
      partNumber: taskToEdit.partNumber || '',
      serialNumber: taskToEdit.serialNumber || '',
      itemType: taskToEdit.itemType,
      associatedComponent: taskToEdit.associatedComponent || '',
      details: taskToEdit.details || '',
      isActive: taskToEdit.isActive,
      trackType: taskToEdit.trackType,
      isTripsNotAffected: taskToEdit.isTripsNotAffected || false, // Ensure boolean, not undefined
      
      lastCompletedDate: taskToEdit.lastCompletedDate || '', // Ensure string, not undefined
      lastCompletedHours: taskToEdit.lastCompletedHours, // Keep as number | undefined
      lastCompletedCycles: taskToEdit.lastCompletedCycles, // Keep as number | undefined
      lastCompletedNotes: taskToEdit.lastCompletedNotes || '', // Ensure string, not undefined
      
      isHoursDueEnabled: taskToEdit.isHoursDueEnabled || false,
      hoursDue: taskToEdit.hoursDue,
      hoursTolerance: taskToEdit.hoursTolerance,
      alertHoursPrior: taskToEdit.alertHoursPrior,
      
      isCyclesDueEnabled: taskToEdit.isCyclesDueEnabled || false,
      cyclesDue: taskToEdit.cyclesDue,
      cyclesTolerance: taskToEdit.cyclesTolerance,
      alertCyclesPrior: taskToEdit.alertCyclesPrior,
      
      isDaysDueEnabled: taskToEdit.isDaysDueEnabled || false,
      daysIntervalType: taskToEdit.daysIntervalType || 'days', // Default if undefined
      daysDueValue: taskToEdit.daysDueValue || '', // Ensure string, not undefined
      daysTolerance: taskToEdit.daysTolerance,
      alertDaysPrior: taskToEdit.alertDaysPrior,
    };
    setInitialModalFormData(formData);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskFormData: MaintenanceTaskFormData) => {
    if (!currentAircraft) return;

    const taskToSave: FlowMaintenanceTask = {
      ...taskFormData,
      id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Generate new ID if not editing
      aircraftId: currentAircraft.id, // This must be the Firestore document ID of the aircraft
    };

    try {
      await saveMaintenanceTask(taskToSave);
      toast({
        title: editingTaskOriginalId ? "Task Updated" : "New Task Added",
        description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`,
      });
      // Reload tasks for the current aircraft
      await loadMaintenanceTasks(currentAircraft.id); // Use currentAircraft.id
      setIsTaskModalOpen(false); // Close modal on successful save
      setEditingTaskOriginalId(null); // Reset editing ID
      setInitialModalFormData(null); // Reset form data
    } catch (error) {
      console.error("Failed to save task:", error);
      toast({ title: "Error Saving Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      // Do not close modal on error, allow user to retry or correct
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentAircraft) return; // Should not happen if a task exists for an aircraft
    try {
      await deleteMaintenanceTask({ taskId });
      toast({ title: "Task Deleted", description: `Task ID ${taskId} removed from Firestore.` });
      await loadMaintenanceTasks(currentAircraft.id); // Reload tasks for the current aircraft
      // Modal closing is handled by the modal component itself after calling this.
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };

  const calculateToGo = useCallback((item: DisplayMaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
    const now = new Date();

    // 1. Date-based due
    if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
      const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    }
    
    // 2. Hour or Cycle based due
    let currentRelevantTime: number | undefined = undefined;
    let currentRelevantCycles: number | undefined = undefined;
    
    const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") 
      ? item.associatedComponent.trim() 
      : "Airframe"; // Default to Airframe
    
    const currentTimesForComponent = editableComponentTimes.find(c => c.componentName.trim() === componentNameToUse);

    if (currentTimesForComponent) {
      currentRelevantTime = currentTimesForComponent.currentTime;
      currentRelevantCycles = currentTimesForComponent.currentCycles;
    } else {
      // If the specific component (or default 'Airframe') isn't found, we can't accurately calculate.
      if (item.dueAtHours != null) return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: 'hrs', isOverdue: false };
      if (item.dueAtCycles != null) return { text: `N/A (No cycles for ${componentNameToUse})`, numeric: Infinity, unit: 'cycles', isOverdue: false };
      return { text: 'N/A (Comp. data missing)', numeric: Infinity, unit: 'N/A', isOverdue: false };
    }
    
    // Check for Hours Due
    if (item.dueAtHours != null && currentRelevantTime !== undefined) {
      const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
      return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs (from ${componentNameToUse})`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
    }
  
    // Check for Cycles Due
    if (item.dueAtCycles != null && currentRelevantCycles !== undefined) {
      const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
      return { text: `${cyclesRemaining.toLocaleString()} cycles (from ${componentNameToUse})`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
    }
    
    return { text: 'N/A (Not Date/Hr/Cycle)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  }, [editableComponentTimes]);


  const getReleaseStatus = (toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
    if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (No cycles for') || toGo.text.startsWith('N/A (Comp. data missing')) {
      return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
    }
    if (toGo.isOverdue) return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
    
    // Alert thresholds (configurable in a real app)
    const daysAlertThreshold = 30;
    const hoursAlertThreshold = 25;
    const cyclesAlertThreshold = 50;

    if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    
    if (toGo.text === 'N/A (Not Date/Hr/Cycle)' || toGo.text === 'Invalid Date') return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Check Due Info' };
    return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
  };

  // Still keeping the main JSX return simplified for now
  // return (
  //   <div>
  //     Hello World - Aircraft Maintenance Detail Page Simplified. Progressively uncommenting.
  //   </div>
  // );

  if (isLoadingAircraft) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading aircraft details...</p></div>;
  }
  if (!tailNumber || !currentAircraft) {
    return (
      <div>
        <PageHeader title="Aircraft Not Found" icon={Wrench} />
        <Card>
          <CardContent className="pt-6">
            <p>Aircraft "{tailNumber || 'Unknown'}" not found.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!currentAircraft.isMaintenanceTracked) {
     return (
        <div>
            <PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} />
            <Card className="mb-6">
                <CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p>
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  const pageHeaderTitle = `Maintenance Details for ${currentAircraft.tailNumber}`;
  const pageHeaderDescription = `Tracked items & component status for ${currentAircraft.model} (${currentAircraft.tailNumber}).`;


  return (
    <div>
      <PageHeader
        title={pageHeaderTitle}
        description={pageHeaderDescription}
        icon={Wrench}
        actions={
          <AddMaintenanceTaskModal 
            aircraft={currentAircraft} 
            onSave={handleSaveTask} 
            onDelete={handleDeleteTask}
            isOpen={isTaskModalOpen}
            setIsOpen={setIsTaskModalOpen}
            initialData={initialModalFormData}
            isEditing={!!editingTaskOriginalId}
            currentTaskId={editingTaskOriginalId}
          >
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Add New Task</Button>
          </AddMaintenanceTaskModal>
        }
      />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
           <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-center gap-2"><PlaneIcon className="h-6 w-6 text-primary" /><CardTitle>Current Hours & Cycles</CardTitle></div>
            {!isEditingComponentTimes ? (
                <Button variant="outline" size="icon" onClick={() => setIsEditingComponentTimes(true)} disabled={isSavingComponentTimes}>
                    <Edit className="h-4 w-4" /> <span className="sr-only">Edit Component Times</span>
                </Button>
            ) : (
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCancelEditComponentTimes} disabled={isSavingComponentTimes}>
                        <XCircle className="h-4 w-4" /><span className="sr-only">Cancel Edit</span>
                    </Button>
                    <Button size="icon" onClick={handleSaveComponentTimes} disabled={isSavingComponentTimes}>
                        {isSavingComponentTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="sr-only">Save Component Times</span>
                    </Button>
                </div>
            )}
           </CardHeader>
           <CardContent>
            {editableComponentTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No components configured for time tracking. Update in Company Settings.</p>
            ) : (
                <div className="space-y-3">
                {editableComponentTimes.map(comp => (
                    <div key={comp.componentName} className="grid grid-cols-3 items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                        <span className="col-span-1 text-sm font-medium">{comp.componentName}</span>
                        {isEditingComponentTimes ? (
                        <>
                            <Input 
                                type="number" 
                                value={comp.currentTime} 
                                onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentTime', e.target.value)}
                                placeholder="Hours"
                                className="text-sm h-8"
                            />
                            <Input 
                                type="number" 
                                value={comp.currentCycles} 
                                onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentCycles', e.target.value)}
                                placeholder="Cycles"
                                className="text-sm h-8"
                            />
                        </>
                        ) : (
                        <>
                            <span className="col-span-1 text-sm text-right">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs</span>
                            <span className="col-span-1 text-sm text-right">{comp.currentCycles.toLocaleString()} cyc</span>
                        </>
                        )}
                    </div>
                ))}
                </div>
            )}
           </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2"><InfoIcon className="h-6 w-6 text-primary" />Aircraft Information</CardTitle>
              {/* Aircraft Info Edit form related buttons and form will be re-added when aircraftInfoForm logic is uncommented */}
            </div>
          </CardHeader>
          <CardContent>
            {/* Display mode for aircraft info */}
            <div className="space-y-2 text-sm">
              <p><strong className="text-muted-foreground">Model:</strong> {currentAircraft.model}</p>
              <p><strong className="text-muted-foreground">Serial #:</strong> {currentAircraft.serialNumber || 'N/A'}</p>
              <p><strong className="text-muted-foreground">Base:</strong> {currentAircraft.baseLocation || 'N/A'}</p>
              {currentAircraft.primaryContactName && <p><strong className="text-muted-foreground">Contact:</strong> {currentAircraft.primaryContactName} {currentAircraft.primaryContactPhone && `(${currentAircraft.primaryContactPhone})`}</p>}
              {currentAircraft.engineDetails && currentAircraft.engineDetails.length > 0 && (
                <div className="pt-2">
                  <h4 className="font-semibold text-muted-foreground">Engine Details:</h4>
                  <ul className="list-disc list-inside pl-2">
                    {currentAircraft.engineDetails.map((engine, idx) => (
                      <li key={idx}>
                        {engine.model || `Engine ${idx+1}`}
                        {engine.serialNumber && ` (S/N: ${engine.serialNumber})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" />Maintenance Items</CardTitle>
          <CardDescription>
            Overview of scheduled and upcoming maintenance tasks for {currentAircraft.tailNumber}.
            Calculated "To Go" is based on the values in "Current Hours & Cycles" above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTasks ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading maintenance tasks...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Associated Component</TableHead>
                  <TableHead>Last Done</TableHead>
                  <TableHead>Due At</TableHead>
                  <TableHead>To Go</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No maintenance tasks found for this aircraft. 
                      <Button variant="link" className="p-0 ml-1" onClick={handleOpenAddTaskModal}>Add one now?</Button>
                    </TableCell>
                  </TableRow>
                )}
                {maintenanceTasks.map((item) => {
                  const toGo = calculateToGo(item);
                  const status = getReleaseStatus(toGo);
                  let dueAtDisplay = "N/A";
                  if (item.dueAtDate) {
                    try { dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yy'); } catch {}
                  } else if (item.dueAtHours !== undefined) {
                    dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
                  } else if (item.dueAtCycles !== undefined) {
                    dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cyc`;
                  }

                  let lastDoneDisplay = "N/A";
                  if (item.lastCompletedDate) {
                     try { lastDoneDisplay = format(parseISO(item.lastCompletedDate), 'MM/dd/yy'); } catch {}
                  } else if (item.lastCompletedHours !== undefined) {
                    lastDoneDisplay = `${item.lastCompletedHours.toLocaleString()} hrs`;
                  } else if (item.lastCompletedCycles !== undefined) {
                    lastDoneDisplay = `${item.lastCompletedCycles.toLocaleString()} cyc`;
                  }

                  return (
                    <TableRow key={item.id} className={item.isActive ? '' : 'opacity-50 bg-muted/30 hover:bg-muted/40'}>
                      <TableCell className="font-medium">
                        {item.itemTitle}
                        {!item.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>}
                        <p className="text-xs text-muted-foreground">{item.itemType}</p>
                      </TableCell>
                      <TableCell>{item.associatedComponent || 'Airframe'}</TableCell>
                      <TableCell>{lastDoneDisplay}</TableCell>
                      <TableCell>{dueAtDisplay}</TableCell>
                      <TableCell className={`font-semibold ${status.colorClass}`}>{toGo.text}</TableCell>
                      <TableCell className="text-center">
                        <div className={`flex flex-col items-center justify-center ${status.colorClass}`}>
                          {status.icon}
                          <span className="text-xs mt-1">{status.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditTaskModal(item)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


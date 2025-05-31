
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

  // const calculateDisplayFields = useCallback((task: FlowMaintenanceTask): DisplayMaintenanceItem => {
  //   let dueAtDate: string | undefined = undefined;
  //   let dueAtHours: number | undefined = undefined;
  //   let dueAtCycles: number | undefined = undefined;

  //   const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate))
  //     ? parseISO(task.lastCompletedDate)
  //     : new Date(); 
  //   const actualLastCompletedHours = Number(task.lastCompletedHours || 0);
  //   const actualLastCompletedCycles = Number(task.lastCompletedCycles || 0);

  //   if (task.trackType === "Interval") {
  //     if (task.isDaysDueEnabled && task.daysDueValue && task.daysIntervalType) {
  //       const intervalValue = Number(task.daysDueValue);
  //       if (!isNaN(intervalValue) && intervalValue > 0) {
  //         switch (task.daysIntervalType) {
  //           case 'days': dueAtDate = format(addDays(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
  //           case 'months_specific_day': dueAtDate = format(addMonths(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
  //           case 'months_eom': dueAtDate = format(endOfMonth(addMonths(actualLastCompletedDateObj, intervalValue)), 'yyyy-MM-dd'); break;
  //           case 'years_specific_day': dueAtDate = format(addYears(actualLastCompletedDateObj, intervalValue), 'yyyy-MM-dd'); break;
  //         }
  //       }
  //     }
  //     if (task.isHoursDueEnabled && task.hoursDue) {
  //       dueAtHours = actualLastCompletedHours + Number(task.hoursDue);
  //     }
  //     if (task.isCyclesDueEnabled && task.cyclesDue) {
  //       dueAtCycles = actualLastCompletedCycles + Number(task.cyclesDue);
  //     }
  //   } else if (task.trackType === "One Time") {
  //     if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue))) { 
  //       dueAtDate = task.daysDueValue;
  //     }
  //     if (task.isHoursDueEnabled && task.hoursDue) dueAtHours = Number(task.hoursDue);
  //     if (task.isCyclesDueEnabled && task.cyclesDue) dueAtCycles = Number(task.cyclesDue);
  //   }
  //   return { ...task, dueAtDate, dueAtHours, dueAtCycles };
  // }, []);

  // const initializeComponentTimes = useCallback((aircraft: FleetAircraft | null) => {
  //   if (!aircraft) {
  //     setEditableComponentTimes([]);
  //     setOriginalComponentTimes([]);
  //     return;
  //   }
    
  //   const aircraftKeyInMock = aircraft.id || aircraft.tailNumber;
  //   const componentValuesForAircraft = MOCK_COMPONENT_VALUES_DATA[aircraftKeyInMock] || {};
  //   const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
  
  //   const initialTimes = trackedComponents.map(name => {
  //     const trimmedName = name.trim();
  //     const mockDataForComponent = componentValuesForAircraft[trimmedName] || 
  //                                  Object.entries(componentValuesForAircraft)
  //                                        .find(([key, _]) => key.trim() === trimmedName)?.[1];
      
  //     return {
  //       componentName: trimmedName,
  //       currentTime: mockDataForComponent?.time ?? 0,
  //       currentCycles: mockDataForComponent?.cycles ?? 0,
  //     };
  //   });
  
  //   setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimes)));
  //   setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimes)));
  // }, []);


  // const loadMaintenanceTasks = useCallback(async (aircraftId: string) => {
  //   setIsLoadingTasks(true);
  //   try {
  //     const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId });
  //     setMaintenanceTasks(tasksFromDb.map(calculateDisplayFields));
  //   } catch (error) {
  //     console.error("Failed to load maintenance tasks:", error);
  //     toast({ title: "Error", description: "Could not load maintenance tasks.", variant: "destructive" });
  //     setMaintenanceTasks([]);
  //   } finally {
  //     setIsLoadingTasks(false);
  //   }
  // }, [toast, calculateDisplayFields]); // Added calculateDisplayFields dependency

  // useEffect(() => {
  //   const loadAircraftDetails = async () => {
  //     if (!tailNumber) {
  //       setIsLoadingAircraft(false);
  //       return;
  //     }
  //     setIsLoadingAircraft(true);
  //     try {
  //       const fleet = await fetchFleetAircraft();
  //       const foundAircraft = fleet.find(ac => ac.tailNumber === tailNumber);
  //       if (foundAircraft) {
  //         setCurrentAircraft(foundAircraft);
  //         // aircraftInfoForm.reset({
  //         //   model: foundAircraft.model,
  //         //   serialNumber: foundAircraft.serialNumber || '',
  //         //   baseLocation: foundAircraft.baseLocation || '',
  //         //   primaryContactName: foundAircraft.primaryContactName || '',
  //         //   primaryContactPhone: foundAircraft.primaryContactPhone || '',
  //         // });
  //         initializeComponentTimes(foundAircraft);
  //         await loadMaintenanceTasks(foundAircraft.id);
  //       } else {
  //         setCurrentAircraft(null);
  //         setMaintenanceTasks([]);
  //         initializeComponentTimes(null);
  //         toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" });
  //       }
  //     } catch (error) {
  //       console.error("Failed to load aircraft details:", error);
  //       toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" });
  //     } finally {
  //       setIsLoadingAircraft(false);
  //     }
  //   };
  //   loadAircraftDetails();
  // }, [tailNumber, toast, /*aircraftInfoForm,*/ initializeComponentTimes, loadMaintenanceTasks]);

  // const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
  //   const numericValue = parseFloat(value);
  //   if (isNaN(numericValue) && value !== "") return;
  //   setEditableComponentTimes(prev => prev.map(c => c.componentName === componentName ? { ...c, [field]: isNaN(numericValue) ? 0 : numericValue } : c));
  // };

  // const handleSaveComponentTimes = () => {
  //   if (!currentAircraft) return;
  //   startSavingComponentTimesTransition(() => {
  //     const currentAircraftId = currentAircraft.id || currentAircraft.tailNumber;
  //     const newValues: Record<string, { time?: number; cycles?: number }> = {};
  //     editableComponentTimes.forEach(comp => newValues[comp.componentName] = { time: comp.currentTime, cycles: comp.currentCycles });
  //     MOCK_COMPONENT_VALUES_DATA[currentAircraftId] = newValues;
  //     setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes)));
  //     setIsEditingComponentTimes(false);
  //     toast({ title: "Component Times Saved (Mock)", description: `Updated for ${currentAircraftId}.` });
  //   });
  // };

  // const handleCancelEditComponentTimes = () => {
  //   setEditableComponentTimes(JSON.parse(JSON.stringify(originalComponentTimes)));
  //   setIsEditingComponentTimes(false);
  // };

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

  // const handleOpenAddTaskModal = () => {
  //   setEditingTaskOriginalId(null);
  //   setInitialModalFormData(defaultMaintenanceTaskFormValues);
  //   setIsTaskModalOpen(true);
  // };

  // const handleOpenEditTaskModal = (taskToEdit: FlowMaintenanceTask) => {
  //   setEditingTaskOriginalId(taskToEdit.id);
  //   const formData: MaintenanceTaskFormData = {
  //     itemTitle: taskToEdit.itemTitle,
  //     referenceNumber: taskToEdit.referenceNumber || '',
  //     partNumber: taskToEdit.partNumber || '',
  //     serialNumber: taskToEdit.serialNumber || '',
  //     itemType: taskToEdit.itemType,
  //     associatedComponent: taskToEdit.associatedComponent || '',
  //     details: taskToEdit.details || '',
  //     isActive: taskToEdit.isActive,
  //     trackType: taskToEdit.trackType,
  //     isTripsNotAffected: taskToEdit.isTripsNotAffected || false,
  //     lastCompletedDate: taskToEdit.lastCompletedDate || '',
  //     lastCompletedHours: taskToEdit.lastCompletedHours,
  //     lastCompletedCycles: taskToEdit.lastCompletedCycles,
  //     lastCompletedNotes: taskToEdit.lastCompletedNotes || '',
  //     isHoursDueEnabled: taskToEdit.isHoursDueEnabled || false,
  //     hoursDue: taskToEdit.hoursDue,
  //     hoursTolerance: taskToEdit.hoursTolerance,
  //     alertHoursPrior: taskToEdit.alertHoursPrior,
  //     isCyclesDueEnabled: taskToEdit.isCyclesDueEnabled || false,
  //     cyclesDue: taskToEdit.cyclesDue,
  //     cyclesTolerance: taskToEdit.cyclesTolerance,
  //     alertCyclesPrior: taskToEdit.alertCyclesPrior,
  //     isDaysDueEnabled: taskToEdit.isDaysDueEnabled || false,
  //     daysIntervalType: taskToEdit.daysIntervalType || 'days',
  //     daysDueValue: taskToEdit.daysDueValue || '',
  //     daysTolerance: taskToEdit.daysTolerance,
  //     alertDaysPrior: taskToEdit.alertDaysPrior,
  //   };
  //   setInitialModalFormData(formData);
  //   setIsTaskModalOpen(true);
  // };

  // const handleSaveTask = async (taskFormData: MaintenanceTaskFormData) => {
  //   if (!currentAircraft) return;

  //   const taskToSave: FlowMaintenanceTask = {
  //     ...taskFormData,
  //     id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  //     aircraftId: currentAircraft.id,
  //   };

  //   try {
  //     await saveMaintenanceTask(taskToSave);
  //     toast({
  //       title: editingTaskOriginalId ? "Task Updated" : "New Task Added",
  //       description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`,
  //     });
  //     await loadMaintenanceTasks(currentAircraft.id);
  //     setIsTaskModalOpen(false);
  //     setEditingTaskOriginalId(null);
  //     setInitialModalFormData(null);
  //   } catch (error) {
  //     console.error("Failed to save task:", error);
  //     toast({ title: "Error Saving Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
  //   }
  // };

  // const handleDeleteTask = async (taskId: string) => {
  //   if (!currentAircraft) return;
  //   try {
  //     await deleteMaintenanceTask({ taskId });
  //     toast({ title: "Task Deleted", description: `Task ID ${taskId} removed from Firestore.` });
  //     await loadMaintenanceTasks(currentAircraft.id);
  //   } catch (error) {
  //     console.error("Failed to delete task:", error);
  //     toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
  //   }
  // };

  // const calculateToGo = useCallback((item: DisplayMaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  //   const now = new Date();
  
  //   // 1. Date-based due
  //   if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
  //     const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
  //     const daysRemaining = differenceInCalendarDays(dueDate, now);
  //     return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  //   }
  
  //   // 2. Hour or Cycle based due
  //   let currentRelevantTime: number | undefined = undefined;
  //   let currentRelevantCycles: number | undefined = undefined;
  //   let componentNameToUse: string;
  //   let componentUsedForCalcMessage = ""; // For logging/display
  
  //   if (item.associatedComponent && item.associatedComponent.trim() !== "") {
  //     componentNameToUse = item.associatedComponent.trim();
  //   } else {
  //     componentNameToUse = "Airframe"; // Default to Airframe if no component is associated
  //   }
  
  //   // Find current times for the determined component
  //   const currentTimesForComponent = editableComponentTimes.find(c => c.componentName.trim() === componentNameToUse);
  
  //   if (currentTimesForComponent) {
  //     currentRelevantTime = currentTimesForComponent.currentTime;
  //     currentRelevantCycles = currentTimesForComponent.currentCycles;
  //     componentUsedForCalcMessage = componentNameToUse;
  //   } else {
  //     // If the specific component (or default 'Airframe') isn't found in editableComponentTimes, we can't calculate
  //     // This case should ideally not happen if initializeComponentTimes works correctly for all tracked components.
  //     if (item.dueAtHours != null) return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: 'hrs', isOverdue: false };
  //     if (item.dueAtCycles != null) return { text: `N/A (No cycles for ${componentNameToUse})`, numeric: Infinity, unit: 'cycles', isOverdue: false };
  //     return { text: 'N/A (Comp. data missing)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  //   }
    
  //   // Check for Hours Due
  //   if (item.dueAtHours != null && currentRelevantTime !== undefined) {
  //     const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
  //     return { text: `${hoursRemaining} hrs (from ${componentUsedForCalcMessage})`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  //   }
  
  //   // Check for Cycles Due
  //   if (item.dueAtCycles != null && currentRelevantCycles !== undefined) {
  //     const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
  //     return { text: `${cyclesRemaining} cycles (from ${componentUsedForCalcMessage})`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  //   }
    
  //   return { text: 'N/A (Not Date/Hr/Cycle)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  // }, [editableComponentTimes]); // Dependency on editableComponentTimes


  // const getReleaseStatus = (toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
  //   if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (No cycles for') || toGo.text.startsWith('N/A (Comp. data missing')) {
  //     return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
  //   }
  //   if (toGo.isOverdue) return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
  //   if (toGo.unit === 'days' && toGo.numeric < 30) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  //   if (toGo.unit === 'hrs' && toGo.numeric < 25) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  //   if (toGo.unit === 'cycles' && toGo.numeric < 50) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
  //   if (toGo.text === 'N/A (Not Date/Hr/Cycle)' || toGo.text === 'Invalid Date') return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Check Due Info' };
  //   return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
  // };


  // if (isLoadingAircraft) {
  //   return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading aircraft details...</p></div>;
  // }
  // if (!tailNumber || !currentAircraft) {
  //   return <div>{/*<PageHeader title="Aircraft Not Found" icon={Wrench} />*/}<Card><CardContent className="pt-6"><p>Aircraft "{tailNumber || 'Unknown'}" not found.</p><Button asChild variant="outline" className="mt-4"><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></Button></CardContent></Card></div>;
  // }
  // if (!currentAircraft.isMaintenanceTracked) {
  //   return <div>{/*<PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} />*/}<Card className="mb-6"><CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent></Card><Card><CardContent className="pt-6"><p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p><Button asChild variant="outline" className="mt-4"><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></Button></CardContent></Card></div>;
  // }

  // // Placeholder for PageHeader to be re-added later
  // // const pageHeaderTitle = `Maintenance Details for ${currentAircraft.tailNumber}`;
  // // const pageHeaderDescription = `Tracked items & component status for ${currentAircraft.model} (${currentAircraft.tailNumber}).`;

  return (
    <div>
      Hello World - Aircraft Maintenance Detail Page Simplified
      {/* 
      Original Full JSX for PageHeader and the rest of the page content remains commented out.
      It will be restored step-by-step once the basic JS logic above this return statement is confirmed to be error-free.
      
      Example of restoring PageHeader:
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
         ... rest of the card layout ...
      </div>
      */}
    </div>
  );
}

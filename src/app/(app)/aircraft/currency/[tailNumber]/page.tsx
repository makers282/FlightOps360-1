
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
  'N630MW': { 'Airframe': { time: 12540.0, cycles: 8978 }, 'Engine 1': { time: 12471.2, cycles: 9058 }, 'Propeller 1': { time: 245.3, cycles: 88 } },
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

  const aircraftInfoForm = useForm<AircraftInfoEditFormData>({ resolver: zodResolver(aircraftInfoEditSchema) });

  const calculateDisplayFields = (task: FlowMaintenanceTask): DisplayMaintenanceItem => {
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
  };

  const initializeComponentTimes = useCallback((aircraft: FleetAircraft | null) => {
    if (!aircraft) {
      setEditableComponentTimes([]);
      setOriginalComponentTimes([]);
      return;
    }
    const aircraftKeyInMock = aircraft.id || aircraft.tailNumber;
    const componentValuesForAircraft = MOCK_COMPONENT_VALUES_DATA[aircraftKeyInMock] || {};
    const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
    
    const initialTimes = trackedComponents.map(name => ({
      componentName: name,
      currentTime: componentValuesForAircraft[name]?.time ?? 0,
      currentCycles: componentValuesForAircraft[name]?.cycles ?? 0,
    }));
    
    setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimes)));
    setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimes)));
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
  }, [toast]);

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
          await loadMaintenanceTasks(foundAircraft.id); // Load tasks for this aircraft
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
  }, [tailNumber, toast, aircraftInfoForm, initializeComponentTimes, loadMaintenanceTasks]);

  const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return;
    setEditableComponentTimes(prev => prev.map(c => c.componentName === componentName ? { ...c, [field]: isNaN(numericValue) ? 0 : numericValue } : c));
  };

  const handleSaveComponentTimes = () => {
    if (!currentAircraft) return;
    startSavingComponentTimesTransition(() => {
      const currentAircraftId = currentAircraft.id || currentAircraft.tailNumber;
      const newValues: Record<string, { time?: number; cycles?: number }> = {};
      editableComponentTimes.forEach(comp => newValues[comp.componentName] = { time: comp.currentTime, cycles: comp.currentCycles });
      MOCK_COMPONENT_VALUES_DATA[currentAircraftId] = newValues;
      setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes)));
      setIsEditingComponentTimes(false);
      toast({ title: "Component Times Saved (Mock)", description: `Updated for ${currentAircraftId}.` });
    });
  };

  const handleCancelEditComponentTimes = () => {
    setEditableComponentTimes(JSON.parse(JSON.stringify(originalComponentTimes)));
    setIsEditingComponentTimes(false);
  };

  const onSubmitAircraftInfo: SubmitHandler<AircraftInfoEditFormData> = (data) => {
    if (!currentAircraft) return;
    startSavingAircraftInfoTransition(async () => {
      try {
        const updatedAircraftData: FleetAircraft = { ...currentAircraft, ...data };
        await saveFleetAircraft(updatedAircraftData);
        setCurrentAircraft(updatedAircraftData);
        setIsEditingAircraftInfo(false);
        toast({ title: "Success", description: "Aircraft information updated." });
      } catch (error) {
        console.error("Failed to save aircraft info:", error);
        toast({ title: "Error", description: "Could not save aircraft information.", variant: "destructive" });
      }
    });
  };

  const handleOpenAddTaskModal = () => {
    setEditingTaskOriginalId(null);
    setInitialModalFormData(defaultMaintenanceTaskFormValues);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (taskToEdit: FlowMaintenanceTask) => {
    setEditingTaskOriginalId(taskToEdit.id); // This is the Firestore document ID
    const formData: MaintenanceTaskFormData = { // Map FlowMaintenanceTask to MaintenanceTaskFormData
      itemTitle: taskToEdit.itemTitle,
      referenceNumber: taskToEdit.referenceNumber || '',
      partNumber: taskToEdit.partNumber || '',
      serialNumber: taskToEdit.serialNumber || '',
      itemType: taskToEdit.itemType,
      associatedComponent: taskToEdit.associatedComponent || '',
      details: taskToEdit.details || '',
      isActive: taskToEdit.isActive,
      trackType: taskToEdit.trackType,
      isTripsNotAffected: taskToEdit.isTripsNotAffected || false,
      lastCompletedDate: taskToEdit.lastCompletedDate || '',
      lastCompletedHours: taskToEdit.lastCompletedHours,
      lastCompletedCycles: taskToEdit.lastCompletedCycles,
      lastCompletedNotes: taskToEdit.lastCompletedNotes || '',
      isHoursDueEnabled: taskToEdit.isHoursDueEnabled || false,
      hoursDue: taskToEdit.hoursDue,
      hoursTolerance: taskToEdit.hoursTolerance,
      alertHoursPrior: taskToEdit.alertHoursPrior,
      isCyclesDueEnabled: taskToEdit.isCyclesDueEnabled || false,
      cyclesDue: taskToEdit.cyclesDue,
      cyclesTolerance: taskToEdit.cyclesTolerance,
      alertCyclesPrior: taskToEdit.alertCyclesPrior,
      isDaysDueEnabled: taskToEdit.isDaysDueEnabled || false,
      daysIntervalType: taskToEdit.daysIntervalType || 'days',
      daysDueValue: taskToEdit.daysDueValue || '',
      daysTolerance: taskToEdit.daysTolerance,
      alertDaysPrior: taskToEdit.alertDaysPrior,
    };
    setInitialModalFormData(formData);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskFormData: MaintenanceTaskFormData) => {
    if (!currentAircraft) return;

    const taskToSave: FlowMaintenanceTask = {
      ...taskFormData, // Spread the form data
      id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Generate new ID if not editing
      aircraftId: currentAircraft.id, // Associate with current aircraft
    };

    try {
      await saveMaintenanceTask(taskToSave);
      toast({
        title: editingTaskOriginalId ? "Task Updated" : "New Task Added",
        description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`,
      });
      await loadMaintenanceTasks(currentAircraft.id); // Reload tasks
      setIsTaskModalOpen(false);
      setEditingTaskOriginalId(null);
      setInitialModalFormData(null);
    } catch (error) {
      console.error("Failed to save task:", error);
      toast({ title: "Error Saving Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentAircraft) return;
    try {
      await deleteMaintenanceTask({ taskId });
      toast({ title: "Task Deleted", description: `Task ID ${taskId} removed from Firestore.` });
      await loadMaintenanceTasks(currentAircraft.id); // Reload tasks
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };

  const calculateToGo = (item: DisplayMaintenanceItem): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
    const now = new Date();
    const currentAirframeTime = editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentTime ?? 0;
    const currentAirframeCycles = editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentCycles ?? 0;

    if (item.dueAtDate) {
      try {
        const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
        const daysRemaining = differenceInCalendarDays(dueDate, now);
        return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
      } catch (e) { return { text: 'Invalid Date', numeric: Infinity, unit: 'N/A', isOverdue: true }; }
    }
    if (item.dueAtHours != null) {
      const hoursRemaining = parseFloat((item.dueAtHours - currentAirframeTime).toFixed(1));
      return { text: `${hoursRemaining} hrs`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
    }
    if (item.dueAtCycles != null) {
      const cyclesRemaining = item.dueAtCycles - currentAirframeCycles;
      return { text: `${cyclesRemaining} cycles`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
    }
    return { text: 'N/A', numeric: Infinity, unit: 'N/A', isOverdue: false };
  };

  const getReleaseStatus = (toGo: { numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
    if (toGo.isOverdue) return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
    if (toGo.unit === 'days' && toGo.numeric < 30) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'hrs' && toGo.numeric < 25) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'cycles' && toGo.numeric < 50) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.text === 'N/A') return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'N/A' };
    return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
  };


  if (isLoadingAircraft) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading aircraft details...</p></div>;
  }
  if (!tailNumber || !currentAircraft) {
    return <><PageHeader title="Aircraft Not Found" icon={Wrench} /><Card><CardContent className="pt-6"><p>Aircraft "{tailNumber || 'Unknown'}" not found.</p><Button asChild variant="outline" className="mt-4"><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></Button></CardContent></Card></>;
  }
  if (!currentAircraft.isMaintenanceTracked) {
    return <><PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} /><Card className="mb-6"><CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent></Card><Card><CardContent className="pt-6"><p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p><Button asChild variant="outline" className="mt-4"><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></Button></CardContent></Card></>;
  }

  return (
    <>
      <PageHeader
        title={`Maintenance Details for ${currentAircraft.tailNumber}`}
        description={`Tracked items & component status for ${currentAircraft.model} (${currentAircraft.tailNumber}).`}
        icon={Wrench}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></Button>
            <AddMaintenanceTaskModal
              key={editingTaskOriginalId || 'add-new-task'}
              aircraft={currentAircraft}
              onSave={handleSaveTask}
              onDelete={handleDeleteTask}
              isOpen={isTaskModalOpen}
              setIsOpen={setIsTaskModalOpen}
              initialData={initialModalFormData} 
              isEditing={!!editingTaskOriginalId}
              currentTaskId={editingTaskOriginalId}
            >
              <Button className="w-full sm:w-auto" onClick={handleOpenAddTaskModal}><PlusCircle className="mr-2 h-4 w-4" /> Add New Task</Button>
            </AddMaintenanceTaskModal>
          </div>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
           <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex items-center gap-2"><PlaneIcon className="h-6 w-6 text-primary" /><CardTitle>Current Hours & Cycles</CardTitle></div>
            {!isEditingComponentTimes && (<Button variant="outline" size="sm" onClick={() => setIsEditingComponentTimes(true)}><Edit3 className="mr-2 h-4 w-4" /> Edit Times</Button>)}
          </CardHeader>
          <CardContent>
            {editableComponentTimes.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Component</TableHead><TableHead className="text-right">Current Time (hrs)</TableHead><TableHead className="text-right">Current Cycles</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {editableComponentTimes.map((comp) => (
                      <TableRow key={comp.componentName}>
                        <TableCell className="font-medium">{comp.componentName}</TableCell>
                        <TableCell className="text-right">
                          {isEditingComponentTimes ? (<Input type="number" value={comp.currentTime} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentTime', e.target.value)} className="w-24 text-right h-8" step="0.1"/>) : (<span className="tabular-nums">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditingComponentTimes ? (<Input type="number" value={comp.currentCycles} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentCycles', e.target.value)} className="w-24 text-right h-8"/>) : (<span className="tabular-nums">{comp.currentCycles.toLocaleString()}</span>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {isEditingComponentTimes && (
                  <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={handleSaveComponentTimes} size="sm" disabled={isSavingComponentTimes}>{isSavingComponentTimes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Component Times</Button>
                     <Button variant="outline" size="sm" onClick={handleCancelEditComponentTimes} disabled={isSavingComponentTimes}><XCircle className="mr-2 h-4 w-4" /> Cancel</Button>
                  </div>
                )}
              </div>
            ) : (<p className="text-muted-foreground">No specific components configured.</p>)}
          </CardContent>
        </Card>

        <Card className="shadow-lg lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between"><div className="flex items-center gap-2"><InfoIcon className="h-6 w-6 text-primary" /><CardTitle>Aircraft Information</CardTitle></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isEditingAircraftInfo ? (
              <Form {...aircraftInfoForm}>
                <form onSubmit={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} className="space-y-4">
                  <div><span className="text-muted-foreground">Tail Number:</span><span className="font-medium ml-2">{currentAircraft.tailNumber}</span></div>
                  <FormField control={aircraftInfoForm.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="baseLocation" render={({ field }) => (<FormItem><FormLabel>Base Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="primaryContactName" render={({ field }) => (<FormItem><FormLabel>Primary Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="primaryContactPhone" render={({ field }) => (<FormItem><FormLabel>Primary Contact Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={isSavingAircraftInfo}>{isSavingAircraftInfo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Changes</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setIsEditingAircraftInfo(false); aircraftInfoForm.reset({ model: currentAircraft.model, serialNumber: currentAircraft.serialNumber || '', baseLocation: currentAircraft.baseLocation || '', primaryContactName: currentAircraft.primaryContactName || '', primaryContactPhone: currentAircraft.primaryContactPhone || '' }); }}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
                  </div>
                </form>
              </Form>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Tail Number:</span><span className="font-medium">{currentAircraft.tailNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Model:</span><span className="font-medium">{currentAircraft.model}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Serial Number:</span><span className="font-medium">{currentAircraft.serialNumber || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Base Location:</span><span className="font-medium">{currentAircraft.baseLocation || 'N/A'}</span></div>
                {currentAircraft.engineDetails && currentAircraft.engineDetails.length > 0 && (<div><h4 className="font-medium text-muted-foreground mt-2 mb-1">Engine Details:</h4>{currentAircraft.engineDetails.map((engine, idx) => (<div key={idx} className="pl-2 text-xs border-l ml-2 mb-1"><p><strong>Engine {idx + 1} Model:</strong> {engine.model || 'N/A'}</p><p><strong>Engine {idx + 1} S/N:</strong> {engine.serialNumber || 'N/A'}</p></div>))}</div>)}
                {(currentAircraft.primaryContactName || currentAircraft.primaryContactPhone) && (<div className="pt-2 border-t mt-3">{currentAircraft.primaryContactName && (<div className="flex items-center gap-2"><UserCircle className="h-4 w-4 text-muted-foreground" /><span>{currentAircraft.primaryContactName}</span></div>)}{currentAircraft.primaryContactPhone && (<div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{currentAircraft.primaryContactPhone}</span></div>)}</div>)}
                <div className="mt-4 flex justify-end">{!isEditingAircraftInfo && (<Button variant="outline" size="sm" onClick={() => setIsEditingAircraftInfo(true)}><Edit className="mr-2 h-4 w-4" /> Edit Aircraft Info</Button>)}</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle>Tracked Maintenance Items</CardTitle>
          <CardDescription>Detailed list of maintenance items for {currentAircraft.tailNumber}.
            {editableComponentTimes.find(c => c.componentName === 'Airframe') && ` Overall Airframe Time: ${editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs / ${editableComponentTimes.find(c => c.componentName === 'Airframe')?.currentCycles.toLocaleString()} cycles.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTasks ? (
             <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading maintenance tasks...</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Item Description</TableHead><TableHead>Type</TableHead><TableHead className="text-center">Due At</TableHead><TableHead className="text-center">To Go</TableHead><TableHead className="text-center">Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {maintenanceTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No maintenance items tracked for this aircraft. Click "Add New Task" to begin.</TableCell></TableRow>
                ) : (
                  maintenanceTasks.map((item) => {
                    const toGoData = calculateToGo(item);
                    const status = getReleaseStatus(toGoData);
                    let dueAtDisplay = 'N/A', dueType = 'N/A';
                    if (item.dueAtDate) { try { dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy'); dueType = 'Date'; } catch { dueAtDisplay = "Invalid Date"; dueType = 'Date';}} 
                    else if (item.dueAtHours != null) { dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`; dueType = 'Hours'; } 
                    else if (item.dueAtCycles != null) { dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cycles`; dueType = 'Cycles'; }
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{item.itemTitle}</TableCell><TableCell>{dueType}</TableCell><TableCell className="text-center">{dueAtDisplay}</TableCell>
                        <TableCell className={`text-center font-medium ${status.colorClass}`}>{toGoData.text}</TableCell>
                        <TableCell className={`text-center ${status.colorClass}`}><div className="flex flex-col items-center">{status.icon}<span className="text-xs mt-1">{status.label}</span></div></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.details || '-'}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleOpenEditTaskModal(item) }><Edit2 className="h-4 w-4" /><span className="sr-only">Edit Item</span></Button></TableCell>
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

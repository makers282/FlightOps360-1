
"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter
import Link from 'next/link';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { AddMaintenanceTaskModal, type MaintenanceTaskFormData, defaultMaintenanceTaskFormValues } from './components/add-maintenance-task-modal';
import { Badge } from '@/components/ui/badge';

import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Edit, Loader2, InfoIcon, Phone, UserCircle, MapPin, Save, XCircle, Edit2, Edit3, AlertTriangle, CheckCircle2, XCircle as XCircleIcon, Search, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { format, parse, addDays, isValid, addMonths, addYears, endOfMonth, parseISO, differenceInCalendarDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask, deleteMaintenanceTask, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchComponentTimesForAircraft, saveComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { PageHeader } from '@/components/page-header';


export interface DisplayMaintenanceItem extends FlowMaintenanceTask {
  dueAtDate?: string; 
  dueAtHours?: number;
  dueAtCycles?: number;
  toGoData?: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean };
}

const aircraftInfoEditSchema = z.object({
  model: z.string().min(1, "Model is required."),
  serialNumber: z.string().optional(),
  baseLocation: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactPhone: z.string().optional(),
});
type AircraftInfoEditFormData = z.infer<typeof aircraftInfoEditSchema>;

type SortKey = 'itemTitle' | 'toGoNumeric' | 'referenceNumber';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter(); // For back button navigation
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<FlowMaintenanceTask[]>([]); // Store raw tasks
  
  const [editableComponentTimes, setEditableComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);
  const [originalComponentTimes, setOriginalComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);

  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingComponentTimes, setIsLoadingComponentTimes] = useState(true);
  
  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);
  const [isEditingComponentTimes, setIsEditingComponentTimes] = useState(false);
  const [isSavingComponentTimes, startSavingComponentTimesTransition] = useTransition();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskOriginalId, setEditingTaskOriginalId] = useState<string | null>(null);
  const [initialModalFormData, setInitialModalFormData] = useState<Partial<MaintenanceTaskFormData> | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'dueSoon' | 'overdue'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'toGoNumeric', direction: 'ascending' });

  const aircraftInfoForm = useForm<AircraftInfoEditFormData>({ resolver: zodResolver(aircraftInfoEditSchema) });

  const calculateToGo = useCallback((item: DisplayMaintenanceItem, currentComponentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
    const now = new Date();
    if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
      const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    }
    
    let currentRelevantTime: number | undefined = undefined;
    let currentRelevantCycles: number | undefined = undefined;
    
    const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") 
      ? item.associatedComponent.trim() 
      : "Airframe"; 
    
    const timesForComponent = currentComponentTimes.find(c => c.componentName.trim() === componentNameToUse);

    if (timesForComponent) {
      currentRelevantTime = timesForComponent.currentTime;
      currentRelevantCycles = timesForComponent.currentCycles;
    } else {
      if (item.dueAtHours != null) return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: 'hrs', isOverdue: false };
      if (item.dueAtCycles != null) return { text: `N/A (No cycles for ${componentNameToUse})`, numeric: Infinity, unit: 'cycles', isOverdue: false };
      return { text: 'N/A (Comp. data missing)', numeric: Infinity, unit: 'N/A', isOverdue: false };
    }
    
    if (item.dueAtHours != null && currentRelevantTime !== undefined) {
      const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
      return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs (from ${componentNameToUse})`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
    }
  
    if (item.dueAtCycles != null && currentRelevantCycles !== undefined) {
      const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
      return { text: `${cyclesRemaining.toLocaleString()} cycles (from ${componentNameToUse})`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
    }
    
    return { text: 'N/A (Not Date/Hr/Cycle)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  }, []);

  const calculateDisplayFields = useCallback((task: FlowMaintenanceTask, currentComponentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>): DisplayMaintenanceItem => {
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
    const toGoData = calculateToGo({ ...task, dueAtDate, dueAtHours, dueAtCycles }, currentComponentTimes);
    return { ...task, dueAtDate, dueAtHours, dueAtCycles, toGoData };
  }, [calculateToGo]);
  
  const loadAndInitializeComponentTimes = useCallback(async (aircraft: FleetAircraft | null) => {
    if (!aircraft || !aircraft.id) {
      setEditableComponentTimes([]);
      setOriginalComponentTimes([]);
      setIsLoadingComponentTimes(false);
      return;
    }
    setIsLoadingComponentTimes(true);
    try {
      const fetchedTimesMap = await fetchComponentTimesForAircraft({ aircraftId: aircraft.id });
      const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
      
      const initialTimesArray = trackedComponents.map(name => {
        const trimmedName = name.trim();
        const componentData = fetchedTimesMap ? fetchedTimesMap[trimmedName] : null;
        return {
          componentName: trimmedName,
          currentTime: componentData?.time ?? 0,
          currentCycles: componentData?.cycles ?? 0,
        };
      });

      setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimesArray)));
      setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimesArray)));

    } catch (error) {
      console.error(`Failed to load component times for ${aircraft.id}:`, error);
      toast({ title: "Error Loading Component Times", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
      const defaultTimesArray = trackedComponents.map(name => ({
        componentName: name.trim(),
        currentTime: 0,
        currentCycles: 0,
      }));
      setEditableComponentTimes(defaultTimesArray);
      setOriginalComponentTimes(JSON.parse(JSON.stringify(defaultTimesArray)));
    } finally {
      setIsLoadingComponentTimes(false);
    }
  }, [toast]);

  const loadMaintenanceTasks = useCallback(async (aircraftId: string) => {
    setIsLoadingTasks(true);
    try {
      const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId });
      setMaintenanceTasks(tasksFromDb); // Store raw tasks
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
          await loadAndInitializeComponentTimes(foundAircraft); 
          await loadMaintenanceTasks(foundAircraft.id);
        } else {
          setCurrentAircraft(null);
          setMaintenanceTasks([]);
          await loadAndInitializeComponentTimes(null);
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
  }, [tailNumber, toast, aircraftInfoForm, loadAndInitializeComponentTimes, loadMaintenanceTasks]);

  const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== "") return; 
    setEditableComponentTimes(prev => 
        prev.map(c => 
            c.componentName === componentName 
            ? { ...c, [field]: isNaN(numericValue) ? 0 : numericValue } 
            : c
        )
    );
  };

  const handleSaveComponentTimes = () => {
    if (!currentAircraft || !currentAircraft.id) return;
    startSavingComponentTimesTransition(async () => {
      const componentTimesMap: AircraftComponentTimes = {};
      editableComponentTimes.forEach(comp => {
        componentTimesMap[comp.componentName] = {
          time: comp.currentTime,
          cycles: comp.currentCycles,
        };
      });
      
      try {
        await saveComponentTimesForAircraft({ aircraftId: currentAircraft.id, componentTimes: componentTimesMap });
        setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes)));
        setIsEditingComponentTimes(false);
        toast({ title: "Component Times Saved", description: `Updated for ${currentAircraft.tailNumber} in Firestore.` });
      } catch (error) {
        console.error("Failed to save component times:", error);
        toast({ title: "Error Saving Component Times", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
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
        const updatedAircraftData: FleetAircraft = { 
          ...currentAircraft, 
          ...data,
          isMaintenanceTracked: currentAircraft.isMaintenanceTracked,
          trackedComponentNames: currentAircraft.trackedComponentNames,
          engineDetails: currentAircraft.engineDetails,
        };
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
    setEditingTaskOriginalId(taskToEdit.id); 
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
      ...taskFormData,
      id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`, 
      aircraftId: currentAircraft.id, 
    };
    try {
      await saveMaintenanceTask(taskToSave);
      toast({
        title: editingTaskOriginalId ? "Task Updated" : "New Task Added",
        description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`,
      });
      await loadMaintenanceTasks(currentAircraft.id); 
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
      await loadMaintenanceTasks(currentAircraft.id); 
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    }
  };
  
  const formatTaskFrequency = (task: FlowMaintenanceTask): string => {
    if (task.trackType === "Dont Alert") return "Not Tracked";
    if (task.trackType === "One Time") return "One Time";

    const frequencies = [];
    if (task.isHoursDueEnabled && task.hoursDue) {
      frequencies.push(`${task.hoursDue.toLocaleString()} hrs`);
    }
    if (task.isCyclesDueEnabled && task.cyclesDue) {
      frequencies.push(`${task.cyclesDue.toLocaleString()} cyc`);
    }
    if (task.isDaysDueEnabled && task.daysDueValue) {
        const numVal = Number(task.daysDueValue);
        let unit = '';
        switch(task.daysIntervalType) {
            case 'days': unit = 'days'; break;
            case 'months_specific_day': 
            case 'months_eom': unit = 'months'; break;
            case 'years_specific_day': unit = 'years'; break;
            default: unit = task.daysIntervalType || 'days';
        }
        frequencies.push(`${numVal} ${unit}`);
    }
    return frequencies.length > 0 ? frequencies.join(' / ') : 'N/A';
  };

  const getReleaseStatus = (toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }): { icon: JSX.Element; colorClass: string; label: string } => {
    if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (No cycles for') || toGo.text.startsWith('N/A (Comp. data missing')) {
      return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
    }
    if (toGo.isOverdue) return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500', label: 'Overdue' };
    
    const daysAlertThreshold = 30;
    const hoursAlertThreshold = 25;
    const cyclesAlertThreshold = 50;

    if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500', label: 'Due Soon' };
    
    if (toGo.text === 'N/A (Not Date/Hr/Cycle)' || toGo.text === 'Invalid Date') return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Check Due Info' };
    return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500', label: 'OK' };
  };

  const displayedTasks = useMemo(() => {
    if (isLoadingComponentTimes) return []; // Don't process until component times are loaded

    let filtered = maintenanceTasks.map(task => calculateDisplayFields(task, editableComponentTimes));

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.itemTitle.toLowerCase().includes(lowerSearchTerm) ||
        (task.referenceNumber && task.referenceNumber.toLowerCase().includes(lowerSearchTerm)) ||
        task.itemType.toLowerCase().includes(lowerSearchTerm) ||
        (task.associatedComponent && task.associatedComponent.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => {
        if (statusFilter === 'active') return task.isActive;
        if (statusFilter === 'inactive') return !task.isActive;
        if (!task.isActive) return false; // Further status filters only apply to active tasks

        const status = getReleaseStatus(task.toGoData!);
        if (statusFilter === 'overdue') return status.label === 'Overdue';
        if (statusFilter === 'dueSoon') return status.label === 'Due Soon';
        return true;
      });
    }
    
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: string | number | undefined;
        let bValue: string | number | undefined;

        if (sortConfig.key === 'toGoNumeric') {
          aValue = a.toGoData?.numeric;
          bValue = b.toGoData?.numeric;
        } else {
          aValue = a[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined;
          bValue = b[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined;
        }

        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
          return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }

    return filtered;
  }, [maintenanceTasks, searchTerm, statusFilter, sortConfig, calculateDisplayFields, editableComponentTimes, isLoadingComponentTimes]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };


  if (isLoadingAircraft || isLoadingComponentTimes) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading aircraft details & component times...</p></div>;
  }
  if (!tailNumber || !currentAircraft) {
    return (
      <div>
        <PageHeader 
          title="Aircraft Not Found" 
          icon={Wrench} 
          actions={
            <Button asChild variant="outline">
              <Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <p>Aircraft "{tailNumber || 'Unknown'}" not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!currentAircraft.isMaintenanceTracked) {
     return (
        <div>
            <PageHeader 
                title={`Data for ${currentAircraft.tailNumber}`} 
                icon={PlaneIcon}
                actions={
                    <Button asChild variant="outline">
                      <Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link>
                    </Button>
                }
            />
            <Card className="mb-6">
                <CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  const pageHeaderTitle = `Maintenance Details for ${currentAircraft.tailNumber}`;
  const pageHeaderDescription = `Tracked items & component status for ${currentAircraft.model} (${currentAircraft.tailNumber}). Component times are loaded from Firestore.`;

  return (
    <div>
      <PageHeader
        title={pageHeaderTitle}
        description={pageHeaderDescription}
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
                <Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link>
            </Button>
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
          </div>
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
                <p className="text-sm text-muted-foreground">No components configured for time tracking. Update in Company Settings or component data not yet loaded.</p>
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
              {!isEditingAircraftInfo ? (
                <Button variant="outline" size="icon" onClick={() => setIsEditingAircraftInfo(true)} disabled={isSavingAircraftInfo}>
                  <Edit className="h-4 w-4" /><span className="sr-only">Edit Aircraft Info</span>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setIsEditingAircraftInfo(false); aircraftInfoForm.reset({ model: currentAircraft.model, serialNumber: currentAircraft.serialNumber || '', baseLocation: currentAircraft.baseLocation || '', primaryContactName: currentAircraft.primaryContactName || '', primaryContactPhone: currentAircraft.primaryContactPhone || '' }); }} disabled={isSavingAircraftInfo}>
                    <XCircle className="h-4 w-4" /><span className="sr-only">Cancel</span>
                  </Button>
                  <Button size="icon" onClick={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} disabled={isSavingAircraftInfo}>
                    {isSavingAircraftInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="sr-only">Save Info</span>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingAircraftInfo ? (
              <Form {...aircraftInfoForm}>
                <form onSubmit={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} className="space-y-4">
                  <FormField control={aircraftInfoForm.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="baseLocation" render={({ field }) => (<FormItem><FormLabel>Base Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="primaryContactName" render={({ field }) => (<FormItem><FormLabel>Primary Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={aircraftInfoForm.control} name="primaryContactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </form>
              </Form>
            ) : (
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
            )}
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
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tasks (title, ref, type, component)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
              {searchTerm && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setSearchTerm('')}>
                    <XCircleIcon className="h-4 w-4"/>
                </Button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="active">Active Items</SelectItem>
                <SelectItem value="inactive">Inactive Items</SelectItem>
                <SelectItem value="dueSoon">Due Soon (Active)</SelectItem>
                <SelectItem value="overdue">Overdue (Active)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTasks ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading maintenance tasks...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref #</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => requestSort('itemTitle')} className="px-1 -ml-2">
                        Title {getSortIcon('itemTitle')}
                    </Button>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Last Done</TableHead>
                  <TableHead>Due At</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => requestSort('toGoNumeric')} className="px-1 -ml-2">
                        To Go {getSortIcon('toGoNumeric')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      No maintenance tasks match your criteria. 
                      <Button variant="link" className="p-0 ml-1" onClick={handleOpenAddTaskModal}>Add one now?</Button>
                    </TableCell>
                  </TableRow>
                )}
                {displayedTasks.map((item) => {
                  const status = getReleaseStatus(item.toGoData!);
                  const frequency = formatTaskFrequency(item);
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
                      <TableCell className="text-xs text-muted-foreground">{item.referenceNumber || '-'}</TableCell>
                      <TableCell className="font-medium">
                        {item.itemTitle}
                        {!item.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{item.itemType}</TableCell>
                      <TableCell className="text-xs">{item.associatedComponent || 'Airframe'}</TableCell>
                      <TableCell className="text-xs">{frequency}</TableCell>
                      <TableCell className="text-xs">{lastDoneDisplay}</TableCell>
                      <TableCell className="text-xs">{dueAtDisplay}</TableCell>
                      <TableCell className={`font-semibold text-xs ${item.toGoData?.isOverdue ? 'text-red-600' : (item.toGoData?.unit === 'days' && item.toGoData?.numeric < 30) || (item.toGoData?.unit === 'hrs' && item.toGoData?.numeric < 25) || (item.toGoData?.unit === 'cycles' && item.toGoData?.numeric < 50) ? 'text-yellow-600' : 'text-green-600'}`}>{item.toGoData?.text}</TableCell>
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


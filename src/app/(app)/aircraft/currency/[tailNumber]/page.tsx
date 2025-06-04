

"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { AddMaintenanceTaskDialogContent, type MaintenanceTaskFormData, defaultMaintenanceTaskFormValues } from './components/add-maintenance-task-modal';
import { AddEditAircraftDiscrepancyModal, type AircraftDiscrepancyFormData, defaultDiscrepancyFormValues } from './components/add-edit-aircraft-discrepancy-modal';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; 

import { Wrench, PlusCircle, ArrowLeft, PlaneIcon, Edit, Loader2, InfoIcon, Phone, UserCircle, MapPin, Save, XCircle, Edit2, Edit3, AlertTriangle, CheckCircle2, XCircle as XCircleIcon, Search, ArrowUpDown, ArrowDown, ArrowUp, Printer, Filter } from 'lucide-react';
import { format, parse, addDays, isValid, addMonths, addYears, endOfMonth, parseISO, differenceInCalendarDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchFleetAircraft, saveFleetAircraft } from '@/ai/flows/manage-fleet-flow';
import type { FleetAircraft, SaveFleetAircraftInput } from '@/ai/schemas/fleet-aircraft-schemas';
import { fetchMaintenanceTasksForAircraft, saveMaintenanceTask, deleteMaintenanceTask, type MaintenanceTask as FlowMaintenanceTask } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchComponentTimesForAircraft, saveComponentTimesForAircraft, type AircraftComponentTimes } from '@/ai/flows/manage-component-times-flow';
import { fetchCompanyProfile, type CompanyProfile } from '@/ai/flows/manage-company-profile-flow';
import { PageHeader } from '@/components/page-header';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchAircraftDiscrepancies, saveAircraftDiscrepancy, deleteAircraftDiscrepancy } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import type { AircraftDiscrepancy, SaveAircraftDiscrepancyInput } from '@/ai/schemas/aircraft-discrepancy-schemas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogModalContent,
  AlertDialogDescription as AlertDialogModalDescription,
  AlertDialogFooter as AlertDialogModalFooter,
  AlertDialogHeader as AlertDialogModalHeader,
  AlertDialogTitle as AlertDialogModalTitle,
} from "@/components/ui/alert-dialog";


export interface DisplayMaintenanceItem extends FlowMaintenanceTask {
  dueAtDate?: string; 
  dueAtHours?: number;
  dueAtCycles?: number;
  toGoData?: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean };
}

const aircraftInfoEditSchema = z.object({
  model: z.string().min(1, "Aircraft model is required."),
  aircraftYear: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 10).optional(),
  baseLocation: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactPhone: z.string().optional(),
  primaryContactEmail: z.string().email("Invalid email format.").optional().or(z.literal('')),
  internalNotes: z.string().optional(),
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
  const router = useRouter(); 
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<FlowMaintenanceTask[]>([]); 
  const [aircraftDiscrepancies, setAircraftDiscrepancies] = useState<AircraftDiscrepancy[]>([]);
  
  const [editableComponentTimes, setEditableComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);
  const [originalComponentTimes, setOriginalComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);

  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingDiscrepancies, setIsLoadingDiscrepancies] = useState(true);
  const [isLoadingComponentTimes, setIsLoadingComponentTimes] = useState(true);
  
  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);
  const [isEditingComponentTimes, setIsEditingComponentTimes] = useState(false);
  const [isSavingComponentTimes, startSavingComponentTimesTransition] = useTransition();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskOriginalId, setEditingTaskOriginalId] = useState<string | null>(null);
  const [initialModalFormData, setInitialModalFormData] = useState<Partial<MaintenanceTaskFormData> | null>(null);

  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);
  const [editingDiscrepancyId, setEditingDiscrepancyId] = useState<string | null>(null);
  const [initialDiscrepancyModalData, setInitialDiscrepancyModalData] = useState<Partial<AircraftDiscrepancyFormData> | null>(null);
  const [isSavingDiscrepancy, startSavingDiscrepancyTransition] = useTransition();
  const [discrepancyToDelete, setDiscrepancyToDelete] = useState<AircraftDiscrepancy | null>(null);
  const [showDeleteDiscrepancyConfirm, setShowDeleteDiscrepancyConfirm] = useState(false);
  const [isDeletingDiscrepancy, startDeletingDiscrepancyTransition] = useTransition();


  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'dueSoon' | 'overdue' | 'gracePeriod'>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'toGoNumeric', direction: 'ascending' });

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isGeneratingReport, startReportGenerationTransition] = useTransition();
  
  const aircraftInfoForm = useForm<AircraftInfoEditFormData>({
    resolver: zodResolver(aircraftInfoEditSchema),
    defaultValues: {
      model: '', aircraftYear: undefined, baseLocation: '',
      primaryContactName: '', primaryContactPhone: '', primaryContactEmail: '', internalNotes: '',
    },
  });

  const resetAircraftInfoForm = useCallback((aircraft: FleetAircraft | null) => {
    if (aircraft) {
      aircraftInfoForm.reset({
        model: aircraft.model || '', aircraftYear: aircraft.aircraftYear || undefined,
        baseLocation: aircraft.baseLocation || '', primaryContactName: aircraft.primaryContactName || '',
        primaryContactPhone: aircraft.primaryContactPhone || '', primaryContactEmail: aircraft.primaryContactEmail || '',
        internalNotes: aircraft.internalNotes || '',
      });
    } else { aircraftInfoForm.reset({ model: '', aircraftYear: undefined, baseLocation: '', primaryContactName: '', primaryContactPhone: '', primaryContactEmail: '', internalNotes: '', }); }
  }, [aircraftInfoForm]);


  const calculateToGo = useCallback((item: DisplayMaintenanceItem, currentComponentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
    const now = new Date();
    if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
      const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
      const daysRemaining = differenceInCalendarDays(dueDate, now);
      return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
    }
    let currentRelevantTime: number | undefined = undefined, currentRelevantCycles: number | undefined = undefined;
    const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") ? item.associatedComponent.trim() : "Airframe"; 
    const timesForComponent = currentComponentTimes.find(c => c.componentName.trim() === componentNameToUse);
    if (timesForComponent) { currentRelevantTime = timesForComponent.currentTime; currentRelevantCycles = timesForComponent.currentCycles; } 
    else {
      if (item.dueAtHours != null) return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: 'hrs', isOverdue: false };
      if (item.dueAtCycles != null) return { text: `N/A (No cycles for ${componentNameToUse})`, numeric: Infinity, unit: 'cycles', isOverdue: false };
      return { text: 'N/A (Comp. data missing)', numeric: Infinity, unit: 'N/A', isOverdue: false };
    }
    if (item.dueAtHours != null && currentRelevantTime !== undefined) { const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1)); return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs (from ${componentNameToUse})`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 }; }
    if (item.dueAtCycles != null && currentRelevantCycles !== undefined) { const cyclesRemaining = item.dueAtCycles - currentRelevantCycles; return { text: `${cyclesRemaining.toLocaleString()} cycles (from ${componentNameToUse})`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 }; }
    return { text: 'N/A (Not Date/Hr/Cycle)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  }, []);

  const calculateDisplayFields = useCallback((task: FlowMaintenanceTask, currentComponentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>): DisplayMaintenanceItem => {
    let dueAtDate: string | undefined = undefined, dueAtHours: number | undefined = undefined, dueAtCycles: number | undefined = undefined;
    const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate)) ? parseISO(task.lastCompletedDate) : new Date(); 
    const actualLastCompletedHours = Number(task.lastCompletedHours || 0); const actualLastCompletedCycles = Number(task.lastCompletedCycles || 0);
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
      if (task.isHoursDueEnabled && task.hoursDue) { dueAtHours = actualLastCompletedHours + Number(task.hoursDue); }
      if (task.isCyclesDueEnabled && task.cyclesDue) { dueAtCycles = actualLastCompletedCycles + Number(task.cyclesDue); }
    } else if (task.trackType === "One Time") {
      if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue))) {  dueAtDate = task.daysDueValue; }
      if (task.isHoursDueEnabled && task.hoursDue) dueAtHours = Number(task.hoursDue);
      if (task.isCyclesDueEnabled && task.cyclesDue) dueAtCycles = Number(task.cyclesDue);
    }
    const toGoData = calculateToGo({ ...task, dueAtDate, dueAtHours, dueAtCycles }, currentComponentTimes);
    return { ...task, dueAtDate, dueAtHours, dueAtCycles, toGoData };
  }, [calculateToGo]);
  
  const loadAndInitializeComponentTimes = useCallback(async (aircraft: FleetAircraft | null) => {
    if (!aircraft || !aircraft.id) { setEditableComponentTimes([]); setOriginalComponentTimes([]); setIsLoadingComponentTimes(false); return; }
    setIsLoadingComponentTimes(true);
    try {
      const fetchedTimesMap = await fetchComponentTimesForAircraft({ aircraftId: aircraft.id });
      const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
      const initialTimesArray = trackedComponents.map(name => { const trimmedName = name.trim(); const componentData = fetchedTimesMap ? fetchedTimesMap[trimmedName] : null; return { componentName: trimmedName, currentTime: componentData?.time ?? 0, currentCycles: componentData?.cycles ?? 0, }; });
      setEditableComponentTimes(JSON.parse(JSON.stringify(initialTimesArray))); setOriginalComponentTimes(JSON.parse(JSON.stringify(initialTimesArray)));
    } catch (error) {
      console.error(`Failed to load component times for ${aircraft.id}:`, error);
      toast({ title: "Error Loading Component Times", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      const trackedComponents = aircraft.trackedComponentNames || ['Airframe', 'Engine 1'];
      const defaultTimesArray = trackedComponents.map(name => ({ componentName: name.trim(), currentTime: 0, currentCycles: 0, }));
      setEditableComponentTimes(defaultTimesArray); setOriginalComponentTimes(JSON.parse(JSON.stringify(defaultTimesArray)));
    } finally { setIsLoadingComponentTimes(false); }
  }, [toast]);

  const loadMaintenanceTasks = useCallback(async (aircraftId: string) => {
    setIsLoadingTasks(true);
    try { const tasksFromDb = await fetchMaintenanceTasksForAircraft({ aircraftId }); setMaintenanceTasks(tasksFromDb);  } 
    catch (error) { console.error("Failed to load maintenance tasks:", error); toast({ title: "Error", description: "Could not load maintenance tasks.", variant: "destructive" }); setMaintenanceTasks([]); } 
    finally { setIsLoadingTasks(false); }
  }, [toast]);

  const loadAircraftDiscrepancies = useCallback(async (aircraftId: string) => {
    setIsLoadingDiscrepancies(true);
    try { const discrepanciesFromDb = await fetchAircraftDiscrepancies({ aircraftId }); setAircraftDiscrepancies(discrepanciesFromDb); } 
    catch (error) { console.error("Failed to load aircraft discrepancies:", error); toast({ title: "Error", description: "Could not load aircraft discrepancies.", variant: "destructive" }); setAircraftDiscrepancies([]); } 
    finally { setIsLoadingDiscrepancies(false); }
  }, [toast]);

  useEffect(() => {
    const loadAircraftDetails = async () => {
      if (!tailNumber) { setIsLoadingAircraft(false); return; }
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        const foundAircraft = fleet.find(ac => ac.tailNumber === tailNumber);
        if (foundAircraft) { setCurrentAircraft(foundAircraft); resetAircraftInfoForm(foundAircraft); await loadAndInitializeComponentTimes(foundAircraft); await loadMaintenanceTasks(foundAircraft.id); await loadAircraftDiscrepancies(foundAircraft.id); } 
        else { setCurrentAircraft(null); setMaintenanceTasks([]); await loadAndInitializeComponentTimes(null); setAircraftDiscrepancies([]); toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" }); }
      } catch (error) { console.error("Failed to load aircraft details:", error); toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" }); } 
      finally { setIsLoadingAircraft(false); }
    };
    loadAircraftDetails();
  }, [tailNumber, toast, loadAndInitializeComponentTimes, loadMaintenanceTasks, loadAircraftDiscrepancies, resetAircraftInfoForm]);

  const handleComponentTimeChange = (componentName: string, field: 'currentTime' | 'currentCycles', value: string) => {
    const numericValue = parseFloat(value); if (isNaN(numericValue) && value !== "") return;  setEditableComponentTimes(prev => prev.map(c => c.componentName === componentName ? { ...c, [field]: isNaN(numericValue) ? 0 : numericValue } : c ) );
  };

  const handleSaveComponentTimes = () => {
    if (!currentAircraft || !currentAircraft.id) return;
    startSavingComponentTimesTransition(async () => {
      const componentTimesMap: AircraftComponentTimes = {}; editableComponentTimes.forEach(comp => { componentTimesMap[comp.componentName] = { time: comp.currentTime, cycles: comp.currentCycles, }; });
      try { await saveComponentTimesForAircraft({ aircraftId: currentAircraft.id, componentTimes: componentTimesMap }); setOriginalComponentTimes(JSON.parse(JSON.stringify(editableComponentTimes))); setIsEditingComponentTimes(false); toast({ title: "Component Times Saved", description: `Updated for ${currentAircraft.tailNumber} in Firestore.` }); } 
      catch (error) { console.error("Failed to save component times:", error); toast({ title: "Error Saving Component Times", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
    });
  };

  const handleCancelEditComponentTimes = () => { setEditableComponentTimes(JSON.parse(JSON.stringify(originalComponentTimes))); setIsEditingComponentTimes(false); };
  const onSubmitAircraftInfo: SubmitHandler<AircraftInfoEditFormData> = (data) => {
    if (!currentAircraft) return;
    startSavingAircraftInfoTransition(async () => {
      const aircraftToSave: SaveFleetAircraftInput = { ...currentAircraft, model: data.model, aircraftYear: data.aircraftYear, baseLocation: data.baseLocation, primaryContactName: data.primaryContactName, primaryContactPhone: data.primaryContactPhone, primaryContactEmail: data.primaryContactEmail, internalNotes: data.internalNotes, };
      try { const savedData = await saveFleetAircraft(aircraftToSave); setCurrentAircraft(savedData); setIsEditingAircraftInfo(false); toast({ title: "Aircraft Info Saved", description: `Details for ${savedData.tailNumber} updated.` }); } 
      catch (error) { console.error("Failed to save aircraft info:", error); toast({ title: "Error Saving Aircraft Info", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
    });
  };

  const handleOpenAddTaskModal = () => { 
    setEditingTaskOriginalId(null); 
    setInitialModalFormData(defaultMaintenanceTaskFormValues); 
    setIsTaskModalOpen(true); 
  };
  const handleOpenEditTaskModal = (taskToEdit: FlowMaintenanceTask) => {
    setEditingTaskOriginalId(taskToEdit.id); 
    const formData: MaintenanceTaskFormData = { itemTitle: taskToEdit.itemTitle, referenceNumber: taskToEdit.referenceNumber || '', partNumber: taskToEdit.partNumber || '', serialNumber: taskToEdit.serialNumber || '', itemType: taskToEdit.itemType, associatedComponent: taskToEdit.associatedComponent || '', details: taskToEdit.details || '', isActive: taskToEdit.isActive, trackType: taskToEdit.trackType, isTripsNotAffected: taskToEdit.isTripsNotAffected || false,  lastCompletedDate: taskToEdit.lastCompletedDate || '',  lastCompletedHours: taskToEdit.lastCompletedHours,  lastCompletedCycles: taskToEdit.lastCompletedCycles,  lastCompletedNotes: taskToEdit.lastCompletedNotes || '',  isHoursDueEnabled: taskToEdit.isHoursDueEnabled || false, hoursDue: taskToEdit.hoursDue, hoursTolerance: taskToEdit.hoursTolerance, alertHoursPrior: taskToEdit.alertHoursPrior, isCyclesDueEnabled: taskToEdit.isCyclesDueEnabled || false, cyclesDue: taskToEdit.cyclesDue, cyclesTolerance: taskToEdit.cyclesTolerance, alertCyclesPrior: taskToEdit.alertCyclesPrior, isDaysDueEnabled: taskToEdit.isDaysDueEnabled || false, daysIntervalType: taskToEdit.daysIntervalType || 'days',  daysDueValue: taskToEdit.daysDueValue || '',  daysTolerance: taskToEdit.daysTolerance, alertDaysPrior: taskToEdit.alertDaysPrior, };
    setInitialModalFormData(formData); setIsTaskModalOpen(true);
  };
  const handleSaveTask = async (taskFormData: MaintenanceTaskFormData) => {
    if (!currentAircraft) return;
    const taskToSave: FlowMaintenanceTask = { ...taskFormData, id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`,  aircraftId: currentAircraft.id,  };
    try { await saveMaintenanceTask(taskToSave); toast({ title: editingTaskOriginalId ? "Task Updated" : "New Task Added", description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`, }); await loadMaintenanceTasks(currentAircraft.id); setIsTaskModalOpen(false); setEditingTaskOriginalId(null); setInitialModalFormData(null); } 
    catch (error) { console.error("Failed to save task:", error); toast({ title: "Error Saving Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
  };
  const handleDeleteTask = async (taskId: string) => {
    if (!currentAircraft) return; 
    try { await deleteMaintenanceTask({ taskId }); toast({ title: "Task Deleted", description: `Task ID ${taskId} removed from Firestore.` }); await loadMaintenanceTasks(currentAircraft.id); setIsTaskModalOpen(false); } 
    catch (error) { console.error("Failed to delete task:", error); toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
  };

  const handleOpenAddDiscrepancyModal = () => { setEditingDiscrepancyId(null); setInitialDiscrepancyModalData(defaultDiscrepancyFormValues); setIsDiscrepancyModalOpen(true); };
  const handleOpenEditDiscrepancyModal = (discrepancy: AircraftDiscrepancy) => {
    setEditingDiscrepancyId(discrepancy.id);
    const formData: AircraftDiscrepancyFormData = {
        status: discrepancy.status,
        dateDiscovered: discrepancy.dateDiscovered && isValid(parseISO(discrepancy.dateDiscovered)) ? parseISO(discrepancy.dateDiscovered) : new Date(),
        timeDiscovered: discrepancy.timeDiscovered || "",
        description: discrepancy.description,
        discoveredBy: discrepancy.discoveredBy || "",
        discoveredByCertNumber: discrepancy.discoveredByCertNumber || "",
        isDeferred: discrepancy.isDeferred || false,
        deferralReference: discrepancy.deferralReference || "",
        deferralDate: discrepancy.deferralDate && isValid(parseISO(discrepancy.deferralDate)) ? parseISO(discrepancy.deferralDate) : undefined,
        correctiveAction: discrepancy.correctiveAction || "",
        dateCorrected: discrepancy.dateCorrected && isValid(parseISO(discrepancy.dateCorrected)) ? parseISO(discrepancy.dateCorrected) : undefined,
        correctedBy: discrepancy.correctedBy || "",
        correctedByCertNumber: discrepancy.correctedByCertNumber || "",
    };
    setInitialDiscrepancyModalData(formData);
    setIsDiscrepancyModalOpen(true);
  };
  const handleSaveDiscrepancy = async (discrepancyFormData: SaveAircraftDiscrepancyInput, originalId?: string) => {
    if (!currentAircraft) return;
    startSavingDiscrepancyTransition(async () => {
      try {
        await saveAircraftDiscrepancy({ ...discrepancyFormData, id: originalId });
        toast({ title: editingDiscrepancyId ? "Discrepancy Updated" : "New Discrepancy Added", description: `Discrepancy for ${currentAircraft.tailNumber} saved.` });
        await loadAircraftDiscrepancies(currentAircraft.id);
        setIsDiscrepancyModalOpen(false);
      } catch (error) { console.error("Failed to save discrepancy:", error); toast({ title: "Error Saving Discrepancy", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
    });
  };
  const confirmDeleteDiscrepancy = (discrepancy: AircraftDiscrepancy) => { setDiscrepancyToDelete(discrepancy); setShowDeleteDiscrepancyConfirm(true); };
  const executeDeleteDiscrepancy = async () => {
    if (!discrepancyToDelete || !currentAircraft) return;
    startDeletingDiscrepancyTransition(async () => {
      try {
        await deleteAircraftDiscrepancy({ discrepancyId: discrepancyToDelete.id });
        toast({ title: "Discrepancy Deleted", description: `Discrepancy ID ${discrepancyToDelete.id} removed.` });
        await loadAircraftDiscrepancies(currentAircraft.id);
      } catch (error) { console.error("Failed to delete discrepancy:", error); toast({ title: "Error Deleting Discrepancy", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); } 
      finally { setShowDeleteDiscrepancyConfirm(false); setDiscrepancyToDelete(null); }
    });
  };


  const formatTaskFrequency = (task: FlowMaintenanceTask): string => {
    if (task.trackType === "Dont Alert") return "Not Tracked"; if (task.trackType === "One Time") return "One Time";
    const frequencies = [];
    if (task.isHoursDueEnabled && task.hoursDue) { frequencies.push(`${task.hoursDue.toLocaleString()} hrs`); }
    if (task.isCyclesDueEnabled && task.cyclesDue) { frequencies.push(`${task.cyclesDue.toLocaleString()} cyc`); }
    if (task.isDaysDueEnabled && task.daysDueValue) { const numVal = Number(task.daysDueValue); let unit = ''; switch(task.daysIntervalType) { case 'days': unit = 'days'; break; case 'months_specific_day': case 'months_eom': unit = 'months'; break; case 'years_specific_day': unit = 'years'; break; default: unit = task.daysIntervalType || 'days'; } frequencies.push(`${numVal} ${unit}`); }
    return frequencies.length > 0 ? frequencies.join(' / ') : 'N/A';
  };
  const getReleaseStatus = (toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean }, task: DisplayMaintenanceItem ): { icon: JSX.Element; colorClass: string; label: string } => {
    if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (No cycles for') || toGo.text.startsWith('N/A (Comp. data missing')) { return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' }; }
    if (toGo.isOverdue) { let withinGrace = false; const numericOverdueAmount = Math.abs(toGo.numeric); if (toGo.unit === 'days' && typeof task.daysTolerance === 'number' && numericOverdueAmount <= task.daysTolerance) { withinGrace = true; } else if (toGo.unit === 'hrs' && typeof task.hoursTolerance === 'number' && numericOverdueAmount <= task.hoursTolerance) { withinGrace = true; } else if (toGo.unit === 'cycles' && typeof task.cyclesTolerance === 'number' && numericOverdueAmount <= task.cyclesTolerance) { withinGrace = true; } if (withinGrace) { return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-600 dark:text-yellow-500', label: 'Grace Period' }; } return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Overdue' }; }
    const daysAlertThreshold = task.alertDaysPrior ?? 30; const hoursAlertThreshold = task.alertHoursPrior ?? 25; const cyclesAlertThreshold = task.alertCyclesPrior ?? 50;
    if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
    if (toGo.text === 'N/A (Not Date/Hr/Cycle)' || toGo.text === 'Invalid Date') return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Check Due Info' };
    return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500 dark:text-green-400', label: 'OK' };
  };

  const availableComponentsForFilter = useMemo(() => { const uniqueComponents = new Set<string>(); maintenanceTasks.forEach(task => { if (task.associatedComponent && task.associatedComponent.trim() !== "") { uniqueComponents.add(task.associatedComponent.trim()); } else { uniqueComponents.add("Airframe"); } }); return Array.from(uniqueComponents).sort(); }, [maintenanceTasks]);
  const displayedTasks = useMemo(() => {
    if (isLoadingComponentTimes) return []; let filtered = maintenanceTasks.map(task => calculateDisplayFields(task, editableComponentTimes));
    if (searchTerm) { const lowerSearchTerm = searchTerm.toLowerCase(); filtered = filtered.filter(task => task.itemTitle.toLowerCase().includes(lowerSearchTerm) || (task.referenceNumber && task.referenceNumber.toLowerCase().includes(lowerSearchTerm)) || task.itemType.toLowerCase().includes(lowerSearchTerm) || (task.associatedComponent && task.associatedComponent.toLowerCase().includes(lowerSearchTerm)) ); }
    if (statusFilter !== 'all') { filtered = filtered.filter(task => { if (statusFilter === 'active') return task.isActive; if (statusFilter === 'inactive') return !task.isActive; if (!task.isActive) return false; const status = getReleaseStatus(task.toGoData!, task); if (statusFilter === 'overdue') return status.label === 'Overdue'; if (statusFilter === 'dueSoon') return status.label === 'Due Soon'; if (statusFilter === 'gracePeriod') return status.label === 'Grace Period'; return true; }); }
    if (componentFilter !== 'all') { filtered = filtered.filter(task => (task.associatedComponent || "Airframe") === componentFilter); }
    if (sortConfig !== null) { filtered.sort((a, b) => { let aValue: string | number | undefined; let bValue: string | number | undefined; if (sortConfig.key === 'toGoNumeric') { aValue = a.toGoData?.numeric; bValue = b.toGoData?.numeric; } else { aValue = a[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined; bValue = b[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined; } if (aValue === undefined && bValue === undefined) return 0; if (aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1; if (bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1; if (typeof aValue === 'string' && typeof bValue === 'string') { const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase()); return sortConfig.direction === 'ascending' ? comparison : -comparison; } if (typeof aValue === 'number' && typeof bValue === 'number') { return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue; } return 0; }); }
    return filtered;
  }, [maintenanceTasks, searchTerm, statusFilter, componentFilter, sortConfig, calculateDisplayFields, editableComponentTimes, isLoadingComponentTimes]);

  const requestSort = (key: SortKey) => { let direction: SortDirection = 'ascending'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction }); };
  const getSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) { return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />; } return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />; };
  const handleSelectTask = (taskId: string, checked: boolean) => { setSelectedTaskIds(prev => checked ? [...prev, taskId] : prev.filter(id => id !== taskId) ); };
  const handleSelectAllTasks = (checked: boolean) => { if (checked) { setSelectedTaskIds(displayedTasks.map(task => task.id)); } else { setSelectedTaskIds([]); } };
  const generateWorkOrderHtml = ( tasksToReport: DisplayMaintenanceItem[], aircraft: FleetAircraft, componentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>, companyProfile: CompanyProfile | null ): string => {
    const companyName = companyProfile?.companyName || "FlightOps360"; const companyAddress = companyProfile?.companyAddress || ""; const companyContact = [companyProfile?.companyEmail, companyProfile?.companyPhone].filter(Boolean).join(' | ');
    const aircraftContactName = aircraft.primaryContactName || "N/A"; const aircraftContactPhone = aircraft.primaryContactPhone || "N/A"; const aircraftContactEmail = aircraft.primaryContactEmail || "N/A";
    const companyLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plane"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;
    const tasksHtml = tasksToReport.map(task => { let lastDoneStr = "N/A"; if (task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate))) { try { lastDoneStr = format(parseISO(task.lastCompletedDate), 'MM/dd/yy'); } catch {} } else if (task.lastCompletedHours !== undefined) lastDoneStr = `${task.lastCompletedHours.toLocaleString()} hrs`; else if (task.lastCompletedCycles !== undefined) lastDoneStr = `${task.lastCompletedCycles.toLocaleString()} cyc`; let dueAtStr = "N/A"; if (task.dueAtDate) { try { dueAtStr = format(parse(task.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yy'); } catch {} } else if (task.dueAtHours !== undefined) dueAtStr = `${task.dueAtHours.toLocaleString()} hrs`; else if (task.dueAtCycles !== undefined) dueAtStr = `${task.dueAtCycles.toLocaleString()} cyc`; return `<tr><td style="white-space: nowrap;">${task.referenceNumber || '-'}</td><td>${task.itemTitle}</td><td>${task.itemType}</td><td>${task.associatedComponent || 'Airframe'}</td><td>${lastDoneStr}</td><td>${dueAtStr}</td><td>${task.toGoData?.text || 'N/A'}</td><td style="min-width: 200px; max-width: 350px; word-break: break-word; white-space: pre-wrap;">${task.details || '-'}</td><td style="height: 60px; border-bottom: 1px solid #ccc; min-width: 150px;"></td></tr>`; }).join('');
    return `<html><head><title>Work Order - ${aircraft.tailNumber}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 20px; font-size: 10pt; color: #333; } .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #007bff; } .company-info h1 { margin: 0; font-size: 20pt; color: #007bff; } .company-info p { margin: 2px 0; font-size: 9pt; } .logo-container { width: 50px; height: 50px; } .report-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; } .report-info, .aircraft-contact-info, .component-times-info { border: 1px solid #e0e0e0; padding: 12px; border-radius: 6px; background-color: #f9f9f9; } .report-info h2, .aircraft-contact-info h2 { margin-top: 0; font-size: 12pt; color: #333; } .report-info p, .aircraft-contact-info p, .component-times-info p { margin: 4px 0; } .component-times-info strong { font-size: 11pt; display: block; margin-bottom: 8px; } .component-times-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 15px; } .component-times-grid p { display: flex; justify-content: space-between; border-bottom: 1px dotted #eee; padding-bottom: 3px; margin-bottom: 3px; } .component-times-grid p span:first-child { font-weight: 500; margin-right: 10px; color: #555; } .tasks-section h2 { font-size: 13pt; margin-top: 20px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;} table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; } th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; } th { background-color: #e9ecef; color: #495057; font-weight: 600; } td[style*="white-space: nowrap;"] { min-width: 70px; } tr:nth-child(even) { background-color: #f8f9fa; } .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; } .signatures div { width: 45%; } .signatures div p { margin-bottom: 50px; font-size: 10pt; } .print-button-container { text-align: center; margin-top: 30px; margin-bottom: 10px; } .print-button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12pt;} .footer-powered-by { text-align: center; font-size: 9pt; color: #777; margin-top: 30px; padding-top: 10px; border-top: 1px solid #eee; } @media print { .print-button-container { display: none; } body { margin: 0.5in; font-size: 9pt; color: #000; } .header-container { border-bottom: 2px solid #007bff; } .company-info h1 { color: #007bff; } .report-info, .aircraft-contact-info, .component-times-info { border: 1px solid #ccc; background-color: #fff; } th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } tr:nth-child(even) { background-color: #f8f8f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } table { font-size: 8pt; } th, td { padding: 5px; border: 1px solid #999; } }</style></head><body><div class="header-container"><div class="company-info"><h1>${companyName}</h1><p>${companyAddress}</p><p>${companyContact}</p></div><div class="logo-container">${companyLogoSvg}</div></div><div class="report-meta-grid"><div class="report-info"><h2>Aircraft Details</h2><p><strong>Aircraft:</strong> ${aircraft.tailNumber} (${aircraft.model})</p><p><strong>Serial Number:</strong> ${aircraft.serialNumber || 'N/A'}</p><p><strong>Date Generated:</strong> ${format(new Date(), "PPP HH:mm")}</p></div><div class="aircraft-contact-info"><h2>Aircraft Contact</h2><p><strong>Name:</strong> ${aircraftContactName}</p><p><strong>Phone:</strong> ${aircraftContactPhone}</p><p><strong>Email:</strong> ${aircraftContactEmail}</p><p><strong>Base:</strong> ${aircraft.baseLocation || 'N/A'}</p></div></div><div class="component-times-info"><strong>Current Component Times (as of report generation):</strong><div class="component-times-grid">${componentTimes.map(c => `<p><span>${c.componentName}:</span> <span>${c.currentTime.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1})} hrs / ${c.currentCycles.toLocaleString()} cyc</span></p>`).join('')}</div></div><div class="tasks-section"><h2>Selected Maintenance Tasks</h2><table><thead><tr><th>Ref #</th><th>Task Title</th><th>Type</th><th>Component</th><th>Last Done</th><th>Due At</th><th>To Go</th><th style="width: 30%;">Work Instructions</th><th style="width: 20%;">Work Performed / Notes</th></tr></thead><tbody>${tasksHtml}</tbody></table></div><div class="signatures"><div><p>Shop Signature: _________________________</p><p>Date: ____________</p></div><div><p>Inspector Signature: _________________________</p><p>Date: ____________</p></div></div><div class="print-button-container"><button class="print-button" onclick="window.print()">Print Work Order</button></div><div class="footer-powered-by">Powered by FlightOps360</div></body></html>`;
  };
  const handleGenerateWorkOrder = async () => {
    if (!currentAircraft) { toast({ title: "Error", description: "Aircraft data not loaded.", variant: "destructive" }); return; }
    if (selectedTaskIds.length === 0) { toast({ title: "No Tasks Selected", description: "Please select at least one maintenance task to include in the work order.", variant: "info" }); return; }
    startReportGenerationTransition(async () => {
      try { const companyProfile = await fetchCompanyProfile(); const tasksToReport = displayedTasks.filter(task => selectedTaskIds.includes(task.id)); const reportHtml = generateWorkOrderHtml(tasksToReport, currentAircraft, editableComponentTimes, companyProfile); const reportWindow = window.open('', '_blank'); if (reportWindow) { reportWindow.document.open(); reportWindow.document.write(reportHtml); reportWindow.document.close(); } else { toast({ title: "Popup Blocked?", description: "Could not open the report window. Please check your popup blocker.", variant: "destructive" }); } toast({ title: "Work Order Generated", description: "A new window with the work order should have opened.", variant: "default" }); } 
      catch (error) { console.error("Error generating work order:", error); toast({ title: "Error Generating Report", description: (error instanceof Error ? error.message : "Could not fetch company profile."), variant: "destructive" }); }
    });
  };

  if (isLoadingAircraft || isLoadingComponentTimes) { return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading aircraft details &amp; component times...</p></div>; }
  if (!tailNumber || !currentAircraft) { return ( <div> <PageHeader title="Aircraft Not Found" icon={Wrench} actions={ <Button asChild variant="outline"> <Link href="/aircraft/currency"><span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</span></Link> </Button> } /> <Card> <CardContent className="pt-6"> <p>Aircraft "{tailNumber || 'Unknown'}" not found.</p> </CardContent> </Card> </div> ); }
  if (!currentAircraft.isMaintenanceTracked) { return ( <div> <PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} actions={ <Button asChild variant="outline"> <Link href="/aircraft/currency"><span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</span></Link> </Button> } /> <Card className="mb-6"> <CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader> <CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent> </Card> <Card> <CardContent className="pt-6"> <p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p> </CardContent> </Card> </div> ); }

  const pageHeaderTitle = `Maintenance Details for ${currentAircraft.tailNumber}`;
  const pageHeaderDescription = `Tracked items &amp; component status for ${currentAircraft.model} (${currentAircraft.tailNumber}). Component times are loaded from Firestore.`;

  return (
    <div>
      <PageHeader 
        title={pageHeaderTitle} 
        description={pageHeaderDescription} 
        icon={Wrench} 
        actions={ 
          <div className="flex gap-2"> 
            <Button asChild variant="outline"> 
              <Link href="/aircraft/currency">
                <span><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</span>
              </Link> 
            </Button> 
            <Button onClick={handleGenerateWorkOrder} disabled={selectedTaskIds.length === 0 || isGeneratingReport}> {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} Generate Work Order ({selectedTaskIds.length}) </Button> 
            {/* Temporarily simplified "Add New Task" button */}
            <Button onClick={handleOpenAddTaskModal}><PlusCircle className="mr-2 h-4 w-4" /> Add New Task (Test)</Button>
          </div> 
        } 
      />
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        {/* The trigger is now the button above, so no DialogTrigger needed here */}
        <AddMaintenanceTaskDialogContent 
            aircraft={currentAircraft} 
            onSave={handleSaveTask} 
            onDelete={handleDeleteTask} 
            initialData={initialModalFormData} 
            isEditing={!!editingTaskOriginalId} 
            currentTaskId={editingTaskOriginalId} 
        />
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
           <CardHeader className="flex flex-row items-start justify-between"> <div className="flex items-center gap-2"><PlaneIcon className="h-6 w-6 text-primary" /><CardTitle>Current Hours & Cycles</CardTitle></div> {!isEditingComponentTimes ? ( <Button variant="outline" size="icon" onClick={() => setIsEditingComponentTimes(true)} disabled={isSavingComponentTimes}> <Edit className="h-4 w-4" /> <span className="sr-only">Edit Component Times</span> </Button> ) : ( <div className="flex gap-2"> <Button variant="ghost" size="icon" onClick={handleCancelEditComponentTimes} disabled={isSavingComponentTimes}> <XCircle className="h-4 w-4" /><span className="sr-only">Cancel Edit</span> </Button> <Button size="icon" onClick={handleSaveComponentTimes} disabled={isSavingComponentTimes}> {isSavingComponentTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="sr-only">Save Component Times</span> </Button> </div> )} </CardHeader>
           <CardContent> {editableComponentTimes.length === 0 ? ( <p className="text-sm text-muted-foreground">No components configured for time tracking. Update in Company Settings or component data not yet loaded.</p> ) : ( <div className="space-y-3"> {editableComponentTimes.map(comp => { let subText = null; if (currentAircraft) { if (comp.componentName === "Airframe") { subText = `${currentAircraft.model || ''}${currentAircraft.serialNumber ? `/${currentAircraft.serialNumber}` : ''}`; } else if (comp.componentName.startsWith("Engine ")) { const engineIndexMatch = comp.componentName.match(/Engine (\d+)/); if (engineIndexMatch && currentAircraft.engineDetails && currentAircraft.engineDetails.length > 0) { const engineNum = parseInt(engineIndexMatch[1], 10); if (engineNum > 0 && engineNum <= currentAircraft.engineDetails.length) { const engine = currentAircraft.engineDetails[engineNum - 1]; subText = `${engine.model || 'N/A Model'}${engine.serialNumber ? `/${engine.serialNumber}` : ''}`; } } } else if (comp.componentName.startsWith("Propeller ")) { const propIndexMatch = comp.componentName.match(/Propeller (\d+)/); if (propIndexMatch && currentAircraft.propellerDetails && currentAircraft.propellerDetails.length > 0) { const propNum = parseInt(propIndexMatch[1], 10); if (propNum > 0 && propNum <= currentAircraft.propellerDetails.length) { const propeller = currentAircraft.propellerDetails[propNum - 1]; subText = `${propeller.model || 'N/A Model'}${propeller.serialNumber ? `/${propeller.serialNumber}` : ''}`; } } } } return ( <div key={comp.componentName} className="grid grid-cols-3 items-start gap-2 border-b pb-2 last:border-b-0 last:pb-0"> <div className="col-span-1"> <span className="text-sm font-medium">{comp.componentName}</span> {subText && <p className="text-xs text-muted-foreground -mt-0.5">{subText}</p>} </div> {isEditingComponentTimes ? ( <> <Input type="number" value={comp.currentTime} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentTime', e.target.value)} placeholder="Hours" className="text-sm h-8" /> <Input type="number" value={comp.currentCycles} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentCycles', e.target.value)} placeholder="Cycles" className="text-sm h-8" /> </> ) : ( <> <span className="col-span-1 text-sm text-right pt-1">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs</span> <span className="col-span-1 text-sm text-right pt-1">{comp.currentCycles.toLocaleString()} cyc</span> </> )} </div> ); })} </div> )} </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader> <div className="flex justify-between items-start"> <CardTitle className="flex items-center gap-2"><InfoIcon className="h-6 w-6 text-primary" />Aircraft Information</CardTitle> {!isEditingAircraftInfo ? ( <Button variant="outline" size="icon" onClick={() => setIsEditingAircraftInfo(true)} disabled={isSavingAircraftInfo}> <Edit className="h-4 w-4" /> <span className="sr-only">Edit Aircraft Information</span> </Button> ) : ( <div className="flex gap-2"> <Button variant="ghost" size="icon" onClick={() => { setIsEditingAircraftInfo(false); resetAircraftInfoForm(currentAircraft);}} disabled={isSavingAircraftInfo}> <XCircle className="h-4 w-4" /><span className="sr-only">Cancel</span> </Button> <Button variant="default" size="icon" onClick={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} disabled={isSavingAircraftInfo}> {isSavingAircraftInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="sr-only">Save Aircraft Information</span> </Button> </div> )} </div> </CardHeader>
          <CardContent> {isEditingAircraftInfo ? ( <Form {...aircraftInfoForm}> <form onSubmit={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} className="space-y-3"> <p className="text-sm"><strong>Tail Number:</strong> {currentAircraft.tailNumber}</p> <p className="text-sm"><strong>Serial #:</strong> {currentAircraft.serialNumber || 'N/A'} <span className="text-xs text-muted-foreground">(Managed in Company Settings)</span></p> <FormField control={aircraftInfoForm.control} name="model" render={({ field }) => ( <FormItem> <FormLabel>Model</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="aircraftYear" render={({ field }) => ( <FormItem> <FormLabel>Year</FormLabel> <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="baseLocation" render={({ field }) => ( <FormItem> <FormLabel>Base Location</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactName" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactPhone" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Phone</FormLabel> <FormControl><Input type="tel" {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactEmail" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Email</FormLabel> <FormControl><Input type="email" {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="internalNotes" render={({ field }) => ( <FormItem> <FormLabel>Internal Notes</FormLabel> <FormControl><Textarea {...field} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> </form> </Form> ) : ( <div className="space-y-1.5 text-sm"> <p><strong className="text-muted-foreground w-28 inline-block">Model:</strong> {currentAircraft.model}</p> <p><strong className="text-muted-foreground w-28 inline-block">Serial #:</strong> {currentAircraft.serialNumber || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Year:</strong> {currentAircraft.aircraftYear || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Base:</strong> {currentAircraft.baseLocation || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Contact:</strong> {currentAircraft.primaryContactName || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Phone:</strong> {currentAircraft.primaryContactPhone || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Email:</strong> {currentAircraft.primaryContactEmail || 'N/A'}</p> <div className="pt-2"> <h4 className="font-semibold text-muted-foreground">Internal Notes:</h4> {currentAircraft.internalNotes ? ( <p className="whitespace-pre-wrap p-2 bg-muted/30 rounded-md text-xs">{currentAircraft.internalNotes}</p> ) : ( <p className="text-xs text-muted-foreground pl-2">N/A</p> )} </div> </div> )} </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" />Maintenance Items</CardTitle>
          <CardDescription> Overview of scheduled and upcoming maintenance tasks for {currentAircraft.tailNumber}. Calculated "To Go" is based on the values in "Current Hours &amp; Cycles" above. </CardDescription>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 items-center"> <div className="relative flex-grow w-full sm:w-auto"> <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> <Input type="search" placeholder="Search tasks (title, ref, type, component)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full" /> {searchTerm && ( <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setSearchTerm('')}> <XCircleIcon className="h-4 w-4"/> </Button> )} </div> <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}> <SelectTrigger className="w-full sm:w-[180px]"> <SelectValue placeholder="Filter by status" /> </SelectTrigger> <SelectContent> <SelectItem value="all">All Statuses</SelectItem> <SelectItem value="active">Active Items</SelectItem> <SelectItem value="inactive">Inactive Items</SelectItem> <SelectItem value="dueSoon">Due Soon (Active)</SelectItem> <SelectItem value="overdue">Overdue (Active)</SelectItem> <SelectItem value="gracePeriod">Grace Period (Active)</SelectItem> </SelectContent> </Select> <Select value={componentFilter} onValueChange={setComponentFilter}> <SelectTrigger className="w-full sm:w-[200px]"> <Filter className="h-4 w-4 mr-2 opacity-50" /> <SelectValue placeholder="Filter by component" /> </SelectTrigger> <SelectContent> <SelectItem value="all">All Components</SelectItem> {availableComponentsForFilter.map(comp => ( <SelectItem key={comp} value={comp}>{comp}</SelectItem> ))} </SelectContent> </Select> </div>
        </CardHeader>
        <CardContent> {isLoadingTasks ? ( <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading maintenance tasks...</p></div> ) : ( <Table> <TableHeader> <TableRow> <TableHead className="w-10"> <Checkbox checked={selectedTaskIds.length === displayedTasks.length && displayedTasks.length > 0} onCheckedChange={(checked) => handleSelectAllTasks(Boolean(checked))} aria-label="Select all tasks" disabled={displayedTasks.length === 0} /> </TableHead> <TableHead>Ref #</TableHead> <TableHead> <Button variant="ghost" size="sm" onClick={() => requestSort('itemTitle')} className="px-1 -ml-2"> Title {getSortIcon('itemTitle')} </Button> </TableHead> <TableHead>Type</TableHead> <TableHead>Component</TableHead> <TableHead>Frequency</TableHead> <TableHead>Last Done</TableHead> <TableHead>Due At</TableHead> <TableHead> <Button variant="ghost" size="sm" onClick={() => requestSort('toGoNumeric')} className="px-1 -ml-2"> To Go {getSortIcon('toGoNumeric')} </Button> </TableHead> <TableHead className="text-center">Status</TableHead> <TableHead className="text-right">Actions</TableHead> </TableRow> </TableHeader> <TableBody> {displayedTasks.length === 0 && ( <TableRow> <TableCell colSpan={11} className="text-center text-muted-foreground py-10"> No maintenance tasks match your criteria. 
          <Dialog open={isTaskModalOpen && initialModalFormData === defaultMaintenanceTaskFormValues} onOpenChange={(open) => { if (open) handleOpenAddTaskModal(); else setIsTaskModalOpen(false); }}>
            <DialogTrigger asChild>
              <Button variant="link" className="p-0 ml-1">Add one now?</Button>
            </DialogTrigger>
            <AddMaintenanceTaskDialogContent aircraft={currentAircraft} onSave={handleSaveTask} onDelete={handleDeleteTask} initialData={initialModalFormData} isEditing={!!editingTaskOriginalId} currentTaskId={editingTaskOriginalId} />
          </Dialog>
        </TableCell> </TableRow> )} {displayedTasks.map((item) => { const status = getReleaseStatus(item.toGoData!, item); const frequency = formatTaskFrequency(item); let dueAtDisplay = "N/A"; if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) { try { dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yy'); } catch {} } else if (item.dueAtHours !== undefined) { dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`; } else if (item.dueAtCycles !== undefined) { dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cyc`; } let lastDoneDisplay = "N/A"; if (item.lastCompletedDate && isValid(parseISO(item.lastCompletedDate))) { try { lastDoneDisplay = format(parseISO(item.lastCompletedDate), 'MM/dd/yy'); } catch {} } else if (item.lastCompletedHours !== undefined) { lastDoneDisplay = `${item.lastCompletedHours.toLocaleString()} hrs`; } else if (item.lastCompletedCycles !== undefined) { lastDoneDisplay = `${item.lastCompletedCycles.toLocaleString()} cyc`; } return ( <TableRow key={item.id} className={item.isActive ? '' : 'opacity-50 bg-muted/30 hover:bg-muted/40'} data-state={selectedTaskIds.includes(item.id) ? "selected" : ""}> <TableCell> <Checkbox checked={selectedTaskIds.includes(item.id)} onCheckedChange={(checked) => handleSelectTask(item.id, Boolean(checked))} aria-label={`Select task ${item.itemTitle}`} /> </TableCell> <TableCell className="text-xs text-muted-foreground">{item.referenceNumber || '-'}</TableCell> <TableCell className="font-medium"> {item.itemTitle} {!item.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>} </TableCell> <TableCell className="text-xs">{item.itemType}</TableCell> <TableCell className="text-xs">{item.associatedComponent || 'Airframe'}</TableCell> <TableCell className="text-xs">{frequency}</TableCell> <TableCell className="text-xs">{lastDoneDisplay}</TableCell> <TableCell className="text-xs">{dueAtDisplay}</TableCell> <TableCell className={`font-semibold text-xs ${item.toGoData?.isOverdue ? (status.label === 'Grace Period' ? 'text-yellow-600' : 'text-red-600') : (item.toGoData?.unit === 'days' && item.toGoData?.numeric < (item.alertDaysPrior ?? 30)) || (item.toGoData?.unit === 'hrs' && item.toGoData?.numeric < (item.alertHoursPrior ?? 25)) || (item.toGoData?.unit === 'cycles' && item.toGoData?.numeric < (item.alertCyclesPrior ?? 50)) ? 'text-yellow-600' : 'text-green-600'}`}>{item.toGoData?.text}</TableCell> <TableCell className="text-center"> <div className={`flex flex-col items-center justify-center ${status.colorClass}`}> {status.icon} <span className="text-xs mt-1">{status.label}</span> </div> </TableCell> <TableCell className="text-right"> <Button variant="ghost" size="icon" onClick={() => handleOpenEditTaskModal(item)}> <Edit3 className="h-4 w-4" /> </Button> </TableCell> </TableRow> ); })} </TableBody> </Table> )} </CardContent>
      </Card>

      {/* Discrepancies Section */}
      <Card className="mt-6 shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" />Aircraft Discrepancies</CardTitle>
            <CardDescription>Log and track discrepancies for {currentAircraft.tailNumber}.</CardDescription>
          </div>
          <Button onClick={handleOpenAddDiscrepancyModal} disabled={!currentAircraft || isSavingDiscrepancy}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Discrepancy
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingDiscrepancies ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-destructive" /><p className="ml-2 text-muted-foreground">Loading discrepancies...</p></div>
          ) : aircraftDiscrepancies.length === 0 ? (
             <p className="text-center text-muted-foreground py-6">No discrepancies logged for this aircraft.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Discovered By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aircraftDiscrepancies.map((disc) => (
                  <TableRow key={disc.id} className={disc.status !== "Closed" ? "font-semibold" : "opacity-70"}>
                    <TableCell className="text-xs">
                      {disc.dateDiscovered && isValid(parseISO(disc.dateDiscovered)) ? format(parseISO(disc.dateDiscovered), 'MM/dd/yy') : '-'}
                      {disc.timeDiscovered ? ` ${disc.timeDiscovered}` : ''}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={disc.description}>{disc.description}</TableCell>
                    <TableCell><Badge variant={disc.status === 'Open' ? 'destructive' : (disc.status === 'Deferred' ? 'secondary' : 'default')}>{disc.status}</Badge></TableCell>
                    <TableCell className="text-xs">{disc.discoveredBy || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDiscrepancyModal(disc)} disabled={isSavingDiscrepancy || isDeletingDiscrepancy}> <Edit3 className="h-4 w-4" /> </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirmDeleteDiscrepancy(disc)} disabled={isSavingDiscrepancy || isDeletingDiscrepancy || disc.status === "Closed"}> <Trash2 className="h-4 w-4" /> </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditAircraftDiscrepancyModal
        isOpen={isDiscrepancyModalOpen}
        setIsOpen={setIsDiscrepancyModalOpen}
        onSave={handleSaveDiscrepancy}
        aircraft={currentAircraft}
        initialData={editingDiscrepancyId ? aircraftDiscrepancies.find(d => d.id === editingDiscrepancyId) : null}
        isEditing={!!editingDiscrepancyId}
        isSaving={isSavingDiscrepancy}
      />

       {showDeleteDiscrepancyConfirm && discrepancyToDelete && (
        <AlertDialogModalContent>
          <AlertDialogModalHeader>
            <AlertDialogModalTitle>Confirm Deletion</AlertDialogModalTitle>
            <AlertDialogModalDescription>
              Are you sure you want to delete discrepancy: "{discrepancyToDelete.description.substring(0,50)}..."? This action cannot be undone.
            </AlertDialogModalDescription>
          </AlertDialogModalHeader>
          <AlertDialogModalFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDiscrepancyConfirm(false)} disabled={isDeletingDiscrepancy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeDeleteDiscrepancy} disabled={isDeletingDiscrepancy}>
              {isDeletingDiscrepancy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Discrepancy
            </Button>
          </AlertDialogModalFooter>
        </AlertDialogModalContent>
      )}

    </div>
  );
}
    


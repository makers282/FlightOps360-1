
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
import { AddEditAircraftDiscrepancyModal } from './components/add-edit-aircraft-discrepancy-modal';
import { SignOffDiscrepancyModal, type SignOffFormData } from './components/sign-off-discrepancy-modal';
import { AddEditMelItemModal } from './components/add-edit-mel-item-modal';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Wrench, PlusCircle, ArrowLeft, Plane as PlaneIcon, Edit, Loader2, InfoIcon, Save, XCircle as XCircleIcon, Edit3, AlertTriangle, CheckCircle2, Search, ArrowUpDown, ArrowDown, ArrowUp, Printer, Filter as FilterIcon, ListChecks, BookOpen, Hammer, FileWarning, BookLock, Trash2, ShieldCheck, GripVertical } from 'lucide-react';
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
import { fetchMelItemsForAircraft, saveMelItem, deleteMelItem } from '@/ai/flows/manage-mel-items-flow';
import type { MelItem, SaveMelItemInput } from '@/ai/schemas/mel-item-schemas';


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

// Top-level helper functions
const calculateLocalToGo = (
  item: Pick<DisplayMaintenanceItem, 'dueAtDate' | 'dueAtHours' | 'dueAtCycles' | 'associatedComponent'>,
  currentComponentTimesArray: Array<{ componentName: string; currentTime: number; currentCycles: number }>
): { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } => {
  const now = new Date();
  if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
    const dueDate = parse(item.dueAtDate, 'yyyy-MM-dd', new Date());
    const daysRemaining = differenceInCalendarDays(dueDate, now);
    return { text: `${daysRemaining} days`, numeric: daysRemaining, unit: 'days', isOverdue: daysRemaining < 0 };
  }
  let currentRelevantTime: number | undefined = undefined, currentRelevantCycles: number | undefined = undefined;
  const componentNameToUse = (item.associatedComponent && item.associatedComponent.trim() !== "") ? item.associatedComponent.trim() : "Airframe";
  const timesForComponent = currentComponentTimesArray.find(c => c.componentName.trim() === componentNameToUse);

  if (timesForComponent) {
    currentRelevantTime = timesForComponent.currentTime;
    currentRelevantCycles = timesForComponent.currentCycles;
  } else {
    if (item.dueAtHours != null) return { text: `N/A (No time for ${componentNameToUse})`, numeric: Infinity, unit: 'hrs', isOverdue: false };
    if (item.dueAtCycles != null) return { text: `N/A (No cycles for ${componentNameToUse})`, numeric: Infinity, unit: 'cycles', isOverdue: false };
    return { text: 'N/A (Comp. data missing)', numeric: Infinity, unit: 'N/A', isOverdue: false };
  }

  if (typeof currentRelevantTime === 'number' && item.dueAtHours != null) {
    const hoursRemaining = parseFloat((item.dueAtHours - currentRelevantTime).toFixed(1));
    return { text: `${hoursRemaining.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs (from ${componentNameToUse})`, numeric: hoursRemaining, unit: 'hrs', isOverdue: hoursRemaining < 0 };
  }
  if (typeof currentRelevantCycles === 'number' && item.dueAtCycles != null) {
    const cyclesRemaining = item.dueAtCycles - currentRelevantCycles;
    return { text: `${cyclesRemaining.toLocaleString()} cycles (from ${componentNameToUse})`, numeric: cyclesRemaining, unit: 'cycles', isOverdue: cyclesRemaining < 0 };
  }
  return { text: 'N/A (Not Date/Hr/Cycle)', numeric: Infinity, unit: 'N/A', isOverdue: false };
};

const calculateLocalDisplayFields = (
  task: FlowMaintenanceTask,
  currentComponentTimesArray: Array<{ componentName: string; currentTime: number; currentCycles: number }>,
): DisplayMaintenanceItem => {
  let dueAtDate: string | undefined = undefined, dueAtHours: number | undefined = undefined, dueAtCycles: number | undefined = undefined;
  const actualLastCompletedDateObj = task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate)) ? parseISO(task.lastCompletedDate) : new Date();
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
    if (task.isHoursDueEnabled && typeof task.hoursDue === 'number') { dueAtHours = actualLastCompletedHours + Number(task.hoursDue); }
    if (task.isCyclesDueEnabled && typeof task.cyclesDue === 'number') { dueAtCycles = actualLastCompletedCycles + Number(task.cyclesDue); }
  } else if (task.trackType === "One Time") {
    if (task.isDaysDueEnabled && task.daysDueValue && isValid(parseISO(task.daysDueValue))) { dueAtDate = task.daysDueValue; }
    if (task.isHoursDueEnabled && typeof task.hoursDue === 'number') dueAtHours = Number(task.hoursDue);
    if (task.isCyclesDueEnabled && typeof task.cyclesDue === 'number') dueAtCycles = Number(task.cyclesDue);
  }
  const toGoData = calculateLocalToGo({ ...task, dueAtDate, dueAtHours, dueAtCycles }, currentComponentTimesArray);
  return { ...task, dueAtDate, dueAtHours, dueAtCycles, toGoData };
};

const formatLocalTaskFrequency = (task: FlowMaintenanceTask): string => {
  if (task.trackType === "Dont Alert") return "Not Tracked";
  if (task.trackType === "One Time") return "One Time";
  const frequencies = [];
  if (task.isHoursDueEnabled && typeof task.hoursDue === 'number') { frequencies.push(`${task.hoursDue.toLocaleString()} hrs`); }
  if (task.isCyclesDueEnabled && typeof task.cyclesDue === 'number') { frequencies.push(`${task.cyclesDue.toLocaleString()} cyc`); }
  if (task.isDaysDueEnabled && task.daysDueValue) {
    const numVal = Number(task.daysDueValue);
    let unit = '';
    switch(task.daysIntervalType) {
      case 'days': unit = 'days'; break;
      case 'months_specific_day': case 'months_eom': unit = 'months'; break;
      case 'years_specific_day': unit = 'years'; break;
      default: unit = task.daysIntervalType || 'days';
    }
    frequencies.push(`${numVal} ${unit}`);
  }
  return frequencies.length > 0 ? frequencies.join(' / ') : 'N/A';
};

const getLocalReleaseStatus = (
  toGo: { text: string; numeric: number; unit: 'days' | 'hrs' | 'cycles' | 'N/A'; isOverdue: boolean } | undefined,
  task: DisplayMaintenanceItem
): { icon: JSX.Element; colorClass: string; label: string } => {
  if (!toGo) {
    return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Calculating...' };
  }
  if (toGo.text.startsWith('N/A (No time for') || toGo.text.startsWith('N/A (No cycles for') || toGo.text.startsWith('N/A (Comp. data missing')) {
    return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-orange-500', label: 'Missing Comp. Time' };
  }
  if (toGo.isOverdue) {
    let withinGrace = false;
    const numericOverdueAmount = Math.abs(toGo.numeric);
    if (toGo.unit === 'days' && typeof task.daysTolerance === 'number' && numericOverdueAmount <= task.daysTolerance) { withinGrace = true; }
    else if (toGo.unit === 'hrs' && typeof task.hoursTolerance === 'number' && numericOverdueAmount <= task.hoursTolerance) { withinGrace = true; }
    else if (toGo.unit === 'cycles' && typeof task.cyclesTolerance === 'number' && numericOverdueAmount <= task.cyclesTolerance) { withinGrace = true; }
    if (withinGrace) { return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-600 dark:text-yellow-500', label: 'Grace Period' }; }
    return { icon: <XCircleIcon className="h-5 w-5" />, colorClass: 'text-red-500 dark:text-red-400', label: 'Overdue' };
  }
  const daysAlertThreshold = task.alertDaysPrior ?? 30;
  const hoursAlertThreshold = task.alertHoursPrior ?? 25;
  const cyclesAlertThreshold = task.alertCyclesPrior ?? 50;
  if (toGo.unit === 'days' && toGo.numeric < daysAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
  if (toGo.unit === 'hrs' && toGo.numeric < hoursAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
  if (toGo.unit === 'cycles' && toGo.numeric < cyclesAlertThreshold) return { icon: <AlertTriangle className="h-5 w-5" />, colorClass: 'text-yellow-500 dark:text-yellow-400', label: 'Due Soon' };
  if (toGo.text === 'N/A (Not Date/Hr/Cycle)' || toGo.text === 'Invalid Date') return { icon: <InfoIcon className="h-5 w-5" />, colorClass: 'text-gray-400', label: 'Check Due Info' };
  return { icon: <CheckCircle2 className="h-5 w-5" />, colorClass: 'text-green-500 dark:text-green-400', label: 'OK' };
};

interface MaintenanceTaskRowProps {
  task: DisplayMaintenanceItem;
  isSelected: boolean;
  onSelectTask: (taskId: string, checked: boolean) => void;
  onEditTask: (task: FlowMaintenanceTask) => void;
}

const MaintenanceTaskRow = React.memo(function MaintenanceTaskRow(props: MaintenanceTaskRowProps) {
  const { task: item, isSelected, onSelectTask, onEditTask } = props;

  if (!item || !item.id) {
    console.error("MaintenanceTaskRow received invalid item:", item);
    return <TableRow><TableCell colSpan={11} className="text-center text-destructive">Error rendering task row data.</TableCell></TableRow>;
  }

  const itemTitle = item.itemTitle || "Untitled Task";
  const referenceNumber = item.referenceNumber || '-';
  const itemType = item.itemType || "Other";
  const associatedComponent = item.associatedComponent || 'Airframe';
  const toGoData = item.toGoData;
  const status = getLocalReleaseStatus(toGoData, item);
  const frequency = formatLocalTaskFrequency(item);
  const toGoTextDisplay = toGoData?.text || 'N/A';

  let toGoColorClass = 'text-green-600 dark:text-green-400'; // Default
  if (toGoData) {
      if (toGoData.isOverdue) {
          toGoColorClass = status.label === 'Grace Period' ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-400';
      } else if (status.label === 'Due Soon') {
          toGoColorClass = 'text-yellow-500 dark:text-yellow-400';
      } else if (status.label === 'Missing Comp. Time' || status.label === 'Check Due Info') {
          toGoColorClass = 'text-orange-500 dark:text-orange-400';
      }
  }


  let dueAtDisplay = "N/A";
  if (item.dueAtDate && isValid(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()))) {
    try { dueAtDisplay = format(parse(item.dueAtDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yy'); } catch {}
  } else if (typeof item.dueAtHours === 'number') {
    dueAtDisplay = `${item.dueAtHours.toLocaleString()} hrs`;
  } else if (typeof item.dueAtCycles === 'number') {
    dueAtDisplay = `${item.dueAtCycles.toLocaleString()} cyc`;
  }

  let lastDoneDisplay = "N/A";
  if (item.lastCompletedDate && isValid(parseISO(item.lastCompletedDate))) {
    try { lastDoneDisplay = format(parseISO(item.lastCompletedDate), 'MM/dd/yy'); } catch {}
  } else if (typeof item.lastCompletedHours === 'number') {
    lastDoneDisplay = `${item.lastCompletedHours.toLocaleString()} hrs`;
  } else if (typeof item.lastCompletedCycles === 'number') {
    lastDoneDisplay = `${item.lastCompletedCycles.toLocaleString()} cyc`;
  }

  return (
    <TableRow className={item.isActive ? '' : 'opacity-50 bg-muted/30 hover:bg-muted/40'} data-state={isSelected ? "selected" : ""}>
      <TableCell><Checkbox checked={isSelected} onCheckedChange={(checked) => onSelectTask(item.id, Boolean(checked))} aria-label={`Select task ${itemTitle}`} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{referenceNumber}</TableCell>
      <TableCell className="font-medium">{itemTitle}{!item.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>}</TableCell>
      <TableCell className="text-xs">{itemType}</TableCell>
      <TableCell className="text-xs">{associatedComponent}</TableCell>
      <TableCell className="text-xs">{frequency}</TableCell>
      <TableCell className="text-xs">{lastDoneDisplay}</TableCell>
      <TableCell className="text-xs">{dueAtDisplay}</TableCell>
      <TableCell className={`font-semibold text-xs ${toGoColorClass}`}>{toGoTextDisplay}</TableCell>
      <TableCell className="text-center"><div className={`flex flex-col items-center justify-center ${status.colorClass}`}>{status.icon}<span className="text-xs mt-1">{status.label}</span></div></TableCell>
      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => onEditTask(item)}><Edit3 className="h-4 w-4" /></Button></TableCell>
    </TableRow>
  );
});
MaintenanceTaskRow.displayName = 'MaintenanceTaskRow';


export default function AircraftMaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tailNumber = typeof params.tailNumber === 'string' ? decodeURIComponent(params.tailNumber) : undefined;
  const { toast } = useToast();

  const [currentAircraft, setCurrentAircraft] = useState<FleetAircraft | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<FlowMaintenanceTask[]>([]);
  const [aircraftDiscrepancies, setAircraftDiscrepancies] = useState<AircraftDiscrepancy[]>([]);
  const [melItems, setMelItems] = useState<MelItem[]>([]);

  const [editableComponentTimes, setEditableComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);
  const [originalComponentTimes, setOriginalComponentTimes] = useState<Array<{ componentName: string; currentTime: number; currentCycles: number }>>([]);

  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingDiscrepancies, setIsLoadingDiscrepancies] = useState(true);
  const [isLoadingComponentTimes, setIsLoadingComponentTimes] = useState(true);
  const [isLoadingMelItems, setIsLoadingMelItems] = useState(true);

  const [isSavingAircraftInfo, startSavingAircraftInfoTransition] = useTransition();
  const [isEditingAircraftInfo, setIsEditingAircraftInfo] = useState(false);
  const [isEditingComponentTimes, setIsEditingComponentTimes] = useState(false);
  const [isSavingComponentTimes, startSavingComponentTimesTransition] = useTransition();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskOriginalId, setEditingTaskOriginalId] = useState<string | null>(null);
  const [initialModalFormData, setInitialModalFormData] = useState<Partial<MaintenanceTaskFormData> | null>(null);

  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);
  const [isSavingDiscrepancy, startSavingDiscrepancyTransition] = useTransition();
  const [editingDiscrepancyId, setEditingDiscrepancyId] = useState<string | null>(null);
  const [initialDiscrepancyModalData, setInitialDiscrepancyModalData] = useState<AircraftDiscrepancy | null>(null);
  const [discrepancyToDelete, setDiscrepancyToDelete] = useState<AircraftDiscrepancy | null>(null);
  const [showDeleteDiscrepancyConfirm, setShowDeleteDiscrepancyConfirm] = useState(false);
  const [isDeletingDiscrepancy, startDeletingDiscrepancyTransition] = useTransition();

  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [discrepancyToSignOff, setDiscrepancyToSignOff] = useState<AircraftDiscrepancy | null>(null);
  const [isSavingSignOff, startSavingSignOffTransition] = useTransition();
  
  const [isMelModalOpen, setIsMelModalOpen] = useState(false);
  const [isEditingMelItem, setIsEditingMelItem] = useState(false);
  const [currentMelItemToEdit, setCurrentMelItemToEdit] = useState<MelItem | null>(null);
  const [isSavingMelItem, startSavingMelItemTransition] = useTransition();
  const [melItemToDelete, setMelItemToDelete] = useState<MelItem | null>(null);
  const [showDeleteMelConfirm, setShowDeleteMelConfirm] = useState(false);
  const [isDeletingMelItem, startDeletingMelItemTransition] = useTransition();

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

  const loadMelItems = useCallback(async (aircraftId: string) => {
    setIsLoadingMelItems(true);
    try {
      const melItemsFromDb = await fetchMelItemsForAircraft({ aircraftId });
      setMelItems(melItemsFromDb);
    } catch (error) {
      console.error("Failed to load MEL items:", error);
      toast({ title: "Error Loading MELs", description: "Could not load MEL items.", variant: "destructive" });
      setMelItems([]);
    } finally {
      setIsLoadingMelItems(false);
    }
  }, [toast]);


  useEffect(() => {
    const loadAircraftDetails = async () => {
      if (!tailNumber) { setIsLoadingAircraft(false); return; }
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        const foundAircraft = fleet.find(ac => ac.tailNumber === tailNumber);
        if (foundAircraft) { setCurrentAircraft(foundAircraft); resetAircraftInfoForm(foundAircraft); await loadAndInitializeComponentTimes(foundAircraft); await loadMaintenanceTasks(foundAircraft.id); await loadAircraftDiscrepancies(foundAircraft.id); await loadMelItems(foundAircraft.id); }
        else { setCurrentAircraft(null); setMaintenanceTasks([]); await loadAndInitializeComponentTimes(null); setAircraftDiscrepancies([]); setMelItems([]); toast({ title: "Error", description: `Aircraft ${tailNumber} not found in fleet.`, variant: "destructive" }); }
      } catch (error) { console.error("Failed to load aircraft details:", error); toast({ title: "Error", description: "Could not load aircraft details.", variant: "destructive" }); }
      finally { setIsLoadingAircraft(false); }
    };
    loadAircraftDetails();
  }, [tailNumber, toast, loadAndInitializeComponentTimes, loadMaintenanceTasks, loadAircraftDiscrepancies, loadMelItems, resetAircraftInfoForm]);

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

  const handleOpenAddTaskModal = useCallback(() => {
    setEditingTaskOriginalId(null);
    setInitialModalFormData(defaultMaintenanceTaskFormValues);
    setIsTaskModalOpen(true);
  }, []);

  const handleOpenEditTaskModal = useCallback((taskToEdit: FlowMaintenanceTask) => {
    setEditingTaskOriginalId(taskToEdit.id);
    const formData: MaintenanceTaskFormData = { itemTitle: taskToEdit.itemTitle, referenceNumber: taskToEdit.referenceNumber || '', partNumber: taskToEdit.partNumber || '', serialNumber: taskToEdit.serialNumber || '', itemType: taskToEdit.itemType, associatedComponent: taskToEdit.associatedComponent || '', details: taskToEdit.details || '', isActive: taskToEdit.isActive, trackType: taskToEdit.trackType, isTripsNotAffected: taskToEdit.isTripsNotAffected || false, lastCompletedDate: taskToEdit.lastCompletedDate || '', lastCompletedHours: taskToEdit.lastCompletedHours, lastCompletedCycles: taskToEdit.lastCompletedCycles, lastCompletedNotes: taskToEdit.lastCompletedNotes || '', isHoursDueEnabled: taskToEdit.isHoursDueEnabled || false, hoursDue: taskToEdit.hoursDue, hoursTolerance: taskToEdit.hoursTolerance, alertHoursPrior: taskToEdit.alertHoursPrior, isCyclesDueEnabled: !!taskToEdit.isCyclesDueEnabled, cyclesDue: taskToEdit.cyclesDue, cyclesTolerance: taskToEdit.cyclesTolerance, alertCyclesPrior: taskToEdit.alertCyclesPrior, isDaysDueEnabled: taskToEdit.isDaysDueEnabled || false, daysIntervalType: taskToEdit.daysIntervalType || 'days', daysDueValue: taskToEdit.daysDueValue || '', daysTolerance: taskToEdit.daysTolerance, alertDaysPrior: taskToEdit.alertDaysPrior, };
    setInitialModalFormData(formData);
    setIsTaskModalOpen(true);
  }, []);

  const handleSaveTask = useCallback(async (taskFormData: MaintenanceTaskFormData) => {
    if (!currentAircraft) return;
    const taskToSave: FlowMaintenanceTask = { ...taskFormData, id: editingTaskOriginalId || `MX-${Date.now()}-${Math.random().toString(16).slice(2)}`, aircraftId: currentAircraft.id, };
    try { await saveMaintenanceTask(taskToSave); toast({ title: editingTaskOriginalId ? "Task Updated" : "New Task Added", description: `Task "${taskToSave.itemTitle}" for ${currentAircraft.tailNumber} saved to Firestore.`, }); await loadMaintenanceTasks(currentAircraft.id); setIsTaskModalOpen(false); setEditingTaskOriginalId(null); setInitialModalFormData(null); }
    catch (error) { console.error("Failed to save task:", error); toast({ title: "Error Saving Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
  }, [currentAircraft, editingTaskOriginalId, toast, loadMaintenanceTasks]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!currentAircraft) return;
    try { await deleteMaintenanceTask({ taskId }); toast({ title: "Task Deleted", description: `Task ID ${taskId} removed from Firestore.` }); await loadMaintenanceTasks(currentAircraft.id); setIsTaskModalOpen(false); }
    catch (error) { console.error("Failed to delete task:", error); toast({ title: "Error Deleting Task", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
  }, [currentAircraft, toast, loadMaintenanceTasks]);

  const handleOpenAddDiscrepancyModal = useCallback(() => {
    setEditingDiscrepancyId(null);
    setInitialDiscrepancyModalData(null);
    setIsDiscrepancyModalOpen(true);
  }, []);

  const handleOpenEditDiscrepancyModal = (discrepancy: AircraftDiscrepancy) => {
    setEditingDiscrepancyId(discrepancy.id);
    setInitialDiscrepancyModalData(discrepancy);
    setIsDiscrepancyModalOpen(true);
  };
  
  const handleSaveDiscrepancy = async (discrepancyFormDataFromModal: Omit<SaveAircraftDiscrepancyInput, 'status'>, originalId?: string) => {
    if (!currentAircraft) return;
    startSavingDiscrepancyTransition(async () => {
      try {
        let statusToSet: AircraftDiscrepancy['status'] = "Open"; // Default for new
        if (originalId) { // If editing, preserve existing status or use status from a more complete form
          const existingDiscrepancy = aircraftDiscrepancies.find(d => d.id === originalId);
          statusToSet = existingDiscrepancy?.status || "Open";
        }

        const completeDiscrepancyData: SaveAircraftDiscrepancyInput = {
            ...discrepancyFormDataFromModal,
            id: originalId,
            // Status is now handled by the flow or explicitly set here for clarity if needed for edits from other forms
            // For this modal, if editing, the flow will preserve. If new, flow sets to "Open".
            // If the `discrepancyFormDataFromModal` could include status for edits, it would be:
            // status: originalId ? (discrepancyFormDataFromModal as SaveAircraftDiscrepancyInput).status || statusToSet : "Open",
        };

        await saveAircraftDiscrepancy(completeDiscrepancyData);
        toast({ title: originalId ? "Discrepancy Updated" : "New Discrepancy Logged", description: `Discrepancy for ${currentAircraft.tailNumber} saved.` });
        await loadAircraftDiscrepancies(currentAircraft.id);
        setIsDiscrepancyModalOpen(false);
        setEditingDiscrepancyId(null); 
        setInitialDiscrepancyModalData(null);
      } catch (error) { console.error("Failed to save discrepancy:", error); toast({ title: "Error Saving Discrepancy", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
    });
  };

  const confirmDeleteDiscrepancy = (discrepancy: AircraftDiscrepancy) => {
    setDiscrepancyToDelete(discrepancy);
    setShowDeleteDiscrepancyConfirm(true);
  };

  const executeDeleteDiscrepancy = async () => {
    if (!discrepancyToDelete || !currentAircraft) return;
    startDeletingDiscrepancyTransition(async () => {
      try {
        await deleteAircraftDiscrepancy({ discrepancyId: discrepancyToDelete.id });
        toast({ title: "Discrepancy Deleted", description: `Discrepancy "${discrepancyToDelete.description.substring(0,20)}..." removed.` });
        await loadAircraftDiscrepancies(currentAircraft.id);
      } catch (error) { console.error("Failed to delete discrepancy:", error); toast({ title: "Error Deleting Discrepancy", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" }); }
      finally { setShowDeleteDiscrepancyConfirm(false); setDiscrepancyToDelete(null); }
    });
  };

  const handleOpenSignOffModal = (discrepancy: AircraftDiscrepancy) => {
    setDiscrepancyToSignOff(discrepancy);
    setIsSignOffModalOpen(true);
  };

  const handleExecuteSignOff = async (discrepancyId: string, signOffData: SignOffFormData) => {
    if (!currentAircraft) return;
    const originalDiscrepancy = aircraftDiscrepancies.find(d => d.id === discrepancyId);
    if (!originalDiscrepancy) {
        toast({ title: "Error", description: "Original discrepancy not found for sign-off.", variant: "destructive"});
        return;
    }
    startSavingSignOffTransition(async () => {
        try {
            const dataToSave: SaveAircraftDiscrepancyInput = {
                aircraftId: originalDiscrepancy.aircraftId,
                aircraftTailNumber: originalDiscrepancy.aircraftTailNumber,
                status: "Closed", 
                dateDiscovered: originalDiscrepancy.dateDiscovered,
                // timeDiscovered: originalDiscrepancy.timeDiscovered, // Removed
                description: originalDiscrepancy.description,
                discoveredBy: originalDiscrepancy.discoveredBy,
                discoveredByCertNumber: originalDiscrepancy.discoveredByCertNumber,
                isDeferred: false, 
                deferralReference: undefined,
                deferralDate: undefined,
                correctiveAction: signOffData.correctiveAction,
                dateCorrected: format(signOffData.dateCorrected, "yyyy-MM-dd"),
                correctedBy: signOffData.correctedBy,
                correctedByCertNumber: signOffData.correctedByCertNumber,
            };
            await saveAircraftDiscrepancy({ ...dataToSave, id: discrepancyId });
            toast({ title: "Discrepancy Closed", description: `Discrepancy for ${currentAircraft.tailNumber} signed off and closed.`});
            await loadAircraftDiscrepancies(currentAircraft.id);
            setIsSignOffModalOpen(false);
            setDiscrepancyToSignOff(null);
        } catch (error) {
            console.error("Failed to sign off discrepancy:", error);
            toast({ title: "Error Signing Off", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        }
    });
  };

  const handleOpenAddMelModal = useCallback(() => {
    setIsEditingMelItem(false);
    setCurrentMelItemToEdit(null);
    setIsMelModalOpen(true);
  }, []);

  const handleOpenEditMelModal = useCallback((melItem: MelItem) => {
    setIsEditingMelItem(true);
    setCurrentMelItemToEdit(melItem);
    setIsMelModalOpen(true);
  }, []);

  const handleSaveMelItem = useCallback(async (melItemData: SaveMelItemInput, originalMelId?: string) => {
    if (!currentAircraft) return;
    startSavingMelItemTransition(async () => {
      try {
        await saveMelItem({ ...melItemData, id: originalMelId });
        toast({ title: originalMelId ? "MEL Item Updated" : "New MEL Item Added", description: `MEL item for ${currentAircraft.tailNumber} saved.` });
        await loadMelItems(currentAircraft.id);
        setIsMelModalOpen(false);
      } catch (error) {
        console.error("Failed to save MEL item:", error);
        toast({ title: "Error Saving MEL Item", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  }, [currentAircraft, toast, loadMelItems]);
  
  const confirmDeleteMelItem = useCallback((melItem: MelItem) => {
    setMelItemToDelete(melItem);
    setShowDeleteMelConfirm(true);
  }, []);

  const executeDeleteMelItem = useCallback(async () => {
    if (!melItemToDelete || !currentAircraft) return;
    startDeletingMelItemTransition(async () => {
      try {
        await deleteMelItem({ melItemId: melItemToDelete.id });
        toast({ title: "MEL Item Deleted", description: `MEL Item "${melItemToDelete.melNumber}" removed.`});
        await loadMelItems(currentAircraft.id);
      } catch (error) {
        console.error("Failed to delete MEL Item:", error);
        toast({ title: "Error Deleting MEL Item", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      } finally {
        setShowDeleteMelConfirm(false);
        setMelItemToDelete(null);
      }
    });
  }, [melItemToDelete, currentAircraft, toast, loadMelItems]);
  
  const availableComponentsForFilter = useMemo(() => { const uniqueComponents = new Set<string>(); maintenanceTasks.forEach(task => { if (task.associatedComponent && task.associatedComponent.trim() !== "") { uniqueComponents.add(task.associatedComponent.trim()); } else { uniqueComponents.add("Airframe"); } }); return Array.from(uniqueComponents).sort(); }, [maintenanceTasks]);

  const displayedTasks = useMemo(() => {
    if (isLoadingComponentTimes) return [];
    let filtered = maintenanceTasks.map(task => calculateLocalDisplayFields(task, editableComponentTimes));
    if (searchTerm) { const lowerSearchTerm = searchTerm.toLowerCase(); filtered = filtered.filter(task => task.itemTitle.toLowerCase().includes(lowerSearchTerm) || (task.referenceNumber && task.referenceNumber.toLowerCase().includes(lowerSearchTerm)) || task.itemType.toLowerCase().includes(lowerSearchTerm) || (task.associatedComponent && task.associatedComponent.toLowerCase().includes(lowerSearchTerm)) ); }
    if (statusFilter !== 'all') { filtered = filtered.filter(task => { if (statusFilter === 'active') return task.isActive; if (statusFilter === 'inactive') return !task.isActive; if (!task.isActive) return false; const status = getLocalReleaseStatus(task.toGoData, task); if (statusFilter === 'overdue') return status.label === 'Overdue'; if (statusFilter === 'dueSoon') return status.label === 'Due Soon'; if (statusFilter === 'gracePeriod') return status.label === 'Grace Period'; return true; }); }
    if (componentFilter !== 'all') { filtered = filtered.filter(task => (task.associatedComponent || "Airframe") === componentFilter); }
    if (sortConfig !== null) { filtered.sort((a, b) => { let aValue: string | number | undefined; let bValue: string | number | undefined; if (sortConfig.key === 'toGoNumeric') { aValue = a.toGoData?.numeric; bValue = b.toGoData?.numeric; } else { aValue = a[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined; bValue = b[sortConfig.key as keyof DisplayMaintenanceItem] as string | number | undefined; } if (aValue === undefined && bValue === undefined) return 0; if (aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1; if (bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1; if (typeof aValue === 'string' && typeof bValue === 'string') { const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase()); return sortConfig.direction === 'ascending' ? comparison : -comparison; } if (typeof aValue === 'number' && typeof bValue === 'number') { return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue; } return 0; }); }
    return filtered;
  }, [maintenanceTasks, searchTerm, statusFilter, componentFilter, sortConfig, editableComponentTimes, isLoadingComponentTimes]);

  const handleSelectTask = useCallback((taskId: string, checked: boolean) => {
    setSelectedTaskIds(prev => checked ? [...prev, taskId] : prev.filter(id => id !== taskId) );
  }, []);

  const mappedTaskRows = useMemo(() => {
    return displayedTasks.map((item) => (
      <MaintenanceTaskRow
        key={item.id}
        task={item}
        isSelected={selectedTaskIds.includes(item.id)}
        onSelectTask={handleSelectTask}
        onEditTask={handleOpenEditTaskModal}
      />
    ));
  }, [displayedTasks, selectedTaskIds, handleSelectTask, handleOpenEditTaskModal]);

  const tableBodyContent = useMemo(() => {
    if (displayedTasks.length === 0) {
      return ( <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-10"><div>No maintenance tasks match your criteria.<Button variant="link" className="p-0 ml-1" onClick={handleOpenAddTaskModal}>Add one now?</Button></div></TableCell></TableRow> );
    }
    return mappedTaskRows;
  }, [displayedTasks, handleOpenAddTaskModal, mappedTaskRows]);


  const requestSort = (key: SortKey) => { let direction: SortDirection = 'ascending'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction }); };
  const getSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) { return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />; } return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />; };

  const handleSelectAllTasks = (checked: boolean) => { if (checked) { setSelectedTaskIds(displayedTasks.map(task => task.id)); } else { setSelectedTaskIds([]); } };
  
  const generateWorkOrderHtml = ( tasksToReport: DisplayMaintenanceItem[], aircraft: FleetAircraft, componentTimes: Array<{ componentName: string; currentTime: number; currentCycles: number }>, companyProfile: CompanyProfile | null ): string => {
    return "<html><body>DEBUG: Work Order HTML temporarily simplified for testing.</body></html>";
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
  if (!tailNumber || !currentAircraft) { return ( <div> <PageHeader title="Aircraft Not Found" icon={Wrench} actions={ <Button asChild variant="outline"><span><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></span></Button> } /> <Card> <CardContent className="pt-6"> <p>Aircraft "{tailNumber || 'Unknown'}" not found.</p> </CardContent> </Card> </div> ); }
  if (!currentAircraft.isMaintenanceTracked) { return ( <div> <PageHeader title={`Data for ${currentAircraft.tailNumber}`} icon={PlaneIcon} actions={ <Button asChild variant="outline"><span><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></span></Button> } /> <Card className="mb-6"> <CardHeader><CardTitle>Aircraft Information</CardTitle></CardHeader> <CardContent><p className="text-sm text-muted-foreground">Model: {currentAircraft.model}</p></CardContent> </Card> <Card> <CardContent className="pt-6"> <p>Maintenance tracking not enabled for "{currentAircraft.tailNumber}".</p> </CardContent> </Card> </div> ); }

  const pageHeaderTitle = `Maintenance Details for ${currentAircraft.tailNumber}`;
  const pageHeaderDescription = `Tracked items &amp; component status for ${currentAircraft.model} (${currentAircraft.tailNumber}). Component times are loaded from Firestore.`;
  const openDiscrepancyCount = aircraftDiscrepancies.filter(d => d.status !== "Closed").length;
  const openMelItemsCount = melItems.filter(m => m.status !== "Closed").length;

  const openDiscrepanciesForDisplay = aircraftDiscrepancies.filter(d => d.status !== "Closed").sort((a,b) => parseISO(b.dateDiscovered).getTime() - parseISO(a.dateDiscovered).getTime());

  return (
    <div> 
      <PageHeader
        title={pageHeaderTitle}
        description={pageHeaderDescription}
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><span><Link href="/aircraft/currency"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview</Link></span></Button>
            <Button onClick={handleGenerateWorkOrder} disabled={selectedTaskIds.length === 0 || isGeneratingReport}> {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} Generate Work Order ({selectedTaskIds.length}) </Button>
            <Button onClick={handleOpenAddTaskModal}><PlusCircle className="mr-2 h-4 w-4" /> Add New Task</Button>
          </div>
        }
      />
      <Dialog open={isTaskModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsTaskModalOpen(false);
          setInitialModalFormData(null);
          setEditingTaskOriginalId(null);
        } else {
          setIsTaskModalOpen(true);
        }
      }}>
        {initialModalFormData && (
          <AddMaintenanceTaskDialogContent
              aircraft={currentAircraft}
              onSave={handleSaveTask}
              onDelete={handleDeleteTask}
              initialData={initialModalFormData}
              isEditing={!!editingTaskOriginalId}
              currentTaskId={editingTaskOriginalId}
          />
        )}
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-2">
           <CardHeader className="flex flex-row items-start justify-between"> <div className="flex items-center gap-2"><PlaneIcon className="h-6 w-6 text-primary" /><CardTitle>Current Hours & Cycles</CardTitle></div> {!isEditingComponentTimes ? ( <Button variant="outline" size="icon" onClick={() => setIsEditingComponentTimes(true)} disabled={isSavingComponentTimes}> <Edit className="h-4 w-4" /> <span className="sr-only">Edit Component Times</span> </Button> ) : ( <div className="flex gap-2"> <Button variant="ghost" size="icon" onClick={handleCancelEditComponentTimes} disabled={isSavingComponentTimes}> <XCircleIcon className="h-4 w-4" /><span className="sr-only">Cancel Edit</span> </Button> <Button size="icon" onClick={handleSaveComponentTimes} disabled={isSavingComponentTimes}> {isSavingComponentTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="sr-only">Save Component Times</span> </Button> </div> )} </CardHeader>
           <CardContent> {editableComponentTimes.length === 0 ? ( <p className="text-sm text-muted-foreground">No components configured for time tracking. Update in Company Settings or component data not yet loaded.</p> ) : ( <div className="space-y-3"> {editableComponentTimes.map(comp => { let subText = null; if (currentAircraft) { if (comp.componentName === "Airframe") { subText = `${currentAircraft.model || ''}${currentAircraft.serialNumber ? `/${currentAircraft.serialNumber}` : ''}`; } else if (comp.componentName.startsWith("Engine ")) { const engineIndexMatch = comp.componentName.match(/Engine (\d+)/); if (engineIndexMatch && currentAircraft.engineDetails && currentAircraft.engineDetails.length > 0) { const engineNum = parseInt(engineIndexMatch[1], 10); if (engineNum > 0 && engineNum <= currentAircraft.engineDetails.length) { const engine = currentAircraft.engineDetails[engineNum - 1]; subText = `${engine.model || 'N/A Model'}${engine.serialNumber ? `/${engine.serialNumber}` : ''}`; } } } else if (comp.componentName.startsWith("Propeller ")) { const propIndexMatch = comp.componentName.match(/Propeller (\d+)/); if (propIndexMatch && currentAircraft.propellerDetails && currentAircraft.propellerDetails.length > 0) { const propNum = parseInt(propIndexMatch[1], 10); if (propNum > 0 && propNum <= currentAircraft.propellerDetails.length) { const propeller = currentAircraft.propellerDetails[propNum - 1]; subText = `${propeller.model || 'N/A Model'}${propeller.serialNumber ? `/${propeller.serialNumber}` : ''}`; } } } } return ( <div key={comp.componentName} className="grid grid-cols-3 items-start gap-2 border-b pb-2 last:border-b-0 last:pb-0"> <div className="col-span-1"> <span className="text-sm font-medium">{comp.componentName}</span> {subText && <p className="text-xs text-muted-foreground -mt-0.5">{subText}</p>} </div> {isEditingComponentTimes ? ( <> <Input type="number" value={comp.currentTime} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentTime', e.target.value)} placeholder="Hours" className="text-sm h-8" /> <Input type="number" value={comp.currentCycles} onChange={(e) => handleComponentTimeChange(comp.componentName, 'currentCycles', e.target.value)} placeholder="Cycles" className="text-sm h-8" /> </> ) : ( <> <span className="col-span-1 text-sm text-right pt-1">{comp.currentTime.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} hrs</span> <span className="col-span-1 text-sm text-right pt-1">{comp.currentCycles.toLocaleString()} cyc</span> </> )} </div> ); })} </div> )} </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader> <div className="flex justify-between items-start"> <CardTitle className="flex items-center gap-2"><InfoIcon className="h-6 w-6 text-primary" />Aircraft Information</CardTitle> {!isEditingAircraftInfo ? ( <Button variant="outline" size="icon" onClick={() => setIsEditingAircraftInfo(true)} disabled={isSavingAircraftInfo}> <Edit className="h-4 w-4" /> <span className="sr-only">Edit Aircraft Information</span> </Button> ) : ( <div className="flex gap-2"> <Button variant="ghost" size="icon" onClick={() => { setIsEditingAircraftInfo(false); resetAircraftInfoForm(currentAircraft);}} disabled={isSavingAircraftInfo}> <XCircleIcon className="h-4 w-4" /><span className="sr-only">Cancel</span> </Button> <Button variant="default" size="icon" onClick={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} disabled={isSavingAircraftInfo}> {isSavingAircraftInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="sr-only">Save Aircraft Information</span> </Button> </div> )} </div> </CardHeader>
          <CardContent> {isEditingAircraftInfo ? ( <Form {...aircraftInfoForm}> <form onSubmit={aircraftInfoForm.handleSubmit(onSubmitAircraftInfo)} className="space-y-3"> <p className="text-sm"><strong>Tail Number:</strong> {currentAircraft.tailNumber}</p> <p className="text-sm"><strong>Serial #:</strong> {currentAircraft.serialNumber || 'N/A'} <span className="text-xs text-muted-foreground">(Managed in Company Settings)</span></p> <FormField control={aircraftInfoForm.control} name="model" render={({ field }) => ( <FormItem> <FormLabel>Model</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="aircraftYear" render={({ field }) => ( <FormItem> <FormLabel>Year</FormLabel> <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="baseLocation" render={({ field }) => ( <FormItem> <FormLabel>Base Location</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactName" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactPhone" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Phone</FormLabel> <FormControl><Input type="tel" {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="primaryContactEmail" render={({ field }) => ( <FormItem> <FormLabel>Primary Contact Email</FormLabel> <FormControl><Input type="email" {...field} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={aircraftInfoForm.control} name="internalNotes" render={({ field }) => ( <FormItem> <FormLabel>Internal Notes</FormLabel> <FormControl><Textarea {...field} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> </form> </Form> ) : ( <div className="space-y-1.5 text-sm"> <p><strong className="text-muted-foreground w-28 inline-block">Model:</strong> {currentAircraft.model}</p> <p><strong className="text-muted-foreground w-28 inline-block">Serial #:</strong> {currentAircraft.serialNumber || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Year:</strong> {currentAircraft.aircraftYear || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Base:</strong> {currentAircraft.baseLocation || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Contact:</strong> {currentAircraft.primaryContactName || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Phone:</strong> {currentAircraft.primaryContactPhone || 'N/A'}</p> <p><strong className="text-muted-foreground w-28 inline-block">Email:</strong> {currentAircraft.primaryContactEmail || 'N/A'}</p> <div className="pt-2"> <h4 className="font-semibold text-muted-foreground">Internal Notes:</h4> {currentAircraft.internalNotes ? ( <p className="whitespace-pre-wrap p-2 bg-muted/30 rounded-md text-xs">{currentAircraft.internalNotes}</p> ) : ( <p className="text-xs text-muted-foreground pl-2">N/A</p> )} </div> </div> )} </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-lg">
        <Accordion type="single" collapsible defaultValue="discrepancies-item" className="w-full">
          <AccordionItem value="aircraft-status-logs-item">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl">Aircraft Status &amp; Logs</CardTitle>
                 {(openDiscrepancyCount > 0 || openMelItemsCount > 0) && (
                    <Badge variant="destructive" className="ml-2">
                        {openDiscrepancyCount > 0 && `${openDiscrepancyCount} Open Disc.`}
                        {openDiscrepancyCount > 0 && openMelItemsCount > 0 && " / "}
                        {openMelItemsCount > 0 && `${openMelItemsCount} Open MELs`}
                    </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <Tabs defaultValue="discrepancies" className="w-full px-6 pb-4">
                <TabsList className="mb-4 grid w-full grid-cols-3">
                  <TabsTrigger value="discrepancies">Discrepancies ({openDiscrepancyCount})</TabsTrigger>
                  <TabsTrigger value="mels">MELs ({openMelItemsCount})</TabsTrigger>
                  <TabsTrigger value="damageLog">Damage Log (0)</TabsTrigger>
                </TabsList>
                <TabsContent value="discrepancies">
                  <CardDescription className="mb-3">Track and manage discrepancies for {currentAircraft.tailNumber}.</CardDescription>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={handleOpenAddDiscrepancyModal} disabled={!currentAircraft || isSavingDiscrepancy} className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Discrepancy
                      </Button>
                      <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href="/aircraft/discrepancies">
                          <ListChecks className="mr-2 h-4 w-4" /> View Full Discrepancy Log
                        </Link>
                      </Button>
                    </div>
                    {isLoadingDiscrepancies ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-destructive" /><p className="ml-2 text-muted-foreground">Loading discrepancies...</p></div>
                    ) : (
                        openDiscrepanciesForDisplay.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No open or deferred discrepancies for this aircraft.</p>
                        ) : (
                           <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Date Disc.</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {openDiscrepanciesForDisplay.map(disc => (
                                <TableRow key={disc.id} className={disc.status === "Open" ? "bg-destructive/5 hover:bg-destructive/10" : (disc.status === "Deferred" ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "")}>
                                  <TableCell><Badge variant={disc.status === "Open" ? "destructive" : "secondary"}>{disc.status}</Badge></TableCell>
                                  <TableCell className="text-xs">{format(parseISO(disc.dateDiscovered), 'MM/dd/yy')}</TableCell>
                                  <TableCell className="text-xs max-w-xs truncate" title={disc.description}>{disc.description}</TableCell>
                                  <TableCell className="text-right space-x-1">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEditDiscrepancyModal(disc)} disabled={isSavingDiscrepancy || isDeletingDiscrepancy || isSavingSignOff}>Edit</Button>
                                    {(disc.status === "Open" || disc.status === "Deferred") && (
                                        <Button 
                                            size="sm" 
                                            className="bg-green-500 hover:bg-green-600 text-white border-green-700 hover:border-green-800 shadow-md"
                                            onClick={() => handleOpenSignOffModal(disc)} 
                                            disabled={isSavingDiscrepancy || isDeletingDiscrepancy || isSavingSignOff}
                                        > 
                                          Clear 
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirmDeleteDiscrepancy(disc)} disabled={isSavingDiscrepancy || isDeletingDiscrepancy || isSavingSignOff || disc.status === "Closed"}> <Trash2 className="h-4 w-4" /> </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                           </Table>
                        )
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="mels">
                  <CardDescription className="mb-3">Manage Minimum Equipment List items for {currentAircraft.tailNumber}.</CardDescription>
                   <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                       <Button onClick={handleOpenAddMelModal} disabled={!currentAircraft || isSavingMelItem} className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New MEL Item
                      </Button>
                      <Button variant="outline" onClick={() => toast({ title: "Coming Soon!", description: "A dedicated page for full MEL log viewing is planned."})} className="w-full sm:w-auto">
                        <BookLock className="mr-2 h-4 w-4" /> View Full MEL Log (Coming Soon)
                      </Button>
                    </div>
                     {isLoadingMelItems ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading MEL items...</p></div>
                    ) : melItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No MEL items logged for this aircraft.</p>
                    ) : (
                        <Table>
                            <TableHeader><TableRow><TableHead>MEL #</TableHead><TableHead>Description</TableHead><TableHead>Cat.</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {melItems.map(item => (
                                    <TableRow key={item.id} className={item.status === "Closed" ? "opacity-60 bg-muted/30" : (item.status === "Open" ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "")}>
                                        <TableCell className="font-medium text-xs">{item.melNumber}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>
                                        <TableCell className="text-xs text-center">{item.category || '-'}</TableCell>
                                        <TableCell><Badge variant={item.status === "Open" ? "destructive" : "default"} className="text-xs">{item.status}</Badge></TableCell>
                                        <TableCell className="text-xs">{item.dueDate && isValid(parseISO(item.dueDate)) ? format(parseISO(item.dueDate), 'MM/dd/yy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditMelModal(item)} disabled={isSavingMelItem || isDeletingMelItem}><Edit3 className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirmDeleteMelItem(item)} disabled={isSavingMelItem || isDeletingMelItem}><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="damageLog">
                  <CardDescription className="mb-3">Track and manage any reported damage for {currentAircraft.tailNumber}.</CardDescription>
                   <div className="space-y-3 text-center py-4">
                    <p className="text-muted-foreground">Damage Log information will be available here soon.</p>
                     <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button variant="secondary" onClick={() => toast({ title: "Coming Soon!", description: "Functionality to add damage reports is planned."})} className="w-full sm:w-auto">
                          <FileWarning className="mr-2 h-4 w-4" /> Add New Damage Report (Coming Soon)
                        </Button>
                        <Button variant="outline" onClick={() => toast({ title: "Coming Soon!", description: "A dedicated page for full damage log viewing is planned."})} className="w-full sm:w-auto">
                          <ListChecks className="mr-2 h-4 w-4" /> View Full Damage Log (Coming Soon)
                        </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" />Maintenance Items</CardTitle>
          <CardDescription> Overview of scheduled and upcoming maintenance tasks for {currentAircraft.tailNumber}. Calculated "To Go" is based on the values in "Current Hours &amp; Cycles" above. </CardDescription>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 items-center"> <div className="relative flex-grow w-full sm:w-auto"> <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> <Input type="search" placeholder="Search tasks (title, ref, type, component)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full" /> {searchTerm && ( <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setSearchTerm('')}> <XCircleIcon className="h-4 w-4"/> </Button> )} </div> <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}> <SelectTrigger className="w-full sm:w-[180px]"> <SelectValue placeholder="Filter by status" /> </SelectTrigger> <SelectContent> <SelectItem value="all">All Statuses</SelectItem> <SelectItem value="active">Active Items</SelectItem> <SelectItem value="inactive">Inactive Items</SelectItem> <SelectItem value="dueSoon">Due Soon (Active)</SelectItem> <SelectItem value="overdue">Overdue (Active)</SelectItem> <SelectItem value="gracePeriod">Grace Period (Active)</SelectItem> </SelectContent> </Select> <Select value={componentFilter} onValueChange={setComponentFilter}> <SelectTrigger className="w-full sm:w-[200px]"> <FilterIcon className="h-4 w-4 mr-2 opacity-50" /> <SelectValue placeholder="Filter by component" /> </SelectTrigger> <SelectContent> <SelectItem value="all">All Components</SelectItem> {availableComponentsForFilter.map(comp => ( <SelectItem key={comp} value={comp}>{comp}</SelectItem> ))} </SelectContent> </Select> </div>
        </CardHeader>
        <CardContent>{isLoadingTasks ? ( <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading maintenance tasks...</p></div> ) : ( <Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={selectedTaskIds.length === displayedTasks.length && displayedTasks.length > 0} onCheckedChange={(checked) => handleSelectAllTasks(Boolean(checked))} aria-label="Select all tasks" disabled={displayedTasks.length === 0} /></TableHead><TableHead>Ref #</TableHead><TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('itemTitle')} className="px-1 -ml-2"> Title {getSortIcon('itemTitle')} </Button></TableHead><TableHead>Type</TableHead><TableHead>Component</TableHead><TableHead>Frequency</TableHead><TableHead>Last Done</TableHead><TableHead>Due At</TableHead><TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('toGoNumeric')} className="px-1 -ml-2"> To Go {getSortIcon('toGoNumeric')} </Button></TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{tableBodyContent}</TableBody></Table> )}
        </CardContent>
      </Card>

      <AddEditAircraftDiscrepancyModal
        isOpen={isDiscrepancyModalOpen}
        setIsOpen={setIsDiscrepancyModalOpen}
        onSave={handleSaveDiscrepancy}
        aircraft={currentAircraft}
        initialData={initialDiscrepancyModalData}
        isEditing={!!editingDiscrepancyId}
        isSaving={isSavingDiscrepancy}
      />
      
      <SignOffDiscrepancyModal
        isOpen={isSignOffModalOpen}
        setIsOpen={setIsSignOffModalOpen}
        onSignOff={handleExecuteSignOff}
        discrepancy={discrepancyToSignOff}
        isSaving={isSavingSignOff}
      />

      {showDeleteDiscrepancyConfirm && discrepancyToDelete && (
        <AlertDialogModalContent>
          <AlertDialogModalHeader>
            <AlertDialogModalTitle>Confirm Delete Discrepancy</AlertDialogModalTitle>
            <AlertDialogModalDescription>
              Are you sure you want to delete the discrepancy: "{discrepancyToDelete.description.substring(0,50)}..."? This action cannot be undone.
            </AlertDialogModalDescription>
          </AlertDialogModalHeader>
          <AlertDialogModalFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDiscrepancyConfirm(false)} disabled={isDeletingDiscrepancy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeDeleteDiscrepancy} disabled={isDeletingDiscrepancy}>
              {isDeletingDiscrepancy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogModalFooter>
        </AlertDialogModalContent>
      )}

      <AddEditMelItemModal
        isOpen={isMelModalOpen}
        setIsOpen={setIsMelModalOpen}
        onSave={handleSaveMelItem}
        aircraft={currentAircraft}
        initialData={currentMelItemToEdit}
        isEditing={isEditingMelItem}
        isSaving={isSavingMelItem}
      />

      {showDeleteMelConfirm && melItemToDelete && (
        <AlertDialogModalContent>
          <AlertDialogModalHeader>
            <AlertDialogModalTitle>Confirm Delete MEL Item</AlertDialogModalTitle>
            <AlertDialogModalDescription>
              Are you sure you want to delete MEL Item "{melItemToDelete.melNumber}: {melItemToDelete.description.substring(0,40)}..."? This action cannot be undone.
            </AlertDialogModalDescription>
          </AlertDialogModalHeader>
          <AlertDialogModalFooter>
            <AlertDialogCancel onClick={() => setShowDeleteMelConfirm(false)} disabled={isDeletingMelItem}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeDeleteMelItem} disabled={isDeletingMelItem}>
              {isDeletingMelItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogModalFooter>
        </AlertDialogModalContent>
      )}
    </div>
  );
}
    

    

    














    

      
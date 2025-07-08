
"use client";

import React, { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, PlusCircle, Search, Edit, Trash2, Paperclip, ArrowUpDown, FileText, TrendingUp, Wrench, Calendar as CalendarIcon, Loader2, Hammer } from 'lucide-react';
import { DateRange } from "react-day-picker"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { addDays, format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, isWithinInterval, parseISO, isValid, parse } from "date-fns"
import { cn } from "@/lib/utils"
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { fetchMaintenanceCosts, deleteMaintenanceCost, type MaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';
import { fetchMaintenanceJobs, deleteMaintenanceJob, type MaintenanceJob } from '@/ai/flows/manage-maintenance-jobs-flow';
import { maintenanceJobStatuses, type MaintenanceJobStatus } from '@/ai/schemas/maintenance-job-schemas';
import { AddEditJobModal } from '@/app/(app)/maintenance/jobs/components/add-edit-job-modal';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAllFlightLogs, type FlightLogLeg } from '@/ai/flows/manage-flight-logs-flow';


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';

type Cost = MaintenanceCost & { variance: number; projectedTotal: number; actualTotal: number; workOrderNumber?: string };
type SortKey = 'invoiceDate' | 'tailNumber' | 'invoiceNumber' | 'costType' | 'category' | 'projectedTotal' | 'actualTotal' | 'variance' | 'workOrderNumber' | 'status';

interface DisplayItem {
    id: string;
    type: 'cost' | 'job';
    tailNumber: string;
    invoiceNumber: string;
    invoiceDate: string; 
    workOrderNumber?: string;
    status: MaintenanceJobStatus | 'Completed';
    projectedTotal: number;
    actualTotal: number;
    variance: number;
    aircraftId: string;
    jobId?: string;
}


const formatCurrency = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export default function MaintenanceCostsPage() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [allLogs, setAllLogs] = useState<FlightLogLeg[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [itemToDelete, setItemToDelete] = useState<DisplayItem | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    aircraft: 'all',
    jobStatus: 'all',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'invoiceDate', direction: 'descending' });
  const [summaryMetrics, setSummaryMetrics] = useState({
    thisMonth: 0,
    monthChange: 0,
    openWorkOrders: 0,
    thisQuarter: 0,
    quarterChange: 0,
    avgCostPerHour: 0,
    thisQuarterTotalFlightHours: 0,
  });
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<MaintenanceJob | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedCosts, fetchedJobs, fetchedFleet, fetchedLogs] = await Promise.all([
        fetchMaintenanceCosts(),
        fetchMaintenanceJobs(),
        fetchFleetAircraft(),
        fetchAllFlightLogs(),
      ]);
      const jobsMap = new Map(fetchedJobs.map(job => [job.id, job]));
      
      const processedCosts = fetchedCosts.map(c => {
        const projectedTotal = c.costBreakdowns.reduce((sum, item) => sum + item.projectedCost, 0);
        const actualTotal = c.costBreakdowns.reduce((sum, item) => sum + item.actualCost, 0);
        const associatedJob = c.jobId ? jobsMap.get(c.jobId) : undefined;
        return {
          ...c,
          projectedTotal,
          actualTotal,
          variance: actualTotal - projectedTotal,
          workOrderNumber: associatedJob?.workOrderNumber,
          jobStatus: associatedJob?.status,
        };
      });
      setCosts(processedCosts as Cost[]);
      setJobs(fetchedJobs);
      setFleet(fetchedFleet);
      setAllLogs(fetchedLogs);
    } catch (error) {
      console.error("Failed to fetch maintenance data:", error);
      toast({ title: "Error", description: "Could not load maintenance costs or jobs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  useEffect(() => {
    if (isLoading) return;
    const now = new Date();
    const getCostsInDateRange = (startDate: Date, endDate: Date) => costs.filter(c => isWithinInterval(parse(c.invoiceDate, 'yyyy-MM-dd', new Date()), { start: startDate, end: endDate }));
    
    // New: filter logs by date range
    const getLogsInDateRange = (startDate: Date, endDate: Date) => {
      return allLogs.filter(l => {
        if (!l.createdAt) return false;
        try {
            const logDate = parseISO(l.createdAt);
            return isWithinInterval(logDate, { start: startDate, end: endDate });
        } catch {
            return false;
        }
      });
    };
    
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const thisMonthTotal = getCostsInDateRange(thisMonthStart, thisMonthEnd).reduce((sum, c) => sum + c.actualTotal, 0);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const lastMonthTotal = getCostsInDateRange(lastMonthStart, lastMonthEnd).reduce((sum, c) => sum + c.actualTotal, 0);
    const monthChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : (thisMonthTotal > 0 ? 100 : 0);
    
    const thisQuarterStart = startOfQuarter(now);
    const thisQuarterEnd = endOfQuarter(now);
    
    const thisQuarterCosts = getCostsInDateRange(thisQuarterStart, thisQuarterEnd);
    const thisQuarterTotalCost = thisQuarterCosts.reduce((sum, c) => sum + c.actualTotal, 0);
    
    const thisQuarterLogs = getLogsInDateRange(thisQuarterStart, thisQuarterEnd);
    const calculateFlightTimeFromLog = (log: FlightLogLeg): number => {
        if (typeof log.hobbsTakeOff === 'number' && typeof log.hobbsLanding === 'number' && log.hobbsLanding > log.hobbsTakeOff) {
            return parseFloat((log.hobbsLanding - log.hobbsTakeOff).toFixed(2));
        }
        return 0;
    };
    const thisQuarterTotalFlightHours = thisQuarterLogs.reduce((sum, log) => sum + calculateFlightTimeFromLog(log), 0);
    const avgCostPerHour = thisQuarterTotalFlightHours > 0 ? thisQuarterTotalCost / thisQuarterTotalFlightHours : 0;
    
    const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
    const lastQuarterEnd = endOfQuarter(subQuarters(now, 1));
    const lastQuarterTotal = getCostsInDateRange(lastQuarterStart, lastQuarterEnd).reduce((sum, c) => sum + c.actualTotal, 0);
    const quarterChange = lastQuarterTotal > 0 ? ((thisQuarterTotalCost - lastQuarterTotal) / lastQuarterTotal) * 100 : (thisQuarterTotalCost > 0 ? 100 : 0);
    
    const openWorkOrders = jobs.filter(j => 
        j.status === 'Quote' || 
        j.status === 'Opened' || 
        j.status === 'Accepted' || 
        j.status === 'In Progress'
    ).length;

    setSummaryMetrics({ 
        thisMonth: thisMonthTotal, 
        monthChange, 
        thisQuarter: thisQuarterTotalCost, 
        quarterChange, 
        openWorkOrders,
        avgCostPerHour,
        thisQuarterTotalFlightHours,
    });
  }, [costs, jobs, allLogs, isLoading]);

  const confirmDelete = (item: DisplayItem) => setItemToDelete(item);

  const executeDelete = () => {
    if (!itemToDelete) return;
    startDeletingTransition(async () => {
      try {
        if (itemToDelete.type === 'cost') {
            await deleteMaintenanceCost({ costId: itemToDelete.id });
            toast({ title: "Success", description: `Invoice ${itemToDelete.invoiceNumber} deleted.` });
        } else {
            await deleteMaintenanceJob({ jobId: itemToDelete.id });
            toast({ title: "Work Order Deleted", description: `Work Order ${itemToDelete.workOrderNumber} deleted.` });
        }
        await loadData();
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
      } finally {
        setItemToDelete(null);
      }
    });
  };

  const displayItems = useMemo<DisplayItem[]>(() => {
    if (isLoading) return [];

    const jobMap = new Map(jobs.map(job => [job.id, job]));
    const costJobIds = new Set(costs.map(c => c.jobId).filter(Boolean));

    const costBasedItems: DisplayItem[] = costs.map(cost => {
      const job = cost.jobId ? jobMap.get(cost.jobId) : undefined;
      return {
        id: cost.id,
        type: 'cost',
        tailNumber: cost.tailNumber,
        invoiceNumber: cost.invoiceNumber,
        invoiceDate: cost.invoiceDate,
        workOrderNumber: job?.workOrderNumber,
        status: job?.status ?? 'Completed',
        projectedTotal: cost.projectedTotal,
        actualTotal: cost.actualTotal,
        variance: cost.variance,
        aircraftId: cost.aircraftId,
        jobId: cost.jobId,
      };
    });

    const jobBasedItems: DisplayItem[] = jobs
      .filter(job => !costJobIds.has(job.id))
      .map(job => {
        const projectedTotal = job.costBreakdowns?.reduce((sum, item) => sum + (item.projectedCost || 0), 0) || 0;
        const actualTotal = job.costBreakdowns?.reduce((sum, item) => sum + (item.actualCost || 0), 0) || 0;
        return {
          id: job.id,
          type: 'job',
          tailNumber: job.tailNumber,
          invoiceNumber: 'N/A',
          invoiceDate: job.dateIssued,
          workOrderNumber: job.workOrderNumber,
          status: job.status,
          projectedTotal: projectedTotal,
          actualTotal: actualTotal,
          variance: actualTotal - projectedTotal,
          aircraftId: job.aircraftId,
          jobId: job.id,
        };
      });
      
    let combined = [...costBasedItems, ...jobBasedItems];

    let filtered = combined.filter(item => {
      const searchMatch = searchTerm
        ? item.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.tailNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.workOrderNumber && item.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const aircraftMatch = filters.aircraft === 'all' || item.aircraftId === filters.aircraft;
      const jobStatusMatch = filters.jobStatus === 'all' || item.status === filters.jobStatus;
      const dateMatch = !dateRange?.from || isWithinInterval(parseISO(item.invoiceDate), { start: dateRange.from, end: dateRange.to || dateRange.from });
      
      return searchMatch && aircraftMatch && dateMatch && jobStatusMatch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];
        if (sortConfig.key === 'invoiceDate') { aValue = parseISO(a.invoiceDate).getTime(); bValue = parseISO(b.invoiceDate).getTime(); }
        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
           return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }
    return filtered;
  }, [costs, jobs, searchTerm, filters, sortConfig, dateRange, isLoading]);

  const requestSort = (key: SortKey) => {
    const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" />;
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };
  
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({ aircraft: 'all', jobStatus: 'all' });
    setDateRange(undefined);
  };
  
  const handleOpenNewJobModal = () => {
      setSelectedJobForEdit(null);
      setIsJobModalOpen(true);
  };

  const handleOpenEditJobModal = (jobId?: string) => {
    if (!jobId) return;
    const job = jobs.find(j => j.id === jobId);
    if (job) {
        setSelectedJobForEdit(job);
        setIsJobModalOpen(true);
    } else {
        toast({title: "Work Order not found", variant: "destructive"});
    }
  };

  const uniqueTailNumbers = useMemo(() => {
    const tailNumbers = new Set<string>();
    costs.forEach(c => tailNumbers.add(c.tailNumber));
    jobs.forEach(j => tailNumbers.add(j.tailNumber));
    return Array.from(tailNumbers).sort();
  }, [costs, jobs]);


  const getStatusBadgeVariant = (status: MaintenanceJobStatus | 'Completed'): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Opened': return 'outline';
      case 'Accepted':
      case 'Quote':
      case 'In Progress': return 'secondary';
      case 'Completed': return 'default';
      case 'Closed': return 'default';
      case 'Canceled': return 'destructive';
      default: return 'outline';
    }
  };


  return (
    <TooltipProvider>
      <PageHeader 
        title="Maintenance Costs &amp; Jobs" 
        icon={DollarSign} 
        actions={
            <div className="flex gap-2">
                <Button asChild><Link href="/maintenance/costs/new"><PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry</Link></Button>
                <Button variant="outline" onClick={handleOpenNewJobModal}><Hammer className="mr-2 h-4 w-4" />New Work Order</Button>
            </div>
        } 
      />
      <div className="grid gap-6 mb-6 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Month</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisMonth)}</div><p className="text-xs text-muted-foreground"><span className={summaryMetrics.monthChange >= 0 ? "text-green-600" : "text-red-600"}>{summaryMetrics.monthChange >= 0 ? '+' : ''}{summaryMetrics.monthChange.toFixed(1)}%</span> from last month</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Quarter</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisQuarter)}</div><p className="text-xs text-muted-foreground"><span className={summaryMetrics.quarterChange >= 0 ? "text-green-600" : "text-red-600"}>{summaryMetrics.quarterChange >= 0 ? '+' : ''}{summaryMetrics.quarterChange.toFixed(1)}%</span> from last quarter</p></CardContent></Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaryMetrics.openWorkOrders}</div>
            <p className="text-xs text-muted-foreground">Jobs currently in progress</p>
          </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Cost / Flight Hour (QTR)</CardTitle></CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{summaryMetrics.avgCostPerHour > 0 ? formatCurrency(summaryMetrics.avgCostPerHour) : 'N/A'}</div>
                <p className="text-xs text-muted-foreground">{summaryMetrics.thisQuarterTotalFlightHours > 0 ? `Based on ${summaryMetrics.thisQuarterTotalFlightHours.toFixed(1)} flight hours` : 'No flight hours this QTR'}</p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
            <Input placeholder="Search invoice, WO#, tail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="lg:col-span-1"/>
            <Select value={filters.aircraft} onValueChange={(v) => setFilters(f => ({...f, aircraft: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Aircraft</SelectItem>{uniqueTailNumbers.map(tn => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.jobStatus} onValueChange={(v) => setFilters(f => ({...f, jobStatus: v as any}))}><SelectTrigger><SelectValue placeholder="Work Order Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Completed">Direct Cost (Completed)</SelectItem>{maintenanceJobStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
             <Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("lg:col-span-1 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : (<span>Pick a date range</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover>
             <Button variant="link" onClick={clearAllFilters} className="lg:col-span-1">Clear Filters</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> ) :
            displayItems.length === 0 ? (
            <div className="text-center py-20"><DollarSign className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-semibold text-foreground">No maintenance costs found</h3><p className="mt-1 text-sm text-muted-foreground">{searchTerm || Object.values(filters).some(v => v !== 'all') || dateRange ? "No items match your current filters." : "Get started by adding a new cost entry or work order."}</p><div className="mt-6 flex justify-center gap-2"><Button asChild><Link href="/maintenance/costs/new"><PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry</Link></Button><Button variant="outline" onClick={handleOpenNewJobModal}><Hammer className="mr-2 h-4 w-4" />New Work Order</Button></div></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Aircraft</TableHead><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>WO #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Projected</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Variance</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {displayItems.map(item => {
                    return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.tailNumber}</TableCell>
                            <TableCell>{item.invoiceNumber}</TableCell>
                            <TableCell>{format(parseISO(item.invoiceDate), 'MM/dd/yyyy')}</TableCell>
                            <TableCell>{item.workOrderNumber ? <Button variant="link" className="p-0 h-auto" onClick={() => handleOpenEditJobModal(item.jobId)}>{item.workOrderNumber}</Button> : 'N/A'}</TableCell>
                            <TableCell><Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(item.projectedTotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.actualTotal)}</TableCell>
                            <TableCell className={`text-right font-medium ${item.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>{item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}</TableCell>
                            <TableCell className="text-right">
                            {item.type === 'cost' ? (
                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild><Link href={`/maintenance/costs/new?id=${item.id}`}><Edit className="h-4 w-4"/></Link></Button></TooltipTrigger><TooltipContent>Edit Cost</TooltipContent></Tooltip>
                            ) : (
                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleOpenEditJobModal(item.id)}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Job</TooltipContent></Tooltip>
                            )}
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirmDelete(item)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                            </TableCell>
                        </TableRow>
                    );
                 })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <AddEditJobModal
        isOpen={isJobModalOpen}
        setIsOpen={setIsJobModalOpen}
        initialData={selectedJobForEdit}
        onJobSaved={loadData}
        fleet={fleet}
      />
      
      {itemToDelete && (
        <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {itemToDelete.type === 'cost' ? `invoice (${itemToDelete.invoiceNumber})` : `work order (${itemToDelete.workOrderNumber})`}? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}

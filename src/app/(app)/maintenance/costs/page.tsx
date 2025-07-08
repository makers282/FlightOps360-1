
"use client";

import React, { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { fetchMaintenanceCosts, deleteMaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';
import type { MaintenanceCost } from '@/ai/schemas/maintenance-cost-schemas';
import { fetchMaintenanceJobs } from '@/ai/flows/manage-maintenance-jobs-flow';
import type { MaintenanceJob, MaintenanceJobStatus } from '@/ai/schemas/maintenance-job-schemas';
import { maintenanceJobStatuses } from '@/ai/schemas/maintenance-job-schemas';

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
type SortKey = 'invoiceDate' | 'tailNumber' | 'invoiceNumber' | 'costType' | 'category' | 'projectedTotal' | 'actualTotal' | 'variance' | 'workOrderNumber';


const formatCurrency = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export default function MaintenanceCostsPage() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [costToDelete, setCostToDelete] = useState<Cost | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    aircraft: 'all',
    costType: 'all',
    category: 'all',
    jobStatus: 'all',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'invoiceDate', direction: 'descending' });
  const [summaryMetrics, setSummaryMetrics] = useState({
    thisMonth: 0,
    monthChange: 0,
    thisQuarter: 0,
    quarterChange: 0,
    avgPerAircraft: 0
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedCosts, fetchedJobs] = await Promise.all([
        fetchMaintenanceCosts(),
        fetchMaintenanceJobs()
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
    const thisQuarterTotal = thisQuarterCosts.reduce((sum, c) => sum + c.actualTotal, 0);
    const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
    const lastQuarterEnd = endOfQuarter(subQuarters(now, 1));
    const lastQuarterTotal = getCostsInDateRange(lastQuarterStart, lastQuarterEnd).reduce((sum, c) => sum + c.actualTotal, 0);
    const quarterChange = lastQuarterTotal > 0 ? ((thisQuarterTotal - lastQuarterTotal) / lastQuarterTotal) * 100 : (thisQuarterTotal > 0 ? 100 : 0);
    const numAircraftInQuarter = new Set(thisQuarterCosts.map(c => c.tailNumber)).size;
    const avgPerAircraft = numAircraftInQuarter > 0 ? thisQuarterTotal / numAircraftInQuarter : 0;
    setSummaryMetrics({ thisMonth: thisMonthTotal, monthChange, thisQuarter: thisQuarterTotal, quarterChange, avgPerAircraft });
  }, [costs, isLoading]);

  const confirmDelete = (cost: Cost) => setCostToDelete(cost);

  const executeDelete = () => {
    if (!costToDelete) return;
    startDeletingTransition(async () => {
      try {
        await deleteMaintenanceCost({ costId: costToDelete.id });
        toast({ title: "Success", description: `Invoice ${costToDelete.invoiceNumber} deleted.` });
        loadData();
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete cost entry.", variant: "destructive" });
      } finally {
        setCostToDelete(null);
      }
    });
  };

  const filteredAndSortedCosts = useMemo(() => {
    const jobMap = new Map(jobs.map(job => [job.id, job]));
    let filtered = costs.filter(cost => {
      const associatedJob = cost.jobId ? jobMap.get(cost.jobId) : undefined;
      const searchMatch = searchTerm ? cost.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || cost.tailNumber.toLowerCase().includes(searchTerm.toLowerCase()) || (associatedJob?.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase())) : true;
      const aircraftMatch = filters.aircraft === 'all' || cost.tailNumber === filters.aircraft;
      const typeMatch = filters.costType === 'all' || cost.costType === filters.costType;
      const categoryMatch = filters.category === 'all' || cost.costBreakdowns.some(b => b.category === filters.category);
      const jobStatusMatch = filters.jobStatus === 'all' || (associatedJob && associatedJob.status === filters.jobStatus);
      const dateMatch = !dateRange?.from || isWithinInterval(parse(cost.invoiceDate, 'yyyy-MM-dd', new Date()), { start: dateRange.from, end: dateRange.to || dateRange.from });
      return searchMatch && aircraftMatch && typeMatch && categoryMatch && dateMatch && jobStatusMatch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];
        if (sortConfig.key === 'invoiceDate') { aValue = parse(a.invoiceDate, 'yyyy-MM-dd', new Date()).getTime(); bValue = parse(b.invoiceDate, 'yyyy-MM-dd', new Date()).getTime(); }
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [costs, jobs, searchTerm, filters, sortConfig, dateRange]);

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
    setFilters({ aircraft: 'all', costType: 'all', category: 'all', jobStatus: 'all' });
    setDateRange(undefined);
  };

  const uniqueTailNumbers = [...new Set(costs.map(c => c.tailNumber))].sort();
  const uniqueCategories = [...new Set(costs.flatMap(c => c.costBreakdowns.map(b => b.category)))].sort();

  return (
    <TooltipProvider>
      <PageHeader title="Maintenance Costs" icon={DollarSign} actions={<Button asChild><Link href="/maintenance/costs/new"><PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry</Link></Button>} />
      <div className="grid gap-6 mb-6 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Month</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisMonth)}</div><p className="text-xs text-muted-foreground"><span className={summaryMetrics.monthChange >= 0 ? "text-green-600" : "text-red-600"}>{summaryMetrics.monthChange >= 0 ? '+' : ''}{summaryMetrics.monthChange.toFixed(1)}%</span> from last month</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Quarter</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisQuarter)}</div><p className="text-xs text-muted-foreground"><span className={summaryMetrics.quarterChange >= 0 ? "text-green-600" : "text-red-600"}>{summaryMetrics.quarterChange >= 0 ? '+' : ''}{summaryMetrics.quarterChange.toFixed(1)}%</span> from last quarter</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg per Aircraft</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(summaryMetrics.avgPerAircraft)}</div><p className="text-xs text-muted-foreground">Per aircraft this quarter</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
            <Input placeholder="Search invoice, WO#, tail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="lg:col-span-1"/>
            <Select value={filters.aircraft} onValueChange={(v) => setFilters(f => ({...f, aircraft: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Aircraft</SelectItem>{uniqueTailNumbers.map(tn => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.jobStatus} onValueChange={(v) => setFilters(f => ({...f, jobStatus: v as any}))}><SelectTrigger><SelectValue placeholder="Work Order Status" /></SelectTrigger><SelectContent><SelectItem value="all">All WO Statuses</SelectItem>{maintenanceJobStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
             <Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : (<span>Pick a date range</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover>
             <Button variant="link" onClick={clearAllFilters} className="lg:col-span-1">Clear Filters</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> ) :
            filteredAndSortedCosts.length === 0 ? (
            <div className="text-center py-20"><DollarSign className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-semibold text-foreground">No maintenance costs found</h3><p className="mt-1 text-sm text-muted-foreground">{searchTerm || Object.values(filters).some(v => v !== 'all') || dateRange ? "No costs match your current filters." : "Get started by adding a new cost entry."}</p><div className="mt-6"><Button asChild><Link href="/maintenance/costs/new"><PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry</Link></Button></div></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Aircraft</TableHead><TableHead>WO #</TableHead><TableHead>Invoice #</TableHead><TableHead className="text-right">Actual Cost</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredAndSortedCosts.map(cost => (
                  <TableRow key={cost.id}>
                    <TableCell>{format(parse(cost.invoiceDate, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy')}</TableCell>
                    <TableCell>{cost.tailNumber}</TableCell>
                    <TableCell>{cost.workOrderNumber ? <Link className="text-primary hover:underline" href={`/maintenance/jobs`}>{cost.workOrderNumber}</Link> : 'N/A'}</TableCell>
                    <TableCell>{cost.invoiceNumber}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(cost.actualTotal)}</TableCell>
                    <TableCell className="text-right">
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild><Link href={`/maintenance/costs/new?id=${cost.id}`}><Edit className="h-4 w-4"/></Link></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirmDelete(cost)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {costToDelete && (
        <AlertDialog open={!!costToDelete} onOpenChange={(open) => !open && setCostToDelete(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete invoice "{costToDelete.invoiceNumber}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={executeDelete} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}

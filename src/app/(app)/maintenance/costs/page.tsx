
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
import { DollarSign, PlusCircle, Search, Edit, Trash2, Paperclip, ArrowUpDown, ChevronLeft, ChevronRight, FileText, TrendingUp, Wrench, Calendar as CalendarIcon, Skeleton, Loader2 } from 'lucide-react';
import { DateRange } from "react-day-picker"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { addDays, format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, isWithinInterval, parseISO, isValid } from "date-fns"
import { cn } from "@/lib/utils"
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { fetchMaintenanceCosts, deleteMaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';
import type { MaintenanceCost } from '@/ai/schemas/maintenance-cost-schemas';
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

type Cost = MaintenanceCost & { variance: number; projectedTotal: number; actualTotal: number };
type SortKey = 'invoiceDate' | 'tailNumber' | 'invoiceNumber' | 'costType' | 'category' | 'projectedTotal' | 'actualTotal' | 'variance';


const formatCurrency = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export default function MaintenanceCostsPage() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [costToDelete, setCostToDelete] = useState<Cost | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    aircraft: 'all',
    costType: 'all',
    category: 'all',
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
      const fetchedCosts = await fetchMaintenanceCosts();
      const processedCosts = fetchedCosts.map(c => {
        const projectedTotal = c.costBreakdowns.reduce((sum, item) => sum + item.projectedCost, 0);
        const actualTotal = c.costBreakdowns.reduce((sum, item) => sum + item.actualCost, 0);
        return {
          ...c,
          projectedTotal,
          actualTotal,
          variance: actualTotal - projectedTotal,
        };
      });
      setCosts(processedCosts);
    } catch (error) {
      console.error("Failed to fetch maintenance costs:", error);
      toast({ title: "Error", description: "Could not load maintenance costs.", variant: "destructive" });
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
    const getCostsInDateRange = (startDate: Date, endDate: Date) => {
        return costs.filter(c => {
            try {
                return isWithinInterval(parseISO(c.invoiceDate), { start: startDate, end: endDate });
            } catch {
                return false;
            }
        });
    };

    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const thisMonthCosts = getCostsInDateRange(thisMonthStart, thisMonthEnd);
    const thisMonthTotal = thisMonthCosts.reduce((sum, c) => sum + c.actualTotal, 0);

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

    const aircraftInQuarter = new Set(thisQuarterCosts.map(c => c.tailNumber));
    const numAircraftInQuarter = aircraftInQuarter.size;
    const avgPerAircraft = numAircraftInQuarter > 0 ? thisQuarterTotal / numAircraftInQuarter : 0;

    setSummaryMetrics({
      thisMonth: thisMonthTotal,
      monthChange: monthChange,
      thisQuarter: thisQuarterTotal,
      quarterChange: quarterChange,
      avgPerAircraft: avgPerAircraft,
    });
  }, [costs, isLoading]);

  const confirmDelete = (cost: Cost) => {
    setCostToDelete(cost);
  };

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
    let filtered = costs.filter(cost => {
      const searchMatch = searchTerm ? cost.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || cost.tailNumber.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      const aircraftMatch = filters.aircraft === 'all' || cost.tailNumber === filters.aircraft;
      const typeMatch = filters.costType === 'all' || cost.costType === filters.costType;
      const categoryMatch = filters.category === 'all' || cost.costBreakdowns.some(b => b.category === filters.category);
      const dateMatch = !dateRange?.from || isWithinInterval(parseISO(cost.invoiceDate), { start: dateRange.from, end: dateRange.to || dateRange.from });
      return searchMatch && aircraftMatch && typeMatch && categoryMatch && dateMatch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];
        
        if (sortConfig.key === 'invoiceDate') {
            aValue = parseISO(a.invoiceDate).getTime();
            bValue = parseISO(b.invoiceDate).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [costs, searchTerm, filters, sortConfig, dateRange]);

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };
  
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({ aircraft: 'all', costType: 'all', category: 'all' });
    setDateRange(undefined);
  };

  const uniqueTailNumbers = [...new Set(costs.map(c => c.tailNumber))];
  const uniqueCategories = [...new Set(costs.flatMap(c => c.costBreakdowns.map(b => b.category)))];

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
    return format(parseISO(dateString), 'MM/dd/yyyy');
  };

  return (
    <TooltipProvider>
      <PageHeader
        title="Maintenance Costs"
        icon={DollarSign}
        actions={
          <Button asChild>
            <Link href="/maintenance/costs/new">
              <PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 mb-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><FileText className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Total Actual Cost this Month</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
              <ClientOnly fallback={<><Skeleton className="h-9 w-3/4 mb-1" /><Skeleton className="h-4 w-1/2" /></>}>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisMonth)}</div>
                <p className="text-xs text-muted-foreground">
                    <span className={summaryMetrics.monthChange >= 0 ? "text-green-600" : "text-red-600"}>
                      {summaryMetrics.monthChange >= 0 ? '+' : ''}{summaryMetrics.monthChange.toFixed(1)}%
                    </span> from last month
                </p>
              </ClientOnly>
            </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDateRange({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) })}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Quarter</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><TrendingUp className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Total Actual Cost this Quarter</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
              <ClientOnly fallback={<><Skeleton className="h-9 w-3/4 mb-1" /><Skeleton className="h-4 w-1/2" /></>}>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisQuarter)}</div>
                  <p className="text-xs text-muted-foreground">
                      <span className={summaryMetrics.quarterChange >= 0 ? "text-green-600" : "text-red-600"}>
                        {summaryMetrics.quarterChange >= 0 ? '+' : ''}{summaryMetrics.quarterChange.toFixed(1)}%
                      </span> from last quarter
                  </p>
              </ClientOnly>
            </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average per Aircraft</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Wrench className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Average Cost per Aircraft this Quarter</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
              <ClientOnly fallback={<><Skeleton className="h-9 w-3/4 mb-1" /><Skeleton className="h-4 w-1/2" /></>}>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.avgPerAircraft)}</div>
                <p className="text-xs text-muted-foreground">Per aircraft this quarter</p>
              </ClientOnly>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input placeholder="Search by invoice # or tail #" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="lg:col-span-1"/>
            <Select value={filters.aircraft} onValueChange={(value) => setFilters(f => ({...f, aircraft: value}))}>
              <SelectTrigger><SelectValue placeholder="Filter by Aircraft" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Aircraft</SelectItem>
                {uniqueTailNumbers.map(tn => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.costType} onValueChange={(value) => setFilters(f => ({...f, costType: value}))}>
              <SelectTrigger><SelectValue placeholder="Filter by Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Unscheduled">Unscheduled</SelectItem>
              </SelectContent>
            </Select>
             <Select value={filters.category} onValueChange={(value) => setFilters(f => ({...f, category: value}))}>
              <SelectTrigger><SelectValue placeholder="Filter by Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
             <Popover>
                <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/>
                </PopoverContent>
            </Popover>
          </div>
           <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={clearAllFilters}>Clear Filters</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredAndSortedCosts.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No maintenance costs found</h3>
              <p className="mt-1 text-sm text-gray-500">{searchTerm || filters.aircraft !== 'all' || filters.costType !== 'all' || filters.category !== 'all' || dateRange ? "No costs match your current filters." : "Get started by adding a new cost entry."}</p>
              <div className="mt-6"><Button asChild><Link href="/maintenance/costs/new"><PlusCircle className="mr-2 h-4 w-4" /> New Cost Entry</Link></Button></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('invoiceDate')}>Date {getSortIcon('invoiceDate')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('tailNumber')}>Tail # {getSortIcon('tailNumber')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('invoiceNumber')}>Invoice # {getSortIcon('invoiceNumber')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('costType')}>Type {getSortIcon('costType')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('projectedTotal')}>Projected {getSortIcon('projectedTotal')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('actualTotal')}>Actual {getSortIcon('actualTotal')}</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => requestSort('variance')}>Variance {getSortIcon('variance')}</TableHead>
                  <TableHead className="text-center">Files</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCosts.map(cost => {
                  const variance = cost.variance;
                  return (
                    <TableRow key={cost.id}>
                      <TableCell>{formatDateForDisplay(cost.invoiceDate)}</TableCell>
                      <TableCell>{cost.tailNumber}</TableCell>
                      <TableCell>{cost.invoiceNumber}</TableCell>
                      <TableCell><Badge variant={cost.costType === 'Scheduled' ? 'default' : 'secondary'}>{cost.costType}</Badge></TableCell>
                      <TableCell className="text-right">{formatCurrency(cost.projectedTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(cost.actualTotal)}</TableCell>
                      <TableCell className={`text-right font-medium ${variance > 0 ? 'text-red-500' : variance < 0 ? 'text-green-500' : ''}`}>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</TableCell>
                      <TableCell className="text-center">{cost.attachments && cost.attachments.length > 0 ? <Badge variant="outline"><Paperclip className="inline-block h-3 w-3 mr-1"/>{cost.attachments.length}</Badge> : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild><Link href={`/maintenance/costs/new?id=${cost.id}`}><Edit className="h-4 w-4"/></Link></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirmDelete(cost)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {costToDelete && (
        <AlertDialog open={!!costToDelete} onOpenChange={(open) => !open && setCostToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete the cost entry for invoice "{costToDelete.invoiceNumber}"? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}

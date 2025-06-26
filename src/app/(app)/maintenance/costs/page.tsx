
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, PlusCircle, Search, Edit, Trash2, Paperclip, ArrowUpDown, ChevronLeft, ChevronRight, FileText, TrendingUp, Wrench, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from "react-day-picker"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { addDays, format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, isWithinInterval, parseISO } from "date-fns"
import { cn } from "@/lib/utils"


// Mock data based on the prompt's requirements
const mockCosts = [
  { id: 'cost1', date: '2025-06-15', tailNumber: 'N1327J', invoice: 'INV-12345', type: 'Scheduled', category: 'Labor', projected: 1200, actual: 1350, attachments: 2 },
  { id: 'cost2', date: '2025-06-14', tailNumber: 'N907DK', invoice: 'INV-12346', type: 'Unscheduled', category: 'Parts', projected: 5000, actual: 4850.75, attachments: 1 },
  { id: 'cost3', date: '2025-06-12', tailNumber: 'N630MW', invoice: 'INV-12347', type: 'Scheduled', category: 'Shop Fees', projected: 300, actual: 300, attachments: 0 },
  { id: 'cost4', date: '2025-06-10', tailNumber: 'N1327J', invoice: 'INV-12348', type: 'Unscheduled', category: 'Other', projected: 150, actual: 145.50, attachments: 1 },
  { id: 'cost5', date: '2025-06-08', tailNumber: 'N907DK', invoice: 'INV-12349', type: 'Scheduled', category: 'Parts', projected: 25000, actual: 26500, attachments: 5 },
  // Adding data for last month/quarter for calculations
  { id: 'cost6', date: format(subMonths(new Date(), 1), 'yyyy-MM-dd'), tailNumber: 'N1327J', invoice: 'INV-PREV-1', type: 'Scheduled', category: 'Labor', projected: 1000, actual: 1100, attachments: 1 },
  { id: 'cost7', date: format(subQuarters(new Date(), 1), 'yyyy-MM-dd'), tailNumber: 'N907DK', invoice: 'INV-PREV-Q', type: 'Scheduled', category: 'Parts', projected: 20000, actual: 19500, attachments: 3 },
];

type Cost = typeof mockCosts[0];
type SortKey = keyof Cost | 'variance';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function MaintenanceCostsPage() {
  const [costs, setCosts] = useState<Cost[]>(mockCosts);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    aircraft: 'all',
    costType: 'all',
    category: 'all',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
  const [summaryMetrics, setSummaryMetrics] = useState({
    thisMonth: 0,
    monthChange: 0,
    thisQuarter: 0,
    quarterChange: 0,
    avgPerAircraft: 0
  });

  useEffect(() => {
    const now = new Date();

    const getCostsInDateRange = (startDate: Date, endDate: Date) => {
        return costs.filter(c => isWithinInterval(new Date(c.date), { start: startDate, end: endDate }));
    };

    // This Month
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const thisMonthCosts = getCostsInDateRange(thisMonthStart, thisMonthEnd);
    const thisMonthTotal = thisMonthCosts.reduce((sum, c) => sum + c.actual, 0);

    // Last Month
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const lastMonthTotal = getCostsInDateRange(lastMonthStart, lastMonthEnd).reduce((sum, c) => sum + c.actual, 0);
    const monthChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : (thisMonthTotal > 0 ? 100 : 0);

    // This Quarter
    const thisQuarterStart = startOfQuarter(now);
    const thisQuarterEnd = endOfQuarter(now);
    const thisQuarterCosts = getCostsInDateRange(thisQuarterStart, thisQuarterEnd);
    const thisQuarterTotal = thisQuarterCosts.reduce((sum, c) => sum + c.actual, 0);

    // Last Quarter
    const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
    const lastQuarterEnd = endOfQuarter(subQuarters(now, 1));
    const lastQuarterTotal = getCostsInDateRange(lastQuarterStart, lastQuarterEnd).reduce((sum, c) => sum + c.actual, 0);
    const quarterChange = lastQuarterTotal > 0 ? ((thisQuarterTotal - lastQuarterTotal) / lastQuarterTotal) * 100 : (thisQuarterTotal > 0 ? 100 : 0);

    // Average per aircraft
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
  }, [costs]);

  const getVariance = (projected: number, actual: number) => actual - projected;

  const filteredAndSortedCosts = useMemo(() => {
    let filtered = costs.filter(cost => {
      const searchMatch = searchTerm ? cost.invoice.toLowerCase().includes(searchTerm.toLowerCase()) || cost.tailNumber.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      const aircraftMatch = filters.aircraft === 'all' || cost.tailNumber === filters.aircraft;
      const typeMatch = filters.costType === 'all' || cost.type === filters.costType;
      const categoryMatch = filters.category === 'all' || cost.category === filters.category;
      const dateMatch = !dateRange?.from || isWithinInterval(new Date(cost.date), { start: dateRange.from, end: dateRange.to || dateRange.from });
      return searchMatch && aircraftMatch && typeMatch && categoryMatch && dateMatch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        if (sortConfig.key === 'variance') {
            aValue = getVariance(a.projected, a.actual);
            bValue = getVariance(b.projected, b.actual);
        } else {
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
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
  const uniqueCategories = [...new Set(costs.map(c => c.category))];

  return (
    <TooltipProvider>
      <PageHeader
        title="Maintenance Costs"
        icon={DollarSign}
        actions={<Button>+ New Cost Entry</Button>}
      />
      <div className="grid gap-6 mb-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><FileText className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Total Actual Cost this Month</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisMonth)}</div>
                <p className="text-xs text-muted-foreground">
                    <span className={summaryMetrics.monthChange >= 0 ? "text-green-600" : "text-red-600"}>
                      {summaryMetrics.monthChange >= 0 ? '+' : ''}{summaryMetrics.monthChange.toFixed(1)}%
                    </span> from last month
                </p>
            </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDateRange({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) })}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Quarter</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><TrendingUp className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Total Actual Cost this Quarter</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.thisQuarter)}</div>
                 <p className="text-xs text-muted-foreground">
                    <span className={summaryMetrics.quarterChange >= 0 ? "text-green-600" : "text-red-600"}>
                      {summaryMetrics.quarterChange >= 0 ? '+' : ''}{summaryMetrics.quarterChange.toFixed(1)}%
                    </span> from last quarter
                </p>
            </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average per Aircraft</CardTitle>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Wrench className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger><TooltipContent>Average Cost per Aircraft this Quarter</TooltipContent></Tooltip>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(summaryMetrics.avgPerAircraft)}</div>
                <p className="text-xs text-muted-foreground">Per aircraft this quarter</p>
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
          {filteredAndSortedCosts.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No maintenance costs found</h3>
              <p className="mt-1 text-sm text-gray-500">{searchTerm || filters.aircraft !== 'all' || filters.costType !== 'all' || filters.category !== 'all' || dateRange ? "No costs match your current filters." : "Get started by adding a new cost entry."}</p>
              <div className="mt-6"><Button>+ New Cost Entry</Button></div>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('tailNumber')}>Tail # {getSortIcon('tailNumber')}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('invoice')}>Invoice # {getSortIcon('invoice')}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('type')}>Type {getSortIcon('type')}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort('category')}>Category {getSortIcon('category')}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => requestSort('projected')}>Projected {getSortIcon('projected')}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => requestSort('actual')}>Actual {getSortIcon('actual')}</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => requestSort('variance')}>Variance {getSortIcon('variance')}</TableHead>
                        <TableHead className="text-center">Files</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedCosts.map(cost => {
                        const variance = getVariance(cost.projected, cost.actual);
                        return (
                          <TableRow key={cost.id}>
                            <TableCell>{format(new Date(cost.date), 'MM/dd/yyyy')}</TableCell>
                            <TableCell>{cost.tailNumber}</TableCell>
                            <TableCell>{cost.invoice}</TableCell>
                            <TableCell><Badge variant={cost.type === 'Scheduled' ? 'default' : 'secondary'}>{cost.type}</Badge></TableCell>
                            <TableCell>{cost.category}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cost.projected)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cost.actual)}</TableCell>
                            <TableCell className={`text-right font-medium ${variance > 0 ? 'text-red-500' : variance < 0 ? 'text-green-500' : ''}`}>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</TableCell>
                            <TableCell className="text-center">{cost.attachments > 0 ? <Badge variant="outline"><Paperclip className="inline-block h-3 w-3 mr-1"/>{cost.attachments}</Badge> : '-'}</TableCell>
                            <TableCell className="text-right">
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
              </div>
              <div className="block md:hidden space-y-4">
                  {filteredAndSortedCosts.map(cost => {
                      const variance = getVariance(cost.projected, cost.actual);
                      return (
                          <Card key={cost.id} className="p-4">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="font-semibold">{cost.tailNumber} - {cost.invoice}</p>
                                      <p className="text-sm text-muted-foreground">{format(new Date(cost.date), 'MM/dd/yyyy')} | <Badge variant={cost.type === 'Scheduled' ? 'default' : 'secondary'} className="text-xs">{cost.type}</Badge> - {cost.category}</p>
                                  </div>
                                  <div className="flex">
                                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                                      <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                  </div>
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                                  <div><p className="text-xs text-muted-foreground">Projected</p><p>{formatCurrency(cost.projected)}</p></div>
                                  <div><p className="text-xs text-muted-foreground">Actual</p><p>{formatCurrency(cost.actual)}</p></div>
                                  <div><p className="text-xs text-muted-foreground">Variance</p><p className={`font-medium ${variance > 0 ? 'text-red-500' : variance < 0 ? 'text-green-500' : ''}`}>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</p></div>
                              </div>
                              {cost.attachments > 0 && <p className="text-xs text-muted-foreground mt-2"><Paperclip className="inline-block h-3 w-3 mr-1"/>{cost.attachments} Attachments</p>}
                          </Card>
                      )
                  })}
              </div>
              <div className="flex items-center justify-end space-x-2 py-4">
                  <Button variant="outline" size="sm" ><ChevronLeft className="h-4 w-4" />Previous</Button>
                  <Button variant="outline" size="sm" >Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

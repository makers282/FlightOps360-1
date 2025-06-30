
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Line } from 'recharts';

import { Wrench, Download, Calendar as CalendarIcon, Loader2, TrendingUp, AlertCircle } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format, isWithinInterval, parseISO } from 'date-fns';

import { fetchMaintenanceCosts, type MaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { ClientOnly } from '@/components/client-only';

const formatCurrency = (value: number | undefined) => {
  if (value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Custom label renderer for the Pie Chart
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name, fill }: any) => {
  const radius = outerRadius * 1.35; // Position label further out
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 5) * cos;
  const sy = cy + (outerRadius + 5) * sin;
  const mx = cx + (outerRadius + 20) * cos;
  const my = cy + (outerRadius + 20) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';


  return (
    <g>
       <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
       <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" dominantBaseline="central" className="text-xs font-medium">
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
};


export default function MaintenanceReportsPage() {
    const [costs, setCosts] = useState<MaintenanceCost[]>([]);
    const [fleet, setFleet] = useState<FleetAircraft[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [aircraftFilter, setAircraftFilter] = useState('all');
    const [costTypeFilter, setCostTypeFilter] = useState<'all' | 'Scheduled' | 'Unscheduled'>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [fetchedCosts, fetchedFleet] = await Promise.all([
                    fetchMaintenanceCosts(),
                    fetchFleetAircraft(),
                ]);
                setCosts(fetchedCosts);
                setFleet(fetchedFleet);
            } catch (error) {
                console.error("Failed to load report data:", error);
                toast({ title: "Error", description: "Could not load data for reports.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [toast]);

    const filteredCosts = useMemo(() => {
        return costs.filter(cost => {
            const dateMatch = dateRange?.from ? isWithinInterval(parseISO(cost.invoiceDate), { start: dateRange.from, end: dateRange.to || dateRange.from }) : true;
            const aircraftMatch = aircraftFilter === 'all' || cost.aircraftId === aircraftFilter;
            const costTypeMatch = costTypeFilter === 'all' || cost.costType === costTypeFilter;
            return dateMatch && aircraftMatch && costTypeMatch;
        });
    }, [costs, dateRange, aircraftFilter, costTypeFilter]);
    
    const summaryData = useMemo(() => {
        const totalCost = filteredCosts.reduce((sum, cost) => sum + cost.costBreakdowns.reduce((s, b) => s + b.actualCost, 0), 0);
        const unscheduledCosts = filteredCosts.filter(c => c.costType === 'Unscheduled').reduce((sum, cost) => sum + cost.costBreakdowns.reduce((s, b) => s + b.actualCost, 0), 0);
        const ratio = totalCost > 0 ? (unscheduledCosts / totalCost) * 100 : 0;
        return {
            totalYTD: totalCost,
            avgCostPerHour: 0, // Placeholder
            unscheduledRatio: ratio,
        };
    }, [filteredCosts]);

    const pieChartData = useMemo(() => {
        const dataMap = new Map<string, number>();
        filteredCosts.forEach(cost => {
            cost.costBreakdowns.forEach(breakdown => {
                const currentTotal = dataMap.get(breakdown.category) || 0;
                dataMap.set(breakdown.category, currentTotal + breakdown.actualCost);
            });
        });
        return Array.from(dataMap.entries()).map(([name, value]) => ({ name, value }));
    }, [filteredCosts]);

    const lineChartData = useMemo(() => {
        const monthlyData: { [key: string]: number } = {};
        filteredCosts.forEach(cost => {
            const month = format(parseISO(cost.invoiceDate), 'MMM yyyy');
            monthlyData[month] = (monthlyData[month] || 0) + cost.costBreakdowns.reduce((s, b) => s + b.actualCost, 0);
        });

        const sortedMonths = Object.keys(monthlyData).sort((a,b) => {
            return new Date(a).getTime() - new Date(b).getTime();
        });

        return sortedMonths.map(month => ({
            name: month,
            total: monthlyData[month]
        }));

    }, [filteredCosts]);
    
    const aircraftTableData = useMemo(() => {
        const dataMap = new Map<string, { totalCost: number; scheduledCost: number; unscheduledCost: number; tailNumber: string; aircraftId: string; }>();
        filteredCosts.forEach(cost => {
            const entry = dataMap.get(cost.aircraftId) || { totalCost: 0, scheduledCost: 0, unscheduledCost: 0, tailNumber: cost.tailNumber, aircraftId: cost.aircraftId };
            const actualTotal = cost.costBreakdowns.reduce((s, b) => s + b.actualCost, 0);
            entry.totalCost += actualTotal;
            if (cost.costType === 'Scheduled') {
                entry.scheduledCost += actualTotal;
            } else {
                entry.unscheduledCost += actualTotal;
            }
            entry.tailNumber = cost.tailNumber;
            dataMap.set(cost.aircraftId, entry);
        });
        return Array.from(dataMap.values());
    }, [filteredCosts]);

    const CATEGORY_COLORS: { [key: string]: string } = {
        Labor: '#4A90E2', // Blue
        Parts: '#7ED321', // Green
        'Shop Fees': '#F5A623', // Orange
        Consumables: '#F8E71C', // Yellow
        'External Services': '#D0021B', // Red
        Other: '#BD10E0', // Purple
    };
    const DEFAULT_COLOR = 'hsl(0, 0%, 80%)';
    
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <PageHeader title="Maintenance Costs Report" description="Analyze maintenance spend by aircraft and category." icon={Wrench} actions={<Button variant="outline" disabled><Download className="mr-2 h-4 w-4" /> Export</Button>} />
            
            {isLoading ? <Skeleton className="h-24 w-full" /> :
                <div className="grid gap-6 md:grid-cols-3">
                    <Card><CardHeader><CardTitle className="text-sm font-medium">Total Maintenance Spend</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summaryData.totalYTD)}</div><p className="text-xs text-muted-foreground">For selected period</p></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm font-medium">Avg Cost / Flight Hour</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">N/A</div><p className="text-xs text-muted-foreground">Requires flight log data</p></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm font-medium">Unscheduled vs. Scheduled</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.unscheduledRatio.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Ratio of unscheduled costs</p></CardContent></Card>
                </div>
            }

            <Card className="bg-muted/50"><CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                <Select value={aircraftFilter} onValueChange={setAircraftFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Aircraft</SelectItem>{fleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}</SelectContent></Select>
                <Select value={costTypeFilter} onValueChange={(v) => setCostTypeFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Cost Types</SelectItem><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Unscheduled">Unscheduled</SelectItem></SelectContent></Select>
                <Popover><PopoverTrigger asChild><Button id="date" variant="outline" className={cn("w-full md:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover>
                <Button variant="link" onClick={() => { setAircraftFilter('all'); setCostTypeFilter('all'); setDateRange(undefined); }}>Clear Filters</Button>
            </CardContent></Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Cost Breakdown by Category</CardTitle>
                        <CardDescription>Distribution of maintenance costs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-64 w-full"/> : 
                            pieChartData.length > 0 ? (
                                <ChartContainer config={{}} className="mx-auto aspect-square max-h-[350px]">
                                    <PieChart margin={{ top: 30, right: 70, bottom: 30, left: 70 }}>
                                        <Pie
                                            data={pieChartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            labelLine={true}
                                            label={renderCustomizedLabel}
                                        >
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || DEFAULT_COLOR} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ChartContainer>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <AlertCircle className="mx-auto h-12 w-12" />
                                    <p className="mt-2">No cost data available for the selected filters.</p>
                                </div>
                            )
                        }
                    </CardContent>
                </Card>
                <Card><CardHeader><CardTitle>Monthly Cost Trend</CardTitle></CardHeader><CardContent>{isLoading ? <Skeleton className="h-64 w-full"/> : <ChartContainer config={{total: { label: "Total Cost", color: "hsl(200, 70%, 55%)"}}} className="aspect-auto h-[300px] w-full"><LineChart data={lineChartData} margin={{left: 12, right: 12}}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 3)} /><YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `$${Number(value) / 1000}k`} /><ChartTooltip content={<ChartTooltipContent indicator="dot" />} /><Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={false}/></LineChart></ChartContainer>}</CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle>Costs by Aircraft</CardTitle></CardHeader><CardContent>
                {isLoading ? <Skeleton className="h-48 w-full"/> : 
                <Table><TableHeader><TableRow><TableHead>Tail Number</TableHead><TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Scheduled</TableHead><TableHead className="text-right">Unscheduled</TableHead><TableHead className="text-right">Cost/Hour (TBD)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{aircraftTableData.length > 0 ? aircraftTableData.map(item => (
                    <TableRow key={item.tailNumber}><TableCell>{item.tailNumber}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(item.totalCost)}</TableCell><TableCell className="text-right">{formatCurrency(item.scheduledCost)}</TableCell><TableCell className="text-right">{formatCurrency(item.unscheduledCost)}</TableCell><TableCell className="text-right text-muted-foreground">N/A</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link href={`/aircraft/currency/${item.aircraftId}`}>Details</Link></Button></TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data for selected filters.</TableCell></TableRow>}
                </TableBody></Table>
                }
            </CardContent></Card>
        </div>
    );
}

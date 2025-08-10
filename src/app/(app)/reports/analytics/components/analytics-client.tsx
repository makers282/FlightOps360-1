
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startOfToday, subDays, parseISO, isWithinInterval, format, startOfMonth } from 'date-fns';

import { getAnalyticsData } from '../actions';
import type { AnalyticsData } from '../actions';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatHours = (hours: number) => {
    if (isNaN(hours) || hours < 0) return '0.0';
    return hours.toFixed(1);
};


export function AnalyticsClient() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getAnalyticsData();
            setData(result);
        } catch (error) {
            console.error("Failed to load analytics data:", error);
            toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Could not load analytics data."), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const summaryMetrics = useMemo(() => {
        if (!data) return { totalHours: 0, onTimePercentage: 0, totalRevenue: 0, avgRevenuePerHour: 0 };
        
        const last90DaysStart = subDays(startOfToday(), 90);
        const recentTrips = data.trips.filter(t => isWithinInterval(parseISO(t.createdAt), { start: last90DaysStart, end: startOfToday() }));
        const recentLogs = data.flightLogs.filter(l => recentTrips.some(t => t.id === l.tripId));

        const totalHours = recentLogs.reduce((sum, log) => sum + ((log.hobbsLanding || 0) - (log.hobbsTakeOff || 0)), 0);
        const totalRevenue = recentTrips.reduce((sum, trip) => {
            const quote = data.quotes.find(q => q.id === trip.quoteId);
            return sum + (quote?.totalSellPrice || 0);
        }, 0);
        
        // Placeholder for on-time performance
        const onTimePercentage = 98.2; 
        
        return {
            totalHours,
            onTimePercentage,
            totalRevenue,
            avgRevenuePerHour: totalHours > 0 ? totalRevenue / totalHours : 0
        };
    }, [data]);
    
    const flightHoursByAircraftChartData = useMemo(() => {
        if (!data) return [];
        const hoursMap = new Map<string, number>();
        data.flightLogs.forEach(log => {
            const trip = data.trips.find(t => t.id === log.tripId);
            if (trip) {
                const hours = (log.hobbsLanding || 0) - (log.hobbsTakeOff || 0);
                hoursMap.set(trip.aircraftId, (hoursMap.get(trip.aircraftId) || 0) + hours);
            }
        });
        return Array.from(hoursMap.entries()).map(([aircraftId, hours]) => ({
            name: data.fleet.find(f => f.id === aircraftId)?.tailNumber || 'Unknown',
            hours: parseFloat(hours.toFixed(1)),
        })).sort((a,b) => b.hours - a.hours);
    }, [data]);

    const revenueAndHoursChartData = useMemo(() => {
        if (!data) return [];
        const monthlyData = new Map<string, { revenue: number, hours: number }>();
        
        data.trips.forEach(trip => {
            const month = format(parseISO(trip.createdAt), 'MMM yyyy');
            const quote = data.quotes.find(q => q.id === trip.quoteId);
            const entry = monthlyData.get(month) || { revenue: 0, hours: 0 };
            entry.revenue += quote?.totalSellPrice || 0;
            monthlyData.set(month, entry);
        });

        data.flightLogs.forEach(log => {
            const trip = data.trips.find(t => t.id === log.tripId);
            if (trip) {
                const month = format(parseISO(trip.createdAt), 'MMM yyyy');
                const hours = (log.hobbsLanding || 0) - (log.hobbsTakeOff || 0);
                const entry = monthlyData.get(month) || { revenue: 0, hours: 0 };
                entry.hours += hours;
                monthlyData.set(month, entry);
            }
        });
        
        const sortedData = Array.from(monthlyData.entries()).sort((a,b) => parseISO(format(startOfMonth(new Date(a[0])), 'yyyy-MM-dd')).getTime() - parseISO(format(startOfMonth(new Date(b[0])), 'yyyy-MM-dd')).getTime());
        
        return sortedData.map(([month, values]) => ({
            name: month.slice(0, 3),
            Revenue: values.revenue,
            'Flight Hours': parseFloat(values.hours.toFixed(1))
        }));
    }, [data]);
    
    const routePerformanceData = useMemo(() => {
        if (!data) return [];
        const routeMap = new Map<string, { flights: number, totalHours: number, totalRevenue: number }>();
        data.trips.forEach(trip => {
            if (trip.legs.length > 0) {
                const routeKey = `${trip.legs[0].origin}-${trip.legs[trip.legs.length - 1].destination}`;
                const entry = routeMap.get(routeKey) || { flights: 0, totalHours: 0, totalRevenue: 0 };
                entry.flights += 1;
                const quote = data.quotes.find(q => q.id === trip.quoteId);
                entry.totalRevenue += quote?.totalSellPrice || 0;
                
                const logsForTrip = data.flightLogs.filter(l => l.tripId === trip.id);
                entry.totalHours += logsForTrip.reduce((sum, log) => sum + ((log.hobbsLanding || 0) - (log.hobbsTakeOff || 0)), 0);
                
                routeMap.set(routeKey, entry);
            }
        });
        return Array.from(routeMap.entries()).map(([route, details]) => ({
            route,
            ...details,
            avgHours: details.flights > 0 ? details.totalHours / details.flights : 0,
        })).sort((a,b) => b.flights - a.flights).slice(0, 10);
    }, [data]);
    
    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/></div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3"/><Skeleton className="h-96 lg:col-span-2"/></div>
                <Skeleton className="h-96"/>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Flight Hours</CardTitle><Clock className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatHours(summaryMetrics.totalHours)}</div><p className="text-xs text-muted-foreground">in last 90 days</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">On-Time Performance</CardTitle><CheckCircle className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{summaryMetrics.onTimePercentage}%</div><p className="text-xs text-muted-foreground">in last 90 days</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summaryMetrics.totalRevenue)}</div><p className="text-xs text-muted-foreground">in last 90 days</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Avg. Revenue / Hour</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summaryMetrics.avgRevenuePerHour)}</div><p className="text-xs text-muted-foreground">in last 90 days</p></CardContent></Card>
            </div>
            
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Flight Hours by Aircraft</CardTitle><CardDescription>Total flight hours per aircraft in the fleet.</CardDescription></CardHeader>
                    <CardContent className="pl-2"><ResponsiveContainer width="100%" height={300}><BarChart data={flightHoursByAircraftChartData}><XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} /><YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} /><RechartsTooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))'}}/><Legend /><Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Revenue &amp; Hours Trend</CardTitle><CardDescription>Monthly totals over the last year.</CardDescription></CardHeader>
                    <CardContent className="pl-2"><ChartContainer config={{Revenue: { label: "Revenue", color: "hsl(var(--primary))" }, "Flight Hours": { label: "Hours", color: "hsl(var(--accent))"}}} className="aspect-auto h-[300px] w-full"><LineChart data={revenueAndHoursChartData} margin={{left: 12, right: 12, top: 10}}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} /><YAxis yAxisId="left" stroke="hsl(var(--primary))" tickFormatter={(value) => formatCurrency(Number(value))} /><YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" /><ChartTooltip content={<ChartTooltipContent indicator="dot" />} /><Legend /><Line type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={true} yAxisId="left"/><Line type="monotone" dataKey="Flight Hours" stroke="hsl(var(--accent))" strokeWidth={2} dot={true} yAxisId="right"/></LineChart></ChartContainer></CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader><CardTitle>Top Routes Performance</CardTitle><CardDescription>Performance metrics for the top 10 most frequent routes.</CardDescription></CardHeader>
                <CardContent><Table><TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-center">Total Flights</TableHead><TableHead className="text-right">Total Hours</TableHead><TableHead className="text-right">Avg. Hours</TableHead><TableHead className="text-right">Total Revenue</TableHead></TableRow></TableHeader><TableBody>{routePerformanceData.map(r => (<TableRow key={r.route}><TableCell className="font-medium">{r.route}</TableCell><TableCell className="text-center">{r.flights}</TableCell><TableCell className="text-right">{formatHours(r.totalHours)}</TableCell><TableCell className="text-right">{formatHours(r.avgHours)}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(r.totalRevenue)}</TableCell></TableRow>))}</TableBody></Table></CardContent>
            </Card>
        </div>
    );
}

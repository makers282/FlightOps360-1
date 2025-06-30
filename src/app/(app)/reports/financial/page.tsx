
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Download, Percent, Users, FileText, TrendingUp, TrendingDown, ArrowRight, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { subMonths, startOfMonth, endOfMonth, eachWeekOfInterval, format, parseISO, isWithinInterval } from 'date-fns';

import type { Quote, QuoteStatus } from '@/ai/schemas/quote-schemas';
import type { Customer } from '@/ai/schemas/customer-schemas';
import { fetchQuotes } from '@/ai/flows/manage-quotes-flow';
import { fetchCustomers } from '@/ai/flows/manage-customers-flow';
import Link from 'next/link';
import { ClientOnly } from '@/components/client-only';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const TrendIndicator = ({ value }: { value: number }) => {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`ml-2 text-xs inline-flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
};

const getConversionRateColor = (rate: number) => {
  if (rate >= 70) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
};


export default function QuoteConversionReportPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  const [customerFilter, setCustomerFilter] = useState('all');
  const [salesRepFilter, setSalesRepFilter] = useState('all'); // Mocked for now

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [quotesData, customersData] = await Promise.all([
        fetchQuotes(),
        fetchCustomers(),
      ]);
      setAllQuotes(quotesData);
      setAllCustomers(customersData);
    } catch (error) {
      console.error("Failed to load report data:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Could not load report data."), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const filteredQuotes = useMemo(() => {
    return allQuotes.filter(quote => 
        (customerFilter === 'all' || quote.selectedCustomerId === customerFilter)
        // Add salesRepFilter logic here when available
    );
  }, [allQuotes, customerFilter, salesRepFilter]);

  const summaryMetrics = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    
    const currentMonthQuotes = filteredQuotes.filter(q => isWithinInterval(parseISO(q.createdAt), { start: currentMonthStart, end: now }));
    const lastMonthQuotes = filteredQuotes.filter(q => isWithinInterval(parseISO(q.createdAt), { start: lastMonthStart, end: lastMonthEnd }));
    
    const totalQuotes = filteredQuotes.length;
    const acceptedQuotes = filteredQuotes.filter(q => q.status === 'Accepted' || q.status === 'Booked').length;
    const conversionRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;
    const totalValue = filteredQuotes.reduce((sum, q) => sum + q.totalSellPrice, 0);

    const totalQuotesLastMonth = lastMonthQuotes.length;
    const quoteCountChange = totalQuotesLastMonth > 0 ? ((currentMonthQuotes.length - totalQuotesLastMonth) / totalQuotesLastMonth) * 100 : (currentMonthQuotes.length > 0 ? 100 : 0);

    return {
      totalQuotes: totalQuotes,
      quoteCountChange: quoteCountChange,
      acceptedQuotes: acceptedQuotes,
      conversionRate: conversionRate,
      totalValue: totalValue,
    };
  }, [filteredQuotes]);
  
  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const fourWeeksAgo = startOfMonth(subMonths(now, 1));
    const weeks = eachWeekOfInterval({ start: fourWeeksAgo, end: now }, { weekStartsOn: 1 });

    return weeks.map(weekStart => {
        const weekEnd = addDays(weekStart, 6); // Missing import or definition for addDays.
        const weekQuotes = filteredQuotes.filter(q => isWithinInterval(parseISO(q.createdAt), {start: weekStart, end: weekEnd}));
        return {
            name: format(weekStart, 'MMM d'),
            Created: weekQuotes.length,
            Accepted: weekQuotes.filter(q => q.status === 'Accepted' || q.status === 'Booked').length,
        };
    }).slice(-4); // Take last 4 weeks
  }, [filteredQuotes]);

  const funnelData = useMemo(() => {
      const created = filteredQuotes.length;
      if (created === 0) return [];
      const sent = filteredQuotes.filter(q => q.status !== 'Draft').length;
      const accepted = filteredQuotes.filter(q => q.status === 'Accepted' || q.status === 'Booked').length;
      const booked = filteredQuotes.filter(q => q.status === 'Booked').length;
      return [
          { name: 'Created', value: created, rate: 100 },
          { name: 'Sent', value: sent, rate: (sent/created) * 100 },
          { name: 'Accepted', value: accepted, rate: (accepted/created) * 100 },
          { name: 'Booked', value: booked, rate: (booked/created) * 100 },
      ];
  }, [filteredQuotes]);
  
  const customerTableData = useMemo(() => {
    const customerMap = new Map<string, {
      customerName: string;
      quotesCreated: number;
      quotesAccepted: number;
      totalValue: number;
    }>();

    filteredQuotes.forEach(quote => {
        const customerId = quote.selectedCustomerId || quote.clientName;
        const customerName = allCustomers.find(c => c.id === quote.selectedCustomerId)?.name || quote.clientName;
        
        const entry = customerMap.get(customerId) || {
            customerName,
            quotesCreated: 0,
            quotesAccepted: 0,
            totalValue: 0,
        };
        
        entry.quotesCreated += 1;
        entry.totalValue += quote.totalSellPrice;
        if (quote.status === 'Accepted' || quote.status === 'Booked') {
            entry.quotesAccepted += 1;
        }
        
        customerMap.set(customerId, entry);
    });

    return Array.from(customerMap.entries()).map(([id, data]) => ({
        id,
        ...data,
        conversionRate: data.quotesCreated > 0 ? (data.quotesAccepted / data.quotesCreated) * 100 : 0,
        avgQuoteValue: data.quotesCreated > 0 ? data.totalValue / data.quotesCreated : 0,
    })).sort((a,b) => b.totalValue - a.totalValue);
  }, [filteredQuotes, allCustomers]);


  if (isLoading) {
      return (
        <div className="space-y-6">
            <PageHeader title="Quote Volume & Conversion" description="Sales metrics and conversion analysis" icon={TrendingUp} actions={<Button variant="outline" disabled><Download className="mr-2 h-4 w-4" /> Export Report</Button>} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3"/><Skeleton className="h-96 lg:col-span-2"/></div>
            <Skeleton className="h-96"/>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quote Volume & Conversion" 
        description="Sales metrics and conversion analysis"
        icon={TrendingUp}
        actions={<Button variant="outline" disabled><Download className="mr-2 h-4 w-4" /> Export Report</Button>}
      />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ClientOnly fallback={<Skeleton className="h-28" />}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Quotes Created</CardTitle><FileText className="h-4 w-4 text-muted-foreground"/></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summaryMetrics.totalQuotes}</div><p className="text-xs text-muted-foreground">vs last month <TrendIndicator value={summaryMetrics.quoteCountChange} /></p></CardContent>
        </Card>
        </ClientOnly>
        <ClientOnly fallback={<Skeleton className="h-28" />}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Quotes Accepted</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader>
          <CardContent><div className="text-2xl font-bold">+{summaryMetrics.acceptedQuotes}</div><p className="text-xs text-muted-foreground">in selected period</p></CardContent>
        </Card>
        </ClientOnly>
        <ClientOnly fallback={<Skeleton className="h-28" />}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Conversion Rate</CardTitle><Percent className="h-4 w-4 text-muted-foreground"/></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summaryMetrics.conversionRate.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Overall conversion rate</p></CardContent>
        </Card>
        </ClientOnly>
        <ClientOnly fallback={<Skeleton className="h-28" />}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Quote Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(summaryMetrics.totalValue)}</div><p className="text-xs text-muted-foreground">Total value of all quotes</p></CardContent>
        </Card>
        </ClientOnly>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Weekly Quote Activity</CardTitle>
            <CardDescription>Created vs. Accepted quotes over the last 4 weeks.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`}/>
                <RechartsTooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))'}}/>
                <Legend iconSize={10} />
                <Bar dataKey="Created" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Accepted" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Quote progression from creation to booking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {funnelData.map((stage, index) => (
                <div key={stage.name}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{stage.name}</span>
                        <span className="text-sm text-muted-foreground">{stage.value} ({stage.rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={stage.rate} indicatorClassName={getConversionRateColor(stage.rate)} />
                </div>
            ))}
            {funnelData.length === 0 && <p className="text-sm text-center text-muted-foreground py-10">No quote data to display funnel.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Customer Performance</CardTitle>
            <CardDescription>Analyze quote conversion rates and value by customer.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-center">Quotes Created</TableHead>
                        <TableHead className="text-center">Accepted</TableHead>
                        <TableHead>Conversion Rate</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-right">Avg. Quote Value</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customerTableData.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No customer data to display.</TableCell></TableRow>
                    )}
                    {customerTableData.map(customer => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.customerName}</TableCell>
                            <TableCell className="text-center">{customer.quotesCreated}</TableCell>
                            <TableCell className="text-center">{customer.quotesAccepted}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Progress value={customer.conversionRate} indicatorClassName={getConversionRateColor(customer.conversionRate)} className="w-20 h-2"/>
                                    <span className="text-xs font-semibold">{customer.conversionRate.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(customer.totalValue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(customer.avgQuoteValue)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/customers?id=${customer.id}`}><Eye className="mr-2 h-4 w-4"/>Details</Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}


    
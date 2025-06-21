'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { type MelItem } from '@/ai/schemas/mel-item-schemas';
import { type FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { melCategories, melStatuses, type MelCategory, type MelStatus } from '@/ai/schemas/mel-item-schemas';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';
import { getMelsAndFleetData } from './actions';

const getStatusBadgeVariant = (status: MelStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Closed": return "default";
    case "Open": return "destructive";
    default: return "outline";
  }
};

export default function MelsClient() {
  const searchParams = useSearchParams();
  const aircraftIdFromQuery = searchParams.get('aircraftId') || 'all';

  const [allMelItems, setAllMelItems] = useState<MelItem[]>([]);
  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MelStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MelCategory | 'all'>('all');
  const [aircraftFilter, setAircraftFilter] = useState<string>(aircraftIdFromQuery);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { melItems, fleet } = await getMelsAndFleetData();
      setAllMelItems(melItems);
      setFleetList(fleet);
      if (aircraftIdFromQuery !== 'all') {
        setAircraftFilter(aircraftIdFromQuery);
      }
    } catch (error) {
      console.error("Failed to load MEL items or fleet:", error);
      toast({
        title: "Error Loading Data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, aircraftIdFromQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMelItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allMelItems.filter(item => {
      const matchesSearch =
        item.melNumber.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        (item.aircraftTailNumber?.toLowerCase().includes(term) ?? false);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesAircraft = aircraftFilter === 'all' || item.aircraftId === aircraftFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesAircraft;
    });
  }, [allMelItems, searchTerm, statusFilter, categoryFilter, aircraftFilter]);

  const getAircraftLabel = (aircraftId: string) => {
    const ac = fleetList.find(a => a.id === aircraftId);
    return ac ? `${ac.tailNumber} (${ac.model})` : aircraftId;
  };

  const formatDateForDisplay = (d?: string) => {
    if (!d) return 'N/A';
    const date = parseISO(d);
    return isValid(date) ? format(date, 'MM/dd/yyyy') : 'Invalid Date';
  };

  return (
    <>
      <PageHeader
        title="Global MEL Log"
        description="View and filter all Minimum Equipment List items across the fleet."
        icon={BookOpen}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All MEL Items</CardTitle>
          <CardDescription>Browse and filter the complete MEL log.</CardDescription>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Input
                placeholder="Search MEL #, aircraft, desc..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={isLoading}
                className="w-full"
              />
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as MelStatus | 'all')} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {melStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as MelCategory | 'all')} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Filter by Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {melCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={aircraftFilter} onValueChange={v => setAircraftFilter(v as string)} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Filter by Aircraft" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aircraft</SelectItem>
                  {fleetList.map(a => <SelectItem key={a.id} value={a.id}>{a.tailNumber} – {a.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading MEL items...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>MEL #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Entered</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMelItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      {allMelItems.length
                        ? "No MEL items match your criteria."
                        : "No MEL items in the system yet."}
                    </TableCell>
                  </TableRow>
                ) : filteredMelItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{getAircraftLabel(item.aircraftId)}</TableCell>
                    <TableCell className="font-medium">{item.melNumber}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell className="text-xs text-center">{item.category || '-'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDateForDisplay(item.dateEntered)}</TableCell>
                    <TableCell className="text-xs">{formatDateForDisplay(item.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/aircraft/currency/${item.aircraftId}#mel-items`}>
                          <Eye className="mr-1 h-4 w-4" /> View/Manage
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

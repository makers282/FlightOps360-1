
"use client";

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
import { BookOpen, Search, Eye, Loader2, Filter as FilterIcon, Settings, AlertTriangle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchAllMelItems, type MelItem } from '@/ai/flows/manage-mel-items-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { melCategories, melStatuses, type MelCategory, type MelStatus } from '@/ai/schemas/mel-item-schemas';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';

const getStatusBadgeVariant = (status: MelStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Closed": return "default";
    case "Open": return "destructive";
    default: return "outline";
  }
};

export default function AllMelItemsPage() {
  const searchParams = useSearchParams();
  const aircraftIdFromQuery = searchParams.get('aircraftId');

  const [allMelItems, setAllMelItems] = useState<MelItem[]>([]);
  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MelStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MelCategory | 'all'>('all');
  const [aircraftFilter, setAircraftFilter] = useState<string>(aircraftIdFromQuery || 'all');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedMelItems, fetchedFleet] = await Promise.all([
        fetchAllMelItems(),
        fetchFleetAircraft(),
      ]);
      setAllMelItems(fetchedMelItems);
      setFleetList(fetchedFleet);
      if (aircraftIdFromQuery) {
        setAircraftFilter(aircraftIdFromQuery);
      }
    } catch (error) {
      console.error("Failed to load MEL items or fleet:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, aircraftIdFromQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMelItems = useMemo(() => {
    return allMelItems.filter(item => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch =
        item.melNumber.toLowerCase().includes(lowerSearchTerm) ||
        item.description.toLowerCase().includes(lowerSearchTerm) ||
        (item.aircraftTailNumber && item.aircraftTailNumber.toLowerCase().includes(lowerSearchTerm));
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesAircraft = aircraftFilter === 'all' || item.aircraftId === aircraftFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesAircraft;
    });
  }, [allMelItems, searchTerm, statusFilter, categoryFilter, aircraftFilter]);

  const getAircraftLabel = (aircraftId: string) => {
    const aircraft = fleetList.find(ac => ac.id === aircraftId);
    return aircraft ? `${aircraft.tailNumber} (${aircraft.model})` : aircraftId;
  };

  const formatDateForDisplay = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MM/dd/yyyy') : 'Invalid Date';
    } catch {
      return 'N/A';
    }
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MelStatus | 'all')} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {melStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as MelCategory | 'all')} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Filter by Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {melCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select value={aircraftFilter} onValueChange={(value) => setAircraftFilter(value as string)} disabled={isLoading || fleetList.length === 0}>
                <SelectTrigger><SelectValue placeholder="Filter by Aircraft" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aircraft</SelectItem>
                  {fleetList.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber} - {ac.model}</SelectItem>)}
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No MEL items found{allMelItems.length > 0 ? " matching your criteria" : ". No MEL items in the system yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMelItems.map((item) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

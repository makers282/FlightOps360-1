
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
import { FileWarning, Eye, Loader2, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchAllAircraftDiscrepancies, type AircraftDiscrepancy } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import { discrepancyStatuses, type DiscrepancyStatus } from '@/ai/schemas/aircraft-discrepancy-schemas';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';

const getStatusBadgeVariant = (status: DiscrepancyStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Closed": return "default";
    case "Open": return "destructive";
    case "Deferred": return "secondary";
    default: return "outline";
  }
};

type SortKey = 'aircraftDisplayLabel' | 'dateDiscovered' | 'status';
interface SortConfig {
  key: SortKey;
  direction: 'ascending' | 'descending';
}

export default function DiscrepanciesClient() {
  const searchParams = useSearchParams();
  const aircraftIdFromQuery = searchParams.get('aircraftId');

  const [allDiscrepancies, setAllDiscrepancies] = useState<AircraftDiscrepancy[]>([]);
  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | 'all'>('all');
  const [aircraftIdFilter, setAircraftIdFilter] = useState<string>(aircraftIdFromQuery || 'all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dateDiscovered', direction: 'descending' });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedDiscrepancies, fetchedFleet] = await Promise.all([
        fetchAllAircraftDiscrepancies(),
        fetchFleetAircraft(),
      ]);
      setAllDiscrepancies(fetchedDiscrepancies);
      setFleetList(fetchedFleet);
      if (aircraftIdFromQuery) {
        setAircraftIdFilter(aircraftIdFromQuery);
      }
    } catch (error) {
      console.error("Failed to load discrepancies or fleet:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, aircraftIdFromQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAircraftDisplayLabel = useCallback((aircraftId: string): string => {
    const aircraft = fleetList.find(ac => ac.id === aircraftId);
    return aircraft
      ? `${aircraft.tailNumber || 'Unknown Tail'} – ${aircraft.model || 'Unknown Model'}`
      : aircraftId;
  }, [fleetList]);

  const filteredAndSortedDiscrepancies = useMemo(() => {
    let list = allDiscrepancies.map(d => ({
      ...d,
      aircraftDisplayLabel: d.aircraftTailNumber || getAircraftDisplayLabel(d.aircraftId),
    }));

    if (statusFilter !== 'all') {
      list = list.filter(d => d.status === statusFilter);
    }
    if (aircraftIdFilter !== 'all') {
      list = list.filter(d => d.aircraftId === aircraftIdFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(d =>
        d.aircraftDisplayLabel.toLowerCase().includes(term) ||
        d.description.toLowerCase().includes(term) ||
        (d.deferralReference?.toLowerCase().includes(term) ?? false)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      const valA = a[sortConfig.key], valB = b[sortConfig.key];
      if (!valA) cmp = 1;
      else if (!valB) cmp = -1;
      else if (sortConfig.key === 'dateDiscovered') {
        cmp = parseISO(valA as string).getTime() - parseISO(valB as string).getTime();
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        cmp = valA.localeCompare(valB);
      }
      return sortConfig.direction === 'ascending' ? cmp : -cmp;
    });

    return list;
  }, [allDiscrepancies, getAircraftDisplayLabel, statusFilter, aircraftIdFilter, searchTerm, sortConfig]);

  const requestSort = (key: SortKey) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'ascending'
      ? 'descending'
      : 'ascending';
    setSortConfig({ key, direction });
  };

  const formatDate = (d?: string) => {
    if (!d) return 'N/A';
    const date = parseISO(d);
    return isValid(date) ? format(date, 'MM/dd/yyyy') : 'Invalid Date';
  };

  return (
    <>
      <PageHeader
        title="Global Aircraft Discrepancy Log"
        description="View and filter all reported aircraft discrepancies across the fleet."
        icon={FileWarning}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Discrepancies</CardTitle>
          <CardDescription>Browse and filter the complete discrepancy log.</CardDescription>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Input
                placeholder="Search by Aircraft, Description, Ref..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select
                value={statusFilter}
                onValueChange={v => setStatusFilter(v as DiscrepancyStatus | 'all')}
                disabled={isLoading}
              >
                <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {discrepancyStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </ClientOnly>
            <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
              <Select
                value={aircraftIdFilter}
                onValueChange={v => setAircraftIdFilter(v as string)}
                disabled={isLoading || fleetList.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="Filter by Aircraft" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aircraft</SelectItem>
                  {fleetList.map(ac => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.tailNumber} – {ac.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ClientOnly>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading discrepancies...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => requestSort('aircraftDisplayLabel')} className="group">
                      Aircraft {<ArrowUpDown className="ml-2 h-3 w-3 opacity-30 group-hover:opacity-100" />}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => requestSort('dateDiscovered')} className="group">
                      Date Disc. {sortConfig.key === 'dateDiscovered'
                        ? (sortConfig.direction === 'ascending' ? <ArrowUp /> : <ArrowDown />)
                        : <ArrowUpDown className="ml-2 h-3 w-3 opacity-30 group-hover:opacity-100" />}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => requestSort('status')} className="group">
                      Status {sortConfig.key === 'status'
                        ? (sortConfig.direction === 'ascending' ? <ArrowUp /> : <ArrowDown />)
                        : <ArrowUpDown className="ml-2 h-3 w-3 opacity-30 group-hover:opacity-100" />}
                    </Button>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedDiscrepancies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      {allDiscrepancies.length
                        ? "No discrepancies match your criteria."
                        : "No discrepancies in the system yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedDiscrepancies.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-xs">{item.aircraftDisplayLabel}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.dateDiscovered)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/aircraft/currency/${item.aircraftId}`}>
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
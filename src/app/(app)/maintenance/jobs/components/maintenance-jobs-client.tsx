
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { fetchMaintenanceJobs } from '@/ai/flows/manage-maintenance-jobs-flow';
import { fetchFleetAircraft } from '@/ai/flows/manage-fleet-flow';
import type { MaintenanceJob, MaintenanceJobStatus } from '@/ai/schemas/maintenance-job-schemas';
import { maintenanceJobStatuses } from '@/ai/schemas/maintenance-job-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Hammer, PlusCircle, Search, Eye, Edit, Loader2 } from 'lucide-react';
import { AddEditJobModal } from './add-edit-job-modal';
import { JobDetailsDrawer } from './job-details-drawer';

const getStatusBadgeVariant = (status: MaintenanceJobStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Opened': return 'outline';
    case 'Accepted': return 'secondary';
    case 'In Progress': return 'secondary';
    case 'Completed': return 'default';
    case 'Closed': return 'default';
    case 'Canceled': return 'destructive';
    default: return 'outline';
  }
};

export function MaintenanceJobsClient() {
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MaintenanceJobStatus | 'all'>('all');
  const [aircraftFilter, setAircraftFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<MaintenanceJob | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsData, fleetData] = await Promise.all([
        fetchMaintenanceJobs(),
        fetchFleetAircraft(),
      ]);
      setJobs(jobsData);
      setFleet(fleetData);
    } catch (error) {
      console.error("Failed to load maintenance jobs data:", error);
      toast({ title: "Error", description: "Could not load maintenance jobs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleOpenNewModal = () => {
    setSelectedJob(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (job: MaintenanceJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };
  
  const handleViewDetails = (job: MaintenanceJob) => {
    setSelectedJob(job);
    setIsDrawerOpen(true);
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const searchMatch = searchTerm ?
        job.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.tailNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.shopName.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const statusMatch = statusFilter === 'all' || job.status === statusFilter;
      const aircraftMatch = aircraftFilter === 'all' || job.aircraftId === aircraftFilter;
      return searchMatch && statusMatch && aircraftMatch;
    });
  }, [jobs, searchTerm, statusFilter, aircraftFilter]);
  
  const aircraftOptions = useMemo(() => [...new Set(jobs.map(j => j.tailNumber))].sort(), [jobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Work Orders"
        description="Track and manage all maintenance jobs from start to finish."
        icon={Hammer}
        actions={<Button onClick={handleOpenNewModal}><PlusCircle className="mr-2 h-4 w-4"/>New Work Order</Button>}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search WO#, Tail#, Shop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Aircraft" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Aircraft</SelectItem>
                {fleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {maintenanceJobStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work Order #</TableHead>
                <TableHead>Aircraft</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates (Issued / Due)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No jobs match your criteria.</TableCell></TableRow>
              ) : filteredJobs.map(job => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.workOrderNumber}</TableCell>
                  <TableCell>{job.tailNumber}</TableCell>
                  <TableCell>{job.shopName}</TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(job.status)}>{job.status}</Badge></TableCell>
                  <TableCell>{format(parseISO(job.dateIssued), 'MM/dd/yy')} → {job.dateDue ? format(parseISO(job.dateDue), 'MM/dd/yy') : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(job)}><Eye className="mr-2 h-4 w-4"/>View</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(job)}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AddEditJobModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        initialData={selectedJob}
        onJobSaved={loadData}
        fleet={fleet}
      />
      
      <JobDetailsDrawer
        isOpen={isDrawerOpen}
        setIsOpen={setIsDrawerOpen}
        job={selectedJob}
      />
    </div>
  );
}

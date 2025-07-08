
'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { MaintenanceJob } from '@/ai/schemas/maintenance-job-schemas';
import { fetchMaintenanceCosts, type MaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';

interface JobDetailsDrawerProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  job: MaintenanceJob | null;
}

const formatCurrency = (value: number | undefined) => {
  if (value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export function JobDetailsDrawer({ isOpen, setIsOpen, job }: JobDetailsDrawerProps) {
  const [linkedCosts, setLinkedCosts] = useState<MaintenanceCost[]>([]);
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && job?.id) {
      setIsLoadingCosts(true);
      fetchMaintenanceCosts()
        .then(allCosts => {
          const filtered = allCosts.filter(cost => cost.jobId === job.id);
          setLinkedCosts(filtered);
        })
        .catch(error => {
          console.error("Error fetching linked costs:", error);
          toast({ title: "Error", description: "Could not load linked cost entries.", variant: "destructive" });
        })
        .finally(() => setIsLoadingCosts(false));
    }
  }, [isOpen, job, toast]);

  if (!job) return null;

  const totalActualCost = linkedCosts.reduce((sum, cost) => sum + cost.costBreakdowns.reduce((s, b) => s + b.actualCost, 0), 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Work Order: {job.workOrderNumber}</SheetTitle>
          <SheetDescription>{job.shopName} - {job.tailNumber}</SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-4">
            <Card>
                <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                    <p><strong>Status:</strong> {job.status}</p>
                    <p><strong>Issued:</strong> {format(parseISO(job.dateIssued), 'PPP')}</p>
                    <p><strong>Due:</strong> {job.dateDue ? format(parseISO(job.dateDue), 'PPP') : 'N/A'}</p>
                    {job.notes && <p><strong>Notes:</strong> {job.notes}</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="text-base">Linked Costs</CardTitle></CardHeader>
                <CardContent>
                    {isLoadingCosts ? <Loader2 className="animate-spin"/> :
                        linkedCosts.length === 0 ? <p className="text-sm text-muted-foreground">No cost entries linked to this job.</p> :
                        <Table>
                            <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {linkedCosts.map(cost => (
                                    <TableRow key={cost.id}>
                                        <TableCell>{cost.invoiceNumber}</TableCell>
                                        <TableCell>{format(parseISO(cost.invoiceDate), 'MM/dd/yy')}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(cost.costBreakdowns.reduce((s,b)=>s+b.actualCost,0))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    }
                     <Separator className="my-2"/>
                     <div className="flex justify-between font-semibold">
                         <span>Total Actual Costs:</span>
                         <span>{formatCurrency(totalActualCost)}</span>
                     </div>
                </CardContent>
            </Card>
        </div>
        <SheetFooter>
          <SheetClose asChild><Button variant="outline">Close</Button></SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

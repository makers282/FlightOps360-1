
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Save, CalendarIcon, Hammer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay } from 'date-fns';
import { saveMaintenanceJob } from '@/ai/flows/manage-maintenance-jobs-flow';
import type { MaintenanceJob, MaintenanceJobStatus } from '@/ai/schemas/maintenance-job-schemas';
import { maintenanceJobStatuses } from '@/ai/schemas/maintenance-job-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';

const jobFormSchema = z.object({
  aircraftId: z.string().min(1, "Please select an aircraft."),
  workOrderNumber: z.string().min(1, "Work Order # is required."),
  shopName: z.string().min(1, "Shop name is required."),
  status: z.enum(maintenanceJobStatuses),
  dateIssued: z.date({ required_error: "Issue date is required." }),
  dateDue: z.date().optional(),
  notes: z.string().optional(),
}).refine(data => data.dateDue ? data.dateDue >= data.dateIssued : true, {
  message: "Due date cannot be before the issue date.",
  path: ["dateDue"],
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface AddEditJobModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialData?: MaintenanceJob | null;
  onJobSaved: () => void;
  fleet: FleetAircraft[];
}

export function AddEditJobModal({ isOpen, setIsOpen, initialData, onJobSaved, fleet }: AddEditJobModalProps) {
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();
  const isEditing = !!initialData;

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      aircraftId: '',
      workOrderNumber: '',
      shopName: '',
      status: 'Opened',
      dateIssued: startOfDay(new Date()),
      dateDue: undefined,
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          aircraftId: initialData.aircraftId,
          workOrderNumber: initialData.workOrderNumber,
          shopName: initialData.shopName,
          status: initialData.status,
          dateIssued: parseISO(initialData.dateIssued),
          dateDue: initialData.dateDue ? parseISO(initialData.dateDue) : undefined,
          notes: initialData.notes || '',
        });
      } else {
        form.reset();
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<JobFormData> = (data) => {
    startSavingTransition(async () => {
      try {
        const aircraft = fleet.find(ac => ac.id === data.aircraftId);
        if (!aircraft) throw new Error("Selected aircraft not found.");

        await saveMaintenanceJob({
          id: isEditing ? initialData?.id : undefined,
          aircraftId: data.aircraftId,
          tailNumber: aircraft.tailNumber,
          workOrderNumber: data.workOrderNumber,
          shopName: data.shopName,
          status: data.status,
          dateIssued: data.dateIssued.toISOString(),
          dateDue: data.dateDue?.toISOString(),
          notes: data.notes,
        });

        toast({ title: `Work Order ${isEditing ? 'Updated' : 'Created'}` });
        onJobSaved();
        setIsOpen(false);
      } catch (error) {
        console.error("Error saving job:", error);
        toast({ title: "Error", description: "Could not save work order.", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hammer className="h-5 w-5"/> {isEditing ? 'Edit Work Order' : 'New Work Order'}</DialogTitle>
          <DialogDescription>Fill in the details for the maintenance job.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="job-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="aircraftId" render={({ field }) => (
              <FormItem><FormLabel>Aircraft</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select aircraft"/></SelectTrigger></FormControl><SelectContent>{fleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
            )}/>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="workOrderNumber" render={({ field }) => (<FormItem><FormLabel>Work Order #</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
              <FormField control={form.control} name="shopName" render={({ field }) => (<FormItem><FormLabel>Shop Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{maintenanceJobStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
            )}/>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="dateIssued" render={({ field }) => (<FormItem><FormLabel>Date Issued</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value&&"text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value?format(field.value,"PPP"):<span>Pick date</span>}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange}/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
              <FormField control={form.control} name="dateDue" render={({ field }) => (<FormItem><FormLabel>Date Due</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value&&"text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value?format(field.value,"PPP"):<span>Pick date</span>}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={d=>form.getValues('dateIssued')?d<form.getValues('dateIssued'):false}/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={3}/></FormControl><FormMessage/></FormItem>)}/>
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button type="submit" form="job-form" disabled={isSaving}>{isSaving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

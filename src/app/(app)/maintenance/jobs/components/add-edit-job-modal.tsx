
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
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
import { Loader2, Save, CalendarIcon, Hammer, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay } from 'date-fns';
import { saveMaintenanceJob } from '@/ai/flows/manage-maintenance-jobs-flow';
import type { MaintenanceJob, MaintenanceJobStatus, ProjectedCostBreakdown } from '@/ai/schemas/maintenance-job-schemas';
import { maintenanceJobStatuses } from '@/ai/schemas/maintenance-job-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const projectedCostBreakdownSchema = z.object({
  category: z.enum(['Labor', 'Parts', 'Shop Fees', 'Other']),
  description: z.string().optional(),
  cost: z.coerce.number().min(0).optional().default(0),
});

const jobFormSchema = z.object({
  aircraftId: z.string().min(1, "Please select an aircraft."),
  workOrderNumber: z.string().min(1, "Work Order # is required."),
  shopName: z.string().min(1, "Shop name is required."),
  shopContactName: z.string().optional(),
  shopContactPhone: z.string().optional(),
  shopContactEmail: z.string().email().optional().or(z.literal('')),
  status: z.enum(maintenanceJobStatuses),
  dateIssued: z.date({ required_error: "Issue date is required." }),
  dateDue: z.date().optional(),
  notes: z.string().optional(),
  costBreakdowns: z.array(projectedCostBreakdownSchema).optional(),
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
      status: 'Quote',
      dateIssued: startOfDay(new Date()),
      dateDue: undefined,
      notes: '',
      costBreakdowns: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'costBreakdowns',
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          aircraftId: initialData.aircraftId,
          workOrderNumber: initialData.workOrderNumber,
          shopName: initialData.shopName,
          shopContactName: initialData.shopContactName,
          shopContactPhone: initialData.shopContactPhone,
          shopContactEmail: initialData.shopContactEmail,
          status: initialData.status,
          dateIssued: parseISO(initialData.dateIssued),
          dateDue: initialData.dateDue ? parseISO(initialData.dateDue) : undefined,
          notes: initialData.notes || '',
          costBreakdowns: initialData.costBreakdowns || [],
        });
      } else {
        form.reset({
            aircraftId: fleet.length > 0 ? fleet[0].id : '',
            workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
            shopName: '',
            shopContactName: '',
            shopContactEmail: '',
            shopContactPhone: '',
            status: 'Quote',
            dateIssued: startOfDay(new Date()),
            dateDue: undefined,
            notes: '',
            costBreakdowns: [{ category: 'Parts', cost: 0, description: '' }],
        });
      }
    }
  }, [isOpen, isEditing, initialData, form, fleet]);

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
          shopContactName: data.shopContactName,
          shopContactPhone: data.shopContactPhone,
          shopContactEmail: data.shopContactEmail,
          status: data.status,
          dateIssued: data.dateIssued.toISOString(),
          dateDue: data.dateDue?.toISOString(),
          notes: data.notes,
          costBreakdowns: data.costBreakdowns,
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hammer className="h-5 w-5"/> {isEditing ? 'Edit Work Order' : 'New Work Order'}</DialogTitle>
          <DialogDescription>Fill in the details for the maintenance job.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="job-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <ScrollArea className="max-h-[65vh] pr-6">
                <div className="space-y-4">
                    <FormField control={form.control} name="aircraftId" render={({ field }) => (
                    <FormItem><FormLabel>Aircraft</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select aircraft"/></SelectTrigger></FormControl><SelectContent>{fleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                    <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="workOrderNumber" render={({ field }) => (<FormItem><FormLabel>Work Order #</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={form.control} name="shopName" render={({ field }) => (<FormItem><FormLabel>Shop Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                    </div>
                     <Card className="p-4 bg-muted/30 border-dashed">
                        <CardHeader className="p-0 pb-2"><CardTitle className="text-base">Shop Contact (Optional)</CardTitle></CardHeader>
                        <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="shopContactName" render={({ field }) => (<FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                            <FormField control={form.control} name="shopContactPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/>
                            <FormField control={form.control} name="shopContactEmail" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                        </CardContent>
                    </Card>
                    <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{maintenanceJobStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                    <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dateIssued" render={({ field }) => (<FormItem><FormLabel>Date Issued</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value&&"text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value?format(field.value,"PPP"):<span>Pick date</span>}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange}/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                    <FormField control={form.control} name="dateDue" render={({ field }) => (<FormItem><FormLabel>Date Due</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value&&"text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value?format(field.value,"PPP"):<span>Pick date</span>}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={d=>form.getValues('dateIssued')?d<form.getValues('dateIssued'):false}/></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                    </div>
                     <Card>
                        <CardHeader><CardTitle className="text-base">Projected Costs</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {fields.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                                    <FormField control={form.control} name={`costBreakdowns.${index}.category`} render={({field}) => (<FormItem className="col-span-4"><FormLabel className="text-xs">Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Labor">Labor</SelectItem><SelectItem value="Parts">Parts</SelectItem><SelectItem value="Shop Fees">Shop Fees</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></FormItem>)} />
                                    <FormField control={form.control} name={`costBreakdowns.${index}.cost`} render={({field}) => (<FormItem className="col-span-3"><FormLabel className="text-xs">Cost</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)} />
                                    <FormField control={form.control} name={`costBreakdowns.${index}.description`} render={({field}) => (<FormItem className="col-span-4"><FormLabel className="text-xs">Description</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({category:'Parts', cost:0, description:''})}><PlusCircle className="h-4 w-4 mr-2"/>Add Cost Item</Button>
                        </CardContent>
                    </Card>
                    <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={3}/></FormControl><FormMessage/></FormItem>)}/>
                </div>
            </ScrollArea>
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

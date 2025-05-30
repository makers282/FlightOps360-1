
"use client";

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parse as parseDate, isValid } from "date-fns"; 
import type { FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { ScrollArea } from '@/components/ui/scroll-area';

const itemTypes = ["Inspection", "Service Bulletin", "Airworthiness Directive", "Component Replacement", "Overhaul", "Life Limited Part", "Other"] as const;
const trackTypes = ["Interval", "One Time", "Dont Alert"] as const;

const maintenanceTaskSchema = z.object({
  // Latest Completed Details
  lastCompletedDate: z.string().optional().refine(val => !val || isValid(parseDate(val, 'yyyy-MM-dd', new Date())), { message: "Invalid date format for last completion." }),
  lastCompletedHours: z.coerce.number({invalid_type_error: "Must be a number"}).positive("Must be positive").optional().or(z.literal(0)).or(z.nan()),
  lastCompletedCycles: z.coerce.number({invalid_type_error: "Must be a number"}).positive("Must be positive").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  lastCompletedNotes: z.string().optional(),

  // Task Description
  itemTitle: z.string().min(1, "Item title is required"),
  referenceNumber: z.string().optional(),
  partNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  itemType: z.enum(itemTypes),
  associatedComponent: z.string().optional(),
  details: z.string().optional(),
  isActive: z.boolean().default(true),

  // Tracking Settings
  trackType: z.enum(trackTypes).default("Interval"),
  isTripsNotAffected: z.boolean().default(false),

  isHoursDueEnabled: z.boolean().default(false),
  hoursDue: z.coerce.number({invalid_type_error: "Must be a number"}).positive("Must be positive").optional().or(z.literal(0)).or(z.nan()),
  hoursTolerance: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").optional().or(z.literal(0)).or(z.nan()),
  alertHoursPrior: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").optional().or(z.literal(0)).or(z.nan()),

  isCyclesDueEnabled: z.boolean().default(false),
  cyclesDue: z.coerce.number({invalid_type_error: "Must be a number"}).positive("Must be positive").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  cyclesTolerance: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  alertCyclesPrior: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  
  isDaysDueEnabled: z.boolean().default(false),
  // For 'One Time' tasks, this field might represent a specific due date.
  // For 'Interval' tasks, this represents number of days from last completion.
  daysDueValue: z.string().optional().refine(val => { // Changed to string to accommodate date picker or number
    if (!val) return true;
    const numVal = Number(val);
    if (!isNaN(numVal)) return numVal >= 0; // Allow positive numbers for interval
    return isValid(parseDate(val, 'yyyy-MM-dd', new Date())); // Allow yyyy-MM-dd for one-time date
  }, { message: "Invalid days/date format." }),
  daysTolerance: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  alertDaysPrior: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
})
.superRefine((data, ctx) => {
    if (data.isHoursDueEnabled && (data.hoursDue === undefined || data.hoursDue === null || isNaN(data.hoursDue))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hours Due value is required when enabled.", path: ["hoursDue"]});
    }
    if (data.isCyclesDueEnabled && (data.cyclesDue === undefined || data.cyclesDue === null || isNaN(data.cyclesDue))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cycles Due value is required when enabled.", path: ["cyclesDue"]});
    }
    if (data.isDaysDueEnabled && (!data.daysDueValue || data.daysDueValue.trim() === "")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Days/Date Due value is required when enabled.", path: ["daysDueValue"]});
    }
});


export type MaintenanceTaskFormData = z.infer<typeof maintenanceTaskSchema>;

interface AddMaintenanceTaskModalProps {
  aircraft: FleetAircraft | null;
  onSave: (data: MaintenanceTaskFormData) => void;
  children: React.ReactNode; 
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function AddMaintenanceTaskModal({ aircraft, onSave, children, isOpen, setIsOpen }: AddMaintenanceTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<MaintenanceTaskFormData>({
    resolver: zodResolver(maintenanceTaskSchema),
    defaultValues: {
      itemTitle: '',
      itemType: 'Inspection',
      isActive: true,
      trackType: 'Interval',
      isTripsNotAffected: false,
      isHoursDueEnabled: false,
      hoursDue: 0,
      hoursTolerance: 0,
      alertHoursPrior: 0,
      isCyclesDueEnabled: false,
      cyclesDue: 0,
      cyclesTolerance: 0,
      alertCyclesPrior: 0,
      isDaysDueEnabled: false,
      daysDueValue: '',
      daysTolerance: 0,
      alertDaysPrior: 0,
      lastCompletedHours: 0,
      lastCompletedCycles: 0,
    },
  });

  const { control, watch, setValue } = form;
  const trackType = watch("trackType");
  const isHoursDueEnabled = watch("isHoursDueEnabled");
  const isCyclesDueEnabled = watch("isCyclesDueEnabled");
  const isDaysDueEnabled = watch("isDaysDueEnabled");
  const lastCompletedDate = watch("lastCompletedDate");

  const onSubmit: SubmitHandler<MaintenanceTaskFormData> = async (data) => {
    setIsSubmitting(true);
    // console.log("Maintenance Task Form Data (Raw):", data);
    
    // Convert empty strings or NaN from optional number inputs to undefined or 0 as appropriate for backend
    const cleanedData = {
        ...data,
        lastCompletedHours: Number(data.lastCompletedHours) || 0,
        lastCompletedCycles: Number(data.lastCompletedCycles) || 0,
        hoursDue: data.isHoursDueEnabled ? (Number(data.hoursDue) || undefined) : undefined,
        hoursTolerance: data.isHoursDueEnabled ? (Number(data.hoursTolerance) || 0) : undefined,
        alertHoursPrior: data.isHoursDueEnabled ? (Number(data.alertHoursPrior) || 0) : undefined,
        cyclesDue: data.isCyclesDueEnabled ? (Number(data.cyclesDue) || undefined) : undefined,
        cyclesTolerance: data.isCyclesDueEnabled ? (Number(data.cyclesTolerance) || 0) : undefined,
        alertCyclesPrior: data.isCyclesDueEnabled ? (Number(data.alertCyclesPrior) || 0) : undefined,
        daysDueValue: data.isDaysDueEnabled ? data.daysDueValue : undefined, // keep as string for date or number for days
        daysTolerance: data.isDaysDueEnabled ? (Number(data.daysTolerance) || 0) : undefined,
        alertDaysPrior: data.isDaysDueEnabled ? (Number(data.alertDaysPrior) || 0) : undefined,
    };
    // console.log("Maintenance Task Form Data (Cleaned):", cleanedData);

    await new Promise(resolve => setTimeout(resolve, 1000)); 
    onSave(cleanedData);
    setIsSubmitting(false);
    form.reset({ // Reset with defaults
        itemTitle: '', itemType: 'Inspection', isActive: true, trackType: 'Interval',
        isTripsNotAffected: false, isHoursDueEnabled: false, hoursDue: 0, hoursTolerance: 0, alertHoursPrior: 0,
        isCyclesDueEnabled: false, cyclesDue: 0, cyclesTolerance: 0, alertCyclesPrior: 0,
        isDaysDueEnabled: false, daysDueValue: '', daysTolerance: 0, alertDaysPrior: 0,
        lastCompletedDate: '', lastCompletedHours: 0, lastCompletedCycles: 0, lastCompletedNotes: '',
        referenceNumber: '', partNumber: '', serialNumber: '', associatedComponent: '', details: '',
    }); 
  };

  const availableComponents = aircraft?.trackedComponentNames || ['Airframe', 'Engine 1', 'Engine 2', 'APU', 'Propeller 1', 'Landing Gear'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset(); // Reset form when dialog is closed
      }
      setIsOpen(open);
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[750px] lg:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Add New Maintenance Task for {aircraft?.tailNumber}</DialogTitle>
          <DialogDescription>
            Fill in the details for the new maintenance task. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(80vh-150px)] pr-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 ">
              
              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary">Latest Completed Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <FormField control={control} name="lastCompletedDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                       <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(parseDate(field.value, 'yyyy-MM-dd', new Date()), "MM/dd/yyyy") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? parseDate(field.value, 'yyyy-MM-dd', new Date()) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={control} name="lastCompletedHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 1250.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={control} name="lastCompletedCycles" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cycles</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 900" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={control} name="lastCompletedNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Last Completion)</FormLabel>
                    <FormControl><Textarea placeholder="Notes about last completion..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </section>

              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary">Task Description</h3>
                <FormField control={control} name="itemTitle" render={({ field }) => ( <FormItem><FormLabel>Item Title</FormLabel><FormControl><Input placeholder="e.g., Annual Inspection" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={control} name="referenceNumber" render={({ field }) => ( <FormItem><FormLabel>Reference #</FormLabel><FormControl><Input placeholder="Ref #" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="partNumber" render={({ field }) => ( <FormItem><FormLabel>Part #</FormLabel><FormControl><Input placeholder="Part #" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="serialNumber" render={({ field }) => ( <FormItem><FormLabel>Serial #</FormLabel><FormControl><Input placeholder="Serial #" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={control} name="itemType" render={({ field }) => (
                    <FormItem><FormLabel>Item Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}><FormControl><SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger></FormControl><SelectContent>{itemTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={control} name="associatedComponent" render={({ field }) => (
                    <FormItem><FormLabel>Associated Component</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}><FormControl><SelectTrigger><SelectValue placeholder="Select component" /></SelectTrigger></FormControl><SelectContent>{availableComponents.map(comp => (<SelectItem key={comp} value={comp}>{comp}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={control} name="details" render={({ field }) => ( <FormItem><FormLabel>Details / Work Instructions</FormLabel><FormControl><Textarea placeholder="Detailed description of the task..." {...field} rows={3}/></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Active Task</FormLabel></FormItem>
                )} />
              </section>

              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary">Tracking Settings</h3>
                <FormField control={control} name="trackType" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel>Track Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">{trackTypes.map(type => (<FormItem key={type} className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value={type} /></FormControl><FormLabel className="font-normal">{type}</FormLabel></FormItem>))}</RadioGroup></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="isTripsNotAffected" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Trips not affected by this item</FormLabel></FormItem>
                )} />
                
                <FormField control={control} name="isHoursDueEnabled" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Hours Due</FormLabel></FormItem> )} />
                {isHoursDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <FormField control={control} name="hoursDue" render={({ field }) => ( <FormItem><FormLabel>Due At (hrs)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="hoursTolerance" render={({ field }) => ( <FormItem><FormLabel>Tolerance (hrs)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="alertHoursPrior" render={({ field }) => ( <FormItem><FormLabel>Alert Prior (hrs)</FormLabel><FormControl><Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                )}

                 <FormField control={control} name="isCyclesDueEnabled" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Cycles Due</FormLabel></FormItem> )} />
                {isCyclesDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <FormField control={control} name="cyclesDue" render={({ field }) => ( <FormItem><FormLabel>Due At (cycles)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="cyclesTolerance" render={({ field }) => ( <FormItem><FormLabel>Tolerance (cycles)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="alertCyclesPrior" render={({ field }) => ( <FormItem><FormLabel>Alert Prior (cycles)</FormLabel><FormControl><Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                )}

                <FormField control={control} name="isDaysDueEnabled" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">{trackType === 'One Time' ? 'Due Date' : 'Days Due (Interval)'}</FormLabel></FormItem> )} />
                {isDaysDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <FormField control={control} name="daysDueValue" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{trackType === 'One Time' ? 'Specific Due Date' : 'Due In (days)'}</FormLabel>
                            {trackType === 'One Time' ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value && isValid(parseDate(field.value, 'yyyy-MM-dd', new Date())) ? format(parseDate(field.value, 'yyyy-MM-dd', new Date()), "MM/dd/yyyy") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value && isValid(parseDate(field.value, 'yyyy-MM-dd', new Date())) ? parseDate(field.value, 'yyyy-MM-dd', new Date()) : undefined}
                                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <FormControl><Input type="number" placeholder="e.g., 30" {...field} onChange={e => field.onChange(e.target.value)} /></FormControl>
                            )}
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={control} name="daysTolerance" render={({ field }) => ( <FormItem><FormLabel>Tolerance (days)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="alertDaysPrior" render={({ field }) => ( <FormItem><FormLabel>Alert Prior (days)</FormLabel><FormControl><Input type="number" placeholder="e.g., 7" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                )}
              </section>

              <DialogFooter className="pt-6 sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="destructive" disabled>Delete</Button> {/* Placeholder */}
                <Button type="button" variant="ghost" disabled>View History</Button> {/* Placeholder */}
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => form.reset()}>Close</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


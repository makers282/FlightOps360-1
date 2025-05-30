
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
const daysIntervalTypes = ["days", "months_specific_day", "months_eom", "years_specific_day"] as const;

// Default values for the form, extracted for reuse
const defaultMaintenanceTaskFormValues = {
  itemTitle: '',
  referenceNumber: '',
  partNumber: '',
  serialNumber: '',
  itemType: 'Inspection' as const,
  associatedComponent: '',
  details: '',
  isActive: true,
  trackType: 'Interval' as const,
  isTripsNotAffected: false,
  lastCompletedDate: '',
  lastCompletedHours: 0,
  lastCompletedCycles: 0,
  lastCompletedNotes: '',
  isHoursDueEnabled: false,
  hoursDue: 0,
  hoursTolerance: 0,
  alertHoursPrior: 0,
  isCyclesDueEnabled: false,
  cyclesDue: 0,
  cyclesTolerance: 0,
  alertCyclesPrior: 0,
  isDaysDueEnabled: false,
  daysIntervalType: 'days' as typeof daysIntervalTypes[number],
  daysDueValue: '', 
  daysTolerance: 0,
  alertDaysPrior: 0,
};


const maintenanceTaskSchema = z.object({
  lastCompletedDate: z.string().optional().refine(val => !val || isValid(parseDate(val, 'yyyy-MM-dd', new Date())), { message: "Invalid date format for last completion." }),
  lastCompletedHours: z.coerce.number({invalid_type_error: "Must be a number"}).nonnegative("Cannot be negative").optional().or(z.literal(0)).or(z.nan()),
  lastCompletedCycles: z.coerce.number({invalid_type_error: "Must be a number"}).nonnegative("Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  lastCompletedNotes: z.string().optional(),

  itemTitle: z.string().min(1, "Item title is required"),
  referenceNumber: z.string().optional(),
  partNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  itemType: z.enum(itemTypes),
  associatedComponent: z.string().optional(),
  details: z.string().optional(),
  isActive: z.boolean().default(true),

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
  daysIntervalType: z.enum(daysIntervalTypes).optional(),
  daysDueValue: z.string().optional(), 
  daysTolerance: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
  alertDaysPrior: z.coerce.number({invalid_type_error: "Must be a number"}).min(0, "Cannot be negative").int("Must be an integer").optional().or(z.literal(0)).or(z.nan()),
})
.superRefine((data, ctx) => {
    if (data.isHoursDueEnabled && (data.hoursDue === undefined || data.hoursDue === null || isNaN(data.hoursDue) || data.hoursDue <=0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hours Due value must be a positive number when enabled.", path: ["hoursDue"]});
    }
    if (data.isCyclesDueEnabled && (data.cyclesDue === undefined || data.cyclesDue === null || isNaN(data.cyclesDue) || data.cyclesDue <=0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cycles Due value must be a positive integer when enabled.", path: ["cyclesDue"]});
    }
    
    if (data.isDaysDueEnabled) {
        if (!data.daysDueValue || data.daysDueValue.trim() === "") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A due value is required when Days/Date Due is enabled.", path: ["daysDueValue"]});
        } else if (data.trackType === 'Interval') {
            if (!data.daysIntervalType) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Interval type is required.", path: ["daysIntervalType"]});
            }
            const numVal = Number(data.daysDueValue);
            if (isNaN(numVal) || numVal <= 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "For Interval tracking, the due value must be a positive number.", path: ["daysDueValue"]});
            }
        } else if (data.trackType === 'One Time') {
            if (!isValid(parseDate(data.daysDueValue, 'yyyy-MM-dd', new Date()))) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "For One Time tracking, Due Date must be a valid date (YYYY-MM-DD).", path: ["daysDueValue"]});
            }
        }
    }
});


export type MaintenanceTaskFormData = z.infer<typeof maintenanceTaskSchema>;

interface AddMaintenanceTaskModalProps {
  aircraft: FleetAircraft | null;
  onSave: (data: MaintenanceTaskFormData) => void;
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialData?: Partial<MaintenanceTaskFormData> | null; 
  isEditing?: boolean;
}

export function AddMaintenanceTaskModal({ aircraft, onSave, children, isOpen, setIsOpen, initialData, isEditing }: AddMaintenanceTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MaintenanceTaskFormData>({
    resolver: zodResolver(maintenanceTaskSchema),
    defaultValues: defaultMaintenanceTaskFormValues,
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? { ...defaultMaintenanceTaskFormValues, ...initialData } : defaultMaintenanceTaskFormValues);
    }
  }, [isOpen, initialData, form]);


  const { control, watch, setValue } = form;
  const trackType = watch("trackType");
  const isHoursDueEnabled = watch("isHoursDueEnabled");
  const isCyclesDueEnabled = watch("isCyclesDueEnabled");
  const isDaysDueEnabled = watch("isDaysDueEnabled");
  const daysIntervalType = watch("daysIntervalType");

  const onSubmit: SubmitHandler<MaintenanceTaskFormData> = async (data) => {
    setIsSubmitting(true);
    const cleanedData: MaintenanceTaskFormData = {
      ...data,
      lastCompletedHours: Number(data.lastCompletedHours) || 0,
      lastCompletedCycles: Number(data.lastCompletedCycles) || 0,
      
      hoursDue: data.isHoursDueEnabled ? (Number(data.hoursDue) || undefined) : undefined,
      hoursTolerance: data.isHoursDueEnabled ? (Number(data.hoursTolerance) || 0) : undefined,
      alertHoursPrior: data.isHoursDueEnabled ? (Number(data.alertHoursPrior) || 0) : undefined,
      
      cyclesDue: data.isCyclesDueEnabled ? (Number(data.cyclesDue) || undefined) : undefined,
      cyclesTolerance: data.isCyclesDueEnabled ? (Number(data.cyclesTolerance) || 0) : undefined,
      alertCyclesPrior: data.isCyclesDueEnabled ? (Number(data.alertCyclesPrior) || 0) : undefined,
      
      daysIntervalType: data.isDaysDueEnabled && data.trackType === 'Interval' ? data.daysIntervalType : undefined,
      daysDueValue: data.isDaysDueEnabled ? data.daysDueValue : undefined,
      daysTolerance: data.isDaysDueEnabled ? (Number(data.daysTolerance) || 0) : undefined,
      alertDaysPrior: data.isDaysDueEnabled ? (Number(data.alertDaysPrior) || 0) : undefined,
    };
    await new Promise(resolve => setTimeout(resolve, 500)); 
    onSave(cleanedData); 
    setIsSubmitting(false);
  };

  const availableComponents = aircraft?.trackedComponentNames || ['Airframe', 'Engine 1', 'Engine 2', 'APU', 'Propeller 1', 'Landing Gear'];
  const modalTitle = isEditing ? `Edit Maintenance Task for ${aircraft?.tailNumber}` : `Add New Maintenance Task for ${aircraft?.tailNumber}`;
  
  const getDaysDueValueLabel = () => {
    if (trackType === 'Interval') {
      switch (daysIntervalType) {
        case 'days': return 'Due In (days)';
        case 'months_specific_day': return 'Due In (months)';
        case 'months_eom': return 'Due In (months)';
        case 'years_specific_day': return 'Due In (years)';
        default: return 'Due In';
      }
    }
    return 'Specific Due Date'; 
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open); 
      if (!open) {
        // form.reset(defaultMaintenanceTaskFormValues);
      }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[750px] lg:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>
            Fill in the details for the maintenance task. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(80vh-200px)] pr-6"> 
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 ">

              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary">Latest Completed Details</h3>
                <p className="text-xs text-muted-foreground">
                  {isEditing ? "Re-enter if changing interval basis or last completion." : "If this is a new recurring item, enter its last known completion."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={control} name="lastCompletedDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
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
                <FormField control={control} name="itemTitle" render={({ field }) => (<FormItem><FormLabel>Item Title</FormLabel><FormControl><Input placeholder="e.g., Annual Inspection" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference #</FormLabel><FormControl><Input placeholder="Ref #" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="partNumber" render={({ field }) => (<FormItem><FormLabel>Part #</FormLabel><FormControl><Input placeholder="Part #" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial #</FormLabel><FormControl><Input placeholder="Serial #" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={control} name="itemType" render={({ field }) => (
                    <FormItem><FormLabel>Item Type</FormLabel><Select onValueChange={field.onChange} value={field.value} name={field.name}><FormControl><SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger></FormControl><SelectContent>{itemTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={control} name="associatedComponent" render={({ field }) => (
                    <FormItem><FormLabel>Associated Component</FormLabel><Select onValueChange={field.onChange} value={field.value} name={field.name}><FormControl><SelectTrigger><SelectValue placeholder="Select component" /></SelectTrigger></FormControl><SelectContent>{availableComponents.map(comp => (<SelectItem key={comp} value={comp}>{comp}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={control} name="details" render={({ field }) => (<FormItem><FormLabel>Details / Work Instructions</FormLabel><FormControl><Textarea placeholder="Detailed description of the task..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Active Task</FormLabel></FormItem>
                )} />
              </section>

              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary">Tracking Settings</h3>
                <FormField control={control} name="trackType" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel>Track Type</FormLabel><FormControl><RadioGroup onValueChange={(value) => { field.onChange(value); if(value === 'Interval' && !form.getValues('daysIntervalType')) { setValue('daysIntervalType', 'days'); } }} defaultValue={field.value} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">{trackTypes.map(type => (<FormItem key={type} className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value={type} /></FormControl><FormLabel className="font-normal">{type}</FormLabel></FormItem>))}</RadioGroup></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="isTripsNotAffected" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Trips not affected by this item</FormLabel></FormItem>
                )} />

                <FormField control={control} name="isHoursDueEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Hours Due</FormLabel></FormItem>)} />
                {isHoursDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <FormField control={control} name="hoursDue" render={({ field }) => (<FormItem><FormLabel>{trackType === 'Interval' ? 'Due In (hrs)' : 'Due At (hrs)'}</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="hoursTolerance" render={({ field }) => (<FormItem><FormLabel>Tolerance (hrs)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="alertHoursPrior" render={({ field }) => (<FormItem><FormLabel>Alert Prior (hrs)</FormLabel><FormControl><Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                )}

                <FormField control={control} name="isCyclesDueEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Cycles Due</FormLabel></FormItem>)} />
                {isCyclesDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    <FormField control={control} name="cyclesDue" render={({ field }) => (<FormItem><FormLabel>{trackType === 'Interval' ? 'Due In (cycles)' : 'Due At (cycles)'}</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="cyclesTolerance" render={({ field }) => (<FormItem><FormLabel>Tolerance (cycles)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="alertCyclesPrior" render={({ field }) => (<FormItem><FormLabel>Alert Prior (cycles)</FormLabel><FormControl><Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                )}

                <FormField control={control} name="isDaysDueEnabled" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md bg-muted/30"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">{trackType === 'One Time' ? 'Specific Due Date' : 'Days/Calendar Due (Interval)'}</FormLabel></FormItem>)} />
                {isDaysDueEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
                    {trackType === 'Interval' && (
                      <FormField control={control} name="daysIntervalType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interval Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'days'} name={field.name}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select interval type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="months_specific_day">Months (Specific Day)</SelectItem>
                              <SelectItem value="months_eom">Calendar Months (End of Month)</SelectItem>
                              <SelectItem value="years_specific_day">Years (Specific Day)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={control} name="daysDueValue" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getDaysDueValueLabel()}</FormLabel>
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
                    <FormField control={control} name="daysTolerance" render={({ field }) => (<FormItem><FormLabel>Tolerance (days)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="alertDaysPrior" render={({ field }) => (<FormItem><FormLabel>Alert Prior (days)</FormLabel><FormControl><Input type="number" placeholder="e.g., 7" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                )}
              </section>
              <DialogFooter className="pt-6 sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="destructive" disabled>Delete Task</Button>
                <Button type="button" variant="ghost" disabled>View History</Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Add Task'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

    

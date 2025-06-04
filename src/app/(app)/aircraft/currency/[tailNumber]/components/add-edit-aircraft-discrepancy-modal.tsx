
"use client";

import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as ModalDialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, AlertTriangle, Edit3, ShieldCheck } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { AircraftDiscrepancy, SaveAircraftDiscrepancyInput } from '@/ai/schemas/aircraft-discrepancy-schemas';
import { discrepancyStatuses } from '@/ai/schemas/aircraft-discrepancy-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const discrepancyFormSchema = z.object({
  status: z.enum(discrepancyStatuses).default("Open"),
  dateDiscovered: z.date({ required_error: "Date discovered is required." }),
  timeDiscovered: z.string().optional().refine(val => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), { message: "Invalid time format (HH:MM)." }),
  description: z.string().min(5, "A clear description of the discrepancy is required."),
  discoveredBy: z.string().optional(),
  discoveredByCertNumber: z.string().optional(),

  isDeferred: z.boolean().default(false),
  deferralReference: z.string().optional(),
  deferralDate: z.date().optional(),

  correctiveAction: z.string().optional(),
  dateCorrected: z.date().optional(),
  correctedBy: z.string().optional(),
  correctedByCertNumber: z.string().optional(),
}).refine(data => {
  if (data.isDeferred && !data.deferralReference) {
    return false;
  }
  return true;
}, { message: "Deferral reference is required if discrepancy is deferred.", path: ["deferralReference"] })
.refine(data => {
  if ((data.status === "Closed" || data.status === "Deferred") && data.isDeferred && !data.deferralDate) {
    return false;
  }
  return true;
}, {message: "Deferral date is required if deferred.", path: ["deferralDate"]})
.refine(data => {
    if (data.status === "Closed" && !data.correctiveAction) {
        return false;
    }
    return true;
}, { message: "Corrective action is required if status is Closed.", path: ["correctiveAction"]})
.refine(data => {
    if (data.status === "Closed" && !data.dateCorrected) {
        return false;
    }
    return true;
}, { message: "Date corrected is required if status is Closed.", path: ["dateCorrected"]})
.refine(data => {
    if (data.status === "Closed" && !data.correctedBy) {
        return false;
    }
    return true;
}, { message: "Corrected By is required if status is Closed.", path: ["correctedBy"]});


export type AircraftDiscrepancyFormData = z.infer<typeof discrepancyFormSchema>;

// Static default values (no new Date() here)
const staticDefaultFormValues: AircraftDiscrepancyFormData = {
  status: "Open",
  dateDiscovered: new Date(0), // Placeholder, will be overwritten by useEffect
  timeDiscovered: "00:00",     // Placeholder
  description: "",
  discoveredBy: "",
  discoveredByCertNumber: "",
  isDeferred: false,
  deferralReference: "",
  deferralDate: undefined,
  correctiveAction: "",
  dateCorrected: undefined,
  correctedBy: "",
  correctedByCertNumber: "",
};


interface AddEditAircraftDiscrepancyModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveAircraftDiscrepancyInput, originalDiscrepancyId?: string) => Promise<void>;
  aircraft: FleetAircraft | null;
  initialData?: AircraftDiscrepancy | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditAircraftDiscrepancyModal({
  isOpen,
  setIsOpen,
  onSave,
  aircraft,
  initialData,
  isEditing,
  isSaving,
}: AddEditAircraftDiscrepancyModalProps) {
  
  const [minDateAllowed, setMinDateAllowed] = useState<Date | null>(null);

  const form = useForm<AircraftDiscrepancyFormData>({
    resolver: zodResolver(discrepancyFormSchema),
    defaultValues: staticDefaultFormValues, // Use static defaults initially
  });
  
  const isDeferredWatch = form.watch("isDeferred");
  const statusWatch = form.watch("status");

  useEffect(() => {
    const todayForMinDate = new Date();
    const pastLimit = new Date(todayForMinDate);
    pastLimit.setFullYear(todayForMinDate.getFullYear() - 5);
    setMinDateAllowed(pastLimit);

    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          status: initialData.status || "Open",
          dateDiscovered: initialData.dateDiscovered && isValidDate(parseISO(initialData.dateDiscovered)) ? parseISO(initialData.dateDiscovered) : startOfDay(new Date()),
          timeDiscovered: initialData.timeDiscovered || format(new Date(), "HH:mm"),
          description: initialData.description,
          discoveredBy: initialData.discoveredBy || "",
          discoveredByCertNumber: initialData.discoveredByCertNumber || "",
          isDeferred: initialData.isDeferred || false,
          deferralReference: initialData.deferralReference || "",
          deferralDate: initialData.deferralDate && isValidDate(parseISO(initialData.deferralDate)) ? parseISO(initialData.deferralDate) : undefined,
          correctiveAction: initialData.correctiveAction || "",
          dateCorrected: initialData.dateCorrected && isValidDate(parseISO(initialData.dateCorrected)) ? parseISO(initialData.dateCorrected) : undefined,
          correctedBy: initialData.correctedBy || "",
          correctedByCertNumber: initialData.correctedByCertNumber || "",
        });
      } else { // New form
        form.reset({
            ...staticDefaultFormValues, // Reset with static, then set dynamic dates
            dateDiscovered: startOfDay(new Date()), // Set dynamic default client-side
            timeDiscovered: format(new Date(), "HH:mm"), // Set dynamic default client-side
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<AircraftDiscrepancyFormData> = async (formData) => {
    if (!aircraft?.id) {
        alert("Aircraft data is missing. Cannot save discrepancy.");
        return;
    }
    const dataToSave: SaveAircraftDiscrepancyInput = {
      aircraftId: aircraft.id,
      aircraftTailNumber: aircraft.tailNumber,
      status: formData.status,
      dateDiscovered: format(formData.dateDiscovered, "yyyy-MM-dd"),
      timeDiscovered: formData.timeDiscovered,
      description: formData.description,
      discoveredBy: formData.discoveredBy,
      discoveredByCertNumber: formData.discoveredByCertNumber,
      isDeferred: formData.isDeferred,
      deferralReference: formData.isDeferred ? formData.deferralReference : undefined,
      deferralDate: formData.isDeferred && formData.deferralDate ? format(formData.deferralDate, "yyyy-MM-dd") : undefined,
      correctiveAction: formData.correctiveAction,
      dateCorrected: formData.dateCorrected ? format(formData.dateCorrected, "yyyy-MM-dd") : undefined,
      correctedBy: formData.correctedBy,
      correctedByCertNumber: formData.correctedByCertNumber,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Discrepancy for ${aircraft?.tailNumber}` : `Add New Discrepancy for ${aircraft?.tailNumber}`;
  const modalDescription = isEditing
    ? "Update the details of this aircraft discrepancy."
    : "Log a new discrepancy for this aircraft. All fields related to correction can be filled later.";
  
  const currentFormValues = form.getValues(); 

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="aircraft-discrepancy-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <ScrollArea className="max-h-[70vh] pr-5">
              <div className="space-y-6 p-1">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {discrepancyStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {statusWatch === 'Closed' && (
                        <p className="text-sm text-primary mt-2 p-2 bg-primary/10 rounded-md">
                          Please scroll down to complete the "Corrective Action &amp; Sign-Off" section to close this discrepancy.
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <Card className="p-4 border-orange-500/50 bg-orange-50/30 dark:bg-orange-900/20">
                  <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-md text-orange-700 dark:text-orange-400">Discrepancy Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="dateDiscovered" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date Discovered</FormLabel>
                          <Popover><PopoverTrigger asChild>
                              <FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                  {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date): undefined)} disabled={(date) => minDateAllowed ? date < minDateAllowed : false} initialFocus /></PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="timeDiscovered" render={({ field }) => (
                        <FormItem><FormLabel>Time Discovered (HH:MM Optional)</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description of Discrepancy</FormLabel><FormControl><Textarea placeholder="e.g., Flat spot on #2 main tire, slight oil leak from right engine nacelle." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="discoveredBy" render={({ field }) => (<FormItem><FormLabel>Discovered By (Optional)</FormLabel><FormControl><Input placeholder="e.g., Capt. Smith, Maintenance" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="discoveredByCertNumber" render={({ field }) => (<FormItem><FormLabel>Discovered By Cert # (Optional)</FormLabel><FormControl><Input placeholder="e.g., A&P 1234567" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="isDeferred" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-normal">Discrepancy is Deferred (e.g., MEL/NEF)</FormLabel>
                      </FormItem>
                    )} />
                    {isDeferredWatch && (
                      <div className="pl-4 border-l-2 border-blue-500 ml-2 space-y-4 py-3">
                        <FormField control={form.control} name="deferralReference" render={({ field }) => (<FormItem><FormLabel>Deferral Reference (e.g., MEL 25-10-01a)</FormLabel><FormControl><Input placeholder="MEL/NEF/CDL Item #" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="deferralDate" render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Deferral Date</FormLabel>
                            <Popover><PopoverTrigger asChild>
                                <FormControl><Button variant={"outline"} className={cn("w-full md:w-1/2 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} disabled={(date) => minDateAllowed ? date < minDateAllowed : false} initialFocus /></PopoverContent>
                            </Popover><FormMessage />
                            </FormItem>
                        )} />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="p-4 border-green-500/50 bg-green-50/30 dark:bg-green-900/20">
                    <CardHeader className="p-0 pb-3">
                        <CardTitle className="text-md text-green-700 dark:text-green-400 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5"/> Corrective Action &amp; Sign-Off
                        </CardTitle>
                         <ModalDialogDescription className="text-xs text-green-600 dark:text-green-500">
                            Fill this section when the discrepancy is corrected or to close it out.
                        </ModalDialogDescription>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4">
                        <FormField control={form.control} name="correctiveAction" render={({ field }) => (<FormItem><FormLabel>Corrective Action Taken</FormLabel><FormControl><Textarea placeholder="e.g., Replaced #2 main tire, torqued B-nut on engine oil line..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="dateCorrected" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Date Corrected</FormLabel>
                                <Popover><PopoverTrigger asChild>
                                    <FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date): undefined)} disabled={(date) => minDateAllowed ? date < minDateAllowed : false} initialFocus /></PopoverContent>
                                </Popover><FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="correctedBy" render={({ field }) => (<FormItem><FormLabel>Corrected By</FormLabel><FormControl><Input placeholder="e.g., Maintenance Staff, Cert. Mechanic" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="correctedByCertNumber" render={({ field }) => (<FormItem><FormLabel>Corrected By Cert # (Optional)</FormLabel><FormControl><Input placeholder="e.g., A&P 7654321" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         {statusWatch === 'Closed' && (!currentFormValues.correctiveAction || !currentFormValues.dateCorrected || !currentFormValues.correctedBy) && (
                            <p className="text-xs text-destructive p-2 rounded-md border border-destructive/50 bg-destructive/10">
                                For 'Closed' status, "Corrective Action Taken", "Date Corrected", and "Corrected By" are required fields.
                            </p>
                        )}
                    </CardContent>
                </Card>

              </div>
            </ScrollArea>
          </form>
        </Form>
        
        <DialogFooter className="pt-4 border-t mt-2">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="aircraft-discrepancy-form" type="submit" disabled={isSaving || !aircraft}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Discrepancy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, AlertTriangle, Edit3 } from 'lucide-react';
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
});


export type AircraftDiscrepancyFormData = z.infer<typeof discrepancyFormSchema>;

const staticDefaultFormValues: AircraftDiscrepancyFormData = {
  status: "Open",
  dateDiscovered: new Date(0), 
  timeDiscovered: "00:00",
  description: "",
  discoveredBy: "",
  discoveredByCertNumber: "",
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
    defaultValues: staticDefaultFormValues,
  });
  
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
        });
      } else { 
        form.reset({
            ...staticDefaultFormValues, 
            dateDiscovered: startOfDay(new Date()), 
            timeDiscovered: format(new Date(), "HH:mm"),
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
      // Corrective action fields are no longer part of this form
      isDeferred: false, // Assuming deferral is handled elsewhere or not set initially here
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Discrepancy for ${aircraft?.tailNumber}` : `Add New Discrepancy for ${aircraft?.tailNumber}`;
  const modalDescription = isEditing
    ? "Update the initial details of this aircraft discrepancy. Clearing and sign-off are handled separately."
    : "Log a new discrepancy for this aircraft. Corrective action and sign-off will be done via the 'Clear Discrepancy' action.";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[calc(100vh-8rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden"> 
          <ScrollArea className="h-full">
            <Form {...form}>
              <form id="aircraft-discrepancy-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 px-4"> 
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={field.value === "Closed" && isEditing}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {discrepancyStatuses
                                .filter(s => s !== "Closed" || (isEditing && initialData?.status === "Closed") ) // Prevent changing to "Closed" here
                                .map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))
                            }
                          </SelectContent>
                        </Select>
                        { (isEditing && initialData?.status === "Closed") && <FormMessage>Status cannot be changed from 'Closed' in this form. Use re-open functionality if needed.</FormMessage>}
                        <FormMessage />
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
                    </CardContent>
                  </Card>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </div>
        
        <DialogFooter className="pt-4 border-t">
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

    
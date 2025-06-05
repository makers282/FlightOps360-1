
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, AlertTriangle, Edit3, CheckboxIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { AircraftDiscrepancy, SaveAircraftDiscrepancyInput } from '@/ai/schemas/aircraft-discrepancy-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const discrepancyFormSchema = z.object({
  dateDiscovered: z.date({ required_error: "Date discovered is required." }),
  description: z.string().min(5, "A clear description of the discrepancy is required."),
  discoveredBy: z.string().optional(),
  discoveredByCertNumber: z.string().optional(),
  isDeferred: z.boolean().default(false),
  deferralReference: z.string().optional(),
  deferralDate: z.date().optional(),
}).refine(data => !data.isDeferred || (data.isDeferred && data.deferralReference), {
    message: "Deferral reference is required if discrepancy is marked as deferred.",
    path: ["deferralReference"],
});


export type AircraftDiscrepancyFormData = z.infer<typeof discrepancyFormSchema>;

const staticDefaultFormValues: Omit<AircraftDiscrepancyFormData, 'dateDiscovered' | 'deferralDate'> & { dateDiscovered?: Date; deferralDate?: Date } = {
  description: "",
  discoveredBy: "",
  discoveredByCertNumber: "",
  isDeferred: false,
  deferralReference: "",
};


interface AddEditAircraftDiscrepancyModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Omit<SaveAircraftDiscrepancyInput, 'status'>, originalDiscrepancyId?: string) => Promise<void>; 
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
  const [isDateDiscoveredCalendarOpen, setIsDateDiscoveredCalendarOpen] = useState(false);
  const [isDeferralDateCalendarOpen, setIsDeferralDateCalendarOpen] = useState(false);

  const form = useForm<AircraftDiscrepancyFormData>({
    resolver: zodResolver(discrepancyFormSchema),
    defaultValues: {
        ...staticDefaultFormValues,
        dateDiscovered: startOfDay(new Date()),
        deferralDate: undefined,
    },
  });
  
  const isDeferredWatch = form.watch("isDeferred");

  useEffect(() => {
    const todayForMinDate = new Date();
    const pastLimit = new Date(todayForMinDate);
    pastLimit.setFullYear(todayForMinDate.getFullYear() - 5);
    setMinDateAllowed(pastLimit);

    if (isOpen) {
      setIsDateDiscoveredCalendarOpen(false); 
      setIsDeferralDateCalendarOpen(false);
      if (isEditing && initialData) {
        form.reset({
          dateDiscovered: initialData.dateDiscovered && isValidDate(parseISO(initialData.dateDiscovered)) ? parseISO(initialData.dateDiscovered) : startOfDay(new Date()),
          description: initialData.description,
          discoveredBy: initialData.discoveredBy || "",
          discoveredByCertNumber: initialData.discoveredByCertNumber || "",
          isDeferred: initialData.isDeferred || false,
          deferralReference: initialData.deferralReference || "",
          deferralDate: initialData.deferralDate && isValidDate(parseISO(initialData.deferralDate)) ? parseISO(initialData.deferralDate) : undefined,
        });
      } else { 
        form.reset({
            ...staticDefaultFormValues, 
            dateDiscovered: startOfDay(new Date()),
            deferralDate: undefined,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<AircraftDiscrepancyFormData> = async (formData) => {
    if (!aircraft?.id) {
        alert("Aircraft data is missing. Cannot save discrepancy.");
        return;
    }
    const dataToSave: Omit<SaveAircraftDiscrepancyInput, 'status'> = { 
      aircraftId: aircraft.id,
      aircraftTailNumber: aircraft.tailNumber,
      dateDiscovered: format(formData.dateDiscovered, "yyyy-MM-dd"),
      description: formData.description,
      discoveredBy: formData.discoveredBy,
      discoveredByCertNumber: formData.discoveredByCertNumber,
      isDeferred: formData.isDeferred,
      deferralReference: formData.isDeferred ? formData.deferralReference : undefined,
      deferralDate: formData.isDeferred && formData.deferralDate ? format(formData.deferralDate, "yyyy-MM-dd") : undefined,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Discrepancy for ${aircraft?.tailNumber}` : `Add New Discrepancy for ${aircraft?.tailNumber}`;
  const modalDescription = isEditing
    ? "Update the initial details of this aircraft discrepancy."
    : "Log a new discrepancy. Corrective action and sign-off will be done via the 'Clear Discrepancy' action.";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[calc(100vh-8rem)] overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <Form {...form}>
            <form id="aircraft-discrepancy-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> 
              <div className="space-y-6">
                <Card className="p-4 border-orange-500/50 bg-orange-50/30 dark:bg-orange-900/20">
                  <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-md text-orange-700 dark:text-orange-400">Discrepancy Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <FormField control={form.control} name="dateDiscovered" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date Discovered</FormLabel>
                          <FormControl>
                            <Popover 
                              modal={false} 
                              open={isDateDiscoveredCalendarOpen} 
                              onOpenChange={(openState) => {
                                console.log('Date Discovered Popover onOpenChange, new state:', openState);
                                setIsDateDiscoveredCalendarOpen(openState);
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[100]" align="start"> 
                                <Calendar 
                                  mode="single" 
                                  selected={field.value} 
                                  onSelect={(date) => { 
                                    field.onChange(date ? startOfDay(date): undefined); 
                                    setIsDateDiscoveredCalendarOpen(false); 
                                  }} 
                                  disabled={(date) => minDateAllowed ? date < minDateAllowed : false} 
                                  initialFocus 
                                />
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description of Discrepancy</FormLabel><FormControl><Textarea placeholder="e.g., Flat spot on #2 main tire, slight oil leak from right engine nacelle." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="discoveredBy" render={({ field }) => (<FormItem><FormLabel>Discovered By (Optional)</FormLabel><FormControl><Input placeholder="e.g., Capt. Smith, Maintenance" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="discoveredByCertNumber" render={({ field }) => (<FormItem><FormLabel>Discovered By Cert # (Optional)</FormLabel><FormControl><Input placeholder="e.g., A&P 1234567" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField
                      control={form.control}
                      name="isDeferred"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-0.5 leading-none">
                            <FormLabel className="font-normal">
                              Mark as Deferred (e.g., per MEL/NEF)
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    {isDeferredWatch && (
                      <div className="space-y-4 pl-4 border-l-2 border-yellow-500 ml-2">
                          <FormField
                              control={form.control}
                              name="deferralReference"
                              render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Deferral Reference</FormLabel>
                                  <FormControl>
                                  <Input placeholder="e.g., MEL 25-10-01a" {...field} value={field.value || ''} />
                                  </FormControl>
                                  <FormDescription className="text-xs">Enter the MEL, NEF, or other reference for deferral.</FormDescription>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                           <FormField
                              control={form.control}
                              name="deferralDate"
                              render={({ field }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>Deferral Date (Optional)</FormLabel>
                                  <FormControl>
                                    <Popover 
                                      modal={false} 
                                      open={isDeferralDateCalendarOpen} 
                                      onOpenChange={(openState) => {
                                        console.log('Deferral Date Popover onOpenChange, new state:', openState);
                                        setIsDeferralDateCalendarOpen(openState);
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant={"outline"}
                                          className={cn(
                                            "w-full md:w-1/2 justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 z-[100]" align="start"> 
                                        <Calendar 
                                          mode="single" 
                                          selected={field.value} 
                                          onSelect={(date) => { 
                                            field.onChange(date ? startOfDay(date): undefined); 
                                            setIsDeferralDateCalendarOpen(false); 
                                          }} 
                                          initialFocus 
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </form>
          </Form>
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
    
    
    

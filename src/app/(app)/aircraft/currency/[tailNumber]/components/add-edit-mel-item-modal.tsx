
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
import { CalendarIcon, Loader2, Save, BookOpen, Edit3 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { MelItem, SaveMelItemInput } from '@/ai/schemas/mel-item-schemas';
import { melCategories, melStatuses } from '@/ai/schemas/mel-item-schemas'; // melStatuses will now be ["Open", "Closed"]
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const melItemFormSchema = z.object({
  melNumber: z.string().min(1, "MEL item number is required (e.g., 25-10-01a)."),
  description: z.string().min(5, "A clear description of the MEL item is required."),
  category: z.enum(melCategories).optional(),
  status: z.enum(melStatuses).default("Open"),
  dateEntered: z.date({ required_error: "Date entered is required." }),
  dueDate: z.date().optional(),
  provisionsOrLimitations: z.string().optional(),
  correctiveAction: z.string().optional(),
  closedDate: z.date().optional(),
}).refine(data => {
  if (data.status === "Closed" && (!data.correctiveAction || !data.closedDate)) {
    return false;
  }
  return true;
}, { message: "Corrective action and closed date are required if status is Closed.", path: ["correctiveAction", "closedDate"] })
.refine(data => {
  if (data.category === "A" && !data.dueDate) {
      // This is a soft warning, might not always be strictly enforced by all MELs as a hard due date.
      // Could also make this a warning in the UI rather than a hard validation if preferred.
      // For now, keeping it as a gentle reminder via validation.
      // return false; // Uncomment if strict validation for Cat A due date is desired
  }
  return true;
}, { message: "Category 'A' items often have a specific time limit (due date).", path: ["dueDate"]});


export type MelItemFormData = z.infer<typeof melItemFormSchema>;

// Static default values (no new Date() here)
const staticDefaultMelFormValues: MelItemFormData = {
  melNumber: "",
  description: "",
  category: undefined,
  status: "Open",
  dateEntered: new Date(0), // Placeholder, will be overwritten by useEffect
  dueDate: undefined,
  provisionsOrLimitations: "",
  correctiveAction: "",
  closedDate: undefined,
};

interface AddEditMelItemModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveMelItemInput, originalMelItemId?: string) => Promise<void>;
  aircraft: FleetAircraft | null;
  initialData?: MelItem | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditMelItemModal({
  isOpen,
  setIsOpen,
  onSave,
  aircraft,
  initialData,
  isEditing,
  isSaving,
}: AddEditMelItemModalProps) {
  
  const [minDateAllowed, setMinDateAllowed] = useState<Date | null>(null);

  const form = useForm<MelItemFormData>({
    resolver: zodResolver(melItemFormSchema),
    defaultValues: staticDefaultMelFormValues,
  });
  
  const statusWatch = form.watch("status");

  useEffect(() => {
    const todayForMinDate = new Date();
    const pastLimit = new Date(todayForMinDate);
    pastLimit.setFullYear(todayForMinDate.getFullYear() - 5); // Allow up to 5 years in past for entry/due dates
    setMinDateAllowed(pastLimit);

    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          melNumber: initialData.melNumber,
          description: initialData.description,
          category: initialData.category,
          status: initialData.status || "Open",
          dateEntered: initialData.dateEntered && isValidDate(parseISO(initialData.dateEntered)) ? parseISO(initialData.dateEntered) : startOfDay(new Date()),
          dueDate: initialData.dueDate && isValidDate(parseISO(initialData.dueDate)) ? parseISO(initialData.dueDate) : undefined,
          provisionsOrLimitations: initialData.provisionsOrLimitations || "",
          correctiveAction: initialData.correctiveAction || "",
          closedDate: initialData.closedDate && isValidDate(parseISO(initialData.closedDate)) ? parseISO(initialData.closedDate) : undefined,
        });
      } else { // New form
        form.reset({
            ...staticDefaultMelFormValues,
            dateEntered: startOfDay(new Date()),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, initialData, form.reset]);

  const onSubmit: SubmitHandler<MelItemFormData> = async (formData) => {
    if (!aircraft?.id) {
        alert("Aircraft data is missing. Cannot save MEL item.");
        return;
    }
    const dataToSave: SaveMelItemInput = {
      aircraftId: aircraft.id,
      aircraftTailNumber: aircraft.tailNumber, // Denormalized for easier display
      melNumber: formData.melNumber,
      description: formData.description,
      category: formData.category,
      status: formData.status,
      dateEntered: format(formData.dateEntered, "yyyy-MM-dd"),
      dueDate: formData.dueDate ? format(formData.dueDate, "yyyy-MM-dd") : undefined,
      provisionsOrLimitations: formData.provisionsOrLimitations,
      correctiveAction: formData.correctiveAction,
      closedDate: formData.closedDate ? format(formData.closedDate, "yyyy-MM-dd") : undefined,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? \`Edit MEL Item for \${aircraft?.tailNumber}\` : \`Add New MEL Item for \${aircraft?.tailNumber}\`;
  const modalDescription = isEditing
    ? "Update the details of this MEL item."
    : "Log a new MEL item for this aircraft.";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <BookOpen className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="mel-item-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <ScrollArea className="max-h-[70vh] pr-5">
              <div className="space-y-6 p-1">
                <FormField
                  control={form.control}
                  name="melNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MEL Item Number</FormLabel>
                      <FormControl><Input placeholder="e.g., 25-10-01a or SB-XYZ-001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea placeholder="Describe the MEL item and its effect..." {...field} rows={3} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select category (A, B, C, D)" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {melCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {melStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="dateEntered" render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Date Entered / Became Active</FormLabel>
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
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Due Date (if applicable)</FormLabel>
                        <Popover><PopoverTrigger asChild>
                            <FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} disabled={(date) => {const dateEntered = form.getValues("dateEntered"); return dateEntered ? date < dateEntered : (minDateAllowed ? date < minDateAllowed : false);}} initialFocus /></PopoverContent>
                        </Popover><FormMessage />
                        </FormItem>
                    )} />
                </div>

                <FormField
                  control={form.control}
                  name="provisionsOrLimitations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provisions or Limitations (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="Detail any operational limitations or procedures required..." {...field} value={field.value || ""} rows={3} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {statusWatch === 'Closed' && (
                    <Card className="p-4 border-green-500/50 bg-green-50/30 dark:bg-green-900/20 mt-4">
                        <CardHeader className="p-0 pb-3">
                            <CardTitle className="text-md text-green-700 dark:text-green-400">Closure Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-4">
                             <FormField control={form.control} name="correctiveAction" render={({ field }) => (<FormItem><FormLabel>Corrective Action Taken</FormLabel><FormControl><Textarea placeholder="e.g., Replaced component, performed operational check..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="closedDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Date Closed</FormLabel>
                                <Popover><PopoverTrigger asChild>
                                    <FormControl><Button variant={"outline"} className={cn("w-full md:w-1/2 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date): undefined)} disabled={(date) => {const dateEntered = form.getValues("dateEntered"); return dateEntered ? date < dateEntered : (minDateAllowed ? date < minDateAllowed : false);}} initialFocus /></PopoverContent>
                                </Popover><FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                )}
              </div>
            </ScrollArea>
          </form>
        </Form>
        
        <DialogFooter className="pt-4 border-t mt-2">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="mel-item-form" type="submit" disabled={isSaving || !aircraft}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add MEL Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    


"use client";

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from "react-dom";
import { useFloating, shift, offset, autoUpdate, flip } from "@floating-ui/react-dom";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, BookOpen, Edit3 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { MelItem, SaveMelItemInput } from '@/ai/schemas/mel-item-schemas';
import { melCategories, melStatuses } from '@/ai/schemas/mel-item-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { Card, CardHeader, CardTitle as ModalCardTitle, CardContent as ModalCardContent } from '@/components/ui/card'; // Aliased to avoid conflict with DialogTitle

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
      // This is a soft warning
  }
  return true;
}, { message: "Category 'A' items often have a specific time limit (due date).", path: ["dueDate"]});


export type MelItemFormData = z.infer<typeof melItemFormSchema>;

const staticDefaultMelFormValues: MelItemFormData = {
  melNumber: "", description: "", category: undefined, status: "Open",
  dateEntered: new Date(0), dueDate: undefined, provisionsOrLimitations: "",
  correctiveAction: "", closedDate: undefined,
};

interface AddEditMelItemModalProps {
  isOpen: boolean; setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveMelItemInput, originalMelItemId?: string) => Promise<void>;
  aircraft: FleetAircraft | null; initialData?: MelItem | null;
  isEditing?: boolean; isSaving: boolean;
}

export function AddEditMelItemModal({
  isOpen, setIsOpen, onSave, aircraft, initialData, isEditing, isSaving,
}: AddEditMelItemModalProps) {
  
  const [minDateAllowed, setMinDateAllowed] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  // Date Entered Picker
  const [isDateEnteredCalendarOpen, setIsDateEnteredCalendarOpen] = useState(false);
  const dateEnteredButtonRef = useRef<HTMLButtonElement>(null);
  const { x: dateEnteredX, y: dateEnteredY, strategy: dateEnteredStrategy, refs: { setReference: setDateEnteredReference, setFloating: setDateEnteredFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (dateEnteredButtonRef.current) setDateEnteredReference(dateEnteredButtonRef.current); }, [setDateEnteredReference, dateEnteredButtonRef, isDateEnteredCalendarOpen]);

  // Due Date Picker
  const [isDueDateCalendarOpen, setIsDueDateCalendarOpen] = useState(false);
  const dueDateButtonRef = useRef<HTMLButtonElement>(null);
  const { x: dueDateX, y: dueDateY, strategy: dueDateStrategy, refs: { setReference: setDueDateReference, setFloating: setDueDateFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (dueDateButtonRef.current) setDueDateReference(dueDateButtonRef.current); }, [setDueDateReference, dueDateButtonRef, isDueDateCalendarOpen]);

  // Closed Date Picker
  const [isClosedDateCalendarOpen, setIsClosedDateCalendarOpen] = useState(false);
  const closedDateButtonRef = useRef<HTMLButtonElement>(null);
  const { x: closedDateX, y: closedDateY, strategy: closedDateStrategy, refs: { setReference: setClosedDateReference, setFloating: setClosedDateFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (closedDateButtonRef.current) setClosedDateReference(closedDateButtonRef.current); }, [setClosedDateReference, closedDateButtonRef, isClosedDateCalendarOpen]);


  const form = useForm<MelItemFormData>({
    resolver: zodResolver(melItemFormSchema),
    defaultValues: staticDefaultMelFormValues,
  });
  
  const statusWatch = form.watch("status");

  useEffect(() => {
    if (!isOpen) {
      setIsDateEnteredCalendarOpen(false);
      setIsDueDateCalendarOpen(false);
      setIsClosedDateCalendarOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const todayForMinDate = new Date();
    const pastLimit = new Date(todayForMinDate);
    pastLimit.setFullYear(todayForMinDate.getFullYear() - 5);
    setMinDateAllowed(pastLimit);

    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          melNumber: initialData.melNumber, description: initialData.description, category: initialData.category,
          status: initialData.status || "Open",
          dateEntered: initialData.dateEntered && isValidDate(parseISO(initialData.dateEntered)) ? parseISO(initialData.dateEntered) : startOfDay(new Date()),
          dueDate: initialData.dueDate && isValidDate(parseISO(initialData.dueDate)) ? parseISO(initialData.dueDate) : undefined,
          provisionsOrLimitations: initialData.provisionsOrLimitations || "",
          correctiveAction: initialData.correctiveAction || "",
          closedDate: initialData.closedDate && isValidDate(parseISO(initialData.closedDate)) ? parseISO(initialData.closedDate) : undefined,
        });
      } else {
        form.reset({ ...staticDefaultMelFormValues, dateEntered: startOfDay(new Date()) });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<MelItemFormData> = async (formData) => {
    if (!aircraft?.id) { alert("Aircraft data is missing. Cannot save MEL item."); return; }
    const dataToSave: SaveMelItemInput = {
      aircraftId: aircraft.id, aircraftTailNumber: aircraft.tailNumber,
      melNumber: formData.melNumber, description: formData.description, category: formData.category,
      status: formData.status,
      dateEntered: format(formData.dateEntered, "yyyy-MM-dd"),
      dueDate: formData.dueDate ? format(formData.dueDate, "yyyy-MM-dd") : undefined,
      provisionsOrLimitations: formData.provisionsOrLimitations,
      correctiveAction: formData.correctiveAction,
      closedDate: formData.closedDate ? format(formData.closedDate, "yyyy-MM-dd") : undefined,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit MEL Item for ${aircraft?.tailNumber || ''}` : `Add New MEL Item for ${aircraft?.tailNumber || ''}`;
  const modalDescription = isEditing ? "Update the details of this MEL item." : "Log a new MEL item for this aircraft.";
  
  const handleInteractOutside = (event: Event) => {
    if (event.target instanceof Element) {
      const targetElement = event.target as Element;
      if (targetElement.closest('[data-calendar-popover="true"]')) {
        event.preventDefault(); 
      }
    }
  };
  
  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent 
        className="sm:max-w-xl overflow-visible"
        onInteractOutside={handleInteractOutside}
      >
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
                <FormField control={form.control} name="melNumber" render={({ field }) => (<FormItem><FormLabel>MEL Item Number</FormLabel><FormControl><Input placeholder="e.g., 25-10-01a or SB-XYZ-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the MEL item and its effect..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Select category (A, B, C, D)" /></SelectTrigger></FormControl><SelectContent>{melCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{melStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="dateEntered" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date Entered / Became Active</FormLabel>
                          <Button ref={dateEnteredButtonRef} type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsDateEnteredCalendarOpen((prev) => !prev)}>
                            <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button><FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Due Date (if applicable)</FormLabel>
                          <Button ref={dueDateButtonRef} type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsDueDateCalendarOpen((prev) => !prev)}>
                            <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button><FormMessage />
                        </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="provisionsOrLimitations" render={({ field }) => (<FormItem><FormLabel>Provisions or Limitations (Optional)</FormLabel><FormControl><Textarea placeholder="Detail any operational limitations or procedures required..." {...field} value={field.value || ""} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                
                {statusWatch === 'Closed' && (
                    <ModalCard className="p-4 border-green-500/50 bg-green-50/30 dark:bg-green-900/20 mt-4">
                        <ModalCardHeader className="p-0 pb-3"><ModalCardTitle className="text-md text-green-700 dark:text-green-400">Closure Details</ModalCardTitle></ModalCardHeader>
                        <ModalCardContent className="p-0 space-y-4">
                             <FormField control={form.control} name="correctiveAction" render={({ field }) => (<FormItem><FormLabel>Corrective Action Taken</FormLabel><FormControl><Textarea placeholder="e.g., Replaced component, performed operational check..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="closedDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>Date Closed</FormLabel>
                                  <Button ref={closedDateButtonRef} type="button" variant={"outline"} className={cn("w-full md:w-1/2 justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsClosedDateCalendarOpen((prev) => !prev)}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  </Button><FormMessage />
                                </FormItem>
                            )} />
                        </ModalCardContent>
                    </ModalCard>
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

    {isMounted && isDateEnteredCalendarOpen && createPortal(<div ref={setDateEnteredFloating} style={{ position: dateEnteredStrategy, top: dateEnteredY ?? "", left: dateEnteredX ?? "", zIndex: 9999 }} data-calendar-popover="true" onMouseDown={(e) => e.preventDefault()}><div className="bg-background border shadow-lg rounded-md"><Calendar mode="single" selected={form.getValues("dateEntered")} onSelect={(date, _, __, e) => { form.setValue("dateEntered", date ? startOfDay(date) : startOfDay(new Date()), { shouldValidate: true }); setIsDateEnteredCalendarOpen(false); }} disabled={(date) => minDateAllowed ? date < minDateAllowed : false} /></div></div>, document.body)}
    {isMounted && isDueDateCalendarOpen && createPortal(<div ref={setDueDateFloating} style={{ position: dueDateStrategy, top: dueDateY ?? "", left: dueDateX ?? "", zIndex: 9999 }} data-calendar-popover="true" onMouseDown={(e) => e.preventDefault()}><div className="bg-background border shadow-lg rounded-md"><Calendar mode="single" selected={form.getValues("dueDate")} onSelect={(date, _, __, e) => { form.setValue("dueDate", date ? startOfDay(date) : undefined, { shouldValidate: true }); setIsDueDateCalendarOpen(false); }} disabled={(date) => { const dateEntered = form.getValues("dateEntered"); return dateEntered ? date < dateEntered : (minDateAllowed ? date < minDateAllowed : false); }} /></div></div>, document.body)}
    {isMounted && isClosedDateCalendarOpen && statusWatch === 'Closed' && createPortal(<div ref={setClosedDateFloating} style={{ position: closedDateStrategy, top: closedDateY ?? "", left: closedDateX ?? "", zIndex: 9999 }} data-calendar-popover="true" onMouseDown={(e) => e.preventDefault()}><div className="bg-background border shadow-lg rounded-md"><Calendar mode="single" selected={form.getValues("closedDate")} onSelect={(date, _, __, e) => { form.setValue("closedDate", date ? startOfDay(date) : undefined, { shouldValidate: true }); setIsClosedDateCalendarOpen(false); }} disabled={(date) => { const dateEntered = form.getValues("dateEntered"); return dateEntered ? date < dateEntered : (minDateAllowed ? date < minDateAllowed : false); }} /></div></div>, document.body)}
    </>
  );
}

    

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
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO, startOfDay } from "date-fns";
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';
import { customerTypes } from '@/ai/schemas/customer-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton'; 

const customerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  customerType: z.enum(customerTypes).default("Charter"),
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  email: z.string().email("Invalid email format.").optional().or(z.literal('')),
  email2: z.string().email("Invalid email format.").optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  streetAddress1: z.string().optional(),
  streetAddress2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  startDate: z.date().optional(),
  isActive: z.boolean().default(true),
  internalNotes: z.string().optional(),
  crewNotes: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

interface AddEditCustomerModalProps {
  isOpen: boolean; setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCustomerInput) => Promise<void>;
  initialData?: Customer | null; isEditing?: boolean; isSaving: boolean;
}

export function AddEditCustomerModal({
  isOpen, setIsOpen, onSave, initialData, isEditing, isSaving,
}: AddEditCustomerModalProps) {
  
  const [minStartDateAllowed, setMinStartDateAllowed] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  useEffect(() => { setIsMounted(true); setIsClient(true); }, []);

  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const startDateButtonRef = useRef<HTMLButtonElement>(null);
  const { x: startDateX, y: startDateY, strategy: startDateStrategy, refs: { setReference: setStartDateReference, setFloating: setStartDateFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (startDateButtonRef.current) setStartDateReference(startDateButtonRef.current); }, [setStartDateReference, startDateButtonRef, isStartDateCalendarOpen]);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '', customerType: "Charter", contactFirstName: '', contactLastName: '', email: '', email2: '', phone: '', phone2: '',
      streetAddress1: '', streetAddress2: '', city: '', state: '', postalCode: '', country: '',
      startDate: undefined, isActive: true, internalNotes: '', crewNotes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) setIsStartDateCalendarOpen(false);
  }, [isOpen]);

  useEffect(() => {
    const today = new Date(); today.setFullYear(today.getFullYear() - 50); setMinStartDateAllowed(today);
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          name: initialData.name, customerType: initialData.customerType || "Charter",
          contactFirstName: initialData.contactFirstName || '', contactLastName: initialData.contactLastName || '',
          email: initialData.email || '', email2: initialData.email2 || '', phone: initialData.phone || '', phone2: initialData.phone2 || '',
          streetAddress1: initialData.streetAddress1 || '', streetAddress2: initialData.streetAddress2 || '',
          city: initialData.city || '', state: initialData.state || '', postalCode: initialData.postalCode || '', country: initialData.country || '',
          startDate: initialData.startDate && isValidDate(parseISO(initialData.startDate)) ? parseISO(initialData.startDate) : undefined,
          isActive: initialData.isActive === undefined ? true : initialData.isActive,
          internalNotes: initialData.internalNotes || '', crewNotes: initialData.crewNotes || '',
        });
      } else {
        form.reset({
          name: '', customerType: "Charter", contactFirstName: '', contactLastName: '', email: '', email2: '', phone: '', phone2: '',
          streetAddress1: '', streetAddress2: '', city: '', state: '', postalCode: '', country: '',
          startDate: undefined, isActive: true, internalNotes: '', crewNotes: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CustomerFormData> = async (data) => {
    const dataToSave: SaveCustomerInput = {
      ...data, id: isEditing && initialData ? initialData.id : undefined,
      startDate: data.startDate ? format(data.startDate, 'yyyy-MM-dd') : undefined,
    };
    await onSave(dataToSave);
  };

  const modalTitle = isEditing ? `Edit: ${initialData?.name || ''}` : 'Add New Customer';
  const modalDescription = isEditing ? "Update the customer's details." : "Fill in the new customer's information.";
  
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
        className="sm:max-w-2xl overflow-visible"
        onInteractOutside={handleInteractOutside}
      >
        <DialogHeader><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription></DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input placeholder="Acme Corp or Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="customerType" render={({ field }) => (<FormItem><FormLabel>Customer Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{customerTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /></div>
              <h3 className="text-md font-semibold border-b pb-1 text-primary">Contact Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="contactFirstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="contactLastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Smith" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /></div>
              <h3 className="text-md font-semibold border-b pb-1 text-primary">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Primary Email</FormLabel><FormControl><Input type="email" placeholder="contact@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="email2" render={({ field }) => (<FormItem><FormLabel>Secondary Email</FormLabel><FormControl><Input type="email" placeholder="alt@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Primary Phone</FormLabel><FormControl><Input type="tel" placeholder="555-123-4567" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="phone2" render={({ field }) => (<FormItem><FormLabel>Secondary Phone</FormLabel><FormControl><Input type="tel" placeholder="555-987-6543" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /></div>
              <h3 className="text-md font-semibold border-b pb-1 text-primary">Address</h3>
              <FormField control={form.control} name="streetAddress1" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="123 Main St" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="streetAddress2" render={({ field }) => (<FormItem><FormLabel>Address Line 2</FormLabel><FormControl><Input placeholder="Suite 100" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Anytown" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State/Province</FormLabel><FormControl><Input placeholder="CA" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="postalCode" render={({ field }) => (<FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input placeholder="90210" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="USA" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} /></div>
              <h3 className="text-md font-semibold border-b pb-1 text-primary">Additional Information</h3>
               <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Start Date (Optional)</FormLabel>
                    {isClient ? (<Button ref={startDateButtonRef} type="button" variant={"outline"} className={cn("w-full md:w-[280px] justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsStartDateCalendarOpen((prev) => !prev)}><CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}</Button>) : <Skeleton className="h-10 w-full md:w-[280px]" />}
                  <FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-0.5"><FormLabel className="text-sm font-normal">Active Customer</FormLabel><FormDescription className="text-xs">Inactive customers may be hidden.</FormDescription></div></FormItem>)} />
              <FormField control={form.control} name="internalNotes" render={({ field }) => (<FormItem><FormLabel>Internal Notes</FormLabel><FormControl><Textarea placeholder="Internal team notes..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="crewNotes" render={({ field }) => (<FormItem><FormLabel>Crew Notes</FormLabel><FormControl><Textarea placeholder="Notes for the crew..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t"><DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose><Button form="customer-form" type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isEditing ? 'Save Changes' : 'Add Customer'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    {isMounted && isStartDateCalendarOpen && createPortal(<div ref={setStartDateFloating} style={{ position: startDateStrategy, top: startDateY ?? "", left: startDateX ?? "", zIndex: 9999 }} data-calendar-popover="true"><div className="bg-background border shadow-lg rounded-md"><Calendar mode="single" selected={form.getValues("startDate")} onSelect={(date) => { form.setValue("startDate", date ? startOfDay(date) : undefined, { shouldValidate: true }); setIsStartDateCalendarOpen(false); }} disabled={(date) => minStartDateAllowed ? date < minStartDateAllowed : false} /></div></div>, document.body)}
    </>
  );
}

    
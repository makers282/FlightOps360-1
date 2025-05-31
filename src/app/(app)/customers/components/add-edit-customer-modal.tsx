
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
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO } from "date-fns";
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';
import { customerTypes } from '@/ai/schemas/customer-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';

// Schema for form validation, aligned with SaveCustomerInput (excluding id, timestamps)
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
  startDate: z.string().optional().refine(val => !val || isValidDate(parseISO(val)), { message: "Invalid date format for start date." }),
  isActive: z.boolean().default(true),
  internalNotes: z.string().optional(),
  crewNotes: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

interface AddEditCustomerModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCustomerInput) => Promise<void>;
  initialData?: Customer | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditCustomerModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving,
}: AddEditCustomerModalProps) {
  
  const [minStartDate, setMinStartDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);


  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      customerType: "Charter",
      contactFirstName: '',
      contactLastName: '',
      email: '',
      email2: '',
      phone: '',
      phone2: '',
      streetAddress1: '',
      streetAddress2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      startDate: '',
      isActive: true,
      internalNotes: '',
      crewNotes: '',
    },
  });

  useEffect(() => {
    setIsClient(true);
    const today = new Date();
    today.setFullYear(today.getFullYear() - 50); // Allow dates up to 50 years in the past
    setMinStartDate(today);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          name: initialData.name,
          customerType: initialData.customerType || "Charter",
          contactFirstName: initialData.contactFirstName || '',
          contactLastName: initialData.contactLastName || '',
          email: initialData.email || '',
          email2: initialData.email2 || '',
          phone: initialData.phone || '',
          phone2: initialData.phone2 || '',
          streetAddress1: initialData.streetAddress1 || '',
          streetAddress2: initialData.streetAddress2 || '',
          city: initialData.city || '',
          state: initialData.state || '',
          postalCode: initialData.postalCode || '',
          country: initialData.country || '',
          startDate: initialData.startDate || '', // Expects YYYY-MM-DD string
          isActive: initialData.isActive === undefined ? true : initialData.isActive,
          internalNotes: initialData.internalNotes || '',
          crewNotes: initialData.crewNotes || '',
        });
      } else {
        form.reset({ // Reset to defaults for "add new"
          name: '', customerType: "Charter", contactFirstName: '', contactLastName: '',
          email: '', email2: '', phone: '', phone2: '',
          streetAddress1: '', streetAddress2: '', city: '', state: '',
          postalCode: '', country: '', startDate: '', isActive: true,
          internalNotes: '', crewNotes: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CustomerFormData> = async (data) => {
    const dataToSave: SaveCustomerInput = {
      ...data,
      id: isEditing && initialData ? initialData.id : undefined,
      startDate: data.startDate ? data.startDate : undefined, // Ensure it's string or undefined
    };
    await onSave(dataToSave);
  };

  const modalTitle = isEditing ? `Edit: ${initialData?.name || ''}` : 'Add New Customer';
  const modalDescription = isEditing
    ? "Update the customer's details."
    : "Fill in the new customer's information.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-2xl"> {/* Increased width */}
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-5"> {/* Adjusted max height */}
          <Form {...form}>
            <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Customer Name (Company or Individual)</FormLabel><FormControl><Input placeholder="e.g., Acme Corp or Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="customerType" render={({ field }) => (<FormItem><FormLabel>Customer Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{customerTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <h3 className="text-md font-semibold border-b pb-1 text-primary">Contact Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contactFirstName" render={({ field }) => (<FormItem><FormLabel>Contact First Name</FormLabel><FormControl><Input placeholder="e.g., John" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactLastName" render={({ field }) => (<FormItem><FormLabel>Contact Last Name</FormLabel><FormControl><Input placeholder="e.g., Smith" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <h3 className="text-md font-semibold border-b pb-1 text-primary">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Primary Email</FormLabel><FormControl><Input type="email" placeholder="e.g., contact@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email2" render={({ field }) => (<FormItem><FormLabel>Secondary Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g., alt@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Primary Phone</FormLabel><FormControl><Input type="tel" placeholder="e.g., 555-123-4567" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone2" render={({ field }) => (<FormItem><FormLabel>Secondary Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="e.g., 555-987-6543" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <h3 className="text-md font-semibold border-b pb-1 text-primary">Address</h3>
              <FormField control={form.control} name="streetAddress1" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="e.g., 123 Main St" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="streetAddress2" render={({ field }) => (<FormItem><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input placeholder="e.g., Suite 100, Apt B" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g., Anytown" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State/Province</FormLabel><FormControl><Input placeholder="e.g., CA" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="postalCode" render={({ field }) => (<FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input placeholder="e.g., 90210" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="e.g., USA" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              
              <h3 className="text-md font-semibold border-b pb-1 text-primary">Additional Information</h3>
               <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date (Optional)</FormLabel>
                    {isClient ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full md:w-[280px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && isValidDate(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value && isValidDate(parseISO(field.value)) ? parseISO(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                            disabled={(date) => minStartDate ? date < minStartDate : false} // Example: disable past dates
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : <Skeleton className="h-10 w-full md:w-[280px]" /> }
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-0.5"><FormLabel className="text-sm font-normal">Active Customer</FormLabel><FormDescription className="text-xs">Inactive customers may be hidden from some views.</FormDescription></div></FormItem>)} />

              <FormField control={form.control} name="internalNotes" render={({ field }) => (<FormItem><FormLabel>Internal Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Notes for internal team members..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="crewNotes" render={({ field }) => (<FormItem><FormLabel>Crew Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Specific notes for the crew regarding this customer..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              
            </form>
          </Form>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="customer-form" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

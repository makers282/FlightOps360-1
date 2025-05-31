
"use client";

import React, { useEffect } from 'react';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Added FormDescription
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';

// Schema for form validation (subset of Customer, no id/timestamps)
const customerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  company: z.string().optional(),
  email: z.string().email("Invalid email format."),
  phone: z.string().optional(),
  notes: z.string().optional(),
  lastActivity: z.string().optional(), // For now, keep as string input
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
  
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      notes: '',
      lastActivity: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          name: initialData.name,
          company: initialData.company || '',
          email: initialData.email,
          phone: initialData.phone || '',
          notes: initialData.notes || '',
          lastActivity: initialData.lastActivity || '',
        });
      } else {
        form.reset({
          name: '',
          company: '',
          email: '',
          phone: '',
          notes: '',
          lastActivity: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CustomerFormData> = async (data) => {
    const dataToSave: SaveCustomerInput = {
      ...data,
      id: isEditing && initialData ? initialData.id : undefined,
    };
    await onSave(dataToSave);
    // Closing the modal is handled by the parent component after successful save
  };

  const modalTitle = isEditing ? `Edit Customer: ${initialData?.name || ''}` : 'Add New Customer';
  const modalDescription = isEditing
    ? "Update the customer's details below."
    : "Fill in the information for the new customer.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isSaving) setIsOpen(open); // Prevent closing while saving
    }}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., Doe Industries" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl><Input type="tel" placeholder="e.g., 555-123-4567" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="lastActivity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Activity (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., 2024-08-15 or Note" {...field} /></FormControl>
                   <FormDescription className="text-xs">Could be a date or a brief note about last contact.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any relevant notes about the customer..." {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isEditing ? 'Save Changes' : 'Add Customer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

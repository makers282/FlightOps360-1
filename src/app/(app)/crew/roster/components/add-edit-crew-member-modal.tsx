
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, UserPlus, Edit3 } from 'lucide-react';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import { crewRoles } from '@/ai/schemas/crew-member-schemas';

const crewMemberFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  role: z.enum(crewRoles).default("Other"),
  employeeId: z.string().optional(),
  email: z.string().email("Invalid email format.").optional().or(z.literal('')),
  phone: z.string().optional(),
  licensesStr: z.string().optional().describe("Comma-separated license types/numbers for simplicity. E.g., ATP #12345, Medical Class 1"),
  typeRatingsStr: z.string().optional().describe("Comma-separated type ratings. E.g., C525, GLEX"),
  homeBase: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export type CrewMemberFormData = z.infer<typeof crewMemberFormSchema>;

interface AddEditCrewMemberModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCrewMemberInput) => Promise<void>;
  initialData?: CrewMember | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditCrewMemberModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving,
}: AddEditCrewMemberModalProps) {
  
  const form = useForm<CrewMemberFormData>({
    resolver: zodResolver(crewMemberFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      role: 'Other',
      employeeId: '',
      email: '',
      phone: '',
      licensesStr: '',
      typeRatingsStr: '',
      homeBase: '',
      isActive: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          firstName: initialData.firstName,
          lastName: initialData.lastName,
          role: initialData.role || 'Other',
          employeeId: initialData.employeeId || '',
          email: initialData.email || '',
          phone: initialData.phone || '',
          licensesStr: (initialData.licenses || []).map(l => `${l.type}${l.number ? ` (#${l.number})` : ''}${l.expiryDate ? ` Exp: ${l.expiryDate}` : ''}`).join(', '),
          typeRatingsStr: (initialData.typeRatings || []).join(', '),
          homeBase: initialData.homeBase || '',
          isActive: initialData.isActive === undefined ? true : initialData.isActive,
          notes: initialData.notes || '',
        });
      } else {
        form.reset({
          firstName: '', lastName: '', role: 'Other', employeeId: '', email: '', phone: '',
          licensesStr: '', typeRatingsStr: '', homeBase: '', isActive: true, notes: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CrewMemberFormData> = async (formData) => {
    // For simplicity, storing licenses and type ratings as simple string arrays for now.
    // A more robust solution would parse them into structured objects.
    const licensesArray = formData.licensesStr ? formData.licensesStr.split(',').map(s => s.trim()).filter(Boolean).map(l => ({ type: l })) : [];
    const typeRatingsArray = formData.typeRatingsStr ? formData.typeRatingsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    const dataToSave: SaveCrewMemberInput = {
      id: isEditing && initialData ? initialData.id : undefined,
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
      employeeId: formData.employeeId || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      licenses: licensesArray,
      typeRatings: typeRatingsArray,
      homeBase: formData.homeBase || undefined,
      isActive: formData.isActive,
      notes: formData.notes || undefined,
    };
    await onSave(dataToSave);
  };

  const modalTitle = isEditing ? `Edit Crew Member: ${initialData?.firstName} ${initialData?.lastName}` : 'Add New Crew Member';
  const modalDescription = isEditing
    ? "Update the crew member's details."
    : "Fill in the new crew member's information.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="crew-member-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="e.g., John" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="e.g., Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Primary Role</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent>{crewRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem><FormLabel>Employee ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., EMP123" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="e.g., 555-123-4567" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <FormField control={form.control} name="homeBase" render={({ field }) => (<FormItem><FormLabel>Home Base (Optional)</FormLabel><FormControl><Input placeholder="e.g., KTEB, KJFK" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="licensesStr" render={({ field }) => (<FormItem><FormLabel>Licenses (Optional)</FormLabel><FormControl><Textarea placeholder="Comma-separated, e.g., ATP #12345, Medical Class 1 Exp: 2025-12-31" {...field} value={field.value || ''} rows={2} /></FormControl><FormDescription className="text-xs">Enter license type, number, and expiry if applicable. Multiple licenses can be comma-separated.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="typeRatingsStr" render={({ field }) => (<FormItem><FormLabel>Type Ratings (Optional)</FormLabel><FormControl><Textarea placeholder="Comma-separated, e.g., C525, GLEX, B737" {...field} value={field.value || ''} rows={2} /></FormControl><FormDescription className="text-xs">Enter aircraft type ratings, comma-separated.</FormDescription><FormMessage /></FormItem>)} />
              
              <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-0.5"><FormLabel className="text-sm font-normal">Active Crew Member</FormLabel><FormDescription className="text-xs">Inactive members may be hidden from some views.</FormDescription></div></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Internal Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any internal notes..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
            </form>
          </Form>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="crew-member-form" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Crew Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


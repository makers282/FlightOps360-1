
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
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Lock, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay, setHours, setMinutes } from "date-fns";
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';
import { crewBlockOutReasons, type SaveCrewBlockOutInput } from '@/ai/schemas/crew-block-out-schemas';
import { Textarea } from '@/components/ui/textarea';

const blockOutFormSchema = z.object({
  reason: z.enum(crewBlockOutReasons, { required_error: "A reason is required." }),
  notes: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  endDate: z.date({ required_error: "End date is required." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
}).refine(data => {
    const startDateTime = setMinutes(setHours(data.startDate, parseInt(data.startTime.split(':')[0])), parseInt(data.startTime.split(':')[1]));
    const endDateTime = setMinutes(setHours(data.endDate, parseInt(data.endTime.split(':')[0])), parseInt(data.endTime.split(':')[1]));
    return endDateTime > startDateTime;
}, {
  message: "End date and time must be after start date and time.",
  path: ["endDate"], 
});

export type CrewBlockOutFormData = z.infer<typeof blockOutFormSchema>;

interface CreateCrewBlockOutModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCrewBlockOutInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  crewMember: CrewMember | null;
  initialData?: {
    id?: string;
    reason: (typeof crewBlockOutReasons)[number];
    notes?: string;
    startDate: Date;
    endDate: Date;
  } | null;
  isEditing: boolean;
}

export function CreateCrewBlockOutModal({
  isOpen,
  setIsOpen,
  onSave,
  onDelete,
  crewMember,
  initialData,
  isEditing,
}: CreateCrewBlockOutModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CrewBlockOutFormData>({
    resolver: zodResolver(blockOutFormSchema),
    defaultValues: {
      reason: undefined,
      notes: '',
      startDate: startOfDay(new Date()),
      startTime: '09:00',
      endDate: startOfDay(new Date()),
      endTime: '17:00',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          reason: initialData.reason,
          notes: initialData.notes || '',
          startDate: startOfDay(initialData.startDate),
          startTime: format(initialData.startDate, 'HH:mm'),
          endDate: startOfDay(initialData.endDate),
          endTime: format(initialData.endDate, 'HH:mm'),
        });
      } else if (initialData?.startDate) { // For creating new from a specific day click
         form.reset({
          reason: undefined,
          notes: '',
          startDate: startOfDay(initialData.startDate),
          startTime: '09:00',
          endDate: startOfDay(initialData.startDate),
          endTime: '17:00',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CrewBlockOutFormData> = async (formData) => {
    setIsSaving(true);
    const startDateTime = setMinutes(setHours(formData.startDate, parseInt(formData.startTime.split(':')[0])), parseInt(formData.startTime.split(':')[1]));
    const endDateTime = setMinutes(setHours(formData.endDate, parseInt(formData.endTime.split(':')[0])), parseInt(formData.endTime.split(':')[1]));

    const dataToSave = {
        crewMemberId: crewMember!.id,
        crewMemberName: `${crewMember!.firstName} ${crewMember!.lastName}`,
        reason: formData.reason,
        notes: formData.notes,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
    };
    await onSave(dataToSave, isEditing ? initialData?.id : undefined);
    setIsSaving(false);
  };
  
  const handleDelete = async () => {
    if (isEditing && initialData?.id && onDelete) {
        setIsSaving(true);
        await onDelete(initialData.id);
        setIsSaving(false);
    }
  };


  if (!crewMember) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!isSaving) setIsOpen(open);}}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            {isEditing ? 'Edit Crew Block Out' : 'Schedule Crew Block Out'}
          </DialogTitle>
          <DialogDescription>
             {isEditing ? `Editing block out for ${crewMember.firstName} ${crewMember.lastName}.` : `Block out ${crewMember.firstName} ${crewMember.lastName} for a specific period.`}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="createCrewBlockOutModalForm" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
             <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger></FormControl><SelectContent>{crewBlockOutReasons.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent></Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-[200]" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="startTime" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="endDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-[200]" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => form.getValues("startDate") ? d < form.getValues("startDate") : false} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="endTime" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Add any relevant notes..." {...field} /></FormControl><FormMessage /></FormItem> )} />
          </form>
        </Form>
        
        <DialogFooter className="pt-4 justify-between">
          <div>
            {isEditing && onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                </Button>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" form="createCrewBlockOutModalForm" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Save Block Out'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

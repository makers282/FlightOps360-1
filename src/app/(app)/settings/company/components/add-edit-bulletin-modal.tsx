
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, Megaphone, Edit3 } from 'lucide-react';
import type { Bulletin, SaveBulletinInput } from '@/ai/schemas/bulletin-schemas';
import { bulletinTypes } from '@/ai/schemas/bulletin-schemas';

// Form schema for the modal
const bulletinFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  message: z.string().min(10, "Message must be at least 10 characters long."),
  type: z.enum(bulletinTypes).default("General"),
  isActive: z.boolean().default(true),
});

export type BulletinFormData = z.infer<typeof bulletinFormSchema>;

interface AddEditBulletinModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveBulletinInput, originalBulletinId?: string) => Promise<void>;
  initialData?: Bulletin | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditBulletinModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving,
}: AddEditBulletinModalProps) {
  
  const form = useForm<BulletinFormData>({
    resolver: zodResolver(bulletinFormSchema),
    defaultValues: {
      title: '',
      message: '',
      type: "General",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          title: initialData.title,
          message: initialData.message,
          type: initialData.type || "General",
          isActive: initialData.isActive,
        });
      } else {
        form.reset({
          title: '',
          message: '',
          type: "General",
          isActive: true,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<BulletinFormData> = async (formData) => {
    const dataToSave: SaveBulletinInput = {
      ...formData,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Bulletin: ${initialData?.title || ''}` : 'Create New Bulletin';
  const modalDescription = isEditing
    ? "Update the bulletin's details."
    : "Enter the details for the new company bulletin.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <Megaphone className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="bulletin-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4 p-1">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="e.g., System Maintenance Alert" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl><Textarea placeholder="Enter the full bulletin message here..." {...field} rows={5} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bulletin Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {bulletinTypes.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-normal">Active Bulletin</FormLabel>
                      <DialogDescription className="text-xs">Inactive bulletins will not be shown on the dashboard.</DialogDescription>
                    </div>
                  </FormItem>
                )} />
              </div>
            </ScrollArea>
          </form>
        </Form>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="bulletin-form" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Publish Bulletin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

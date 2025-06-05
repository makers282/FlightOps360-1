
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, FileText as FileTextIcon, Edit3 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { CrewDocument, SaveCrewDocumentInput } from '@/ai/schemas/crew-document-schemas';
import { documentTypes } from '@/ai/schemas/crew-document-schemas';
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';

// Schema for form validation
const crewDocumentFormSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member selection is required."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(documentTypes, { required_error: "Document type is required."}),
  issueDate: z.string().optional().refine(val => !val || isValidDate(parseISO(val)), { message: "Invalid date format for issue date." }),
  expiryDate: z.string().optional().refine(val => !val || isValidDate(parseISO(val)), { message: "Invalid date format for expiry date." }),
  notes: z.string().optional(),
}).refine(data => {
  if (data.issueDate && data.expiryDate) {
    return parseISO(data.expiryDate) >= parseISO(data.issueDate);
  }
  return true;
}, {
  message: "Expiry date cannot be before issue date.",
  path: ["expiryDate"],
});

export type CrewDocumentFormData = z.infer<typeof crewDocumentFormSchema>;

interface AddEditCrewDocumentModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCrewDocumentInput, originalDocumentId?: string) => Promise<void>;
  initialData?: CrewDocument | null;
  isEditing?: boolean;
  isSaving: boolean;
  crewMembers: Pick<CrewMember, 'id' | 'firstName' | 'lastName' | 'role'>[];
  isLoadingCrewMembers: boolean;
}

export function AddEditCrewDocumentModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving,
  crewMembers,
  isLoadingCrewMembers,
}: AddEditCrewDocumentModalProps) {
  
  const form = useForm<CrewDocumentFormData>({
    resolver: zodResolver(crewDocumentFormSchema),
    defaultValues: {
      crewMemberId: '',
      documentName: '',
      documentType: "Other",
      issueDate: '',
      expiryDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          crewMemberId: initialData.crewMemberId,
          documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          issueDate: initialData.issueDate || '',
          expiryDate: initialData.expiryDate || '',
          notes: initialData.notes || '',
        });
      } else {
        form.reset({
          crewMemberId: '', documentName: '', documentType: "Other",
          issueDate: '', expiryDate: '', notes: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CrewDocumentFormData> = async (formData) => {
    const selectedCrewMember = crewMembers.find(cm => cm.id === formData.crewMemberId);
    const dataToSave: SaveCrewDocumentInput = {
      ...formData,
      crewMemberName: selectedCrewMember ? `${selectedCrewMember.firstName} ${selectedCrewMember.lastName}` : 'Unknown Crew Member',
      issueDate: formData.issueDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      notes: formData.notes || undefined,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Document: ${initialData?.documentName || ''}` : 'Add New Crew Document';
  const modalDescription = isEditing
    ? "Update the crew document's details."
    : "Fill in the new crew document's information.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <FileTextIcon className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="crew-document-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="crewMemberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crew Member</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCrewMembers}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingCrewMembers ? "Loading crew..." : "Select crew member"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!isLoadingCrewMembers && crewMembers.map(cm => (
                          <SelectItem key={cm.id} value={cm.id}>
                            {cm.firstName} {cm.lastName} ({cm.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="e.g., ATP License, Class 1 Medical" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {documentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Issue Date (Optional)</FormLabel>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && isValidDate(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value && isValidDate(parseISO(field.value)) ? parseISO(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(startOfDay(date), 'yyyy-MM-dd') : '')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date (Optional)</FormLabel>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && isValidDate(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value && isValidDate(parseISO(field.value)) ? parseISO(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(startOfDay(date), 'yyyy-MM-dd') : '')}
                            disabled={(date) => {
                                const issueDate = form.getValues("issueDate");
                                return issueDate && isValidDate(parseISO(issueDate)) ? date < parseISO(issueDate) : false;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any specific notes about this document..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <FormDescription className="text-xs">Actual file upload functionality will be added later.</FormDescription>
            </form>
          </Form>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="crew-document-form" type="submit" disabled={isSaving || isLoadingCrewMembers}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


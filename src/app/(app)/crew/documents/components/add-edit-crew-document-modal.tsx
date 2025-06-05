
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, FileText as FileTextIcon, Edit3 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { CrewDocument, SaveCrewDocumentInput } from '@/ai/schemas/crew-document-schemas';
import { documentTypes } from '@/ai/schemas/crew-document-schemas';
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';

const crewDocumentFormSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member selection is required."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(documentTypes, { required_error: "Document type is required."}),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.issueDate && data.expiryDate) {
    return data.expiryDate >= data.issueDate;
  }
  return true;
}, { message: "Expiry date cannot be before issue date.", path: ["expiryDate"] });

export type CrewDocumentFormData = z.infer<typeof crewDocumentFormSchema>;

interface AddEditCrewDocumentModalProps {
  isOpen: boolean; setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCrewDocumentInput, originalDocumentId?: string) => Promise<void>;
  initialData?: CrewDocument | null; isEditing?: boolean; isSaving: boolean;
  crewMembers: Pick<CrewMember, 'id' | 'firstName' | 'lastName' | 'role'>[];
  isLoadingCrewMembers: boolean;
}

export function AddEditCrewDocumentModal({
  isOpen, setIsOpen, onSave, initialData, isEditing, isSaving, crewMembers, isLoadingCrewMembers,
}: AddEditCrewDocumentModalProps) {
  
  const [isMounted, setIsMounted] = React.useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [isIssueDateCalendarOpen, setIsIssueDateCalendarOpen] = useState(false);
  const issueDateButtonRef = useRef<HTMLButtonElement>(null);
  const { x: issueDateX, y: issueDateY, strategy: issueDateStrategy, refs: { setReference: setIssueDateReference, setFloating: setIssueDateFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (issueDateButtonRef.current) setIssueDateReference(issueDateButtonRef.current); }, [setIssueDateReference, issueDateButtonRef, isIssueDateCalendarOpen]);

  const [isExpiryDateCalendarOpen, setIsExpiryDateCalendarOpen] = useState(false);
  const expiryDateButtonRef = useRef<HTMLButtonElement>(null);
  const { x: expiryDateX, y: expiryDateY, strategy: expiryDateStrategy, refs: { setReference: setExpiryDateReference, setFloating: setExpiryDateFloating } } = useFloating({
    placement: "bottom-start", middleware: [offset(4), shift(), flip()], whileElementsMounted: autoUpdate,
  });
  useEffect(() => { if (expiryDateButtonRef.current) setExpiryDateReference(expiryDateButtonRef.current); }, [setExpiryDateReference, expiryDateButtonRef, isExpiryDateCalendarOpen]);

  const form = useForm<CrewDocumentFormData>({
    resolver: zodResolver(crewDocumentFormSchema),
    defaultValues: {
      crewMemberId: '', documentName: '', documentType: "Other",
      issueDate: undefined, expiryDate: undefined, notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setIsIssueDateCalendarOpen(false);
      setIsExpiryDateCalendarOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          crewMemberId: initialData.crewMemberId, documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          issueDate: initialData.issueDate && isValidDate(parseISO(initialData.issueDate)) ? parseISO(initialData.issueDate) : undefined,
          expiryDate: initialData.expiryDate && isValidDate(parseISO(initialData.expiryDate)) ? parseISO(initialData.expiryDate) : undefined,
          notes: initialData.notes || '',
        });
      } else {
        form.reset({
          crewMemberId: '', documentName: '', documentType: "Other",
          issueDate: undefined, expiryDate: undefined, notes: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<CrewDocumentFormData> = async (formData) => {
    const selectedCrewMember = crewMembers.find(cm => cm.id === formData.crewMemberId);
    const dataToSave: SaveCrewDocumentInput = {
      crewMemberId: formData.crewMemberId, documentName: formData.documentName, documentType: formData.documentType,
      crewMemberName: selectedCrewMember ? `${selectedCrewMember.firstName} ${selectedCrewMember.lastName}` : 'Unknown Crew Member',
      issueDate: formData.issueDate ? format(formData.issueDate, 'yyyy-MM-dd') : undefined,
      expiryDate: formData.expiryDate ? format(formData.expiryDate, 'yyyy-MM-dd') : undefined,
      notes: formData.notes || undefined,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
  };

  const modalTitle = isEditing ? `Edit Document: ${initialData?.documentName || ''}` : 'Add New Crew Document';
  const modalDescription = isEditing ? "Update the crew document's details." : "Fill in the new crew document's information.";

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg overflow-visible">
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
              <FormField control={form.control} name="crewMemberId" render={({ field }) => (<FormItem><FormLabel>Crew Member</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCrewMembers}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingCrewMembers ? "Loading crew..." : "Select crew member"} /></SelectTrigger></FormControl><SelectContent>{!isLoadingCrewMembers && crewMembers.map(cm => (<SelectItem key={cm.id} value={cm.id}>{cm.firstName} {cm.lastName} ({cm.role})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="e.g., ATP License, Class 1 Medical" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentType" render={({ field }) => (<FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger></FormControl><SelectContent>{documentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Issue Date (Optional)</FormLabel>
                      <Button ref={issueDateButtonRef} type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsIssueDateCalendarOpen((prev) => !prev)}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button><FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date (Optional)</FormLabel>
                      <Button ref={expiryDateButtonRef} type="button" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} onClick={() => setIsExpiryDateCalendarOpen((prev) => !prev)}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button><FormMessage />
                    </FormItem>
                )} />
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

    {isMounted && isIssueDateCalendarOpen && createPortal(<div ref={setIssueDateFloating} style={{ position: issueDateStrategy, top: issueDateY ?? "", left: issueDateX ?? "", zIndex: 9999 }}><div className="bg-background border shadow-lg rounded-md" style={{pointerEvents: 'auto'}}><Calendar mode="single" selected={form.getValues("issueDate")} onSelect={(date, _, __, e) => { e?.stopPropagation(); e?.preventDefault(); form.setValue("issueDate", date ? startOfDay(date) : undefined, { shouldValidate: true }); setIsIssueDateCalendarOpen(false); }} /></div></div>, document.body)}
    {isMounted && isExpiryDateCalendarOpen && createPortal(<div ref={setExpiryDateFloating} style={{ position: expiryDateStrategy, top: expiryDateY ?? "", left: expiryDateX ?? "", zIndex: 9999 }}><div className="bg-background border shadow-lg rounded-md" style={{pointerEvents: 'auto'}}><Calendar mode="single" selected={form.getValues("expiryDate")} onSelect={(date, _, __, e) => { e?.stopPropagation(); e?.preventDefault(); form.setValue("expiryDate", date ? startOfDay(date) : undefined, { shouldValidate: true }); setIsExpiryDateCalendarOpen(false); }} disabled={(date) => { const issueDateVal = form.getValues("issueDate"); return issueDateVal ? date < issueDateVal : false; }} /></div></div>, document.body)}
    </>
  );
}

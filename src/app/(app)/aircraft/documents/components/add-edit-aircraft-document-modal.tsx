
"use client";

import React, { useEffect, useState, useRef } from 'react';
// Removed useFloating, createPortal, and related imports
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"; // Added PopoverContent
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, FileText as FileTextIcon, Edit3, UploadCloud, Paperclip, XCircle as RemoveFileIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO, startOfDay } from "date-fns";
import type { AircraftDocument, SaveAircraftDocumentInput } from '@/ai/schemas/aircraft-document-schemas';
import { aircraftDocumentTypes } from '@/ai/schemas/aircraft-document-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadAircraftDocument } from '@/ai/flows/upload-aircraft-document-flow';
import { useToast } from '@/hooks/use-toast';

const aircraftDocumentFormSchema = z.object({
  aircraftId: z.string().min(1, "Aircraft selection is required."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(aircraftDocumentTypes, { required_error: "Document type is required."}),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
  notes: z.string().optional(),
  fileUrl: z.string().url().optional(),
}).refine(data => {
  if (data.issueDate && data.expiryDate) {
    return data.expiryDate >= data.issueDate;
  }
  return true;
}, { message: "Expiry date cannot be before issue date.", path: ["expiryDate"] });

export type AircraftDocumentFormData = z.infer<typeof aircraftDocumentFormSchema>;

interface AddEditAircraftDocumentModalProps {
  isOpen: boolean; setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveAircraftDocumentInput, originalDocumentId?: string) => Promise<void>;
  initialData?: AircraftDocument | null; isEditing?: boolean; isSaving: boolean;
  aircraftList: Pick<FleetAircraft, 'id' | 'tailNumber' | 'model'>[];
  isLoadingAircraft: boolean; selectedAircraftIdForNew?: string;
}

export function AddEditAircraftDocumentModal({
  isOpen, setIsOpen, onSave, initialData, isEditing, isSaving: isSavingProp,
  aircraftList, isLoadingAircraft, selectedAircraftIdForNew,
}: AddEditAircraftDocumentModalProps) {

  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removed isMounted and calendar open states, and useFloating hooks

  const form = useForm<AircraftDocumentFormData>({
    resolver: zodResolver(aircraftDocumentFormSchema),
    defaultValues: {
      aircraftId: '', documentName: '', documentType: "Other",
      issueDate: undefined, expiryDate: undefined, notes: '', fileUrl: undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
      if (isEditing && initialData) {
        form.reset({
          aircraftId: initialData.aircraftId, documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          issueDate: initialData.issueDate && isValidDate(parseISO(initialData.issueDate)) ? parseISO(initialData.issueDate) : undefined,
          expiryDate: initialData.expiryDate && isValidDate(parseISO(initialData.expiryDate)) ? parseISO(initialData.expiryDate) : undefined,
          notes: initialData.notes || '', fileUrl: initialData.fileUrl || undefined,
        });
      } else {
        form.reset({
          aircraftId: selectedAircraftIdForNew || '', documentName: '', documentType: "Other",
          issueDate: undefined, expiryDate: undefined, notes: '', fileUrl: undefined,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form, selectedAircraftIdForNew]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files && event.target.files[0]) { setSelectedFile(event.target.files[0]); form.setValue('fileUrl', undefined); } };
  const handleRemoveFile = () => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const onSubmit: SubmitHandler<AircraftDocumentFormData> = async (formData) => {
    setIsSavingFile(true); let finalFileUrl = formData.fileUrl;
    if (selectedFile) {
      if (!formData.aircraftId) { toast({ title: "Error", description: "Aircraft ID missing for upload.", variant: "destructive" }); setIsSavingFile(false); return; }
      try {
        const reader = new FileReader(); reader.readAsDataURL(selectedFile);
        reader.onloadend = async () => {
          const fileDataUri = reader.result as string;
          const documentIdForUpload = (isEditing && initialData?.id) || `doc_${Date.now()}`;
          toast({ title: "Uploading File...", description: "Please wait.", variant: "default" });
          const uploadResult = await uploadAircraftDocument({ aircraftId: formData.aircraftId, documentId: documentIdForUpload, fileName: selectedFile.name, fileDataUri: fileDataUri });
          finalFileUrl = uploadResult.fileUrl; proceedWithSave(formData, finalFileUrl);
        };
        reader.onerror = (error) => { console.error("Error reading file:", error); toast({ title: "File Read Error", variant: "destructive" }); setIsSavingFile(false); };
      } catch (error) { console.error("File upload error:", error); toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Could not upload file.", variant: "destructive" }); setIsSavingFile(false); return; }
    } else { proceedWithSave(formData, finalFileUrl); }
  };

  const proceedWithSave = async (formData: AircraftDocumentFormData, fileUrlToSave?: string) => {
    const selectedAircraft = aircraftList.find(ac => ac.id === formData.aircraftId);
    const dataToSave: SaveAircraftDocumentInput = {
      aircraftId: formData.aircraftId, documentName: formData.documentName, documentType: formData.documentType,
      aircraftTailNumber: selectedAircraft ? selectedAircraft.tailNumber : 'Unknown Aircraft',
      issueDate: formData.issueDate ? format(formData.issueDate, 'yyyy-MM-dd') : undefined,
      expiryDate: formData.expiryDate ? format(formData.expiryDate, 'yyyy-MM-dd') : undefined,
      notes: formData.notes || undefined, fileUrl: fileUrlToSave,
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
    setIsSavingFile(false);
  };

  const modalTitle = isEditing ? `Edit Document: ${initialData?.documentName || ''}` : 'Add New Aircraft Document';
  const modalDescription = isEditing ? "Update document details." : "Fill in document information.";
  const totalSaving = isSavingProp || isSavingFile;
  
  // Removed onInteractOutside handler

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!totalSaving) setIsOpen(open); }}>
      <DialogContent 
        className="sm:max-w-lg overflow-visible"
        // Removed onInteractOutside
      >
        <DialogHeader><DialogTitle className="flex items-center gap-2">{isEditing ? <Edit3 /> : <FileTextIcon />}{modalTitle}</DialogTitle><ModalDialogDescription>{modalDescription}</ModalDialogDescription></DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="aircraft-document-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="aircraftId" render={({ field }) => (<FormItem><FormLabel>Aircraft</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAircraft || isEditing}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingAircraft ? "Loading..." : "Select aircraft"} /></SelectTrigger></FormControl><SelectContent>{!isLoadingAircraft && aircraftList.map(ac => (<SelectItem key={ac.id} value={ac.id}>{ac.tailNumber} - {ac.model}</SelectItem>))}</SelectContent></Select>{isEditing && <FormDescription className="text-xs">Aircraft cannot be changed for an existing document.</FormDescription>}<FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="Registration Certificate" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentType" render={({ field }) => (<FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{aircraftDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Issue Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick date</span>}
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[100]" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Expiry Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick date</span>}
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[100]" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} disabled={(date) => { const issueDateVal = form.getValues("issueDate"); return issueDateVal ? date < issueDateVal : false; }} />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
              </div>
              <FormItem><FormLabel className="flex items-center gap-2"><UploadCloud /> Document File</FormLabel><div className="flex items-center gap-2"><FormControl><Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/></FormControl>{selectedFile && (<Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile} className="text-destructive"><RemoveFileIcon /></Button>)}</div>{selectedFile && (<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Paperclip />Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>)}{!selectedFile && form.getValues('fileUrl') && (<p className="text-xs mt-1">Current: <a href={form.getValues('fileUrl')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs inline-block">{form.getValues('fileUrl')?.split('/').pop()}</a></p>)}<FormDescription className="text-xs">Max 5MB. PDF, DOCX, PNG, JPG.</FormDescription><FormMessage /></FormItem>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Notes about this document..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t"><DialogClose asChild><Button type="button" variant="outline" disabled={totalSaving}>Cancel</Button></DialogClose><Button form="aircraft-document-form" type="submit" disabled={totalSaving || isLoadingAircraft}>{totalSaving ? <Loader2 className="animate-spin" /> : <Save />}{isEditing ? 'Save Changes' : 'Add Document'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
    

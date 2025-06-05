
"use client";

import React, { useEffect, useState, useRef } from 'react';
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  fileUrl: z.string().url().optional(), // For storing existing file URL
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
  isLoadingAircraft: boolean;
  selectedAircraftIdForNew?: string; // To pre-select aircraft if coming from a filtered view (not used here yet)
}

export function AddEditAircraftDocumentModal({
  isOpen, setIsOpen, onSave, initialData, isEditing, isSaving: isSavingProp,
  aircraftList, isLoadingAircraft, selectedAircraftIdForNew,
}: AddEditAircraftDocumentModalProps) {

  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false); // Renamed from isSavingFile for clarity
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AircraftDocumentFormData>({
    resolver: zodResolver(aircraftDocumentFormSchema),
    defaultValues: {
      aircraftId: '', documentName: '', documentType: "Other",
      issueDate: undefined, expiryDate: undefined, notes: '', fileUrl: undefined,
    },
  });
  
  const { control, handleSubmit, reset, setValue, getValues } = form;

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null); 
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (isEditing && initialData) {
        reset({
          aircraftId: initialData.aircraftId, 
          documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          issueDate: initialData.issueDate && isValidDate(parseISO(initialData.issueDate)) ? parseISO(initialData.issueDate) : undefined,
          expiryDate: initialData.expiryDate && isValidDate(parseISO(initialData.expiryDate)) ? parseISO(initialData.expiryDate) : undefined,
          notes: initialData.notes || '', 
          fileUrl: initialData.fileUrl || undefined,
        });
      } else {
        reset({
          aircraftId: selectedAircraftIdForNew || aircraftList[0]?.id || '', // Default to first aircraft if available, or empty
          documentName: '', 
          documentType: "Other",
          issueDate: undefined, 
          expiryDate: undefined, 
          notes: '', 
          fileUrl: undefined,
        });
      }
    }
  }, [isOpen, isEditing, initialData, reset, selectedAircraftIdForNew, aircraftList]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
    if (event.target.files && event.target.files[0]) { 
      setSelectedFile(event.target.files[0]); 
      setValue('fileUrl', undefined); // Clear existing URL if new file is chosen for upload
    } 
  };
  const handleRemoveFile = () => { 
    setSelectedFile(null); 
    if (fileInputRef.current) fileInputRef.current.value = ""; 
    // If editing, and they remove a selected file, don't clear existing form.fileUrl yet.
    // It will be cleared if a new file is selected OR if save proceeds without a new file.
  };

  const onSubmitHandler: SubmitHandler<AircraftDocumentFormData> = async (formData) => {
    setIsUploadingFile(true); 
    let finalFileUrl = formData.fileUrl; // Use existing URL by default

    if (selectedFile) {
      if (!formData.aircraftId) { 
        toast({ title: "Error", description: "Aircraft ID missing for upload.", variant: "destructive" }); 
        setIsUploadingFile(false); 
        return; 
      }
      try {
        const reader = new FileReader(); 
        reader.readAsDataURL(selectedFile);
        
        // Using a promise to handle FileReader's async nature
        await new Promise<void>((resolvePromise, rejectPromise) => {
          reader.onloadend = async () => {
            try {
              const fileDataUri = reader.result as string;
              const documentIdForUpload = (isEditing && initialData?.id) || `doc_${Date.now()}`;
              toast({ title: "Uploading File...", description: "Please wait.", variant: "default" });
              const uploadResult = await uploadAircraftDocument({ aircraftId: formData.aircraftId, documentId: documentIdForUpload, fileName: selectedFile.name, fileDataUri: fileDataUri });
              finalFileUrl = uploadResult.fileUrl;
              resolvePromise();
            } catch (uploadError) {
              rejectPromise(uploadError);
            }
          };
          reader.onerror = (error) => {
            console.error("Error reading file:", error);
            rejectPromise(new Error("File read error"));
          };
        });
        
      } catch (error) { 
        console.error("File upload process error:", error); 
        toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Could not upload file.", variant: "destructive" }); 
        setIsUploadingFile(false); 
        return; 
      }
    }
    // If no new file was selected and form.fileUrl was cleared (e.g. by selecting a file then removing it), ensure it's undefined
    else if (!finalFileUrl && isEditing && initialData?.fileUrl && !selectedFile) {
        // If the user explicitly cleared the selection and there was an initial URL, keep it.
        // If form.fileUrl was programmatically cleared because a file *was* selected then removed,
        // then it should be undefined. If the user just wants to remove the file, they should be able
        // to clear the `fileUrl` field directly in a future enhancement or by not providing a file.
        // For now, if no new file, and initialData.fileUrl exists, let's assume they want to keep it unless formData.fileUrl is explicitly empty.
        finalFileUrl = initialData?.fileUrl || undefined;
    }


    const selectedAircraftMeta = aircraftList.find(ac => ac.id === formData.aircraftId);
    const dataToSave: SaveAircraftDocumentInput = {
      aircraftId: formData.aircraftId, 
      documentName: formData.documentName, 
      documentType: formData.documentType,
      aircraftTailNumber: selectedAircraftMeta ? `${selectedAircraftMeta.tailNumber} - ${selectedAircraftMeta.model}` : 'Unknown Aircraft',
      issueDate: formData.issueDate ? format(formData.issueDate, 'yyyy-MM-dd') : undefined,
      expiryDate: formData.expiryDate ? format(formData.expiryDate, 'yyyy-MM-dd') : undefined,
      notes: formData.notes || undefined, 
      fileUrl: finalFileUrl, // Use the potentially updated finalFileUrl
    };
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
    setIsUploadingFile(false);
  };

  const modalTitle = isEditing ? `Edit Document: ${initialData?.documentName || ''}` : 'Add New Aircraft Document';
  const modalDescription = isEditing ? "Update document details." : "Fill in document information.";
  const totalSaving = isSavingProp || isUploadingFile;
  
  const onOpenChangeHandler = (open: boolean) => {
    if (!totalSaving) {
      setIsOpen(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChangeHandler}>
      <DialogContent 
        className="sm:max-w-lg overflow-visible"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-calendar-popover="true"]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <FileTextIcon className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="aircraft-document-form" onSubmit={handleSubmit(onSubmitHandler)} className="space-y-4 py-2">
              <FormField control={control} name="aircraftId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAircraft || (isEditing && !!initialData?.aircraftId)}>
                    <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAircraft ? "Loading..." : "Select aircraft"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {!isLoadingAircraft && aircraftList.map(ac => (<SelectItem key={ac.id} value={ac.id}>{ac.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {isEditing && initialData?.aircraftId && <FormDescription className="text-xs">Aircraft cannot be changed for an existing document.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="Registration Certificate" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="documentType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{aircraftDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="issueDate" render={({ field }) => (
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
                            <PopoverContent className="w-auto p-0 z-[100]" align="start" data-calendar-popover="true">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={control} name="expiryDate" render={({ field }) => (
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
                            <PopoverContent className="w-auto p-0 z-[100]" align="start" data-calendar-popover="true">
                                <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} disabled={(date) => { const issueDateVal = getValues("issueDate"); return issueDateVal ? date < issueDateVal : false; }} />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
              </div>
              <FormItem>
                <FormLabel className="flex items-center gap-2"><UploadCloud /> Document File</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={totalSaving} />
                  </FormControl>
                  {selectedFile && (<Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile} className="text-destructive" disabled={totalSaving}><RemoveFileIcon /></Button>)}
                </div>
                {selectedFile && (<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Paperclip />Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>)}
                {!selectedFile && getValues('fileUrl') && (<p className="text-xs mt-1">Current: <a href={getValues('fileUrl')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs inline-block">{getValues('fileUrl')?.split('/').pop()}</a></p>)}
                <FormDescription className="text-xs">Max 5MB. PDF, DOCX, PNG, JPG. (Upload simulated)</FormDescription>
                <FormMessage />
              </FormItem>
              <FormField control={control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Notes about this document..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={totalSaving}>Cancel</Button></DialogClose>
          <Button form="aircraft-document-form" type="submit" disabled={totalSaving || isLoadingAircraft}>
            {totalSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
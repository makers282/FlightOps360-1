
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, FileText as FileTextIcon, Edit3, UploadCloud, Paperclip, XCircle as RemoveFileIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO } from "date-fns";
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
}, {
  message: "Expiry date cannot be before issue date.",
  path: ["expiryDate"],
});

export type AircraftDocumentFormData = z.infer<typeof aircraftDocumentFormSchema>;

interface AddEditAircraftDocumentModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveAircraftDocumentInput, originalDocumentId?: string) => Promise<void>;
  initialData?: AircraftDocument | null;
  isEditing?: boolean;
  isSaving: boolean;
  aircraftList: Pick<FleetAircraft, 'id' | 'tailNumber' | 'model'>[];
  isLoadingAircraft: boolean;
  selectedAircraftIdForNew?: string;
}

export function AddEditAircraftDocumentModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving: isSavingProp,
  aircraftList,
  isLoadingAircraft,
  selectedAircraftIdForNew,
}: AddEditAircraftDocumentModalProps) {

  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AircraftDocumentFormData>({
    resolver: zodResolver(aircraftDocumentFormSchema),
    defaultValues: {
      aircraftId: '', documentName: '', documentType: "Other",
      issueDate: undefined, expiryDate: undefined, notes: '', fileUrl: undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (isEditing && initialData) {
        form.reset({
          aircraftId: initialData.aircraftId,
          documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          issueDate: initialData.issueDate && isValidDate(parseISO(initialData.issueDate)) ? parseISO(initialData.issueDate) : undefined,
          expiryDate: initialData.expiryDate && isValidDate(parseISO(initialData.expiryDate)) ? parseISO(initialData.expiryDate) : undefined,
          notes: initialData.notes || '',
          fileUrl: initialData.fileUrl || undefined,
        });
      } else {
        form.reset({
          aircraftId: selectedAircraftIdForNew || '',
          documentName: '', documentType: "Other",
          issueDate: undefined, expiryDate: undefined, notes: '', fileUrl: undefined,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form, selectedAircraftIdForNew]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      form.setValue('fileUrl', undefined);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit: SubmitHandler<AircraftDocumentFormData> = async (formData) => {
    setIsSavingFile(true);
    let finalFileUrl = formData.fileUrl;

    if (selectedFile) {
      if (!formData.aircraftId) {
        toast({ title: "Error", description: "Aircraft ID is missing for file upload.", variant: "destructive" });
        setIsSavingFile(false);
        return;
      }
      try {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onloadend = async () => {
          const fileDataUri = reader.result as string;
          const documentIdForUpload = (isEditing && initialData?.id) || `doc_${Date.now()}`;

          toast({ title: "Uploading File...", description: "Please wait while your document is uploaded.", variant: "default" });
          const uploadResult = await uploadAircraftDocument({
            aircraftId: formData.aircraftId,
            documentId: documentIdForUpload,
            fileName: selectedFile.name,
            fileDataUri: fileDataUri,
          });
          finalFileUrl = uploadResult.fileUrl;
          proceedWithSave(formData, finalFileUrl);
        };
        reader.onerror = (error) => {
            console.error("Error reading file:", error);
            toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
            setIsSavingFile(false);
        };
      } catch (error) {
        console.error("File upload error:", error);
        toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Could not upload file.", variant: "destructive" });
        setIsSavingFile(false);
        return;
      }
    } else {
      proceedWithSave(formData, finalFileUrl);
    }
  };

  const proceedWithSave = async (formData: AircraftDocumentFormData, fileUrlToSave?: string) => {
    const selectedAircraft = aircraftList.find(ac => ac.id === formData.aircraftId);
    const dataToSave: SaveAircraftDocumentInput = {
      aircraftId: formData.aircraftId,
      documentName: formData.documentName,
      documentType: formData.documentType,
      aircraftTailNumber: selectedAircraft ? selectedAircraft.tailNumber : 'Unknown Aircraft',
      issueDate: formData.issueDate ? format(formData.issueDate, 'yyyy-MM-dd') : undefined,
      expiryDate: formData.expiryDate ? format(formData.expiryDate, 'yyyy-MM-dd') : undefined,
      notes: formData.notes || undefined,
      fileUrl: fileUrlToSave,
    };

    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
    setIsSavingFile(false);
  };

  const modalTitle = isEditing ? `Edit Document: ${initialData?.documentName || ''}` : 'Add New Aircraft Document';
  const modalDescription = isEditing
    ? "Update the aircraft document's details."
    : "Fill in the new aircraft document's information.";

  const totalSaving = isSavingProp || isSavingFile;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!totalSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <FileTextIcon className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="aircraft-document-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="aircraftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aircraft</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoadingAircraft || isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select aircraft"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!isLoadingAircraft && aircraftList.map(ac => (
                          <SelectItem key={ac.id} value={ac.id}>
                            {ac.tailNumber} - {ac.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEditing && <FormDescription className="text-xs">Aircraft cannot be changed for an existing document.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="e.g., Registration Certificate, Insurance Policy" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                       <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                       </FormControl>
                        <SelectContent>
                            {aircraftDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Issue Date (Optional)</FormLabel>
                      <FormControl>
                        <Popover modal={false}>
                          <PopoverTrigger asChild>
                              <Button
                                ref={field.ref}
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
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
                      <FormControl>
                        <Popover modal={false}>
                          <PopoverTrigger asChild>
                              <Button
                                ref={field.ref}
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => {
                                  const issueDateValue = form.getValues("issueDate");
                                  return issueDateValue ? date < issueDateValue : false;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary"/> Document File (Optional)</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      id="file-upload"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </FormControl>
                  {selectedFile && (
                     <Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile} className="text-destructive">
                       <RemoveFileIcon className="h-4 w-4" />
                     </Button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3"/> Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {!selectedFile && form.getValues('fileUrl') && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Current file: <a href={form.getValues('fileUrl')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs inline-block">{form.getValues('fileUrl')?.split('/').pop()}</a>
                    </p>
                )}
                <FormDescription className="text-xs">Max file size: 5MB. Allowed types: PDF, DOCX, PNG, JPG.</FormDescription>
                <FormMessage />
              </FormItem>

              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any specific notes about this document..." {...field} value={field.value || ''} rows={3} /></FormControl><FormMessage /></FormItem>)} />
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

    

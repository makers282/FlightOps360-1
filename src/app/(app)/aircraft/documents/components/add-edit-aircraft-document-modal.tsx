
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
import { CalendarIcon, Loader2, Save, FileText as FileTextIcon, Edit3, UploadCloud, Paperclip, XCircle as RemoveFileIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { AircraftDocument, SaveAircraftDocumentInput } from '@/ai/schemas/aircraft-document-schemas';
import { aircraftDocumentTypes } from '@/ai/schemas/aircraft-document-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadAircraftDocument } from '@/ai/flows/upload-aircraft-document-flow'; // Import the new upload flow
import { useToast } from '@/hooks/use-toast'; // Import useToast

const aircraftDocumentFormSchema = z.object({
  aircraftId: z.string().min(1, "Aircraft selection is required."),
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(aircraftDocumentTypes, { required_error: "Document type is required."}),
  issueDate: z.string().optional().refine(val => !val || isValidDate(parseISO(val)), { message: "Invalid date format for issue date." }),
  expiryDate: z.string().optional().refine(val => !val || isValidDate(parseISO(val)), { message: "Invalid date format for expiry date." }),
  notes: z.string().optional(),
  fileUrl: z.string().url().optional(), // Keep track of existing file URL
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
  isSaving: isSavingProp, // Renamed to avoid conflict with internal isSavingFile state
  aircraftList,
  isLoadingAircraft,
  selectedAircraftIdForNew,
}: AddEditAircraftDocumentModalProps) {
  
  const { toast } = useToast(); // Initialize toast
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false); // For file upload spinner
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AircraftDocumentFormData>({
    resolver: zodResolver(aircraftDocumentFormSchema),
    defaultValues: {
      aircraftId: '', documentName: '', documentType: "Other",
      issueDate: '', expiryDate: '', notes: '', fileUrl: undefined,
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
          issueDate: initialData.issueDate || '',
          expiryDate: initialData.expiryDate || '',
          notes: initialData.notes || '',
          fileUrl: initialData.fileUrl || undefined,
        });
      } else {
        form.reset({
          aircraftId: selectedAircraftIdForNew || '',
          documentName: '', documentType: "Other",
          issueDate: '', expiryDate: '', notes: '', fileUrl: undefined,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form, selectedAircraftIdForNew]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      form.setValue('fileUrl', undefined); // Clear existing URL if new file is chosen
    }
  };
  
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (isEditing && initialData?.fileUrl) {
      // If editing and there was an existing file, we might want to clear it
      // For now, we'll just allow uploading a new one to replace. 
      // A "Remove existing file" button would be a separate feature.
      // For simplicity, if a new file is NOT selected, the existing fileUrl will be preserved.
      // If they want to remove the file entirely, they'd need a separate action or to upload an "empty" file (not ideal).
    }
  };

  const onSubmit: SubmitHandler<AircraftDocumentFormData> = async (formData) => {
    setIsSavingFile(true); // Show general saving spinner
    let finalFileUrl = formData.fileUrl; // Keep existing URL if no new file

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
          const documentIdForUpload = (isEditing && initialData?.id) || `doc_${Date.now()}`; // Generate new ID if not editing
          
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
      // No new file selected, proceed with existing formData.fileUrl (which might be undefined or an existing URL)
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
      issueDate: formData.issueDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      notes: formData.notes || undefined,
      fileUrl: fileUrlToSave,
    };
    
    // The onSave prop is expected to be an async function passed from the parent page
    // which handles calling the actual saveAircraftDocument flow
    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
    setIsSavingFile(false); // Turn off spinner after parent's save logic completes
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
          <DialogDescription>{modalDescription}</DialogDescription>
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
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoadingAircraft || isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select aircraft"} />
                        </SelectTrigger>
                        <SelectContent>
                          {!isLoadingAircraft && aircraftList.map(ac => (
                            <SelectItem key={ac.id} value={ac.id}>
                              {ac.tailNumber} - {ac.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
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
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                        <SelectContent>
                          {aircraftDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </FormControl>
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && isValidDate(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && isValidDate(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                        Current file: <a href={form.getValues('fileUrl')} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs inline-block">{form.getValues('fileUrl')?.split('/').pop()}</a>
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

    
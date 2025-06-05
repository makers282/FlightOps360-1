
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
import { CalendarIcon, Loader2, Save, Library as LibraryIcon, Edit3, UploadCloud, Paperclip, XCircle as RemoveFileIcon, Tag } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO } from "date-fns";
import type { CompanyDocument, SaveCompanyDocumentInput } from '@/ai/schemas/company-document-schemas';
import { companyDocumentTypes } from '@/ai/schemas/company-document-schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
// import { uploadCompanyDocument } from '@/ai/flows/upload-company-document-flow'; // Placeholder for future upload flow
import { useToast } from '@/hooks/use-toast';

const companyDocumentFormSchema = z.object({
  documentName: z.string().min(1, "Document name is required."),
  documentType: z.enum(companyDocumentTypes, { required_error: "Document type is required."}),
  description: z.string().optional(),
  version: z.string().optional(),
  effectiveDate: z.date().optional(),
  reviewDate: z.date().optional(),
  fileUrl: z.string().url().optional(),
  tagsStr: z.string().optional().describe("Comma-separated tags"),
}).refine(data => {
  if (data.effectiveDate && data.reviewDate) {
    return data.reviewDate >= data.effectiveDate;
  }
  return true;
}, {
  message: "Review date cannot be before effective date.",
  path: ["reviewDate"],
});

export type CompanyDocumentFormData = z.infer<typeof companyDocumentFormSchema>;

interface AddEditCompanyDocumentModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveCompanyDocumentInput, originalDocumentId?: string) => Promise<void>;
  initialData?: CompanyDocument | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditCompanyDocumentModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving: isSavingProp,
}: AddEditCompanyDocumentModalProps) {

  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CompanyDocumentFormData>({
    resolver: zodResolver(companyDocumentFormSchema),
    defaultValues: {
      documentName: '', documentType: "Other", description: '', version: '',
      effectiveDate: undefined, reviewDate: undefined, fileUrl: undefined, tagsStr: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (isEditing && initialData) {
        form.reset({
          documentName: initialData.documentName,
          documentType: initialData.documentType || "Other",
          description: initialData.description || '',
          version: initialData.version || '',
          effectiveDate: initialData.effectiveDate && isValidDate(parseISO(initialData.effectiveDate)) ? parseISO(initialData.effectiveDate) : undefined,
          reviewDate: initialData.reviewDate && isValidDate(parseISO(initialData.reviewDate)) ? parseISO(initialData.reviewDate) : undefined,
          fileUrl: initialData.fileUrl || undefined,
          tagsStr: (initialData.tags || []).join(', '),
        });
      } else {
        form.reset({
          documentName: '', documentType: "Other", description: '', version: '',
          effectiveDate: undefined, reviewDate: undefined, fileUrl: undefined, tagsStr: '',
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      form.setValue('fileUrl', undefined); // Clear existing URL if new file is chosen
    }
  };
  
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit: SubmitHandler<CompanyDocumentFormData> = async (formData) => {
    setIsUploadingFile(true);
    let finalFileUrl = formData.fileUrl;

    if (selectedFile) {
      // Placeholder: Actual file upload logic would go here
      // For now, we'll just simulate it and use a placeholder URL.
      toast({ title: "File Upload (Simulation)", description: `Simulating upload of ${selectedFile.name}. This will be a placeholder URL.` });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      finalFileUrl = `https://storage.example.com/company_documents/${selectedFile.name.replace(/\s+/g, '_')}`;
      // try {
      //   const reader = new FileReader();
      //   reader.readAsDataURL(selectedFile);
      //   reader.onloadend = async () => {
      //     const fileDataUri = reader.result as string;
      //     // Replace with actual upload flow call:
      //     // const uploadResult = await uploadCompanyDocument({ documentName: formData.documentName, fileName: selectedFile.name, fileDataUri });
      //     // finalFileUrl = uploadResult.fileUrl;
      //     // proceedWithSave(formData, finalFileUrl);
      //   };
      // } catch (error) { ... }
      proceedWithSave(formData, finalFileUrl); // Call with placeholder
    } else {
      proceedWithSave(formData, finalFileUrl);
    }
  };

  const proceedWithSave = async (formData: CompanyDocumentFormData, fileUrlToSave?: string) => {
    const tagsArray = formData.tagsStr ? formData.tagsStr.split(',').map(tag => tag.trim()).filter(Boolean) : [];
    const dataToSave: SaveCompanyDocumentInput = {
      documentName: formData.documentName,
      documentType: formData.documentType,
      description: formData.description || undefined,
      version: formData.version || undefined,
      effectiveDate: formData.effectiveDate ? format(formData.effectiveDate, 'yyyy-MM-dd') : undefined,
      reviewDate: formData.reviewDate ? format(formData.reviewDate, 'yyyy-MM-dd') : undefined,
      fileUrl: fileUrlToSave,
      tags: tagsArray,
    };

    await onSave(dataToSave, isEditing && initialData ? initialData.id : undefined);
    setIsUploadingFile(false);
  };

  const modalTitle = isEditing ? `Edit: ${initialData?.documentName || ''}` : 'Add New Company Document';
  const modalDescription = isEditing
    ? "Update the company document's details."
    : "Fill in the new company document's information.";
  
  const totalSaving = isSavingProp || isUploadingFile;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!totalSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit3 className="h-6 w-6 text-primary" /> : <LibraryIcon className="h-6 w-6 text-primary" />}
            {modalTitle}
          </DialogTitle>
          <ModalDialogDescription>{modalDescription}</ModalDialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-5">
          <Form {...form}>
            <form id="company-document-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="documentName" render={({ field }) => (<FormItem><FormLabel>Document Name</FormLabel><FormControl><Input placeholder="e.g., Flight Operations Manual" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentType" render={({ field }) => (
                <FormItem><FormLabel>Document Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger></FormControl>
                    <SelectContent>{companyDocumentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Briefly describe the document..." {...field} value={field.value || ''} rows={2} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="version" render={({ field }) => (<FormItem><FormLabel>Version (Optional)</FormLabel><FormControl><Input placeholder="e.g., Rev 12.1, v2.0" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="effectiveDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective Date (Optional)</FormLabel>
                    <FormControl>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reviewDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Next Review Date (Optional)</FormLabel>
                    <FormControl>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange}
                            disabled={(date) => { const effDate = form.getValues("effectiveDate"); return effDate ? date < effDate : false; }}
                            initialFocus />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <FormItem>
                <FormLabel className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary"/> Document File (Optional)</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input id="company-file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                  </FormControl>
                  {selectedFile && (<Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile} className="text-destructive"><RemoveFileIcon className="h-4 w-4" /></Button>)}
                </div>
                {selectedFile && (<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Paperclip className="h-3 w-3"/> Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>)}
                {!selectedFile && form.getValues('fileUrl') && (<p className="text-xs text-muted-foreground mt-1">Current file: <a href={form.getValues('fileUrl')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs inline-block">{form.getValues('fileUrl')?.split('/').pop()}</a></p>)}
                <FormDescription className="text-xs">Max file size: 10MB. (Placeholder - no actual upload yet)</FormDescription>
                <FormMessage />
              </FormItem>

              <FormField control={form.control} name="tagsStr" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Tag className="h-4 w-4" /> Tags (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., Safety, FOM, Compliance" {...field} value={field.value || ''} /></FormControl>
                  <FormDescription className="text-xs">Comma-separated tags for easier searching.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={totalSaving}>Cancel</Button></DialogClose>
          <Button form="company-document-form" type="submit" disabled={totalSaving}>
            {totalSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Library, UploadCloud, Search, FileText, Edit3, Trash2, Loader2, Link as LinkIcon, CalendarDays, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

import { fetchCompanyDocuments, saveCompanyDocument, deleteCompanyDocument } from '@/ai/flows/manage-company-documents-flow';
import type { CompanyDocument, SaveCompanyDocumentInput } from '@/ai/schemas/company-document-schemas';
import { AddEditCompanyDocumentModal } from './components/add-edit-company-document-modal';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function CompanyDocumentsPage() {
  const [allCompanyDocuments, setAllCompanyDocuments] = useState<CompanyDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentDocumentToEdit, setCurrentDocumentToEdit] = useState<CompanyDocument | null>(null);
  const [isSavingDocument, startSavingDocumentTransition] = useTransition();
  
  const [isDeletingDocument, startDeletingDocumentTransition] = useTransition();
  const [documentToDelete, setDocumentToDelete] = useState<CompanyDocument | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadCompanyDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const fetchedDocs = await fetchCompanyDocuments();
      setAllCompanyDocuments(fetchedDocs);
    } catch (error) {
      console.error("Failed to load company documents:", error);
      toast({ title: "Error Loading Documents", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadCompanyDocuments();
  }, []); 

  const filteredDocuments = allCompanyDocuments.filter(doc =>
    doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (doc.version && doc.version.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleOpenAddModal = () => {
    setIsEditingModal(false);
    setCurrentDocumentToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (doc: CompanyDocument) => {
    setIsEditingModal(true);
    setCurrentDocumentToEdit(doc);
    setIsModalOpen(true);
  };

  const handleSaveDocument = async (data: SaveCompanyDocumentInput, originalDocumentId?: string) => {
    startSavingDocumentTransition(async () => {
      try {
        const dataToSave = { ...data, id: originalDocumentId };
        const savedData = await saveCompanyDocument(dataToSave);
        toast({
          title: isEditingModal ? "Document Updated" : "Document Added",
          description: `Company document "${savedData.documentName}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadCompanyDocuments(); 
      } catch (error) {
        console.error("Failed to save company document:", error);
        toast({ title: "Error Saving Document", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleDeleteClick = (doc: CompanyDocument) => {
    setDocumentToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const executeDeleteDocument = async () => {
    if (!documentToDelete) return;
    startDeletingDocumentTransition(async () => {
      try {
        await deleteCompanyDocument({ documentId: documentToDelete.id });
        toast({ title: "Document Deleted", description: `Document "${documentToDelete.documentName}" has been removed.` });
        setShowDeleteConfirm(false);
        setDocumentToDelete(null);
        await loadCompanyDocuments(); 
      } catch (error) {
        console.error("Failed to delete document:", error);
        toast({ title: "Error Deleting Document", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setDocumentToDelete(null);
      }
    });
  };

  const formatDateForDisplay = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MM/dd/yyyy') : '-';
    } catch {
      return '-';
    }
  };

  const DocumentListItem = ({ doc }: { doc: CompanyDocument }) => (
    <div className="flex flex-col sm:flex-row items-start justify-between py-3 px-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-sm group">
      <div className="flex items-start gap-3 flex-1 min-w-0 mb-2 sm:mb-0">
        <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="truncate flex-grow">
          <p className="text-sm font-semibold text-foreground truncate" title={doc.documentName}>{doc.documentName}</p>
          <p className="text-xs text-muted-foreground">
            Type: {doc.documentType} | Version: {doc.version || '-'} | Effective: {formatDateForDisplay(doc.effectiveDate)}
          </p>
          {doc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={doc.description}>{doc.description}</p>}
          {doc.tags && doc.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {doc.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">{tag}</Badge>)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0 self-start sm:self-center">
        {doc.fileUrl && (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <LinkIcon className="h-4 w-4" />
                    <span className="sr-only">View/Download File</span>
                </Link>
            </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditModal(doc)}>
          <Edit3 className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(doc)}>
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader 
        title="Company Document Hub"
        description="Manage and access all company-wide operational manuals, compliance documents, policies, and templates."
        icon={Library}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoadingDocuments}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Company Document
          </Button>
        }
      />
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Company Documents</CardTitle>
          <CardDescription>Central repository for all official company documentation. (File uploads are simulated)</CardDescription>
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents (name, type, description, tags)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoadingDocuments && allCompanyDocuments.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingDocuments && allCompanyDocuments.length === 0 ? (
            <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {searchTerm ? "No documents match your search." : "No company documents found. Upload one to get started."}
            </p>
          ) : (
            filteredDocuments.map(doc => <DocumentListItem key={doc.id} doc={doc} />)
          )}
        </CardContent>
      </Card>

      <AddEditCompanyDocumentModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveDocument}
        initialData={currentDocumentToEdit}
        isEditing={isEditingModal}
        isSaving={isSavingDocument}
      />

      {showDeleteConfirm && documentToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the document "{documentToDelete.documentName}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingDocument}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteDocument} disabled={isDeletingDocument}>
                {isDeletingDocument && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

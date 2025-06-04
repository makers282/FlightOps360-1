
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderArchive, UploadCloud, Edit3, Trash2, Search, FileText, Loader2, CalendarDays, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchCrewDocuments, saveCrewDocument, deleteCrewDocument } from '@/ai/flows/manage-crew-documents-flow';
import type { CrewDocument, SaveCrewDocumentInput, CrewDocumentType } from '@/ai/schemas/crew-document-schemas';
import { AddEditCrewDocumentModal } from './components/add-edit-crew-document-modal';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge'; // Added this import

// Define categories based on document types
const GENERAL_DOC_TYPES: CrewDocumentType[] = ["License", "Medical", "Passport", "Visa", "Company ID", "Airport ID", "Other"];
const TRAINING_DOC_TYPES: CrewDocumentType[] = ["Training Certificate", "Type Rating"];


export default function CrewDocumentsPage() {
  const [allCrewMembers, setAllCrewMembers] = useState<CrewMember[]>([]);
  const [allCrewDocuments, setAllCrewDocuments] = useState<CrewDocument[]>([]);
  
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | undefined>(undefined);
  
  const [isLoadingCrew, setIsLoadingCrew] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentDocumentToEdit, setCurrentDocumentToEdit] = useState<CrewDocument | null>(null);
  const [isSavingDocument, startSavingDocumentTransition] = useTransition();
  
  const [isDeletingDocument, startDeletingDocumentTransition] = useTransition();
  const [documentToDelete, setDocumentToDelete] = useState<CrewDocument | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadAllData = async () => {
    setIsLoadingCrew(true);
    setIsLoadingDocuments(true);
    try {
      const [fetchedCrew, fetchedDocs] = await Promise.all([
        fetchCrewMembers(),
        fetchCrewDocuments(),
      ]);
      setAllCrewMembers(fetchedCrew.filter(cm => cm.id)); 
      setAllCrewDocuments(fetchedDocs);
      
      // Removed automatic selection of first crew member here, will rely on ClientOnly for initial render state
    } catch (error) {
      console.error("Failed to load crew or documents:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingCrew(false);
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const documentsForSelectedCrew = useMemo(() => {
    if (!selectedCrewMemberId) return [];
    return allCrewDocuments.filter(doc => doc.crewMemberId === selectedCrewMemberId);
  }, [selectedCrewMemberId, allCrewDocuments]);

  const generalDocuments = useMemo(() => {
    return documentsForSelectedCrew.filter(doc => GENERAL_DOC_TYPES.includes(doc.documentType));
  }, [documentsForSelectedCrew]);

  const trainingDocuments = useMemo(() => {
    return documentsForSelectedCrew.filter(doc => TRAINING_DOC_TYPES.includes(doc.documentType));
  }, [documentsForSelectedCrew]);

  const handleOpenAddModal = () => {
    setIsEditingModal(false);
    setCurrentDocumentToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (doc: CrewDocument) => {
    setIsEditingModal(true);
    setCurrentDocumentToEdit(doc);
    setIsModalOpen(true);
  };

  const handleSaveDocument = async (data: SaveCrewDocumentInput, originalDocumentId?: string) => {
    startSavingDocumentTransition(async () => {
      try {
        const dataToSave = { ...data, id: originalDocumentId };
        const savedData = await saveCrewDocument(dataToSave);
        toast({
          title: isEditingModal ? "Document Updated" : "Document Added",
          description: `Document "${savedData.documentName}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadAllData(); 
      } catch (error) {
        console.error("Failed to save document:", error);
        toast({ title: "Error Saving Document", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleDeleteClick = (doc: CrewDocument) => {
    setDocumentToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const executeDeleteDocument = async () => {
    if (!documentToDelete) return;
    startDeletingDocumentTransition(async () => {
      try {
        await deleteCrewDocument({ documentId: documentToDelete.id });
        toast({ title: "Document Deleted", description: `Document "${documentToDelete.documentName}" has been removed.` });
        setShowDeleteConfirm(false);
        setDocumentToDelete(null);
        await loadAllData(); 
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

  const DocumentItem = ({ doc }: { doc: CrewDocument }) => (
    <div className="flex items-center justify-between py-2 px-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-sm group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="truncate">
          <p className="text-sm font-medium text-foreground truncate" title={doc.documentName}>{doc.documentName}</p>
          <p className="text-xs text-muted-foreground">
            {doc.expiryDate ? `Expires: ${formatDateForDisplay(doc.expiryDate)}` : (doc.issueDate ? `Issued: ${formatDateForDisplay(doc.issueDate)}` : doc.documentType)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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

  const selectedCrewMember = allCrewMembers.find(cm => cm.id === selectedCrewMemberId);
  const pageTitle = selectedCrewMember ? `Crew Documents: ${selectedCrewMember.firstName} ${selectedCrewMember.lastName}` : "Crew Documents";

  return (
    <>
      <PageHeader 
        title={pageTitle}
        description="Manage and track all crew-specific documents, licenses, and certifications."
        icon={FolderArchive}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoadingCrew || !selectedCrewMemberId}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload New Document
          </Button>
        }
      />

      <ClientOnly fallback={<Skeleton className="h-10 w-full max-w-sm mb-6" />}>
        <div className="mb-6 max-w-sm">
          <Label htmlFor="crewMemberSelectDropdown">Choose a Crew Member:</Label>
          <Select
            value={selectedCrewMemberId || ''}
            onValueChange={(value) => setSelectedCrewMemberId(value === 'NONE' ? undefined : value)}
            disabled={isLoadingCrew}
          >
            <SelectTrigger id="crewMemberSelectDropdown">
              <SelectValue placeholder={isLoadingCrew ? "Loading crew..." : "Select a crew member"} />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCrew ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : (
                allCrewMembers.length === 0 ? (
                  <SelectItem value="no-crew" disabled>No crew members found</SelectItem>
                ) : (
                  allCrewMembers.map(crew => (
                    <SelectItem key={crew.id} value={crew.id}>
                      {crew.firstName} {crew.lastName} ({crew.role})
                    </SelectItem>
                  ))
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </ClientOnly>
      
      {isLoadingDocuments && selectedCrewMemberId && (
        <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading documents for {selectedCrewMember?.firstName} {selectedCrewMember?.lastName}...</p>
        </div>
      )}

      {!selectedCrewMemberId && !isLoadingCrew && !isLoadingDocuments && (
        <Card className="shadow-sm">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <User className="mx-auto h-12 w-12 mb-2" />
                Please select a crew member to view their documents.
            </CardContent>
        </Card>
      )}

      {selectedCrewMemberId && !isLoadingDocuments && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Crew Documents</CardTitle>
                <Badge variant="secondary">{generalDocuments.length} Document(s)</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {generalDocuments.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No general documents found for this crew member.</p>
                ) : (
                  generalDocuments.map(doc => <DocumentItem key={doc.id} doc={doc} />)
                )}
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Training Records</CardTitle>
                <Badge variant="secondary">{trainingDocuments.length} Document(s)</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {trainingDocuments.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No training records found for this crew member.</p>
                ) : (
                  trainingDocuments.map(doc => <DocumentItem key={doc.id} doc={doc} />)
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Archived Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Functionality to view and manage archived documents will be available here.
                </p>
                <Button variant="outline" className="w-full" disabled>
                  <FolderArchive className="mr-2 h-4 w-4" /> View Archived Crew Documents
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AddEditCrewDocumentModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveDocument}
        initialData={currentDocumentToEdit}
        isEditing={isEditingModal}
        isSaving={isSavingDocument}
        crewMembers={allCrewMembers.map(cm => ({id: cm.id, firstName: cm.firstName, lastName: cm.lastName, role: cm.role}))}
        isLoadingCrewMembers={isLoadingCrew}
      />

      {showDeleteConfirm && documentToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the document "{documentToDelete.documentName}" for {documentToDelete.crewMemberName}? This action cannot be undone.
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

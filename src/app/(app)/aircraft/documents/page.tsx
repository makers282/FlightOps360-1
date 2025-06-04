
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpenCheck, UploadCloud, Edit3, Trash2, Search, FileText, Loader2, Plane, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
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

import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAircraftDocuments, saveAircraftDocument, deleteAircraftDocument } from '@/ai/flows/manage-aircraft-documents-flow';
import type { AircraftDocument, SaveAircraftDocumentInput } from '@/ai/schemas/aircraft-document-schemas';
import { AddEditAircraftDocumentModal } from './components/add-edit-aircraft-document-modal';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link'; // For linking to fileUrl

export default function AircraftDocumentsPage() {
  const [allFleetAircraft, setAllFleetAircraft] = useState<Pick<FleetAircraft, 'id' | 'tailNumber' | 'model'>[]>([]);
  const [allAircraftDocuments, setAllAircraftDocuments] = useState<AircraftDocument[]>([]);
  
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(undefined);
  
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentDocumentToEdit, setCurrentDocumentToEdit] = useState<AircraftDocument | null>(null);
  const [isSavingDocument, startSavingDocumentTransition] = useTransition();
  
  const [isDeletingDocument, startDeletingDocumentTransition] = useTransition();
  const [documentToDelete, setDocumentToDelete] = useState<AircraftDocument | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadAllData = async () => {
    setIsLoadingFleet(true);
    setIsLoadingDocuments(true);
    try {
      const [fetchedFleet, fetchedDocs] = await Promise.all([
        fetchFleetAircraft(),
        fetchAircraftDocuments(),
      ]);
      setAllFleetAircraft(fetchedFleet.map(ac => ({ id: ac.id, tailNumber: ac.tailNumber, model: ac.model })));
      setAllAircraftDocuments(fetchedDocs);
    } catch (error) {
      console.error("Failed to load aircraft or documents:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingFleet(false);
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const documentsForSelectedAircraft = useMemo(() => {
    if (!selectedAircraftId) return [];
    return allAircraftDocuments.filter(doc => doc.aircraftId === selectedAircraftId);
  }, [selectedAircraftId, allAircraftDocuments]);

  const handleOpenAddModal = () => {
    if (!selectedAircraftId) {
      toast({ title: "Select Aircraft", description: "Please select an aircraft before adding a document.", variant: "info" });
      return;
    }
    setIsEditingModal(false);
    setCurrentDocumentToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (doc: AircraftDocument) => {
    setIsEditingModal(true);
    setCurrentDocumentToEdit(doc);
    setIsModalOpen(true);
  };

  const handleSaveDocument = async (data: SaveAircraftDocumentInput, originalDocumentId?: string) => {
    startSavingDocumentTransition(async () => {
      try {
        // If originalDocumentId is present, it's an edit; otherwise, it's a new document.
        const dataToSave = { ...data, id: originalDocumentId };
        const savedData = await saveAircraftDocument(dataToSave);
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

  const handleDeleteClick = (doc: AircraftDocument) => {
    setDocumentToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const executeDeleteDocument = async () => {
    if (!documentToDelete) return;
    startDeletingDocumentTransition(async () => {
      try {
        await deleteAircraftDocument({ documentId: documentToDelete.id });
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

  const DocumentItem = ({ doc }: { doc: AircraftDocument }) => (
    <div className="flex items-start justify-between py-3 px-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-sm group">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="truncate flex-grow">
          <p className="text-sm font-medium text-foreground truncate" title={doc.documentName}>{doc.documentName}</p>
          <p className="text-xs text-muted-foreground">
            Type: {doc.documentType} | Expires: {formatDateForDisplay(doc.expiryDate)}
          </p>
          {doc.fileUrl && (
            <Link href={doc.fileUrl} target="_blank" rel="noopener noreferrer" 
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
              <LinkIcon className="h-3 w-3" /> View/Download Document
            </Link>
          )}
           {!doc.fileUrl && <p className="text-xs text-muted-foreground italic mt-1">No file uploaded.</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
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

  const selectedAircraftLabel = allFleetAircraft.find(ac => ac.id === selectedAircraftId)?.tailNumber;
  const pageTitle = selectedAircraftLabel ? `Aircraft Documents: ${selectedAircraftLabel}` : "Aircraft Documents";

  return (
    <>
      <PageHeader 
        title={pageTitle}
        description="Manage and access documents specific to each aircraft in your fleet."
        icon={BookOpenCheck}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoadingFleet || !selectedAircraftId}>
            <UploadCloud className="mr-2 h-4 w-4" /> Add Aircraft Document
          </Button>
        }
      />

      <ClientOnly fallback={<Skeleton className="h-10 w-full max-w-sm mb-6" />}>
        <div className="mb-6 max-w-sm">
          <Label htmlFor="aircraftSelectDropdown">Select an Aircraft:</Label>
          <Select
            value={selectedAircraftId || ''}
            onValueChange={(value) => setSelectedAircraftId(value === 'NONE' ? undefined : value)}
            disabled={isLoadingFleet}
            name="aircraftSelectDropdown" // Added name for label association
            // id="aircraftSelectDropdown" // Ensure id is on SelectTrigger or handled by shadcn
          >
            <SelectTrigger id="aircraftSelectDropdown">
              <SelectValue placeholder={isLoadingFleet ? "Loading aircraft..." : "Select an aircraft"} />
            </SelectTrigger>
            <SelectContent>
              {isLoadingFleet ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : (
                allFleetAircraft.length === 0 ? (
                  <SelectItem value="no-aircraft" disabled>No aircraft found in fleet</SelectItem>
                ) : (
                  allFleetAircraft.map(ac => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.tailNumber} - {ac.model}
                    </SelectItem>
                  ))
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </ClientOnly>
      
      {isLoadingDocuments && selectedAircraftId && (
        <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading documents for {selectedAircraftLabel}...</p>
        </div>
      )}

      {!selectedAircraftId && !isLoadingFleet && !isLoadingDocuments && (
        <Card className="shadow-sm">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <Plane className="mx-auto h-12 w-12 mb-2" />
                Please select an aircraft to view its documents.
            </CardContent>
        </Card>
      )}

      {selectedAircraftId && !isLoadingDocuments && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Documents for {selectedAircraftLabel}</CardTitle>
            <CardDescription>All registered documents for this aircraft.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {documentsForSelectedAircraft.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No documents found for this aircraft.</p>
            ) : (
              documentsForSelectedAircraft.map(doc => <DocumentItem key={doc.id} doc={doc} />)
            )}
          </CardContent>
        </Card>
      )}

      <AddEditAircraftDocumentModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveDocument}
        initialData={currentDocumentToEdit}
        isEditing={isEditingModal}
        isSaving={isSavingDocument}
        aircraftList={allFleetAircraft}
        isLoadingAircraft={isLoadingFleet}
        selectedAircraftIdForNew={selectedAircraftId}
      />

      {showDeleteConfirm && documentToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the document "{documentToDelete.documentName}" for aircraft {documentToDelete.aircraftTailNumber || documentToDelete.aircraftId}? This action cannot be undone.
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

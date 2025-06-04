
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Library, UploadCloud, Search, FileText, Edit3, Trash2, Loader2, Link as LinkIcon, CalendarDays, Tag, AlertTriangle, CheckCircle2, Plane } from 'lucide-react';
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
import { format, parseISO, isValid, differenceInDays, isPast } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { fetchAircraftDocuments, saveAircraftDocument, deleteAircraftDocument } from '@/ai/flows/manage-aircraft-documents-flow';
import type { AircraftDocument, SaveAircraftDocumentInput, AircraftDocumentType } from '@/ai/schemas/aircraft-document-schemas';
// aircraftDocumentTypes is already exported from the schema and used in the modal, so it doesn't need to be redefined here.
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { AddEditAircraftDocumentModal } from './components/add-edit-aircraft-document-modal';
import { ClientOnly } from '@/components/client-only'; 
import { Skeleton } from '@/components/ui/skeleton'; 
import Link from 'next/link';

const EXPIRY_WARNING_DAYS = 30;
type DocumentStatus = "Expired" | "Expiring Soon" | "Valid" | "No Expiry";

const getDocumentStatus = (expiryDateString?: string): DocumentStatus => {
  if (!expiryDateString) return "No Expiry";
  try {
    const expiry = parseISO(expiryDateString);
    if (!isValid(expiry)) return "No Expiry"; 
    
    if (isPast(expiry)) return "Expired";
    
    const daysUntilExpiry = differenceInDays(expiry, new Date());
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) return "Expiring Soon";
    
    return "Valid";
  } catch {
    return "No Expiry"; 
  }
};

const getStatusBadgeVariant = (status: DocumentStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Expired": return "destructive";
    case "Expiring Soon": return "secondary"; 
    case "Valid": return "default";
    case "No Expiry": return "outline";
    default: return "outline";
  }
};

const getStatusIcon = (status: DocumentStatus) => {
  switch (status) {
    case "Expired": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "Expiring Soon": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "Valid": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "No Expiry": return <FileText className="h-4 w-4 text-muted-foreground" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};


export default function AircraftDocumentsPage() {
  const [allAircraftDocuments, setAllAircraftDocuments] = useState<AircraftDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentDocumentToEdit, setCurrentDocumentToEdit] = useState<AircraftDocument | null>(null);
  const [isSavingDocument, startSavingDocumentTransition] = useTransition();
  
  const [isDeletingDocument, startDeletingDocumentTransition] = useTransition();
  const [documentToDelete, setDocumentToDelete] = useState<AircraftDocument | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [fleetForSelect, setFleetForSelect] = useState<Pick<FleetAircraft, 'id' | 'tailNumber' | 'model'>[]>([]);
  const [isLoadingAircraftForSelect, setIsLoadingAircraftForSelect] = useState(true);
  const [selectedAircraftFilter, setSelectedAircraftFilter] = useState<string>('all');


  const loadPageData = async () => {
    setIsLoadingDocuments(true);
    setIsLoadingAircraftForSelect(true);
    try {
      const [fetchedDocs, fetchedFleet] = await Promise.all([
        fetchAircraftDocuments(),
        fetchFleetAircraft()
      ]);
      setAllAircraftDocuments(fetchedDocs);
      setFleetForSelect(fetchedFleet.map(ac => ({ id: ac.id, tailNumber: ac.tailNumber, model: ac.model })));
    } catch (error) {
      console.error("Failed to load aircraft documents or fleet:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoadingDocuments(false);
      setIsLoadingAircraftForSelect(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []); 

  const filteredDocuments = useMemo(() => {
    return allAircraftDocuments.filter(doc => {
        const matchesAircraft = selectedAircraftFilter === 'all' || doc.aircraftId === selectedAircraftFilter;
        if (!matchesAircraft) return false;

        if (!searchTerm) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
            doc.documentName.toLowerCase().includes(lowerSearchTerm) ||
            doc.documentType.toLowerCase().includes(lowerSearchTerm) ||
            (doc.aircraftTailNumber && doc.aircraftTailNumber.toLowerCase().includes(lowerSearchTerm)) ||
            (doc.notes && doc.notes.toLowerCase().includes(lowerSearchTerm))
        );
    });
  }, [allAircraftDocuments, searchTerm, selectedAircraftFilter]);


  const handleOpenAddModal = () => {
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
        const dataToSave = { ...data, id: originalDocumentId };
        const savedData = await saveAircraftDocument(dataToSave);
        toast({
          title: isEditingModal ? "Document Updated" : "Document Added",
          description: `Aircraft document "${savedData.documentName}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadPageData(); 
      } catch (error) {
        console.error("Failed to save aircraft document:", error);
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
        await loadPageData(); 
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

  const DocumentListItem = ({ doc }: { doc: AircraftDocument }) => {
    const status = getDocumentStatus(doc.expiryDate); 
    return (
      <div className="flex flex-col sm:flex-row items-start justify-between py-3 px-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-sm group">
        <div className="flex items-start gap-3 flex-1 min-w-0 mb-2 sm:mb-0">
          {getStatusIcon(status)}
          <div className="truncate flex-grow">
            <p className="text-sm font-semibold text-foreground truncate" title={doc.documentName}>{doc.documentName}</p>
            <p className="text-xs text-muted-foreground">
              Type: {doc.documentType} | For: {doc.aircraftTailNumber || doc.aircraftId}
               <Badge variant={getStatusBadgeVariant(status)} className="ml-2 text-xs px-1.5 py-0">{status}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
                Expires: {formatDateForDisplay(doc.expiryDate)}
                {doc.notes && <span className="truncate" title={doc.notes}> | Notes: {doc.notes.substring(0,30)}{doc.notes.length > 30 ? '...' : ''}</span>}
            </p>
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
  }

  return (
    <>
      <PageHeader 
        title="Aircraft Document Management"
        description="Manage and track all aircraft-specific documents like registration, airworthiness, and insurance."
        icon={Plane}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoadingDocuments || isLoadingAircraftForSelect}>
            <UploadCloud className="mr-2 h-4 w-4" /> Add Aircraft Document
          </Button>
        }
      />
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Aircraft Documents</CardTitle>
          <CardDescription>Central repository for aircraft documentation. (File uploads are simulated)</CardDescription>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
             <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search documents (name, type, tail#, notes)..." 
                  className="pl-8 w-full" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoadingDocuments || (allAircraftDocuments.length === 0 && !searchTerm)}
                />
              </div>
              <Select
                value={selectedAircraftFilter}
                onValueChange={setSelectedAircraftFilter}
                disabled={isLoadingAircraftForSelect || isLoadingDocuments}
              >
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder={isLoadingAircraftForSelect ? "Loading aircraft..." : "Filter by Aircraft"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aircraft</SelectItem>
                  {fleetForSelect.map(ac => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.tailNumber} - {ac.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingDocuments && allAircraftDocuments.length === 0 ? ( 
            <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {searchTerm || selectedAircraftFilter !== 'all' ? "No documents match your criteria." : "No aircraft documents found. Add one to get started."}
            </p>
          ) : (
            filteredDocuments.map(doc => <DocumentListItem key={doc.id} doc={doc} />)
          )}
        </CardContent>
      </Card>

      <AddEditAircraftDocumentModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveDocument}
        initialData={currentDocumentToEdit}
        isEditing={isEditingModal}
        isSaving={isSavingDocument}
        aircraftList={fleetForSelect}
        isLoadingAircraft={isLoadingAircraftForSelect}
        selectedAircraftIdForNew={selectedAircraftFilter === 'all' ? undefined : selectedAircraftFilter}
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

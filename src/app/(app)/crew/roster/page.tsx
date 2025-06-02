
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users2, PlusCircle, Edit3, Trash2, Search, CheckCircle2, XCircle as XCircleIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
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

import { fetchCrewMembers, saveCrewMember, deleteCrewMember } from '@/ai/flows/manage-crew-flow';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import { AddEditCrewMemberModal, type CrewMemberFormData } from './components/add-edit-crew-member-modal';
import { useToast } from '@/hooks/use-toast';

export default function CrewRosterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentCrewForModal, setCurrentCrewForModal] = useState<CrewMember | null>(null);
  const [isSavingCrew, startSavingCrewTransition] = useTransition();
  
  const [isDeletingCrew, startDeletingCrewTransition] = useTransition();
  const [crewToDelete, setCrewToDelete] = useState<CrewMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadCrewMembers = async () => {
    setIsLoading(true);
    try {
      const fetchedCrew = await fetchCrewMembers();
      setCrewList(fetchedCrew);
    } catch (error) {
      console.error("Failed to load crew members:", error);
      toast({ title: "Error Loading Crew", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCrewMembers();
  }, []);

  const handleOpenAddModal = () => {
    setIsEditingModal(false);
    setCurrentCrewForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (crewMember: CrewMember) => {
    setIsEditingModal(true);
    setCurrentCrewForModal(crewMember);
    setIsModalOpen(true);
  };

  const handleSaveCrew = async (data: SaveCrewMemberInput) => {
    startSavingCrewTransition(async () => {
      try {
        const savedData = await saveCrewMember(data);
        toast({
          title: isEditingModal ? "Crew Member Updated" : "Crew Member Added",
          description: `Crew member "${savedData.firstName} ${savedData.lastName}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadCrewMembers(); 
      } catch (error) {
        console.error("Failed to save crew member:", error);
        toast({
          title: "Error Saving Crew Member",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteClick = (crewMember: CrewMember) => {
    setCrewToDelete(crewMember);
    setShowDeleteConfirm(true);
  };

  const executeDeleteCrew = async () => {
    if (!crewToDelete) return;
    startDeletingCrewTransition(async () => {
      try {
        await deleteCrewMember({ crewMemberId: crewToDelete.id });
        toast({ title: "Crew Member Deleted", description: `Crew member "${crewToDelete.firstName} ${crewToDelete.lastName}" has been removed.` });
        setShowDeleteConfirm(false);
        setCrewToDelete(null);
        await loadCrewMembers(); 
      } catch (error) {
        console.error("Failed to delete crew member:", error);
        toast({ title: "Error Deleting Crew Member", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setCrewToDelete(null);
      }
    });
  };

  const filteredCrewList = useMemo(() => {
    if (!searchTerm) return crewList;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return crewList.filter(crew =>
      `${crew.firstName} ${crew.lastName}`.toLowerCase().includes(lowerSearchTerm) ||
      (crew.role && crew.role.toLowerCase().includes(lowerSearchTerm)) ||
      (crew.employeeId && crew.employeeId.toLowerCase().includes(lowerSearchTerm)) ||
      (crew.homeBase && crew.homeBase.toLowerCase().includes(lowerSearchTerm))
    );
  }, [searchTerm, crewList]);

  return (
    <TooltipProvider>
      <PageHeader 
        title="Crew Roster Management" 
        description="View, add, and manage crew member information from Firestore."
        icon={Users2}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Crew Member
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Crew Members</CardTitle>
          <CardDescription>Browse and manage your crew roster.</CardDescription>
           <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search crew (name, role, ID, base)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading || crewList.length === 0 && !searchTerm}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading crew members from Firestore...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Home Base</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrewList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No crew members found{crewList.length > 0 && searchTerm ? " matching your search" : ". Add a crew member to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCrewList.map((crew) => (
                    <TableRow key={crew.id}>
                      <TableCell className="font-medium">{`${crew.firstName} ${crew.lastName}`}</TableCell>
                      <TableCell><Badge variant="outline">{crew.role}</Badge></TableCell>
                      <TableCell>{crew.employeeId || '-'}</TableCell>
                      <TableCell>{crew.email || '-'}</TableCell>
                      <TableCell>{crew.phone || '-'}</TableCell>
                      <TableCell>{crew.homeBase || '-'}</TableCell>
                      <TableCell className="text-center">
                        {crew.isActive ? 
                          <Tooltip>
                            <TooltipTrigger asChild><CheckCircle2 className="h-5 w-5 text-green-500 inline-block cursor-default" /></TooltipTrigger>
                            <TooltipContent><p>Active</p></TooltipContent>
                          </Tooltip>
                           : 
                          <Tooltip>
                            <TooltipTrigger asChild><XCircleIcon className="h-5 w-5 text-red-500 inline-block cursor-default" /></TooltipTrigger>
                            <TooltipContent><p>Inactive</p></TooltipContent>
                          </Tooltip>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-1" onClick={() => handleOpenEditModal(crew)}>
                              <Edit3 className="h-4 w-4" />
                              <span className="sr-only">Edit Crew Member</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Crew Member</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(crew)} disabled={isDeletingCrew && crewToDelete?.id === crew.id}>
                                {isDeletingCrew && crewToDelete?.id === crew.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Delete Crew Member</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Crew Member</p></TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditCrewMemberModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveCrew}
        initialData={currentCrewForModal}
        isEditing={isEditingModal}
        isSaving={isSavingCrew}
      />

      {showDeleteConfirm && crewToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete crew member "{`${crewToDelete.firstName} ${crewToDelete.lastName}`}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingCrew}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteCrew} disabled={isDeletingCrew}>
                {isDeletingCrew && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}

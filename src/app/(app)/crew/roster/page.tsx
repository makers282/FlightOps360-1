
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Users2, UserPlus, Loader2, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { fetchCrewMembers, saveCrewMember, deleteCrewMember } from '@/ai/flows/manage-crew-flow';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import { AddEditCrewMemberModal } from './components/add-edit-crew-member-modal';
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

export default function CrewRosterPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const [currentCrewMember, setCurrentCrewMember] = useState<CrewMember | null>(null);
  const [crewToDelete, setCrewToDelete] = useState<CrewMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenNewModal = () => {
    setIsEditing(false);
    setCurrentCrewMember(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (crewMember: CrewMember) => {
    setIsEditing(true);
    setCurrentCrewMember(crewMember);
    setIsModalOpen(true);
  };

  const handleSave = (data: SaveCrewMemberInput) => {
    startSavingTransition(async () => {
        try {
            await saveCrewMember(data);
            toast({ title: "Success", description: `Crew member ${isEditing ? 'updated' : 'added'}.`});
            setIsModalOpen(false);
            await loadCrewMembers();
        } catch (error) {
            console.error("Failed to save crew member:", error);
            toast({ title: "Error", description: `Could not save crew member. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
        }
    });
  };

  const handleDelete = (crewMember: CrewMember) => {
    setCrewToDelete(crewMember);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!crewToDelete) return;
    startDeletingTransition(async () => {
        try {
            await deleteCrewMember({ crewMemberId: crewToDelete.id });
            toast({ title: "Success", description: `${crewToDelete.firstName} ${crewToDelete.lastName} has been deleted.` });
            await loadCrewMembers();
        } catch (error) {
            console.error("Failed to delete crew member:", error);
            toast({ title: "Error", description: `Could not delete crew member. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
        } finally {
            setShowDeleteConfirm(false);
            setCrewToDelete(null);
        }
    });
  };
  
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'N/A';
  };

  return (
    <>
      <PageHeader 
        title="Crew Roster Management" 
        description="View, add, and manage all crew members in the system."
        icon={Users2}
        actions={
          <Button onClick={handleOpenNewModal}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Crew Member
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Crew Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading crew members...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Home Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No crew members found. Add one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  crewList.map((crew) => (
                    <TableRow key={crew.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(crew.firstName, crew.lastName)}</AvatarFallback>
                          </Avatar>
                          {`${crew.firstName} ${crew.lastName}`}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{crew.role}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm">{crew.email || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{crew.phone || 'N/A'}</div>
                      </TableCell>
                      <TableCell>{crew.homeBase || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={crew.isActive ? 'default' : 'secondary'} className={crew.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                          {crew.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(crew)}>
                           <Edit3 className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(crew)} disabled={isDeleting && crewToDelete?.id === crew.id}>
                            {isDeleting && crewToDelete?.id === crew.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                         </Button>
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
        onSave={handleSave}
        isSaving={isSaving}
        isEditing={isEditing}
        initialData={currentCrewMember}
      />
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the record for {crewToDelete?.firstName} {crewToDelete?.lastName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

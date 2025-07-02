
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Users2, UserPlus, Loader2, Edit3, Trash2, UserCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { fetchCrewMembers, deleteCrewMember } from '@/ai/flows/manage-crew-flow';
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';
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

interface CrewRosterSummary {
    totalCrew: number;
    onboardingComplete: number;
    onboardingPending: number;
}

export default function CrewRosterPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, startDeletingTransition] = useTransition();
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

  const summaryData = useMemo<CrewRosterSummary>(() => {
    return {
      totalCrew: crewList.length,
      onboardingComplete: crewList.filter(c => c.onboardingStatus === 'Completed').length,
      onboardingPending: crewList.filter(c => c.onboardingStatus === 'Pending').length,
    };
  }, [crewList]);


  return (
    <>
      <PageHeader 
        title="Crew Roster & Onboarding" 
        description="View all crew members and manage their onboarding status."
        icon={Users2}
        actions={
          <Button asChild>
            <Link href="/settings/users">
              <UserPlus className="mr-2 h-4 w-4" /> Add User / Crew
            </Link>
          </Button>
        }
      />
      
      <div className="grid gap-6 mb-6 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Crew Members</CardTitle><Users2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.totalCrew}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Onboarding Complete</CardTitle><UserCheck className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.onboardingComplete}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Onboarding Pending</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.onboardingPending}</div></CardContent></Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Crew Roster</CardTitle>
          <CardDescription>All crew members linked from the User Management system.</CardDescription>
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
                  <TableHead>Onboarding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No crew members found. Add a user with a "Flight Crew" role to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  crewList.map((crew) => (
                    <TableRow key={crew.id} className={crew.onboardingStatus === 'Pending' ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : ''}>
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
                         <Badge variant={crew.onboardingStatus === 'Completed' ? 'default' : 'secondary'} className={crew.onboardingStatus === 'Completed' ? "bg-green-500 hover:bg-green-600" : "bg-yellow-500 hover:bg-yellow-600"}>
                          {crew.onboardingStatus === 'Pending' ? 'Attention Needed' : 'Complete'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {crew.onboardingStatus === 'Pending' ? (
                          <Button asChild>
                            <Link href={`/crew/onboarding/${crew.id}`}>
                              <UserCheck className="mr-2 h-4 w-4" /> Complete Onboarding
                            </Link>
                          </Button>
                        ) : (
                           <Button variant="outline" asChild>
                             <Link href={`/crew/documents?crewMemberId=${crew.id}`}>
                                View Profile
                             </Link>
                           </Button>
                        )}
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
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the crew record for {crewToDelete?.firstName} {crewToDelete?.lastName}. This action cannot be undone. To remove their system access, delete them from User Management.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Delete Crew Record
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

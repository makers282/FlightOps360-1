
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Users2, UserPlus, Loader2, Edit3, Trash2, UserCheck, AlertTriangle, CheckCircle, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchCrewMembers, deleteCrewMember, saveCrewMember } from '@/ai/flows/manage-crew-flow';
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
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

interface CrewRosterSummary {
    totalCrew: number;
    onboardingComplete: number;
    onboardingPending: number;
}

export default function CrewRosterPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [isAddingCrew, startAddingCrewTransition] = useTransition();
  const [crewToDelete, setCrewToDelete] = useState<CrewMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

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
  
  const handleAddNewCrewMember = () => {
    startAddingCrewTransition(async () => {
      try {
        const newCrewMember = await saveCrewMember({
          firstName: "New",
          lastName: "Crew Member",
          isActive: true,
          onboardingStatus: 'Pending',
        });
        toast({ title: "New Crew Profile Created", description: "Redirecting to onboarding wizard..." });
        router.push(`/crew/onboarding/${newCrewMember.id}`);
      } catch (error) {
        console.error("Failed to create new crew member:", error);
        toast({ title: "Error", description: "Could not create a new crew member profile.", variant: "destructive" });
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

  const summaryData = useMemo<CrewRosterSummary>(() => {
    return {
      totalCrew: crewList.length,
      onboardingComplete: crewList.filter(c => c.onboardingStatus === 'Completed').length,
      onboardingPending: crewList.filter(c => c.onboardingStatus === 'Pending').length,
    };
  }, [crewList]);

  const filteredCrewList = useMemo(() => {
    if (!searchTerm) return crewList;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return crewList.filter(crew => 
        (crew.firstName?.toLowerCase().includes(lowerSearchTerm)) ||
        (crew.lastName?.toLowerCase().includes(lowerSearchTerm)) ||
        (crew.email?.toLowerCase().includes(lowerSearchTerm)) ||
        (crew.onboardingData?.roles?.some(role => role.toLowerCase().includes(lowerSearchTerm)))
    );
  }, [crewList, searchTerm]);


  return (
    <>
      <PageHeader 
        title="Crew Roster & Onboarding" 
        description="View all crew members and manage their onboarding status."
        icon={Users2}
        actions={
          <Button onClick={handleAddNewCrewMember} disabled={isAddingCrew}>
            {isAddingCrew ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} 
            Add Crew Member
          </Button>
        }
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="flex items-center p-4">
            <Users2 className="h-8 w-8 text-primary mr-4" />
            <div>
                <div className="text-2xl font-bold">{summaryData.totalCrew}</div>
                <p className="text-sm text-muted-foreground">Total Crew Members</p>
            </div>
        </Card>
        <Card className="flex items-center p-4">
            <UserCheck className="h-8 w-8 text-green-500 mr-4" />
            <div>
                <div className="text-2xl font-bold">{summaryData.onboardingComplete}</div>
                <p className="text-sm text-muted-foreground">Onboarding Complete</p>
            </div>
        </Card>
        <Card className="flex items-center p-4">
            <Clock className="h-8 w-8 text-orange-500 mr-4" />
            <div>
                <div className="text-2xl font-bold">{summaryData.onboardingPending}</div>
                <p className="text-sm text-muted-foreground">Pending Onboarding</p>
            </div>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Crew Roster ({summaryData.totalCrew})</CardTitle>
          <div className="mt-4 relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search crew members by name, email, or role..." 
                className="pl-8 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={isLoading}
             />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading crew members...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Crew Member</TableHead>
                  <TableHead className="px-4 py-3">Roles</TableHead>
                  <TableHead className="px-4 py-3">Onboarding Status</TableHead>
                  <TableHead className="px-4 py-3">Date Added</TableHead>
                  <TableHead className="px-4 py-3">Last Activity</TableHead>
                  <TableHead className="text-right px-4 py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrewList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No crew members found. Click "Add Crew Member" to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCrewList.map((crew) => (
                    <TableRow key={crew.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={`https://placehold.co/40x40.png?text=${getInitials(crew.firstName, crew.lastName)}`} alt={`${crew.firstName} ${crew.lastName}`} />
                            <AvatarFallback>{getInitials(crew.firstName, crew.lastName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-base font-semibold text-foreground">{`${crew.firstName} ${crew.lastName}`}</p>
                            <p className="text-sm text-muted-foreground">{crew.email || 'No email'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                            {(crew.onboardingData?.roles || []).map(role => (
                                <Badge key={role} variant="outline">{role}</Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {crew.onboardingStatus === 'Completed' ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                                <CheckCircle className="mr-1 h-3.5 w-3.5"/> Complete
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                                <AlertTriangle className="mr-1 h-3.5 w-3.5"/> Attention Needed
                            </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {crew.createdAt && isValid(parseISO(crew.createdAt)) ? format(parseISO(crew.createdAt), 'yyyy-MM-dd') : 'N/A'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {crew.updatedAt && isValid(parseISO(crew.updatedAt)) ? formatDistanceToNow(parseISO(crew.updatedAt), { addSuffix: true }) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right px-4 py-3">
                        {crew.onboardingStatus === 'Pending' ? (
                          <Button asChild>
                            <Link href={`/crew/onboarding/${crew.id}`}>
                                Complete Onboarding
                            </Link>
                          </Button>
                        ) : (
                           <Button variant="outline" asChild>
                             <Link href={`/crew/onboarding/${crew.id}`}>
                                View Profile
                             </Link>
                           </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
        {summaryData.onboardingPending > 0 && (
            <CardFooter>
                 <Alert variant="destructive" className="border-l-4 border-orange-500 bg-orange-50 text-orange-800 [&>svg]:text-orange-600 dark:bg-orange-900/20 dark:text-orange-300 dark:[&>svg]:text-orange-400 mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-bold">
                        {summaryData.onboardingPending} crew member(s) need to complete onboarding
                    </AlertTitle>
                    <AlertDescription>
                        Complete their onboarding to ensure full compliance and system access.
                    </AlertDescription>
                </Alert>
            </CardFooter>
        )}
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


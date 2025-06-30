
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users2, AlertTriangle, CheckCircle2, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { fetchCrewMembers } from '@/ai/flows/manage-crew-flow';
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';

export default function CrewRosterPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const summaryData = useMemo(() => {
    const totalCrew = crewList.length;
    const pendingOnboarding = crewList.filter(c => c.onboardingStatus !== 'Completed').length;
    const completedOnboarding = totalCrew - pendingOnboarding;
    return { totalCrew, pendingOnboarding, completedOnboarding };
  }, [crewList]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'N/A';
  };

  return (
    <>
      <PageHeader 
        title="Crew Roster Management" 
        description="View and manage all crew members and their onboarding status."
        icon={Users2}
        actions={
          <Button asChild>
            <Link href="/settings/users">
              <UserPlus className="mr-2 h-4 w-4" /> Add User / Crew
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Crew Members</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.totalCrew}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Onboarding Complete</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summaryData.completedOnboarding}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Pending Onboarding</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{summaryData.pendingOnboarding}</div></CardContent></Card>
      </div>

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
                  <TableHead>Onboarding Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                      No crew members found. Add a user with the 'Flight Crew' role to begin.
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
                        {crew.onboardingStatus === 'Completed' ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Attention Needed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {crew.onboardingStatus !== 'Completed' ? (
                          <Button asChild>
                            <Link href={`/crew/onboarding/${crew.id}`}>Complete Onboarding</Link>
                          </Button>
                        ) : (
                          <Button variant="outline" asChild>
                             <Link href={`/crew/onboarding/${crew.id}`}>View/Edit Profile</Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {summaryData.pendingOnboarding > 0 && (
         <Card className="mt-6 border-destructive">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle/>Pending Onboarding</CardTitle>
            </CardHeader>
            <CardContent>
                <p>There are <strong className="font-bold">{summaryData.pendingOnboarding} crew members</strong> that require onboarding to be completed.</p>
                <ul className="list-disc pl-5 mt-2 text-sm">
                    {crewList.filter(c => c.onboardingStatus !== 'Completed').map(crew => (
                        <li key={crew.id}>
                            <Link href={`/crew/onboarding/${crew.id}`} className="text-primary hover:underline">
                                {crew.firstName} {crew.lastName}
                            </Link>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
      )}
    </>
  );
}

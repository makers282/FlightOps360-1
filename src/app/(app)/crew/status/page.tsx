
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';

const getStatusBadgeVariant = (isActive: boolean): "default" | "destructive" => {
  return isActive ? 'default' : 'destructive';
};

const getStatusLabel = (isActive: boolean): string => {
  return isActive ? 'Active' : 'Inactive';
};

export default function CrewStatusPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const loadCrew = async () => {
      setIsLoading(true);
      try {
        const fetchedCrew = await fetchCrewMembers();
        setCrewList(fetchedCrew);
      } catch (error) {
        console.error("Failed to load crew members:", error);
        toast({
          title: "Error Loading Crew",
          description: error instanceof Error ? error.message : "Could not fetch crew data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadCrew();
  }, [toast]);

  const filteredCrewList = useMemo(() => {
    if (!searchTerm) {
      return crewList;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return crewList.filter(crew =>
      `${crew.firstName} ${crew.lastName}`.toLowerCase().includes(lowerSearchTerm) ||
      crew.role.toLowerCase().includes(lowerSearchTerm) ||
      (crew.isActive ? "active" : "inactive").includes(lowerSearchTerm) ||
      (crew.homeBase && crew.homeBase.toLowerCase().includes(lowerSearchTerm))
    );
  }, [searchTerm, crewList]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'N/A';
  };
  
  // Placeholder assignment logic for demonstration
  const getAssignment = (crewId: string) => {
    const assignments = [
        "FL123 (KMIA)", "KHPN Base", "-", "N789EF Hangar 3", "KTEB Base", "FL456 (KORD)",
        "Training Sim", "Vacation", "Medical Leave"
    ];
    // Simple pseudo-random assignment based on ID for visual variety
    let hash = 0;
    for (let i = 0; i < crewId.length; i++) {
        hash = crewId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return assignments[Math.abs(hash) % assignments.length] || "-";
  }


  return (
    <>
      <PageHeader 
        title="Crew Status" 
        description="View current status and assignments of all crew members."
        icon={Users}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Crew Members</CardTitle>
          <CardDescription>Monitor availability and assignments in real-time. (Assignments are illustrative)</CardDescription>
          <div className="mt-4 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search crew (name, role, status, base)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading && crewList.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading crew status...</p>
            </div>
          ) : !crewList.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-2" />
              <p className="text-lg font-medium">No Crew Data Found</p>
              <p className="text-sm">There are no crew members in the system yet.</p>
            </div>
          ) : filteredCrewList.length === 0 && searchTerm ? (
             <div className="text-center py-10 text-muted-foreground">
              <Search className="mx-auto h-12 w-12 mb-2" />
              <p className="text-lg font-medium">No Crew Members Found</p>
              <p className="text-sm">Your search for "{searchTerm}" did not match any crew members.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCrewList.map((crew) => (
                <Card key={crew.id} className="hover:shadow-md transition-shadow flex flex-col">
                  <CardContent className="p-4 flex flex-col items-center text-center flex-grow">
                    <Avatar className="h-20 w-20 mb-3">
                      {/* Placeholder for actual avatar URLs when available */}
                      <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(crew.firstName, crew.lastName)}`} alt={`${crew.firstName} ${crew.lastName}`} data-ai-hint="person portrait professional" />
                      <AvatarFallback>{getInitials(crew.firstName, crew.lastName)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-lg">{crew.firstName} {crew.lastName}</p>
                    <p className="text-sm text-muted-foreground">{crew.role}</p>
                    <Badge variant={getStatusBadgeVariant(crew.isActive)} className="mt-2 capitalize">{getStatusLabel(crew.isActive)}</Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      {crew.homeBase && `Base: ${crew.homeBase}`}
                    </p>
                  </CardContent>
                  <div className="border-t p-3 bg-muted/50 text-center">
                     <p className="text-xs font-medium text-muted-foreground">Current Assignment:</p>
                     <p className="text-sm text-foreground truncate" title={getAssignment(crew.id)}>{getAssignment(crew.id)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

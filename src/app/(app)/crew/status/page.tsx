
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Loader2, Plane, Ban, CalendarOff, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { isWithinInterval, parseISO, endOfDay, format } from 'date-fns';
import { fetchCrewBlockOuts, type CrewBlockOut } from '@/ai/flows/manage-crew-block-outs-flow';


interface CrewWithStatus extends CrewMember {
  status: string; // Made generic to hold trip ID or block-out reason
  statusDetails: string;
  statusVariant: "default" | "destructive" | "secondary" | "outline";
  statusIcon: React.ElementType;
}

export default function CrewStatusPage() {
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [blockOuts, setBlockOuts] = useState<CrewBlockOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedCrew, fetchedTrips, fetchedBlockOuts] = await Promise.all([
        fetchCrewMembers(),
        fetchTrips(),
        fetchCrewBlockOuts(),
      ]);
      setCrewList(fetchedCrew);
      setTrips(fetchedTrips);
      setBlockOuts(fetchedBlockOuts);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error Loading Data",
        description: error instanceof Error ? error.message : "Could not fetch crew and trip data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const crewWithStatus = useMemo<CrewWithStatus[]>(() => {
    const now = new Date();
    return crewList.map(crew => {
      if (!crew.isActive) {
        return { 
          ...crew, 
          status: 'Inactive', 
          statusDetails: 'Not on active duty roster',
          statusVariant: 'destructive',
          statusIcon: Ban
        };
      }
      
      const activeBlockOut = blockOuts.find(bo => 
        bo.crewMemberId === crew.id &&
        isWithinInterval(now, { start: parseISO(bo.startDate), end: endOfDay(parseISO(bo.endDate)) })
      );

      if (activeBlockOut) {
          return {
              ...crew,
              status: activeBlockOut.reason, // e.g., "Training", "Medical Leave"
              statusDetails: `Blocked out until ${format(parseISO(activeBlockOut.endDate), 'MM/dd/yy')}`,
              statusVariant: 'secondary', // Grayish/neutral color for block-outs
              statusIcon: CalendarOff,
          };
      }


      const assignedTrip = trips.find(trip => {
        const isAssigned = trip.assignedPilotId === crew.id || 
                           trip.assignedCoPilotId === crew.id || 
                           trip.assignedFlightAttendantIds?.includes(crew.id);
        return isAssigned && trip.status === 'Released';
      });

      if (assignedTrip) {
         const route = (assignedTrip.legs && assignedTrip.legs.length > 0) 
            ? `${assignedTrip.legs[0].origin} ➔ ${assignedTrip.legs[assignedTrip.legs.length - 1].destination}` 
            : 'N/A';
        return {
          ...crew,
          status: 'On Trip',
          statusDetails: `Assigned to Trip ${assignedTrip.tripId} (${route})`,
          statusVariant: 'secondary',
          statusIcon: Plane
        };
      }
      
      return {
        ...crew,
        status: 'Available',
        statusDetails: 'On Standby',
        statusVariant: 'default',
        statusIcon: CheckCircle2
      };
    });
  }, [crewList, trips, blockOuts]);


  const filteredCrewList = useMemo(() => {
    if (!searchTerm) {
      return crewWithStatus;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return crewWithStatus.filter(crew =>
      `${crew.firstName} ${crew.lastName}`.toLowerCase().includes(lowerSearchTerm) ||
      (crew.onboardingData?.roles?.some(role => role.toLowerCase().includes(lowerSearchTerm))) ||
      crew.status.toLowerCase().includes(lowerSearchTerm) ||
      (crew.homeBase && crew.homeBase.toLowerCase().includes(lowerSearchTerm))
    );
  }, [searchTerm, crewWithStatus]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'N/A';
  };

  return (
    <>
      <PageHeader 
        title="Crew Status Board" 
        description="Real-time overview of crew availability based on trip assignments and scheduled block-outs."
        icon={Users}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Crew Members</CardTitle>
          <CardDescription>Monitor availability and current assignments.</CardDescription>
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
                      <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(crew.firstName, crew.lastName)}`} alt={`${crew.firstName} ${crew.lastName}`} data-ai-hint="pilot portrait professional" />
                      <AvatarFallback>{getInitials(crew.firstName, crew.lastName)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-lg">{crew.firstName} {crew.lastName}</p>
                    <p className="text-sm text-muted-foreground">{crew.onboardingData?.roles?.join(', ') || 'No role assigned'}</p>
                     <p className="text-xs text-muted-foreground mt-2">
                      {crew.homeBase && `Base: ${crew.homeBase}`}
                    </p>
                  </CardContent>
                  <div className={`border-t p-3 text-center ${crew.statusVariant === 'default' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                     <div className="flex items-center justify-center gap-2">
                       <crew.statusIcon className={`h-5 w-5 ${crew.statusVariant === 'default' ? 'text-green-500' : crew.statusVariant === 'destructive' ? 'text-red-500' : 'text-muted-foreground' }`} />
                       <p className="font-bold text-sm">{crew.status}</p>
                     </div>
                     <p className="text-xs text-muted-foreground truncate" title={crew.statusDetails}>{crew.statusDetails}</p>
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

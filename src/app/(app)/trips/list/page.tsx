
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Search, Eye, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow'; // Import fetchTrips and Trip type
import { useToast } from '@/hooks/use-toast'; // Import useToast

const getStatusBadgeVariant = (status?: Trip['status']): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'confirmed': // Assuming 'Confirmed' is a positive status
      return 'default';
    case 'en route':
      return 'secondary';
    case 'scheduled':
    case 'awaiting closeout': // (If this is a status for trips)
      return 'outline';
    case 'cancelled':
    case 'diverted': // Assuming 'Diverted' is a problematic status
      return 'destructive';
    default:
      return 'default';
  }
};

export default function TripListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    const loadTrips = async () => {
      setIsLoading(true);
      try {
        const fetchedTrips = await fetchTrips();
        setTrips(fetchedTrips);
      } catch (error) {
        console.error("Failed to load trips:", error);
        toast({ title: "Error Loading Trips", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadTrips();
  }, [toast]);

  const filteredTrips = useMemo(() => {
    if (!searchTerm) return trips;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return trips.filter(trip => 
      (trip.tripId && trip.tripId.toLowerCase().includes(lowerSearchTerm)) ||
      (trip.clientName && trip.clientName.toLowerCase().includes(lowerSearchTerm)) ||
      (trip.aircraftLabel && trip.aircraftLabel.toLowerCase().includes(lowerSearchTerm)) ||
      (trip.status && trip.status.toLowerCase().includes(lowerSearchTerm)) ||
      (trip.legs && trip.legs.length > 0 && 
        `${trip.legs[0].origin || 'N/A'} -> ${trip.legs[trip.legs.length - 1].destination || 'N/A'}`.toLowerCase().includes(lowerSearchTerm))
    );
  }, [searchTerm, trips]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MM/dd/yyyy HH:mm zz') : 'Invalid Date';
    } catch (e) {
      return 'Invalid Date Format';
    }
  };
  
  const getRouteDisplay = (legs: Trip['legs']) => {
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    if (legs.length === 1) return `${origin} -> ${destination}`;
    return `${origin} -> ... -> ${destination} (${legs.length} legs)`;
  };

  return (
    <>
      <PageHeader
        title="Trip List View"
        description="View all trips in a filterable and sortable list format. Data from Firestore."
        icon={ListChecks}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Trips</CardTitle>
          <CardDescription>Browse and manage all scheduled and completed trips.</CardDescription>
          <div className="mt-4 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search trips (ID, client, route, aircraft, status)..." 
              className="pl-8 w-full md:w-1/2 lg:w-1/3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading trips from Firestore...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Departure (First Leg)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No trips found{searchTerm && trips.length > 0 ? " matching your search" : (trips.length === 0 ? ". No trips in the system yet." : "")}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-medium">{trip.tripId || trip.id}</TableCell>
                      <TableCell>{trip.clientName || 'N/A'}</TableCell>
                      <TableCell>{getRouteDisplay(trip.legs)}</TableCell>
                      <TableCell>{trip.aircraftLabel || trip.aircraftId}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(trip.status)}>{trip.status}</Badge>
                      </TableCell>
                      <TableCell>{isMounted ? formatDate(trip.legs?.[0]?.departureDateTime) : "Loading..."}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" disabled> {/* Link to trip details page later */}
                          <span className="cursor-not-allowed"><Eye className="mr-2 h-4 w-4" /> View</span>
                          {/* <Link href={`/trips/details/${trip.id}`}> 
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Link> */}
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
    </>
  );
}

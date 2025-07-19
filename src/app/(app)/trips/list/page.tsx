
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ListChecks, Search, Eye, Loader2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fetchTrips, deleteTrip, type Trip } from '@/ai/flows/manage-trips-flow'; 
import { useToast } from '@/hooks/use-toast'; 

// Handles standard, non-custom-colored badges
const getStatusBadgeVariant = (status?: Trip['status']): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'confirmed': 
      return 'secondary'; // Using secondary for blueish states
    case 'en route':
      return 'secondary';
    case 'scheduled':
      return 'outline';
    case 'cancelled':
    case 'diverted': 
      return 'destructive';
    default:
      return 'outline'; 
  }
};

// Returns custom inline styles for specific statuses
const getStatusBadgeStyle = (status?: Trip['status']): React.CSSProperties => {
    const lowerStatus = status?.toLowerCase();

    if (lowerStatus === 'released') {
        return {
          backgroundColor: 'hsl(145 63% 42%)', // Emerald Green
          color: 'hsl(145 60% 95%)',
          borderColor: 'hsl(145 63% 42%)',
        };
    }

    if (lowerStatus === 'awaiting closeout') {
        return {
          backgroundColor: 'hsl(30 80% 50%)', // Amber Orange
          color: 'hsl(30 60% 95%)',
          borderColor: 'hsl(30 80% 50%)',
        };
    }

    return {};
};


export default function TripListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
  
  const handleDeleteClick = (trip: Trip) => {
    setTripToDelete(trip);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tripToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTrip({ id: tripToDelete.id });
      setTrips(prevTrips => prevTrips.filter(q => q.id !== tripToDelete.id));
      toast({
        title: "Trip Deleted",
        description: `Trip #${tripToDelete.tripId} has been successfully deleted.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to delete trip:", error);
      toast({
        title: "Error Deleting Trip",
        description: (error instanceof Error ? error.message : "An unknown error occurred."),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsAlertOpen(false);
      setTripToDelete(null);
    }
  };

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
      return isValid(date) ? format(date, 'MM/dd/yyyy HH:mm') : 'Invalid Date';
    } catch (e) {
      return 'Invalid Date Format';
    }
  };
  
  const getRouteDisplay = (legs: Trip['legs']) => {
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    return <span className="font-mono">{origin} &rarr; {destination}</span>;
  };
  
  const getAircraftTailNumber = (aircraftLabel?: string) => {
    if (!aircraftLabel) return 'N/A';
    return aircraftLabel.split(' - ')[0];
  }

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
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Trip ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[150px]">Route</TableHead>
                    <TableHead className="w-[120px]">Aircraft</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[180px]">Departure</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
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
                      <TableRow key={trip.id} className="whitespace-nowrap">
                        <TableCell className="font-medium">{trip.tripId || trip.id}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{trip.clientName || 'N/A'}</TableCell>
                        <TableCell>{getRouteDisplay(trip.legs)}</TableCell>
                        <TableCell className="font-mono">{getAircraftTailNumber(trip.aircraftLabel)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusBadgeVariant(trip.status)}
                            style={getStatusBadgeStyle(trip.status)}
                          >
                            {trip.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{isMounted ? formatDate(trip.legs?.[0]?.departureDateTime) : "Loading..."}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => router.push(`/trips/details/${trip.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => router.push(`/trips/edit/${trip.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Trip
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDeleteClick(trip)} className="text-red-600 focus:text-red-500">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Trip
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete trip {' '}
              <span className="font-semibold text-foreground">
                #{tripToDelete?.tripId}
              </span>
              {' '} and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, ArrowLeft, Plane, User, CalendarDays, DollarSign, InfoIcon, Edit3, Trash2, Send, Users as CrewIcon, FileText as FileIcon, Package as LoadManifestIcon, Save, PlaneTakeoff } from 'lucide-react';
import { fetchTripById, deleteTrip, saveTrip } from '@/ai/flows/manage-trips-flow';
import type { Trip, TripLeg, TripStatus, SaveTripInput } from '@/ai/schemas/trip-schemas';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { cn } from "@/lib/utils"; // Added missing import

// Helper to get badge variant for status
const getStatusBadgeVariant = (status?: TripStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'completed': case 'confirmed': return 'default';
    case 'en route': return 'secondary';
    case 'scheduled': case 'awaiting closeout': return 'outline';
    case 'cancelled': case 'diverted': return 'destructive';
    default: return 'outline';
  }
};

const formatTimeDecimalToHHMM = (timeDecimal: number | undefined) => {
    if (timeDecimal === undefined || timeDecimal <= 0 || isNaN(timeDecimal)) return "00:00";
    const hours = Math.floor(timeDecimal);
    const minutes = Math.round((timeDecimal - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

function ViewTripLegsSummary({ legs }: { legs: TripLeg[] }) {
  if (!legs || legs.length === 0) return <p className="text-muted-foreground">No legs information available.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Departure</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-center">Pax</TableHead>
          <TableHead className="text-right">Block Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {legs.map((leg, index) => (
          <TableRow key={index}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{leg.legType}</TableCell>
            <TableCell>{leg.departureDateTime && isValid(parseISO(leg.departureDateTime)) ? format(parseISO(leg.departureDateTime), 'MM/dd HH:mm') : 'N/A'}</TableCell>
            <TableCell>{leg.origin}</TableCell>
            <TableCell>{leg.destination}</TableCell>
            <TableCell className="text-center">{leg.passengerCount}</TableCell>
            <TableCell className="text-right">{formatTimeDecimalToHHMM(leg.blockTimeHours)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ViewTripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const tripIdFromParam = params.tripId;
  const id = typeof tripIdFromParam === 'string' ? tripIdFromParam : undefined;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDeleting, startDeletingTransition] = useTransition();
  const [showDeleteConfirm1, setShowDeleteConfirm1] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false);

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editableNotes, setEditableNotes] = useState('');
  const [isSavingNotes, startSavingNotesTransition] = useTransition();

  const [crewRosterDetails, setCrewRosterDetails] = useState<CrewMember[]>([]);
  const [isLoadingCrewRosterDetails, setIsLoadingCrewRosterDetails] = useState(true);
  const [isUpdatingStatus, startUpdatingStatusTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    const loadTripAndCrew = async () => {
      if (!id) {
        setError("No trip ID provided in URL.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tripData = await fetchTripById({ id });
        if (!isMounted) return;

        if (tripData) {
          setTrip(tripData);
          setEditableNotes(tripData.notes || '');

          setIsLoadingCrewRosterDetails(true);
          try {
            const roster = await fetchCrewMembers();
            if (isMounted) {
              setCrewRosterDetails(roster || []); // Ensure roster is an array
            }
          } catch (crewError) {
            if (isMounted) {
              console.error("Failed to fetch crew roster:", crewError);
              toast({ title: "Error Fetching Crew", description: "Could not load crew roster for display.", variant: "destructive" });
              setCrewRosterDetails([]); // Set to empty array on error
            }
          } finally {
            if (isMounted) setIsLoadingCrewRosterDetails(false);
          }
        } else {
          setError("Trip not found.");
          toast({ title: "Error", description: `Trip with ID ${id} not found.`, variant: "destructive" });
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch trip:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
          toast({ title: "Error Fetching Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTripAndCrew();
    return () => { isMounted = false; };
  }, [id, toast]);

  const handleDeleteInitialConfirm = () => {
      setShowDeleteConfirm1(false);
      setShowDeleteConfirm2(true);
  };

  const executeDeleteTrip = () => {
    if (!trip) return;
    startDeletingTransition(async () => {
        try {
            await deleteTrip({ id: trip.id });
            toast({ title: "Trip Deleted", description: `Trip ${trip.tripId} has been successfully deleted.`});
            router.push('/trips/list');
        } catch (err) {
            console.error("Failed to delete trip:", err);
            toast({ title: "Error Deleting Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
        } finally {
            setShowDeleteConfirm2(false);
        }
    });
  };

  const handleSaveNotes = () => {
    if (!trip) return;
    startSavingNotesTransition(async () => {
      const tripDataToSave: Trip = {
        ...trip,
        notes: editableNotes.trim(),
      };
      
      try {
        const { id: tripDocId, createdAt, updatedAt, ...tripSaveData } = tripDataToSave;
        const savedTrip = await saveTrip({ ...tripSaveData, id: tripDocId });
        
        setTrip(savedTrip);
        setEditableNotes(savedTrip.notes || '');
        setIsEditingNotes(false);
        toast({ title: "Notes Saved", description: "Trip notes have been updated." });
      } catch (err) {
        console.error("Failed to save notes:", err);
        toast({ title: "Error Saving Notes", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleMarkAsReleased = () => {
    if (!trip || (trip.status !== "Scheduled" && trip.status !== "Confirmed")) return;
    startUpdatingStatusTransition(async () => {
      const updatedTripData: Trip = {
        ...trip,
        status: "En Route",
      };
      try {
        const { id: tripDocId, createdAt, updatedAt, ...tripSaveData } = updatedTripData;
        const savedTrip = await saveTrip({ ...tripSaveData, id: tripDocId });
        setTrip(savedTrip);
        toast({ title: "Trip Released", description: `Trip ${savedTrip.tripId} is now En Route.`});
      } catch (err) {
        console.error("Failed to mark trip as released:", err);
        toast({ title: "Error Releasing Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const getCrewMemberDisplay = (crewId?: string) => {
    if (!crewId) return "N/A";
    if (isLoadingCrewRosterDetails) return <Loader2 className="h-4 w-4 animate-spin inline-block" />;
    const crewMember = crewRosterDetails.find(c => c.id === crewId);
    return crewMember ? `${crewMember.firstName} ${crewMember.lastName} (${crewMember.role})` : `Unknown (ID: ${crewId})`;
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg text-muted-foreground">Loading trip details...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <>
        <PageHeader title="Error Loading Trip" icon={InfoIcon} />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Trip data could not be loaded."}</p>
            <Button onClick={() => router.push('/trips/list')} variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trip List
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }
  
  const canReleaseTrip = trip.status === "Scheduled" || trip.status === "Confirmed";

  return (
    <>
      <PageHeader
        title={`Trip Details: ${trip.tripId}`}
        description={`Viewing details for trip with ${trip.clientName || 'N/A'}.`}
        icon={Plane}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
                <Link href={`/trips/edit/${trip.id}`}>
                    <Edit3 className="mr-2 h-4 w-4" /> Edit Trip
                </Link>
            </Button>
            <Button 
              variant="default" 
              onClick={handleMarkAsReleased} 
              disabled={!canReleaseTrip || isUpdatingStatus}
              className={cn(canReleaseTrip && "bg-green-600 hover:bg-green-700 text-white")}
            >
              {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlaneTakeoff className="mr-2 h-4 w-4" />}
              Mark as Released
            </Button>
            <Button variant="outline" disabled><Send className="mr-2 h-4 w-4" /> Send Itinerary</Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm1(true)} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Trip
            </Button>
            <Button onClick={() => router.push('/trips/list')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trip List
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><InfoIcon className="h-5 w-5 text-primary" /> Core Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><strong>Trip ID:</strong> {trip.tripId}</p>
            <div><strong>Status:</strong> <Badge variant={getStatusBadgeVariant(trip.status as TripStatus)}>{trip.status}</Badge></div>
            <p><strong>Client:</strong> {trip.clientName}</p>
            {trip.quoteId && <p><strong>Source Quote ID:</strong> <Link href={`/quotes/${trip.quoteId}`} className="text-primary hover:underline">{trip.quoteId}</Link></p>}
            <p><strong>Aircraft:</strong> {trip.aircraftLabel || trip.aircraftId}</p>
            <Separator className="my-3" />
            <p><strong>Created:</strong> {isValid(parseISO(trip.createdAt)) ? format(parseISO(trip.createdAt), 'PPPp') : 'Invalid Date'}</p>
            <p><strong>Last Updated:</strong> {isValid(parseISO(trip.updatedAt)) ? format(parseISO(trip.updatedAt), 'PPPp') : 'Invalid Date'}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Itinerary</CardTitle>
          </CardHeader>
          <CardContent>
            <ViewTripLegsSummary legs={trip.legs} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CrewIcon className="h-5 w-5 text-primary"/>Crew Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Pilot (PIC):</strong> {getCrewMemberDisplay(trip.assignedPilotId)}</p>
            <p><strong>Co-Pilot (SIC):</strong> {getCrewMemberDisplay(trip.assignedCoPilotId)}</p>
            {(trip.assignedFlightAttendantIds && trip.assignedFlightAttendantIds.length > 0) ? (
                trip.assignedFlightAttendantIds.map((faId, index) => (
                    <p key={faId}><strong>Flight Attendant {index + 1}:</strong> {getCrewMemberDisplay(faId)}</p>
                ))
            ) : (
                <p><strong>Flight Attendants:</strong> N/A</p>
            )}
            <Button variant="outline" className="w-full mt-2" asChild>
                <Link href={`/trips/edit/${trip.id}`}>
                    <Edit3 className="mr-2 h-4 w-4" /> Manage Crew Assignment
                </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2"><FileIcon className="h-5 w-5 text-primary"/>Trip Notes</CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-1">Internal notes specific to this trip.</CardDescription>
            </div>
            {!isEditingNotes && (
              <Button variant="outline" size="icon" onClick={() => { setIsEditingNotes(true); setEditableNotes(trip.notes || ''); }}>
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={editableNotes}
                  onChange={(e) => setEditableNotes(e.target.value)}
                  placeholder="Enter notes for this trip..."
                  rows={5}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNotes} disabled={isSavingNotes} size="sm">
                    {isSavingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Notes
                  </Button>
                  <Button variant="ghost" onClick={() => { setIsEditingNotes(false); setEditableNotes(trip.notes || ''); }} disabled={isSavingNotes} size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              trip.notes ? (
                 <div className="p-3 bg-muted/50 rounded-md border text-sm whitespace-pre-wrap">
                    {trip.notes}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No general notes for this trip yet.</p>
              )
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LoadManifestIcon className="h-5 w-5 text-primary"/>Files & Load Manifest</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">Functionality to attach trip-related documents (e.g., signed quotes, permits) and manage the load manifest (pax/cargo details) will be here.</p>
            <Button variant="outline" disabled className="w-full">
                 <LoadManifestIcon className="mr-2 h-4 w-4" /> Manage Manifest & Files
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* First Deletion Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm1} onOpenChange={setShowDeleteConfirm1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip: {trip.tripId}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trip? This action cannot be immediately undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm1(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInitialConfirm} className={buttonVariants({variant: "destructive"})}>Continue Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second (Final) Deletion Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm2} onOpenChange={setShowDeleteConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-6 w-6"/>Final Confirmation: Delete Trip {trip.tripId}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and will remove all data associated with Trip <strong className="text-foreground">{trip.tripId}</strong>.
              Are you absolutely sure you wish to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm2(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeDeleteTrip} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Yes, Delete This Trip Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowLeft, Plane, User, CalendarDays, DollarSign, InfoIcon, Edit3, Trash2, Send, Users as CrewIcon, FileText as FileIcon, Package as LoadManifestIcon, Save, PlaneTakeoff, CheckCircle } from 'lucide-react'; // Added CheckCircle
import { fetchTripById, deleteTrip, saveTrip } from '@/ai/flows/manage-trips-flow';
import type { Trip, TripLeg, TripStatus, SaveTripInput } from '@/ai/schemas/trip-schemas';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { cn } from "@/lib/utils";
import { FlightLogModal } from '../../components/flight-log-modal';
import { FlightLogSummaryCard } from './components/flight-log-summary-card';
import type { FlightLogLeg, FlightLogLegData, SaveFlightLogLegInput } from '@/ai/schemas/flight-log-schemas'; // Ensure SaveFlightLogLegInput is imported
import { saveFlightLogLeg, fetchFlightLogForLeg } from '@/ai/flows/manage-flight-logs-flow';

// Helper to get badge variant for status
const getStatusBadgeVariant = (status?: TripStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'completed': case 'confirmed': return 'default';
    case 'released':
      return 'secondary';
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
  const [isClosingTrip, startClosingTripTransition] = useTransition();

  const [isFlightLogModalOpen, setIsFlightLogModalOpen] = useState(false);
  const [currentLegForLog, setCurrentLegForLog] = useState<{ tripId: string; legIndex: number; origin: string; destination: string; initialData?: FlightLogLegData } | null>(null);
  const [isSavingFlightLog, startSavingFlightLogTransition] = useTransition();
  const [tripFlightLogs, setTripFlightLogs] = useState<Record<number, FlightLogLeg | null>>({});
  const [isLoadingFlightLogs, setIsLoadingFlightLogs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadTripData = async () => {
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

          // Fetch associated flight logs
          setIsLoadingFlightLogs(true);
          const logPromises = tripData.legs.map((leg, index) =>
            fetchFlightLogForLeg({ tripId: tripData.id, legIndex: index })
          );
          const logs = await Promise.all(logPromises);
          if (isMounted) {
            const logsMap: Record<number, FlightLogLeg | null> = {};
            logs.forEach((log, index) => {
              logsMap[index] = log;
            });
            setTripFlightLogs(logsMap);
            setIsLoadingFlightLogs(false);
          }
        } else {
          setError("Trip not found.");
          toast({ title: "Error", description: `Trip with ID ${id} not found.`, variant: "destructive" });
          setIsLoadingFlightLogs(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch trip or logs:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
          toast({ title: "Error Fetching Trip Data", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
          setIsLoadingFlightLogs(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const loadCrewRoster = async () => {
        setIsLoadingCrewRosterDetails(true);
        try {
            const roster = await fetchCrewMembers();
            if (isMounted) setCrewRosterDetails(roster || []);
        } catch (crewError) {
            if (isMounted) {
                console.error("Failed to fetch crew roster:", crewError);
                toast({ title: "Error Fetching Crew", description: "Could not load crew roster for display.", variant: "destructive" });
                setCrewRosterDetails([]);
            }
        } finally {
           if (isMounted) setIsLoadingCrewRosterDetails(false);
        }
    };

    loadTripData();
    loadCrewRoster();

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
        const savedTrip = await saveTrip({ ...tripSaveData, id: tripDocId } as SaveTripInput); // Cast to SaveTripInput

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
    if (!trip || !canReleaseTrip) return;
    startUpdatingStatusTransition(async () => {
      const updatedTripData: Trip = {
        ...trip,
        status: "Released",
      };
      try {
        const { id: tripDocId, createdAt, updatedAt, ...tripSaveData } = updatedTripData;
        const savedTrip = await saveTrip({ ...tripSaveData, id: tripDocId } as SaveTripInput); // Cast to SaveTripInput
        setTrip(savedTrip);
        toast({ title: "Trip Released", description: `Trip ${savedTrip.tripId} is now Released.`});
      } catch (err) {
        console.error("Failed to mark trip as released:", err);
        toast({ title: "Error Releasing Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleCloseTrip = () => {
    if (!trip || !canCloseTrip) return;
    startClosingTripTransition(async () => {
      const updatedTripData: Trip = {
        ...trip,
        status: "Completed",
      };
      try {
        const { id: tripDocId, createdAt, updatedAt, ...tripSaveData } = updatedTripData;
        const savedTrip = await saveTrip({ ...tripSaveData, id: tripDocId } as SaveTripInput);
        setTrip(savedTrip);
        toast({ title: "Trip Closed", description: `Trip ${savedTrip.tripId} is now marked as Completed.`});
      } catch (err) {
        console.error("Failed to close trip:", err);
        toast({ title: "Error Closing Trip", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
      }
    });
  };


  const getCrewMemberDisplay = (crewId?: string) => {
    if (!crewId) return "N/A";
    if (isLoadingCrewRosterDetails) return <Loader2 className="h-4 w-4 animate-spin inline-block" />;
    const crewMember = crewRosterDetails.find(c => c.id === crewId);
    return crewMember ? `${crewMember.firstName} ${crewMember.lastName} (${crewMember.role})` : `Unknown (ID: ${crewId})`;
  };

  const handleOpenFlightLogModal = (legIndex: number) => {
    if (!trip) return;
    const leg = trip.legs[legIndex];
    if (!leg) return;

    const existingLog = tripFlightLogs[legIndex];
    const initialLogData = existingLog ? {
      ...existingLog,
      taxiOutTimeMins: Number(existingLog.taxiOutTimeMins ?? 0),
      hobbsTakeOff: existingLog.hobbsTakeOff !== undefined && existingLog.hobbsTakeOff !== null ? Number(existingLog.hobbsTakeOff) : undefined,
      hobbsLanding: existingLog.hobbsLanding !== undefined && existingLog.hobbsLanding !== null ? Number(existingLog.hobbsLanding) : undefined,
      taxiInTimeMins: Number(existingLog.taxiInTimeMins ?? 0),
      approaches: Number(existingLog.approaches ?? 0),
      dayLandings: Number(existingLog.dayLandings ?? 0),
      nightLandings: Number(existingLog.nightLandings ?? 0),
      nightTimeDecimal: Number(existingLog.nightTimeDecimal ?? 0.0),
      instrumentTimeDecimal: Number(existingLog.instrumentTimeDecimal ?? 0.0),
      fobStartingFuel: existingLog.fobStartingFuel !== undefined ? Number(existingLog.fobStartingFuel) : undefined,
      fuelPurchasedAmount: Number(existingLog.fuelPurchasedAmount ?? 0.0),
      endingFuel: existingLog.endingFuel !== undefined ? Number(existingLog.endingFuel) : undefined,
      fuelCost: Number(existingLog.fuelCost ?? 0.0),
      postLegApuTimeDecimal: Number(existingLog.postLegApuTimeDecimal ?? 0.0),
    } : undefined;


    setCurrentLegForLog({
      tripId: trip.id,
      legIndex: legIndex,
      origin: leg.origin,
      destination: leg.destination,
      initialData: initialLogData,
    });
    setIsFlightLogModalOpen(true);
  };

  const onSaveFlightLog = async (logData: FlightLogLegData) => {
    if (!currentLegForLog || !trip) return;
    startSavingFlightLogTransition(async () => {
      try {
        const dataToSave: SaveFlightLogLegInput = {
            tripId: currentLegForLog.tripId,
            legIndex: currentLegForLog.legIndex,
            taxiOutTimeMins: logData.taxiOutTimeMins,
            takeOffTime: logData.takeOffTime,
            hobbsTakeOff: logData.hobbsTakeOff === null ? undefined : logData.hobbsTakeOff,
            landingTime: logData.landingTime,
            hobbsLanding: logData.hobbsLanding === null ? undefined : logData.hobbsLanding,
            taxiInTimeMins: logData.taxiInTimeMins,
            approaches: logData.approaches,
            approachType: logData.approachType,
            dayLandings: logData.dayLandings,
            nightLandings: logData.nightLandings,
            nightTimeDecimal: logData.nightTimeDecimal,
            instrumentTimeDecimal: logData.instrumentTimeDecimal,
            fobStartingFuel: logData.fobStartingFuel,
            fuelPurchasedAmount: logData.fuelPurchasedAmount,
            fuelPurchasedUnit: logData.fuelPurchasedUnit,
            endingFuel: logData.endingFuel,
            fuelCost: logData.fuelCost,
            postLegApuTimeDecimal: logData.postLegApuTimeDecimal,
        };

        const savedLog = await saveFlightLogLeg(dataToSave);
        setTripFlightLogs(prevLogs => ({
          ...prevLogs,
          [currentLegForLog.legIndex]: savedLog,
        }));
        toast({ title: "Flight Log Saved", description: `Log for leg ${currentLegForLog.legIndex + 1} saved.` });
        setIsFlightLogModalOpen(false);
      } catch (err) {
        console.error("Failed to save flight log:", err);
        toast({ title: "Error Saving Log", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
      }
    });
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

  const isReleasableStatus = trip.status === "Scheduled" || trip.status === "Confirmed";
  const isCrewAssignedForRelease = !!trip.assignedPilotId;
  const canReleaseTrip = isReleasableStatus && isCrewAssignedForRelease;

  const releaseButtonDisabledReason =
    !isReleasableStatus ? "Trip not in Scheduled/Confirmed state." :
    !isCrewAssignedForRelease ? "Pilot in Command must be assigned to release." :
    undefined;

  const allLogsEntered = trip.legs.every((_, index) => !!tripFlightLogs[index]);
  const canCloseTrip = trip.status === "Released" && allLogsEntered;
  const closeTripButtonDisabledReason =
    trip.status !== "Released" ? "Trip must be 'Released' to close." :
    !allLogsEntered ? "All flight logs must be entered to close trip." :
    undefined;


  return (
    <TooltipProvider>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="default"
                    onClick={handleMarkAsReleased}
                    disabled={!canReleaseTrip || isUpdatingStatus || isClosingTrip}
                    className={cn(canReleaseTrip && "bg-green-600 hover:bg-green-700 text-white")}
                  >
                    {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlaneTakeoff className="mr-2 h-4 w-4" />}
                    Mark as Released
                  </Button>
                </span>
              </TooltipTrigger>
              {releaseButtonDisabledReason && (
                <TooltipContent>
                  <p>{releaseButtonDisabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="default"
                    onClick={handleCloseTrip}
                    disabled={!canCloseTrip || isClosingTrip || isUpdatingStatus}
                    className={cn(canCloseTrip && "bg-blue-600 hover:bg-blue-700 text-white")}
                  >
                    {isClosingTrip ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Close Trip
                  </Button>
                </span>
              </TooltipTrigger>
              {closeTripButtonDisabledReason && (
                <TooltipContent>
                  <p>{closeTripButtonDisabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
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

      <FlightLogSummaryCard
        tripLegs={trip.legs}
        flightLogs={tripFlightLogs}
        isLoadingLogs={isLoadingFlightLogs}
        onLogActualsClick={handleOpenFlightLogModal}
      />

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

      {currentLegForLog && (
        <FlightLogModal
          isOpen={isFlightLogModalOpen}
          setIsOpen={setIsFlightLogModalOpen}
          tripId={currentLegForLog.tripId}
          legIndex={currentLegForLog.legIndex}
          origin={currentLegForLog.origin}
          destination={currentLegForLog.destination}
          initialData={currentLegForLog.initialData}
          onSave={onSaveFlightLog}
          isSaving={isSavingFlightLog}
        />
      )}

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
    </TooltipProvider>
  );
}

    
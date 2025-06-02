
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileArchive, PlusCircle, Edit3, Trash2, Search, Eye, Loader2, CheckCircle, CalendarPlus, Edit } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { fetchQuotes, deleteQuote, saveQuote } from '@/ai/flows/manage-quotes-flow'; 
import type { Quote, QuoteLeg, quoteStatuses as QuoteStatusType, SaveQuoteInput } from '@/ai/schemas/quote-schemas';
import { quoteStatuses } from '@/ai/schemas/quote-schemas';
import { saveTrip } from '@/ai/flows/manage-trips-flow'; 
import type { SaveTripInput as TripToSave, TripLeg as TripLegType } from '@/ai/schemas/trip-schemas'; 
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined) return 'N/A';
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

const getStatusBadgeVariant = (status?: typeof QuoteStatusType[number]): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'accepted':
    case 'booked':
      return 'default'; 
    case 'sent': 
      return 'secondary'; 
    case 'draft': 
      return 'outline'; 
    case 'expired':
    case 'rejected': 
    case 'cancelled': 
      return 'destructive'; 
    default: return 'outline';
  }
};

export default function AllQuotesPage() {
  const [quotesList, setQuotesList] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const [isDeleting, startDeletingTransition] = useTransition();
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isBookingOrUpdating, startBookingOrUpdatingTransition] = useTransition();
  const [quoteToProcess, setQuoteToProcess] = useState<Quote | null>(null);
  const [newStatusForQuote, setNewStatusForQuote] = useState<typeof QuoteStatusType[number] | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);


  const loadQuotes = async () => {
    setIsLoading(true);
    try {
      const fetchedQuotes = await fetchQuotes();
      setQuotesList(fetchedQuotes);
    } catch (error) {
      console.error("Failed to load quotes:", error);
      toast({ title: "Error Loading Quotes", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!quoteToDelete) return;
    startDeletingTransition(async () => {
      try {
        await deleteQuote({ id: quoteToDelete.id });
        toast({ title: "Success", description: `Quote "${quoteToDelete.quoteId}" deleted.` });
        setShowDeleteConfirm(false);
        setQuoteToDelete(null);
        await loadQuotes(); 
      } catch (error) {
        console.error("Failed to delete quote:", error);
        toast({ title: "Error Deleting Quote", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setQuoteToDelete(null);
      }
    });
  };

  const createTripFromQuote = async (bookedQuote: Quote): Promise<boolean> => {
    try {
      const newTripId = `TRP-${bookedQuote.quoteId.replace('QT-', '')}-${Date.now().toString().slice(-4)}`;
      const tripLegs: TripLegType[] = bookedQuote.legs.map(qLeg => ({
        origin: qLeg.origin,
        destination: qLeg.destination,
        departureDateTime: qLeg.departureDateTime,
        legType: qLeg.legType,
        passengerCount: qLeg.passengerCount,
        originFbo: qLeg.originFbo,
        destinationFbo: qLeg.destinationFbo,
        flightTimeHours: qLeg.flightTimeHours,
        blockTimeHours: qLeg.calculatedBlockTimeHours,
      }));

      const tripToSave: TripToSave = {
        tripId: newTripId,
        quoteId: bookedQuote.id,
        customerId: bookedQuote.selectedCustomerId,
        clientName: bookedQuote.clientName,
        aircraftId: bookedQuote.aircraftId || "UNKNOWN_AC",
        aircraftLabel: bookedQuote.aircraftLabel,
        legs: tripLegs,
        status: "Scheduled",
        notes: `Trip created from Quote ${bookedQuote.quoteId}. ${bookedQuote.options.notes || ''}`.trim(),
      };
      await saveTrip(tripToSave);
      toast({ 
          title: "Trip Created!", 
          description: `New Trip ${newTripId} created and scheduled from Quote ${bookedQuote.quoteId}.`,
          variant: "default"
      });
      return true;
    } catch (tripError) {
      console.error("Failed to create trip from quote:", tripError);
      toast({ title: "Error Creating Trip", description: (tripError instanceof Error ? tripError.message : "Unknown error creating trip record."), variant: "destructive" });
      return false;
    }
  };


  const handleStatusChange = (quote: Quote, newStatus: typeof QuoteStatusType[number]) => {
    setQuoteToProcess(quote);
    setNewStatusForQuote(newStatus);
    setShowStatusConfirm(true);
  };

  const executeStatusUpdate = async () => {
    if (!quoteToProcess || !newStatusForQuote) return;
    
    const wasPreviouslyBooked = quoteToProcess.status === "Booked";
    const isNowBooking = newStatusForQuote === "Booked";

    startBookingOrUpdatingTransition(async () => {
      try {
        const updatedQuoteData: Quote = {
          ...quoteToProcess,
          status: newStatusForQuote,
        };
        
        const { id: quoteDocId, createdAt: quoteCreatedAt, updatedAt: quoteUpdatedAt, ...quoteSaveData } = updatedQuoteData;
        const savedQuote = await saveQuote(quoteSaveData as SaveQuoteInput); 

        let tripCreatedSuccessfully = false;
        if (isNowBooking && !wasPreviouslyBooked) {
          tripCreatedSuccessfully = await createTripFromQuote(savedQuote);
        }

        toast({ 
            title: "Quote Status Updated", 
            description: `Quote "${savedQuote.quoteId}" status changed to ${newStatusForQuote}.${isNowBooking && !wasPreviouslyBooked && tripCreatedSuccessfully ? ' Trip also created.' : (isNowBooking && !wasPreviouslyBooked && !tripCreatedSuccessfully ? ' Trip creation FAILED.' : '') }`,
            variant: "default"
        });
        
        setShowStatusConfirm(false);
        setQuoteToProcess(null);
        setNewStatusForQuote(null);
        await loadQuotes(); 
      } catch (error) {
        console.error("Failed to update quote status:", error);
        toast({ title: "Error Updating Status", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowStatusConfirm(false);
        setQuoteToProcess(null);
        setNewStatusForQuote(null);
      }
    });
  };


  const filteredQuotes = quotesList.filter(quote =>
    (quote.quoteId && quote.quoteId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.clientName && quote.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.aircraftLabel && quote.aircraftLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.status && quote.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.legs && quote.legs.length > 0 && 
      `${quote.legs[0].origin} -> ${quote.legs[quote.legs.length - 1].destination}`.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRouteDisplay = (legs: QuoteLeg[]) => {
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    if (legs.length === 1) return `${origin} -> ${destination}`;
    return `${origin} -> ... -> ${destination} (${legs.length} legs)`;
  };

  const canBookQuote = (status?: typeof QuoteStatusType[number]) => {
    return status === 'Sent' || status === 'Accepted';
  };


  return (
    <TooltipProvider>
      <PageHeader 
        title="All Quotes" 
        description="Browse, manage, and track all flight quotes from Firestore."
        icon={FileArchive}
        actions={
          <Button asChild>
            <Link href="/quotes/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Quote
            </Link>
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Quotes Overview</CardTitle>
          <CardDescription>Review and manage all generated quotes.</CardDescription>
           <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search quotes (ID, client, route, aircraft, status)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading quotes from Firestore...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote ID</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quote Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right min-w-[320px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No quotes found. {searchTerm ? "Try adjusting your search." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quoteId}</TableCell>
                      <TableCell>{quote.clientName || 'N/A'}</TableCell>
                      <TableCell>{getRouteDisplay(quote.legs)}</TableCell>
                      <TableCell>{quote.aircraftLabel || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(quote.status as typeof quoteStatuses[number])}>{quote.status}</Badge>
                      </TableCell>
                      <TableCell>{quote.createdAt ? format(parseISO(quote.createdAt), 'MMM d, yyyy') : 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(quote.totalSellPrice)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1 flex-nowrap">
                          <Select
                              value={quote.status}
                              onValueChange={(newStatus) => handleStatusChange(quote, newStatus as typeof QuoteStatusType[number])}
                              disabled={isBookingOrUpdating && quoteToProcess?.id === quote.id}
                            >
                            <SelectTrigger className="h-9 w-[120px] text-xs px-2"> {/* Consistent height h-9, adjust padding */}
                              <SelectValue placeholder="Change Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {quoteStatuses.map(stat => (
                                <SelectItem key={stat} value={stat} className="text-xs">
                                  {stat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {canBookQuote(quote.status as typeof QuoteStatusType[number]) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" // Use "sm" for h-9
                                  onClick={() => handleStatusChange(quote, "Booked")}
                                  disabled={isBookingOrUpdating}
                                  className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700 p-2 w-9" // Make it square
                                >
                                  <CalendarPlus className="h-4 w-4" /> 
                                  <span className="sr-only">Book Trip</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Book Trip & Create Schedule Item</p></TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="sm" asChild className="p-2 w-9"> {/* size="sm", p-2 w-9 */}
                                  <Link href={`/quotes/${quote.id}`}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View Quote</span>
                                  </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>View Quote</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild className="p-2 w-9"> {/* size="sm", p-2 w-9 */}
                                <Link href={`/quotes/new?editMode=true&quoteId=${quote.id}`}>
                                  <Edit3 className="h-4 w-4" />
                                  <span className="sr-only">Edit Quote</span>
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit Quote</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" // size="sm"
                                  className="text-destructive hover:text-destructive p-2 w-9" // p-2 w-9
                                  onClick={() => handleDeleteClick(quote)} 
                                  disabled={isDeleting || quote.status === 'Booked'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Quote</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>{quote.status === 'Booked' ? 'Cannot delete booked quote' : 'Delete Quote'}</p></TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {showDeleteConfirm && quoteToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete quote "{quoteToDelete.quoteId}" for {quoteToDelete.clientName}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showStatusConfirm && quoteToProcess && newStatusForQuote && (
        <AlertDialog open={showStatusConfirm} onOpenChange={(open) => {if(!isBookingOrUpdating) setShowStatusConfirm(open)}}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change the status of quote "{quoteToProcess.quoteId}" to "{newStatusForQuote}"?
                {newStatusForQuote === "Booked" && quoteToProcess.status !== "Booked" && " This will also create a new trip record."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowStatusConfirm(false); setQuoteToProcess(null); setNewStatusForQuote(null);}} disabled={isBookingOrUpdating}>Cancel</AlertDialogCancel>
              <Button 
                variant={newStatusForQuote === "Booked" || newStatusForQuote === "Accepted" ? "default" : (newStatusForQuote === "Rejected" || newStatusForQuote === "Expired" || newStatusForQuote === "Cancelled" ? "destructive" : "secondary")}
                onClick={executeStatusUpdate} 
                disabled={isBookingOrUpdating}
              >
                {isBookingOrUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Change to {newStatusForQuote}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}
    


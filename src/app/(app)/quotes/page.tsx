
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
import { Search, Eye, Loader2, MoreHorizontal, Edit, Trash2, FileText, PlaneTakeoff } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fetchQuotes, deleteQuote, type Quote } from '@/ai/flows/manage-quotes-flow';
import { useToast } from '@/hooks/use-toast';

const getStatusBadgeVariant = (status?: Quote['status']): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'accepted':
    case 'sent':
      return 'default';
    case 'in progress':
    case 'draft':
      return 'secondary';
    case 'cancelled':
    case 'expired':
      return 'destructive';
    case 'booked': 
      return 'default';
    default:
      return 'outline';
  }
};

// Returns custom inline styles for specific statuses
const getStatusBadgeStyle = (status?: Quote['status']): React.CSSProperties => {
    const lowerStatus = status?.toLowerCase();

    if (lowerStatus === 'booked') {
        return {
          backgroundColor: 'hsl(145, 63%, 42%)', 
          color: 'hsl(145, 60%, 95%)',
          borderColor: 'hsl(145, 63%, 42%)',
        };
    }
    
    return {};
};


export default function AllQuotesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const loadQuotes = async () => {
      setIsLoading(true);
      try {
        const fetchedQuotes = await fetchQuotes();
        setQuotes(fetchedQuotes);
      } catch (error) {
        console.error("Failed to load quotes:", error);
        toast({ title: "Error Loading Quotes", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadQuotes();
  }, [toast]);

  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuote({ id: quoteToDelete.id });
      setQuotes(prevQuotes => prevQuotes.filter(q => q.id !== quoteToDelete.id));
      toast({
        title: "Quote Deleted",
        description: `Quote #${quoteToDelete.quoteId} has been successfully deleted.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast({
        title: "Error Deleting Quote",
        description: (error instanceof Error ? error.message : "An unknown error occurred."),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsAlertOpen(false);
      setQuoteToDelete(null);
    }
  };

  const filteredQuotes = useMemo(() => {
    if (!searchTerm) return quotes;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return quotes.filter(quote =>
      (quote.quoteId?.toLowerCase().includes(lowerSearchTerm)) ||
      (quote.clientName?.toLowerCase().includes(lowerSearchTerm)) ||
      (quote.aircraftLabel?.toLowerCase().includes(lowerSearchTerm)) ||
      (quote.status?.toLowerCase().includes(lowerSearchTerm)) ||
      (quote.legs && quote.legs.length > 0 &&
        `${quote.legs[0].origin || 'N/A'} -> ${quote.legs[quote.legs.length - 1].destination || 'N/A'}`.toLowerCase().includes(lowerSearchTerm))
    );
  }, [searchTerm, quotes]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MM/dd/yyyy HH:mm') : 'Invalid Date';
    } catch (e) {
      return 'Invalid Date Format';
    }
  };

  const getRouteDisplay = (legs: Quote['legs']) => {
    if (!legs || legs.length === 0) return 'N/A';
    const origin = legs[0].origin || 'UNK';
    const destination = legs[legs.length - 1].destination || 'UNK';
    return <span className="font-mono">{origin} &rarr; {destination}</span>;
  };

  const getAircraftTailNumber = (aircraftLabel?: string) => {
    if (!aircraftLabel) return 'N/A';
    return aircraftLabel.split(' - ')[0];
  }
  
  const showBookNow = (status?: Quote['status']) => {
      const lowerStatus = status?.toLowerCase();
      return lowerStatus !== 'expired' && lowerStatus !== 'cancelled' && lowerStatus !== 'booked';
  }

  return (
    <>
      <PageHeader
        title="All Quotes"
        description="View all quotes in a filterable and sortable list format. Data from Firestore."
        icon={FileText}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Quotes</CardTitle>
          <CardDescription>Browse and manage all customer quotes.</CardDescription>
          <div className="mt-4 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes (ID, client, route, aircraft, status)..."
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
              <p className="ml-2 text-muted-foreground">Loading quotes from Firestore...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Quote ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[150px]">Route</TableHead>
                    <TableHead className="w-[120px]">Aircraft</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[180px]">Departure</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No quotes found{searchTerm && quotes.length > 0 ? " matching your search" : (quotes.length === 0 ? ". No quotes in the system yet." : "")}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.map((quote) => (
                      <TableRow key={quote.id} className="whitespace-nowrap">
                        <TableCell className="font-medium">{quote.quoteId || quote.id}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{quote.clientName || 'N/A'}</TableCell>
                        <TableCell>{getRouteDisplay(quote.legs)}</TableCell>
                        <TableCell className="font-mono">{getAircraftTailNumber(quote.aircraftLabel)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusBadgeVariant(quote.status)} 
                            style={getStatusBadgeStyle(quote.status)}
                          >
                            {quote.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>{isMounted ? formatDate(quote.legs?.[0]?.departureDateTime) : "Loading..."}</TableCell>
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
                                {showBookNow(quote.status) && (
                                  <DropdownMenuItem onSelect={() => router.push(`/trips/new?quoteId=${quote.id}`)} className="text-green-600 focus:text-green-500 font-semibold">
                                      <PlaneTakeoff className="mr-2 h-4 w-4" />
                                      <span>Book Now</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View/Print
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => router.push(`/quotes/new?quoteId=${quote.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Quote
                                </DropdownMenuItem>
                                {quote.status !== 'Booked' && (
                                  <DropdownMenuItem onSelect={() => handleDeleteClick(quote)} className="text-red-600 focus:text-red-500">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Quote
                                  </DropdownMenuItem>
                                )}
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
              This action cannot be undone. This will permanently delete quote {' '}
              <span className="font-semibold text-foreground">
                #{quoteToDelete?.quoteId}
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

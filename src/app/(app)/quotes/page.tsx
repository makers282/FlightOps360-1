
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileArchive, PlusCircle, Edit3, Trash2, Search, Eye, Loader2 } from 'lucide-react';
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
import { fetchQuotes, deleteQuote } from '@/ai/flows/manage-quotes-flow'; 
import type { Quote, QuoteLeg, quoteStatuses as QuoteStatusType } from '@/ai/schemas/quote-schemas';
import { quoteStatuses } from '@/ai/schemas/quote-schemas';
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
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right space-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <Button variant="ghost" size="icon" asChild>
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
                            <Button variant="ghost" size="icon" asChild>
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
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(quote)} disabled={isDeleting}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Quote</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Quote</p></TooltipContent>
                        </Tooltip>
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
    </TooltipProvider>
  );
}

    

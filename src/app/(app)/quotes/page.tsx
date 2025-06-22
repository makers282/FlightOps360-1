"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  FileArchive,
  PlusCircle,
  Trash2,
  Loader2,
  Search,
  Eye,
  Edit,
  CalendarDays,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { fetchQuotes, deleteQuote } from '@/ai/flows/manage-quotes-flow';
import type { Quote, quoteStatuses } from '@/ai/schemas/quote-schemas';
import { useToast } from '@/hooks/use-toast';
import { ClientOnly } from '@/components/client-only';
import { Skeleton } from '@/components/ui/skeleton';

type QuoteStatus = (typeof quoteStatuses)[number];

export default function AllQuotesPage() {
  const [quotesList, setQuotesList] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setIsLoading(true);
    try {
      const data = await fetchQuotes();
      setQuotesList(data);
    } catch (error) {
      toast({
        title: 'Error loading quotes',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(quoteId: string, newStatus: QuoteStatus) {
    // In a real application, you would call an API to update the quote status
    // For now, we'll just update the local state
    setQuotesList((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
    );
    toast({
      title: 'Status Updated (Simulated)',
      description: `Quote ${quoteId} status changed to ${newStatus}.`,
    });
  }

  function handleDelete(quote: Quote) {
    setQuoteToDelete(quote);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!quoteToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuote({ id: quoteToDelete.id });
      toast({ title: 'Deleted', description: `Quote ${quoteToDelete.quoteId} deleted.` });
      setShowDeleteConfirm(false);
      setQuoteToDelete(null);
      await loadQuotes();
    } catch (error) {
      toast({
        title: 'Error deleting quote',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const getStatusBadgeClassNames = (status: QuoteStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-200 text-gray-800';
      case 'Sent':
        return 'bg-blue-200 text-blue-800'; // Soft blue, can be customized further if a specific palette is defined
      case 'Booked':
        return 'bg-green-200 text-green-800';
      case 'Expired':
      case 'Cancelled':
        return 'bg-red-200 text-red-800';
      case 'Accepted':
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300'; // Outline-like
    }
  };

  const formatRoute = (legs: Quote['legs']) => {
    if (!legs || legs.length === 0) return 'N/A';
    const firstOrigin = legs[0]?.origin;
    const lastDestination = legs[legs.length - 1]?.destination;
    const numLegs = legs.length;
    if (numLegs === 1) {
      return `${firstOrigin} → ${lastDestination}`;
    }
    return `${firstOrigin} → ... → ${lastDestination} (${numLegs} legs)`;
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filtered = quotesList.filter((q) => {
    const term = searchTerm.toLowerCase();
    const route = formatRoute(q.legs).toLowerCase();
    return (
      (q.quoteId ?? '').toLowerCase().includes(term) ||
      (q.clientName ?? '').toLowerCase().includes(term) ||
      (q.status ?? '').toLowerCase().includes(term) ||
      (q.aircraftLabel ?? '').toLowerCase().includes(term) ||
      route.includes(term)
    );
  });

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          title="Quotes Overview"
          description="Review and manage all generated quotes."
          icon={FileArchive}
          actions={
            <Button asChild>
              <Link href="/quotes/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Quote
              </Link>
            </Button>
          }
        />

        <Card className="mt-4">
          <CardHeader>
            <ClientOnly fallback={<Skeleton className="h-10 w-full max-w-sm" />}>
              <div className="mt-2 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search quotes (ID, client, route, aircraft, status)..."
                  className="pl-8 w-full max-w-sm"
                />
              </div>
            </ClientOnly>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No quotes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>{q.quoteId}</TableCell>
                        <TableCell>{q.clientName}</TableCell>
                        <TableCell>{formatRoute(q.legs)}</TableCell>
                        <TableCell>{q.aircraftLabel || 'N/A'}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Select value={q.status} onValueChange={(newStatus: QuoteStatus) => handleStatusChange(q.id, newStatus)}>
                              <SelectTrigger className="h-8 text-xs focus:ring-0 focus:ring-offset-0">
                                <Badge className={getStatusBadgeClassNames(q.status as QuoteStatus)}>
                                  {q.status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {(['Draft', 'Sent', 'Accepted', 'Booked', 'Expired', 'Cancelled'] as QuoteStatus[]).map(
                                  (status) => (
                                    <SelectItem key={status} value={status} className="py-1 px-2 text-sm">
                                      {status}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            {q.status === 'Sent' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700 p-2 w-9"
                                  >
                                    <Link href={`/trips/new?quoteId=${q.id}`}> {/* Link to trip creation page */}
                                      <CalendarDays className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Book Trip</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(q.createdAt)}</TableCell>
                        <TableCell>{formatCurrency(q.totalSellPrice)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/quotes/${q.id}`} className="flex items-center w-full">
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/quotes/new?editMode=true&quoteId=${q.id}`} className="flex items-center w-full">
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(q)}
                                disabled={isDeleting}
                                className="flex items-center text-red-600 focus:text-red-600 w-full"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
          <AlertDialog open onOpenChange={() => setShowDeleteConfirm(false)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {quoteToDelete.quoteId}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </TooltipProvider>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, FileText, User, Plane, CalendarDays, DollarSign, Percent, ListChecks, InfoIcon } from 'lucide-react';
import { fetchQuoteById } from '@/ai/flows/manage-quotes-flow';
import type { Quote, QuoteLeg, QuoteLineItem, quoteStatuses as QuoteStatusType } from '@/ai/schemas/quote-schemas';
import { quoteStatuses, legTypes } from '@/ai/schemas/quote-schemas'; // Ensure legTypes is available if needed by reused components
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

// Helper function to format currency (can be moved to utils if used elsewhere)
const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined) return 'N/A';
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

// Helper to get badge variant for status (can be moved to utils or a shared component)
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

// Simplified Legs Summary Display for View Page
function ViewLegsSummary({ legs }: { legs: QuoteLeg[] }) {
  if (!legs || legs.length === 0) return <p className="text-muted-foreground">No legs information available.</p>;

  const formatTimeDecimalToHHMM = (timeDecimal: number | undefined) => {
      if (timeDecimal === undefined || timeDecimal <= 0 || isNaN(timeDecimal)) return "00:00";
      const hours = Math.floor(timeDecimal);
      const minutes = Math.round((timeDecimal - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };


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
            <TableCell className="text-right">{formatTimeDecimalToHHMM(leg.calculatedBlockTimeHours)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Simplified Costs Summary Display for View Page
function ViewCostsSummary({ lineItems, totalBuyCost, totalSellPrice, marginAmount, marginPercentage }: { 
  lineItems: QuoteLineItem[];
  totalBuyCost: number;
  totalSellPrice: number;
  marginAmount: number;
  marginPercentage: number;
}) {
  if (!lineItems || lineItems.length === 0) return <p className="text-muted-foreground">No cost breakdown available.</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Sell Rate</TableHead>
            <TableHead className="text-center">Qty</TableHead>
            <TableHead className="text-right">Sell Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.sellRate)} / {item.unitDescription}</TableCell>
              <TableCell className="text-center">{item.quantity.toFixed(2)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(item.sellTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-muted/50">
          <TableRow>
            <TableCell colSpan={3} className="text-right font-semibold text-muted-foreground">Subtotal Cost (Buy):</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalBuyCost)}</TableCell>
          </TableRow>
           <TableRow>
            <TableCell colSpan={3} className="text-right font-bold text-primary">Total Client Price (Sell):</TableCell>
            <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalSellPrice)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={3} className="text-right font-semibold text-muted-foreground">Margin:</TableCell>
            <TableCell className="text-right font-semibold">
              {formatCurrency(marginAmount)} 
              <span className={`ml-1 ${marginAmount >=0 ? 'text-green-600' : 'text-red-600'}`}>
                ({marginAmount >=0 ? '+' : ''}{marginPercentage.toFixed(1)}%)
              </span>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </>
  );
}


export default function ViewQuotePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const quoteIdFromParam = params.id;
  const id = typeof quoteIdFromParam === 'string' ? quoteIdFromParam : undefined;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setError(null);
      fetchQuoteById({ id })
        .then(data => {
          if (data) {
            setQuote(data);
          } else {
            setError("Quote not found.");
            toast({ title: "Error", description: `Quote with ID ${id} not found.`, variant: "destructive" });
          }
        })
        .catch(err => {
          console.error("Failed to fetch quote:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
          toast({ title: "Error Fetching Quote", description: (err instanceof Error ? err.message : "Unknown error"), variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else {
      setError("No quote ID provided in URL.");
      setIsLoading(false);
    }
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg text-muted-foreground">Loading quote details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Error Loading Quote" icon={InfoIcon} />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => router.push('/quotes')} variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Quotes
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (!quote) {
     return (
      <>
        <PageHeader title="Quote Not Found" icon={InfoIcon}/>
        <Card>
          <CardContent className="pt-6">
            <p>The requested quote could not be found.</p>
             <Button onClick={() => router.push('/quotes')} variant="outline" className="mt-4">
               <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Quotes
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader 
        title={`Quote Details: ${quote.quoteId}`}
        description={`Viewing details for quote sent to ${quote.clientName || 'N/A'}.`}
        icon={FileText}
        actions={
          <Button onClick={() => router.push('/quotes')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Quotes
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Client & Quote Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><strong>Client:</strong> {quote.clientName}</p>
            <p><strong>Email:</strong> {quote.clientEmail}</p>
            <p><strong>Phone:</strong> {quote.clientPhone || 'N/A'}</p>
            <Separator className="my-3" />
            <p><strong>Quote ID:</strong> {quote.quoteId}</p>
            <p><strong>Status:</strong> <Badge variant={getStatusBadgeVariant(quote.status as typeof quoteStatuses[number])}>{quote.status}</Badge></p>
            <p><strong>Aircraft:</strong> {quote.aircraftLabel || 'N/A'}</p>
            <p><strong>Created:</strong> {isValid(parseISO(quote.createdAt)) ? format(parseISO(quote.createdAt), 'PPPp') : 'Invalid Date'}</p>
            <p><strong>Updated:</strong> {isValid(parseISO(quote.updatedAt)) ? format(parseISO(quote.updatedAt), 'PPPp') : 'Invalid Date'}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Itinerary</CardTitle>
          </CardHeader>
          <CardContent>
            <ViewLegsSummary legs={quote.legs} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Financial Breakdown</CardTitle>
          <CardDescription>Detailed cost and pricing structure for this quote.</CardDescription>
        </CardHeader>
        <CardContent>
          <ViewCostsSummary 
            lineItems={quote.lineItems}
            totalBuyCost={quote.totalBuyCost}
            totalSellPrice={quote.totalSellPrice}
            marginAmount={quote.marginAmount}
            marginPercentage={quote.marginPercentage}
          />
        </CardContent>
      </Card>

      {(quote.options.notes || quote.options.cateringNotes || quote.options.medicsRequested || quote.options.estimatedOvernights || 0 > 0) && (
        <Card className="mt-6 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><InfoIcon className="h-5 w-5 text-primary" /> Options & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {quote.options.medicsRequested && <p><strong>Medics Requested:</strong> Yes</p>}
            {quote.options.cateringRequested && <p><strong>Catering Requested:</strong> Yes</p>}
            {quote.options.cateringNotes && <p><strong>Catering Notes:</strong> {quote.options.cateringNotes}</p>}
            {quote.options.estimatedOvernights && quote.options.estimatedOvernights > 0 && <p><strong>Estimated Overnights:</strong> {quote.options.estimatedOvernights}</p>}
            {quote.options.notes && (
              <>
                <Separator className="my-2" />
                <p><strong>General Quote Notes:</strong></p>
                <p className="whitespace-pre-wrap p-2 bg-muted/50 rounded-md">{quote.options.notes}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

    
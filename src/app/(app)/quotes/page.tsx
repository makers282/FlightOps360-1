
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileArchive, PlusCircle, Edit3, Trash2, Search, Eye } from 'lucide-react';
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

const quoteData = [
  { id: 'QT-A1B2C', clientName: 'Aero Corp', route: 'KJFK -> KLAX', aircraft: 'Global 6000', status: 'Sent', quoteDate: '2024-08-10', amount: '$25,500.00' },
  { id: 'QT-X3Y4Z', clientName: 'VIP Travel Inc.', route: 'KTEB -> KMIA', aircraft: 'Citation CJ3', status: 'Accepted', quoteDate: '2024-08-05', amount: '$12,800.00' },
  { id: 'QT-P5Q6R', clientName: 'Global Reach Ltd.', route: 'EGLL -> LSGG', aircraft: 'Gulfstream G650', status: 'Draft', quoteDate: '2024-08-12', amount: '$45,000.00' },
  { id: 'QT-M7N8O', clientName: 'Executive Flights', route: 'KHPN -> KORD', aircraft: 'Phenom 300', status: 'Expired', quoteDate: '2024-07-15', amount: '$9,200.00' },
  { id: 'QT-K9J1H', clientName: 'SkyHigh Charters', route: 'KSFO -> KSDL', aircraft: 'Learjet 75', status: 'Rejected', quoteDate: '2024-08-01', amount: '$15,000.00' },
];

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'accepted': return 'default'; // Greenish / Primary
    case 'sent': return 'secondary'; // Blueish / Active
    case 'draft': return 'outline'; // Neutral / In progress
    case 'expired':
    case 'rejected': 
      return 'destructive'; // Reddish / Warning
    default: return 'outline';
  }
};

export default function AllQuotesPage() {
  return (
    <TooltipProvider>
      <PageHeader 
        title="All Quotes" 
        description="Browse, manage, and track all flight quotes."
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
            <Input placeholder="Search quotes (e.g., ID, client, route)..." className="pl-8 w-full sm:w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
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
              {quoteData.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.id}</TableCell>
                  <TableCell>{quote.clientName}</TableCell>
                  <TableCell>{quote.route}</TableCell>
                  <TableCell>{quote.aircraft}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(quote.status)}>{quote.status}</Badge>
                  </TableCell>
                  <TableCell>{quote.quoteDate}</TableCell>
                  <TableCell>{quote.amount}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Quote</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>View Quote</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Edit3 className="h-4 w-4" />
                          <span className="sr-only">Edit Quote</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Edit Quote</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Quote</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete Quote</p></TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {quoteData.length === 0 && (
            <div className="text-center py-10 col-span-full"> {/* Ensure col-span-full if inside a grid-like table structure */}
              <FileArchive className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No quotes found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new quote.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}


import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UsersRound, PlusCircle, Edit3, Trash2, Search } from 'lucide-react';
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

const customerData = [
  { id: 'CUST001', name: 'John Doe', company: 'Doe Industries', email: 'john.doe@example.com', phone: '555-1234', notes: 'VIP Client, prefers morning flights.', lastActivity: '2024-08-10' },
  { id: 'CUST002', name: 'Jane Smith', company: 'Smith Corp', email: 'jane.smith@example.com', phone: '555-5678', notes: 'Requires specific catering.', lastActivity: '2024-07-25' },
  { id: 'CUST003', name: 'Robert Brown', company: 'Brown & Co.', email: 'robert.brown@example.com', phone: '555-8765', notes: 'Often books last minute.', lastActivity: '2024-08-01' },
  { id: 'CUST004', name: 'Emily White', company: 'White Solutions', email: 'emily.white@example.com', phone: '555-4321', notes: 'Interested in block hours.', lastActivity: '2024-06-15' },
];

export default function CustomersPage() {
  return (
    <>
      <PageHeader 
        title="Customer Management" 
        description="View, add, and manage customer information."
        icon={UsersRound}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>Browse and manage your customer database.</CardDescription>
           <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-8 w-full sm:w-1/3" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerData.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.id}</TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.company}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.lastActivity}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-1">
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit Customer</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Customer</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {customerData.length === 0 && (
            <div className="text-center py-10">
              <UsersRound className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No customers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new customer.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

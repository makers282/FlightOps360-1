
"use client";

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UsersRound, PlusCircle, Edit3, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge'; // Import Badge

interface Customer {
  id: string;
  name: string;
  type: 'Charter' | 'Owner' | 'Internal' | 'Retail' | 'Broker' | 'Other';
  contactFirstName?: string;
  contactLastName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
}

const mockCustomers: Customer[] = [
  { id: 'CUS001', name: 'Acme Corp Charter', type: 'Charter', contactFirstName: 'John', contactLastName: 'Doe', email: 'john.doe@acme.com', phone: '555-123-4567', isActive: true },
  { id: 'CUS002', name: 'Jane Smith (Aircraft Owner)', type: 'Owner', contactFirstName: 'Jane', contactLastName: 'Smith', email: 'jane.s@example.org', phone: '555-987-6543', isActive: true },
  { id: 'CUS003', name: 'Internal Flight Department', type: 'Internal', contactFirstName: 'Ops', contactLastName: 'Team', email: 'flightops@internal.co', phone: '555-001-0002', isActive: true },
  { id: 'CUS004', name: 'SkyHigh Brokers Inc.', type: 'Broker', contactFirstName: 'Mike', contactLastName: 'Ross', email: 'mike.ross@skyhigh.com', phone: '555-BRO-KER1', isActive: true },
  { id: 'CUS005', name: 'Luxury Travel Co.', type: 'Retail', contactFirstName: 'Sarah', contactLastName: 'Connor', email: 's.connor@luxurytravel.com', phone: '555-738-2457', isActive: false },
];

const getStatusBadgeVariant = (isActive: boolean): "default" | "destructive" => {
  return isActive ? 'default' : 'destructive';
};

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return mockCustomers;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return mockCustomers.filter(customer =>
      customer.name.toLowerCase().includes(lowerSearchTerm) ||
      (customer.contactFirstName && customer.contactFirstName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.contactLastName && customer.contactLastName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(lowerSearchTerm)) ||
      customer.type.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm]);

  return (
    <TooltipProvider>
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
            <Input 
              placeholder="Search customers (name, contact, email, type)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No customers found{searchTerm ? " matching your search" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell><Badge variant={customer.type === "Internal" ? "secondary" : "outline"}>{customer.type}</Badge></TableCell>
                    <TableCell>{`${customer.contactFirstName || ''} ${customer.contactLastName || ''}`.trim() || '-'}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell className="text-center">
                      {customer.isActive ? 
                        <Tooltip>
                          <TooltipTrigger asChild><CheckCircle2 className="h-5 w-5 text-green-500 inline-block cursor-default" /></TooltipTrigger>
                          <TooltipContent><p>Active</p></TooltipContent>
                        </Tooltip>
                         : 
                        <Tooltip>
                          <TooltipTrigger asChild><XCircle className="h-5 w-5 text-red-500 inline-block cursor-default" /></TooltipTrigger>
                          <TooltipContent><p>Inactive</p></TooltipContent>
                        </Tooltip>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="mr-1">
                            <Edit3 className="h-4 w-4" />
                            <span className="sr-only">Edit Customer</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit Customer</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Customer</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Customer</p></TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

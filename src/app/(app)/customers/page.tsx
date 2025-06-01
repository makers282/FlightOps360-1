
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

// Mock data removed

const getStatusBadgeVariant = (isActive: boolean): "default" | "destructive" => {
  return isActive ? 'default' : 'destructive';
};

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customersList, setCustomersList] = useState<Customer[]>([]); // Start with an empty list

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customersList;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return customersList.filter(customer =>
      customer.name.toLowerCase().includes(lowerSearchTerm) ||
      (customer.contactFirstName && customer.contactFirstName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.contactLastName && customer.contactLastName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(lowerSearchTerm)) ||
      customer.type.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, customersList]);

  return (
    <TooltipProvider>
      <PageHeader 
        title="Customer Management" 
        description="View, add, and manage customer information."
        icon={UsersRound}
        actions={
          <Button disabled> {/* Disabled until functionality is added */}
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
              disabled={customersList.length === 0} // Disable search if no customers
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
                    No customers found{customersList.length > 0 && searchTerm ? " matching your search" : ". Add a customer to get started."}
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
                          <Button variant="ghost" size="icon" className="mr-1" disabled> {/* Disabled until functionality is added */}
                            <Edit3 className="h-4 w-4" />
                            <span className="sr-only">Edit Customer</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit Customer</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled> {/* Disabled until functionality is added */}
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

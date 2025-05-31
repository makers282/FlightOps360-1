
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UsersRound, PlusCircle, Edit3, Trash2, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react'; // Added CheckCircle2, XCircle
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
import { Badge } from '@/components/ui/badge'; // Import Badge
import { useToast } from '@/hooks/use-toast';
import { fetchCustomers, saveCustomer, deleteCustomer } from '@/ai/flows/manage-customers-flow';
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';
import { AddEditCustomerModal, type CustomerFormData } from './components/add-edit-customer-modal';
import { format, parseISO, isValid } from 'date-fns';

export default function CustomersPage() {
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const { toast } = useToast();

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const fetchedCustomers = await fetchCustomers();
      setCustomersList(fetchedCustomers);
    } catch (error) {
      console.error("Failed to load customers:", error);
      toast({ title: "Error Loading Customers", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setIsEditingMode(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditingMode(true);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (data: SaveCustomerInput) => {
    startSavingTransition(async () => {
      try {
        await saveCustomer(data);
        toast({ title: "Success", description: `Customer ${isEditingMode ? 'updated' : 'added'} successfully.` });
        setIsModalOpen(false);
        await loadCustomers(); 
      } catch (error) {
        console.error("Failed to save customer:", error);
        toast({ title: "Error Saving Customer", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleDeleteConfirm = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const executeDeleteCustomer = async () => {
    if (!customerToDelete) return;
    startDeletingTransition(async () => {
      try {
        await deleteCustomer({ customerId: customerToDelete.id });
        toast({ title: "Success", description: `Customer "${customerToDelete.name}" deleted.` });
        setCustomerToDelete(null);
        await loadCustomers(); 
      } catch (error) {
        console.error("Failed to delete customer:", error);
        toast({ title: "Error Deleting Customer", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setCustomerToDelete(null);
      }
    });
  };

  const filteredCustomers = customersList.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.contactFirstName && customer.contactFirstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.contactLastName && customer.contactLastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.customerType && customer.customerType.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    try {
      const parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) {
        return format(parsedDate, 'PP'); // Format as 'Aug 15, 2024'
      }
      return dateString; // Return original if not a valid ISO date string
    } catch (e) {
      return dateString; 
    }
  };

  return (
    <TooltipProvider>
      <PageHeader 
        title="Customer Management" 
        description="View, add, and manage customer information."
        icon={UsersRound}
        actions={
          <Button onClick={handleOpenAddModal}>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading customers...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 && !isLoading ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No customers found. {searchTerm ? "Try adjusting your search." : ""}
                        </TableCell>
                    </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell><Badge variant={customer.customerType === "Internal" ? "secondary" : "outline"}>{customer.customerType}</Badge></TableCell>
                      <TableCell>{customer.contactFirstName || customer.contactLastName ? `${customer.contactFirstName || ''} ${customer.contactLastName || ''}`.trim() : '-'}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell className="text-center">
                        {customer.isActive ? 
                          <CheckCircle2 className="h-5 w-5 text-green-500 inline-block" /> : 
                          <XCircle className="h-5 w-5 text-red-500 inline-block" />}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-1" onClick={() => handleOpenEditModal(customer)} disabled={isSaving || isDeleting}>
                              <Edit3 className="h-4 w-4" />
                              <span className="sr-only">Edit Customer</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Customer</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteConfirm(customer)} disabled={isSaving || isDeleting}>
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
          )}
        </CardContent>
      </Card>

      <AddEditCustomerModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveCustomer}
        initialData={editingCustomer}
        isEditing={isEditingMode}
        isSaving={isSaving}
      />

      {customerToDelete && (
        <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the customer "{customerToDelete.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCustomerToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteCustomer} disabled={isDeleting}>
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


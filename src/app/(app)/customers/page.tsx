
"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UsersRound, PlusCircle, Edit3, Trash2, Search, CheckCircle2, XCircle as XCircleIcon, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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

import { fetchCustomers, saveCustomer, deleteCustomer } from '@/ai/flows/manage-customers-flow';
import type { Customer, SaveCustomerInput } from '@/ai/schemas/customer-schemas';
import { AddEditCustomerModal, type CustomerFormData } from './components/add-edit-customer-modal';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';

const getStatusBadgeVariant = (isActive: boolean): "default" | "destructive" => {
  return isActive ? 'default' : 'destructive';
};

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentCustomerForModal, setCurrentCustomerForModal] = useState<Customer | null>(null);
  const [isSavingCustomer, startSavingCustomerTransition] = useTransition();
  
  const [isDeletingCustomer, startDeletingCustomerTransition] = useTransition();
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    setIsEditingModal(false);
    setCurrentCustomerForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setIsEditingModal(true);
    setCurrentCustomerForModal(customer);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (data: SaveCustomerInput) => {
    startSavingCustomerTransition(async () => {
      try {
        const savedData = await saveCustomer(data);
        toast({
          title: isEditingModal ? "Customer Updated" : "Customer Added",
          description: `Customer "${savedData.name}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadCustomers(); // Refresh list
      } catch (error) {
        console.error("Failed to save customer:", error);
        toast({
          title: "Error Saving Customer",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirm(true);
  };

  const executeDeleteCustomer = async () => {
    if (!customerToDelete) return;
    startDeletingCustomerTransition(async () => {
      try {
        await deleteCustomer({ customerId: customerToDelete.id });
        toast({ title: "Customer Deleted", description: `Customer "${customerToDelete.name}" has been removed.` });
        setShowDeleteConfirm(false);
        setCustomerToDelete(null);
        await loadCustomers(); 
      } catch (error) {
        console.error("Failed to delete customer:", error);
        toast({ title: "Error Deleting Customer", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setCustomerToDelete(null);
      }
    });
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customersList;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return customersList.filter(customer =>
      customer.name.toLowerCase().includes(lowerSearchTerm) ||
      (customer.contactFirstName && customer.contactFirstName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.contactLastName && customer.contactLastName.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(lowerSearchTerm)) ||
      customer.customerType.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, customersList]);

  return (
    <TooltipProvider>
      <PageHeader 
        title="Customer Management" 
        description="View, add, and manage customer information from Firestore."
        icon={UsersRound}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoading}>
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
              disabled={isLoading || customersList.length === 0 && !searchTerm}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading customers from Firestore...</p>
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
                      <TableCell><Badge variant={customer.customerType === "Internal" ? "secondary" : "outline"}>{customer.customerType}</Badge></TableCell>
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
                            <TooltipTrigger asChild><XCircleIcon className="h-5 w-5 text-red-500 inline-block cursor-default" /></TooltipTrigger>
                            <TooltipContent><p>Inactive</p></TooltipContent>
                          </Tooltip>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-1" onClick={() => handleOpenEditModal(customer)}>
                              <Edit3 className="h-4 w-4" />
                              <span className="sr-only">Edit Customer</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Customer</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(customer)} disabled={isDeletingCustomer && customerToDelete?.id === customer.id}>
                                {isDeletingCustomer && customerToDelete?.id === customer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
        initialData={currentCustomerForModal}
        isEditing={isEditingModal}
        isSaving={isSavingCustomer}
      />

      {showDeleteConfirm && customerToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete customer "{customerToDelete.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingCustomer}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteCustomer} disabled={isDeletingCustomer}>
                {isDeletingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}

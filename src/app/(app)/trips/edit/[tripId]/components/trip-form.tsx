
// src/app/(app)/trips/edit/[tripId]/components/trip-form.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, Edit3, UserSearch, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/ai/schemas/customer-schemas';
import { fetchCustomers } from '@/ai/flows/manage-customers-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';

// Schema for the client details and aircraft selection
const TripFormSchemaBase = z.object({
  tripId: z.string().min(1, "Trip ID is required."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  aircraftId: z.string().min(1, "Aircraft selection is required.").optional(),
});

type TripFormDataBase = z.infer<typeof TripFormSchemaBase>;

interface TripFormProps {
  initialTripData?: any | null;
  isEditMode: boolean;
}

interface AircraftSelectOption {
  value: string;
  label: string;
  model: string;
}

export function TripForm({ isEditMode, initialTripData }: TripFormProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [aircraftSelectOptions, setAircraftSelectOptions] = useState<AircraftSelectOption[]>([]);
  const [isLoadingAircraftList, setIsLoadingAircraftList] = useState(false);

  const form = useForm<TripFormDataBase>({
    resolver: zodResolver(TripFormSchemaBase),
    defaultValues: {
      tripId: initialTripData?.tripId || '',
      selectedCustomerId: initialTripData?.selectedCustomerId || undefined,
      clientName: initialTripData?.clientName || '',
      clientEmail: initialTripData?.clientEmail || '',
      clientPhone: initialTripData?.clientPhone || '',
      aircraftId: initialTripData?.aircraftId || undefined,
    },
  });

  const { setValue, control } = form;

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingCustomers(true);
      setIsLoadingAircraftList(true);
      try {
        const [fetchedCustomersData, fetchedFleetData] = await Promise.all([
          fetchCustomers(),
          fetchFleetAircraft()
        ]);
        setCustomers(fetchedCustomersData);
        const options = fetchedFleetData.map(ac => ({
          value: ac.id,
          label: `${ac.tailNumber} - ${ac.model}`,
          model: ac.model
        }));
        setAircraftSelectOptions(options);

      } catch (error) {
        console.error("Failed to load initial data for trip form:", error);
        toast({ title: "Error loading initial data", description: "Could not load customers or aircraft.", variant: "destructive" });
      } finally {
        setIsLoadingCustomers(false);
        setIsLoadingAircraftList(false);
      }
    };
    loadInitialData();
  }, [toast]);

  useEffect(() => {
    if (initialTripData) {
      form.reset({
        tripId: initialTripData.tripId || '',
        selectedCustomerId: initialTripData.selectedCustomerId || undefined,
        clientName: initialTripData.clientName || '',
        clientEmail: initialTripData.clientEmail || '',
        clientPhone: initialTripData.clientPhone || '',
        aircraftId: initialTripData.aircraftId || undefined,
      });
    }
  }, [initialTripData, form]);


  const handleCustomerSelect = (customerId: string | undefined) => {
    setValue('selectedCustomerId', customerId);
    if (!customerId) {
      // Optionally clear client fields if "None" is selected or input is cleared
      // setValue('clientName', '');
      // setValue('clientEmail', '');
      // setValue('clientPhone', '');
      return;
    }
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email || '');
      setValue('clientPhone', selectedCustomer.phone || '');
    }
  };

  // Placeholder onSubmit for this stage
  const onSubmit = (data: TripFormDataBase) => {
    console.log("Form submitted (client & aircraft details section):", data);
    toast({ title: "Form Section Submitted (Placeholder)", description: "Client & Aircraft details section submitted." });
    // Actual save logic will be more complex and involve legs etc.
  };


  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <Plane className="h-6 w-6 text-primary" />}
              {isEditMode ? `Edit Trip (ID: ${initialTripData?.tripId || 'N/A'})` : 'Create New Trip'}
            </CardTitle>
            <CardDescription>
              {isEditMode ? 'Modify the details for this trip.' : 'Enter the details below to schedule a new trip.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={control}
              name="tripId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip ID</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly={isEditMode} className={isEditMode ? "bg-muted/50 cursor-not-allowed" : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="selectedCustomerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => { handleCustomerSelect(value); field.onChange(value); }}
                    value={field.value || ""}
                    disabled={isLoadingCustomers}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select a client or enter details manually"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {!isLoadingCustomers && customers.length === 0 && <SelectItem value="NO_CUSTOMERS_PLACEHOLDER" disabled>No customers found</SelectItem>}
                      {customers.map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name} {customer.customerType && `(${customer.customerType})`}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choosing a client will auto-populate their details below.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Doe or Acme Corp" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g., contact@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={control}
              name="clientPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Phone (Optional)</FormLabel>
                  <FormControl><Input type="tel" placeholder="e.g., (555) 123-4567" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="aircraftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Plane className="h-4 w-4" /> Aircraft</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                    disabled={isLoadingAircraftList}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAircraftList ? "Loading aircraft..." : "Select an aircraft"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {!isLoadingAircraftList && aircraftSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT_PLACEHOLDER" disabled>No aircraft in fleet</SelectItem>}
                      {aircraftSelectOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled>
              {/* Placeholder submit button, actual save logic will be more complex */}
              {isEditMode ? 'Save Changes (Placeholder)' : 'Create Trip (Placeholder)'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

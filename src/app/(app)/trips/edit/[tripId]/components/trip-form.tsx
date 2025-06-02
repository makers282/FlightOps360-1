
// src/app/(app)/trips/edit/[tripId]/components/trip-form.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plane, Edit3, UserSearch, Loader2, CalendarIcon, PlusCircle, Trash2, GripVertical, Wand2, PlaneTakeoff, PlaneLanding, Building, Users as PaxIcon, Save, InfoIcon } from 'lucide-react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO } from "date-fns";

import type { Customer } from '@/ai/schemas/customer-schemas';
import { fetchCustomers } from '@/ai/flows/manage-customers-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { legTypes } from '@/ai/schemas/quote-schemas'; 
import { type TripLeg as DbTripLeg, tripStatuses, type TripStatus } from '@/ai/schemas/trip-schemas';
import { estimateFlightDetails, type EstimateFlightDetailsOutput } from '@/ai/flows/estimate-flight-details-flow';
import { fetchAircraftPerformance, type AircraftPerformanceData } from '@/ai/flows/manage-aircraft-performance-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { LegsSummaryTable } from '@/app/(app)/quotes/new/components/legs-summary-table';

// Schema for individual legs in the form
const FormLegSchema = z.object({
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5, "Origin code too long.").toUpperCase(),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5, "Destination code too long.").toUpperCase(),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }).optional(),
  legType: z.enum(legTypes, { required_error: "Leg type is required." }),
  passengerCount: z.coerce.number().min(0, "Passenger count cannot be negative.").int().default(1),
  originFbo: z.string().optional(),
  destinationFbo: z.string().optional(),
  originTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  destinationTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  flightTimeHours: z.coerce.number().min(0).optional(),
});
type FormLegData = z.infer<typeof FormLegSchema>;


// Main form schema including legs
const TripFormSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  aircraftId: z.string().min(1, "Aircraft selection is required.").optional(),
  status: z.enum(tripStatuses).default("Scheduled"),
  legs: z.array(FormLegSchema).min(1, "At least one flight leg is required."),
  notes: z.string().optional(),
});

export type FullTripFormData = z.infer<typeof TripFormSchema>;

interface TripFormProps {
  initialTripData?: any | null; 
  isEditMode: boolean;
  onSave: (data: FullTripFormData) => Promise<void>; 
  isSaving: boolean; 
  initialQuoteId?: string | null;
}

interface AircraftSelectOption {
  value: string;
  label: string;
  model: string;
}

type LegEstimate = EstimateFlightDetailsOutput & {
  error?: string;
  estimatedForInputs?: { origin: string; destination: string; aircraftModel: string; knownCruiseSpeedKts?: number };
};

export function TripForm({ isEditMode, initialTripData, onSave, isSaving, initialQuoteId }: TripFormProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [aircraftSelectOptions, setAircraftSelectOptions] = useState<AircraftSelectOption[]>([]);
  const [isLoadingAircraftList, setIsLoadingAircraftList] = useState(false);
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [legEstimates, setLegEstimates] = useState<Array<LegEstimate | null>>([]);
  const [estimatingLegIndex, setEstimatingLegIndex] = useState<number | null>(null);
  const [selectedAircraftPerformance, setSelectedAircraftPerformance] = useState<AircraftPerformanceData | null>(null);
  const [isLoadingSelectedAcPerf, setIsLoadingSelectedAcPerf] = useState(false);

  const form = useForm<FullTripFormData>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: {
      tripId: '',
      selectedCustomerId: undefined,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      aircraftId: undefined,
      status: "Scheduled",
      legs: [{
        origin: '', destination: '', legType: 'Charter', departureDateTime: undefined,
        passengerCount: 1, originFbo: '', destinationFbo: '',
        originTaxiTimeMinutes: 15, destinationTaxiTimeMinutes: 15, flightTimeHours: undefined,
      }],
      notes: '',
    },
  });

  const { setValue, control, getValues, trigger, watch, reset } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "legs",
  });
  
  const currentSelectedAircraftId = watch("aircraftId");
  const legsArray = watch("legs"); 

  useEffect(() => {
    setIsClient(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinLegDepartureDate(today);

    const loadInitialDropdownData = async () => {
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
    loadInitialDropdownData();
  }, [toast]);
  
  useEffect(() => {
    if (isEditMode && initialTripData) {
      const currentAircraftIdFromData = initialTripData.aircraftId || undefined;
      const aircraftModelForEstimates = aircraftSelectOptions.find(ac => ac.value === currentAircraftIdFromData)?.model || 'Unknown Model';

      reset({ 
        tripId: initialTripData.tripId || '',
        selectedCustomerId: initialTripData.selectedCustomerId || initialTripData.customerId || undefined,
        clientName: initialTripData.clientName || '',
        clientEmail: initialTripData.clientEmail || '',
        clientPhone: initialTripData.clientPhone || '',
        aircraftId: currentAircraftIdFromData,
        status: initialTripData.status || "Scheduled",
        legs: (initialTripData.legs || []).map((leg: DbTripLeg) => ({
          ...leg,
          departureDateTime: leg.departureDateTime ? parseISO(leg.departureDateTime) : undefined,
          passengerCount: leg.passengerCount || 1,
          originTaxiTimeMinutes: leg.originTaxiTimeMinutes === undefined ? 15 : leg.originTaxiTimeMinutes,
          destinationTaxiTimeMinutes: leg.destinationTaxiTimeMinutes === undefined ? 15 : leg.destinationTaxiTimeMinutes,
          flightTimeHours: leg.flightTimeHours,
        })),
        notes: initialTripData.notes || '',
      });

      const newLegEstimates = (initialTripData.legs || []).map((leg: DbTripLeg) => {
        if (leg.flightTimeHours !== undefined && leg.flightTimeHours !== null) {
          return {
            estimatedMileageNM: undefined, 
            estimatedFlightTimeHours: leg.flightTimeHours,
            assumedCruiseSpeedKts: undefined, 
            briefExplanation: "Using existing flight time from saved trip data.",
            error: undefined,
            estimatedForInputs: { 
              origin: leg.origin.toUpperCase(),
              destination: leg.destination.toUpperCase(),
              aircraftModel: aircraftModelForEstimates,
              knownCruiseSpeedKts: selectedAircraftPerformance?.cruiseSpeed, 
            }
          } as LegEstimate;
        }
        return null;
      });
      setLegEstimates(newLegEstimates);

    } else if (!isEditMode && !getValues('tripId')) {
      setValue('tripId', `TRP-${Date.now().toString().slice(-6)}`);
      setValue('status', "Scheduled");
      setLegEstimates(new Array(getValues('legs').length).fill(null));
    }
  }, [isEditMode, initialTripData, reset, getValues, setValue, aircraftSelectOptions, selectedAircraftPerformance]); // Added aircraftSelectOptions & selectedAircraftPerformance


  useEffect(() => {
     // Ensure legEstimates array matches legsArray length, preserving existing estimates
    if (legsArray && legEstimates.length !== legsArray.length) {
        setLegEstimates(currentEstimates => {
            const newEstimates = new Array(legsArray.length).fill(null);
            legsArray.forEach((_, index) => {
                if (index < currentEstimates.length && currentEstimates[index]) {
                    newEstimates[index] = currentEstimates[index];
                }
            });
            return newEstimates;
        });
    }
  }, [legsArray, legEstimates.length]);


  useEffect(() => {
    if (currentSelectedAircraftId) {
      setIsLoadingSelectedAcPerf(true);
      fetchAircraftPerformance({ aircraftId: currentSelectedAircraftId })
        .then(perfData => setSelectedAircraftPerformance(perfData))
        .catch(error => {
          console.warn(`Could not fetch performance data for aircraft ${currentSelectedAircraftId}:`, error);
          setSelectedAircraftPerformance(null);
        })
        .finally(() => setIsLoadingSelectedAcPerf(false));
    } else {
      setSelectedAircraftPerformance(null);
    }
  }, [currentSelectedAircraftId]);

  const handleCustomerSelect = (customerId: string | undefined) => {
    setValue('selectedCustomerId', customerId);
    if (!customerId) return;
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email || '');
      setValue('clientPhone', selectedCustomer.phone || '');
    }
  };

  const handleAddLeg = () => {
    let newLegDefaults: Partial<FormLegData> = {
      legType: 'Charter', passengerCount: 1, originTaxiTimeMinutes: 15, destinationTaxiTimeMinutes: 15,
    };
    if (fields.length > 0) {
      const prevLeg = getValues(`legs.${fields.length - 1}`);
      newLegDefaults.origin = prevLeg.destination;
      newLegDefaults.passengerCount = prevLeg.passengerCount;
      if (prevLeg.departureDateTime && isValidDate(prevLeg.departureDateTime)) {
        const prevDep = new Date(prevLeg.departureDateTime);
        const prevFlightHours = Number(prevLeg.flightTimeHours || 1);
        newLegDefaults.departureDateTime = new Date(prevDep.getTime() + (prevFlightHours + 1) * 60 * 60 * 1000);
      }
    }
    append(newLegDefaults as FormLegData);
  };

  const handleRemoveLeg = (index: number) => {
    remove(index);
    setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates.splice(index, 1); return newEstimates; });
  };

  const handleEstimateFlightDetails = useCallback(async (legIndex: number) => {
    if (estimatingLegIndex === legIndex) return;
    if (estimatingLegIndex !== null && estimatingLegIndex !== legIndex) {
       toast({ title: "Estimation in Progress", description: `Still estimating leg ${estimatingLegIndex + 1}. Please wait.`, variant: "default" });
       return;
    }
    const legData = getValues(`legs.${legIndex}`);
    const selectedAircraft = aircraftSelectOptions.find(ac => ac.value === currentSelectedAircraftId);
    if (!legData?.origin || !legData?.destination || !currentSelectedAircraftId || !selectedAircraft) {
      toast({ title: "Missing Information", description: "Origin, destination, and aircraft must be selected.", variant: "destructive" });
      return;
    }
    
    const aircraftModelForFlow = selectedAircraft.model;
    const knownCruiseSpeedForFlow = selectedAircraftPerformance?.cruiseSpeed;
    const currentEstimate = legEstimates[legIndex];

    // Check if inputs for estimation have changed OR if there's no existing valid estimate
    const inputsChanged = !currentEstimate || 
                          currentEstimate.error || // Re-estimate if previous had error
                          currentEstimate.estimatedForInputs?.origin !== legData.origin.toUpperCase() ||
                          currentEstimate.estimatedForInputs?.destination !== legData.destination.toUpperCase() ||
                          currentEstimate.estimatedForInputs?.aircraftModel !== aircraftModelForFlow ||
                          currentEstimate.estimatedForInputs?.knownCruiseSpeedKts !== knownCruiseSpeedForFlow;

    if (!inputsChanged && currentEstimate && currentEstimate.estimatedFlightTimeHours !== undefined) {
        setValue(`legs.${legIndex}.flightTimeHours`, currentEstimate.estimatedFlightTimeHours);
        toast({ title: "Using Existing Estimate", description: `Flight details for Leg ${legIndex + 1} are current.`, variant: "default" });
        return;
    }

    setEstimatingLegIndex(legIndex);
    try {
      const result = await estimateFlightDetails({
        origin: legData.origin.toUpperCase(), destination: legData.destination.toUpperCase(),
        aircraftType: aircraftModelForFlow, knownCruiseSpeedKts: knownCruiseSpeedForFlow,
      });
      setValue(`legs.${legIndex}.flightTimeHours`, result.estimatedFlightTimeHours);
      setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates[legIndex] = {...result, estimatedForInputs: { origin: legData.origin.toUpperCase(), destination: legData.destination.toUpperCase(), aircraftModel: aircraftModelForFlow, knownCruiseSpeedKts: knownCruiseSpeedForFlow } }; return newEstimates; });
      toast({ title: "Flight Details Estimated", description: `Leg ${legIndex + 1}: ${result.estimatedMileageNM} NM, ${result.estimatedFlightTimeHours} hrs.` });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "AI failed to estimate details.";
      toast({ title: "Estimation Error", description: errorMessage, variant: "destructive" });
      setValue(`legs.${legIndex}.flightTimeHours`, undefined); // Clear potentially incorrect value
      setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates[legIndex] = { error: errorMessage, estimatedForInputs: {origin: legData.origin.toUpperCase(), destination: legData.destination.toUpperCase(), aircraftModel: aircraftModelForFlow, knownCruiseSpeedKts: knownCruiseSpeedForFlow} } as LegEstimate; return newEstimates; });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, toast, estimatingLegIndex, setValue, currentSelectedAircraftId, aircraftSelectOptions, selectedAircraftPerformance, legEstimates]);


  const onSubmitHandler: SubmitHandler<FullTripFormData> = async (data) => {
    const isValid = await trigger();
    if (!isValid) {
      toast({ title: "Validation Error", description: "Please check the form for errors.", variant: "destructive" });
      return;
    }
    onSave(data);
  };

  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitHandler)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <Plane className="h-6 w-6 text-primary" />}
              {isEditMode ? `Edit Trip` : 'Create New Trip'}
            </CardTitle>
            <CardDescription>
              {isEditMode ? `Modify the details for Trip ID: ${getValues('tripId') || initialTripData?.tripId || 'N/A'}` : 'Enter the details below to schedule a new trip.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="tripId" render={({ field }) => ( <FormItem> <FormLabel>Trip ID</FormLabel> <FormControl><Input {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl> <FormMessage /> </FormItem> )} />
                {isEditMode && initialQuoteId && (
                     <FormItem>
                        <FormLabel>Sourced From Quote</FormLabel>
                        <Input value={initialQuoteId} readOnly className="bg-muted/50 cursor-not-allowed" />
                    </FormItem>
                )}
            </div>
            
            <FormField control={control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Trip Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} name={field.name}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select trip status" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {tripStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={control} name="selectedCustomerId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel> <Select onValueChange={(value) => { handleCustomerSelect(value); field.onChange(value); }} value={field.value || ""} disabled={isLoadingCustomers}> <FormControl><SelectTrigger><SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select a client or enter details manually"} /></SelectTrigger></FormControl> <SelectContent> {!isLoadingCustomers && customers.length === 0 && <SelectItem value="NO_CUSTOMERS" disabled>No customers</SelectItem>} {customers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))} </SelectContent> </Select> <FormDescription>Auto-fills client details if selected.</FormDescription> <FormMessage /> </FormItem> )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={control} name="clientName" render={({ field }) => ( <FormItem> <FormLabel>Client Name</FormLabel> <FormControl><Input placeholder="John Doe or Acme Corp" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={control} name="clientEmail" render={({ field }) => ( <FormItem> <FormLabel>Client Email</FormLabel> <FormControl><Input type="email" placeholder="contact@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </div>
            <FormField control={control} name="clientPhone" render={({ field }) => ( <FormItem> <FormLabel>Client Phone (Optional)</FormLabel> <FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={control} name="aircraftId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Plane className="h-4 w-4" /> Aircraft</FormLabel> <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingAircraftList}> <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAircraftList ? "Loading aircraft..." : "Select an aircraft"} /></SelectTrigger></FormControl> <SelectContent> {!isLoadingAircraftList && aircraftSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT" disabled>No aircraft in fleet</SelectItem>} {aircraftSelectOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            
            <Separator />
            <section>
              <CardTitle className="text-lg border-b pb-2 mb-4">Flight Legs</CardTitle>
              {fields.map((legItem, index) => (
                <Card key={legItem.id} className="mb-4 p-4 border rounded-lg shadow-sm bg-background/70">
                  <CardHeader className="p-0 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /> Leg {index + 1}</CardTitle>
                      {fields.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLeg(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove Leg</span></Button>)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Origin</FormLabel> <FormControl><Input placeholder="KJFK" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneLanding className="h-4 w-4" />Destination</FormLabel> <FormControl><Input placeholder="KLAX" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Desired Departure Date & Time</FormLabel>
                        <FormControl>
                          {isClient ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !(field.value && field.value instanceof Date && isValidDate(field.value)) && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  <span>{field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "PPP HH:mm") : "Pick a date and time"}</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value && field.value instanceof Date && isValidDate(field.value) ? field.value : undefined}
                                  onSelect={field.onChange}
                                  disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true}
                                  initialFocus
                                />
                                <div className="p-2 border-t">
                                  <Input
                                    type="time"
                                    defaultValue={field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "HH:mm") : ""}
                                    onChange={(e) => {
                                      const time = e.target.value;
                                      const [hours, minutes] = time.split(':').map(Number);
                                      let newDate = field.value && field.value instanceof Date && isValidDate(field.value) ? new Date(field.value) : new Date();
                                      if (!isValidDate(newDate)) newDate = new Date();
                                      newDate.setHours(hours, minutes, 0, 0);
                                      field.onChange(newDate);
                                    }}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Skeleton className="h-10 w-full" />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PaxIcon className="h-4 w-4" />Pax</FormLabel> <FormControl><Input type="number" placeholder="1" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} min="0" /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.originFbo`} render={({ field }) => ( <FormItem> <FormLabel><Building className="inline h-4 w-4 mr-1"/>Origin FBO</FormLabel> <FormControl><Input placeholder="Optional" {...field} /></FormControl> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destinationFbo`} render={({ field }) => ( <FormItem> <FormLabel><Building className="inline h-4 w-4 mr-1"/>Destination FBO</FormLabel> <FormControl><Input placeholder="Optional" {...field} /></FormControl> </FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField control={control} name={`legs.${index}.originTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel>Orig. Taxi (min)</FormLabel> <FormControl><Input type="number" placeholder="15" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} min="0" /></FormControl> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.flightTimeHours`} render={({ field }) => ( <FormItem> <FormLabel>Flight Time (hr)</FormLabel> <FormControl><Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destinationTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel>Dest. Taxi (min)</FormLabel> <FormControl><Input type="number" placeholder="15" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} min="0" /></FormControl> </FormItem> )} />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !currentSelectedAircraftId || isLoadingAircraftList || isLoadingSelectedAcPerf} className="w-full sm:w-auto text-xs"> {estimatingLegIndex === index || isLoadingSelectedAcPerf ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />} Estimate Flight Details </Button>
                    {legEstimates[index] && ( <div className="text-xs p-2 mt-2 border rounded bg-muted/50 flex items-start gap-2"> <InfoIcon className="h-4 w-4 mt-0.5 shrink-0 text-blue-500"/> <div> <p className="font-medium">{legEstimates[index]?.error ? 'Error:' : `AI Est: ${legEstimates[index]?.estimatedMileageNM || 'N/A'} NM, ${legEstimates[index]?.estimatedFlightTimeHours || 'N/A'} hrs. Speed: ${legEstimates[index]?.assumedCruiseSpeedKts || 'N/A'} kts.`}</p> <p className="text-muted-foreground">{legEstimates[index]?.briefExplanation || legEstimates[index]?.error}</p> </div> </div> )}
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={handleAddLeg} className="w-full sm:w-auto mt-2"> <PlusCircle className="mr-2 h-4 w-4" /> Add New Leg </Button>
              {form.formState.errors.legs && typeof form.formState.errors.legs === 'object' && !Array.isArray(form.formState.errors.legs) && ( <FormMessage>{(form.formState.errors.legs as any).message}</FormMessage> )}
            </section>
            <Separator />
            {legsArray && legsArray.length > 0 && (
              <section className="mt-6">
                <LegsSummaryTable legs={legsArray} />
              </section>
            )}
            <Separator />
            <FormField control={control} name="notes" render={({ field }) => ( <FormItem> <FormLabel>Trip Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="Enter any internal notes specific to this trip..." {...field} value={field.value || ''} rows={3} /></FormControl> <FormMessage /> </FormItem> )} />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditMode ? 'Save Trip Changes' : 'Create Trip'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}


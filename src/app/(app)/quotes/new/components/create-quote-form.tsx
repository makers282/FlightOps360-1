
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info, Eye, Send, Building, UserSearch } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { estimateFlightDetails, type EstimateFlightDetailsInput, type EstimateFlightDetailsOutput } from '@/ai/flows/estimate-flight-details-flow';
import { fetchFbosForAirport, type FetchFbosInput, type FetchFbosOutput } from '@/ai/flows/fetch-fbos-flow';
import type { Fbo } from '@/ai/tools/get-fbos-tool';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LegsSummaryTable } from './legs-summary-table';

const legTypes = [
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

const legSchema = z.object({
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5, "Origin airport code too long.").toUpperCase(),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5, "Destination airport code too long.").toUpperCase(),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }),
  legType: z.enum(legTypes, { required_error: "Leg type is required." }),
  passengerCount: z.coerce.number().min(0, "Passenger count cannot be negative.").int().default(1),
  originFbo: z.string().optional(),
  destinationFbo: z.string().optional(),
});

const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),

  legs: z.array(legSchema).min(1, "At least one flight leg is required."),

  aircraftType: z.string().min(1, "Aircraft type is required."),
  medicsRequested: z.boolean().optional().default(false),
  cateringRequested: z.boolean().optional().default(false),
  cateringNotes: z.string().optional(),
  includeLandingFees: z.boolean().optional().default(false),
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export type LegFormData = z.infer<typeof legSchema>;
export type FullQuoteFormData = z.infer<typeof formSchema>;


type LegEstimate = EstimateFlightDetailsOutput & {
  error?: string;
  estimatedForInputs?: { origin: string; destination: string; aircraftType: string };
};

const availableAircraft = [
  { id: 'N123AB', name: 'N123AB - Cessna Citation CJ3' },
  { id: 'N456CD', name: 'N456CD - Bombardier Global 6000' },
  { id: 'N789EF', name: 'N789EF - Gulfstream G650ER' },
  { id: 'LIGHT_JET', name: 'Category: Light Jet' },
  { id: 'MID_JET', name: 'Category: Midsize Jet' },
  { id: 'HEAVY_JET', name: 'Category: Heavy Jet' },
];

const sampleCustomerData = [
  { id: 'CUST001', name: 'John Doe', company: 'Doe Industries', email: 'john.doe@example.com', phone: '555-1234', notes: 'VIP Client, prefers morning flights. Allergic to peanuts.', lastActivity: '2024-08-10' },
  { id: 'CUST002', name: 'Jane Smith', company: 'Smith Corp', email: 'jane.smith@example.com', phone: '555-5678', notes: 'Requires specific catering (vegan options). Always travels with small dog.', lastActivity: '2024-07-25' },
  { id: 'CUST003', name: 'Robert Brown', company: 'Brown & Co.', email: 'robert.brown@example.com', phone: '555-8765', notes: 'Often books last minute. Prefers aisle seat if on shared flights.', lastActivity: '2024-08-01' },
  { id: 'CUST004', name: 'Emily White', company: 'White Solutions', email: 'emily.white@example.com', phone: '555-4321', notes: 'Interested in block hours. Usually flies with 2 assistants.', lastActivity: '2024-06-15' },
];

const PLACEHOLDER_HOURLY_RATE = 3200;
const PLACEHOLDER_LANDING_FEE_PER_LEG = 500;
const PLACEHOLDER_OVERNIGHT_FEE_PER_NIGHT = 1000;
const PLACEHOLDER_MEDICS_FEE = 2000;
const PLACEHOLDER_CATERING_FEE = 500;


export function CreateQuoteForm() {
  const [isGeneratingQuote, startQuoteGenerationTransition] = useTransition();
  const [estimatingLegIndex, setEstimatingLegIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [legEstimates, setLegEstimates] = useState<Array<LegEstimate | null>>([]);
  const [totalEstimatedQuotePrice, setTotalEstimatedQuotePrice] = useState(0);

  const [originFboOptionsPerLeg, setOriginFboOptionsPerLeg] = useState<Array<Fbo[]>>([]);
  const [destinationFboOptionsPerLeg, setDestinationFboOptionsPerLeg] = useState<Array<Fbo[]>>([]);
  const [fetchingFbosForLeg, setFetchingFbosForLeg] = useState<Record<number, {origin?: boolean, destination?: boolean}>>({});


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quoteId: '',
      selectedCustomerId: undefined,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      legs: [{
        origin: '',
        destination: '',
        legType: 'Charter',
        departureDateTime: undefined as Date | undefined,
        passengerCount: 1,
        originFbo: '',
        destinationFbo: '',
      }],
      aircraftType: '',
      medicsRequested: false,
      cateringRequested: false,
      cateringNotes: "",
      includeLandingFees: false,
      estimatedOvernights: 0,
      notes: '',
    },
  });

  const { control, setValue, getValues, watch, trigger, formState: { errors } } = form;
  const cateringRequestedValue = watch("cateringRequested");
  const legsArray = watch("legs");
  const aircraftTypeValue = watch("aircraftType");
  const includeLandingFeesValue = watch("includeLandingFees");
  const estimatedOvernightsValue = watch("estimatedOvernights");
  const medicsRequestedValue = watch("medicsRequested");
  const cateringRequestedWatch = watch("cateringRequested");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "legs",
  });

  useEffect(() => {
    setIsClient(true);
    if (!getValues('quoteId')) {
      setValue('quoteId', `QT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinLegDepartureDate(today);
  }, [setValue, getValues]);

  useEffect(() => {
    setLegEstimates(prevEstimates => {
      const newEstimates = new Array(legsArray.length).fill(null);
      legsArray.forEach((_, index) => {
        if (prevEstimates[index]) newEstimates[index] = prevEstimates[index];
      });
      return newEstimates;
    });
     setOriginFboOptionsPerLeg(prev => {
      const newOptions = new Array(legsArray.length).fill(undefined).map((_, i) => prev[i] || []);
      return newOptions;
    });
    setDestinationFboOptionsPerLeg(prev => {
      const newOptions = new Array(legsArray.length).fill(undefined).map((_, i) => prev[i] || []);
      return newOptions;
    });
    setFetchingFbosForLeg(prev => {
      const newFetchingState: Record<number, {origin?: boolean, destination?: boolean}> = {};
      for(let i = 0; i < legsArray.length; i++) {
        newFetchingState[i] = prev[i] || { origin: false, destination: false };
      }
      return newFetchingState;
    });
  }, [legsArray.length]);

  useEffect(() => {
    let runningTotal = 0;
    legsArray.forEach((_, index) => {
      const estimate = legEstimates[index];
      if (estimate && estimate.estimatedFlightTimeHours && !estimate.error) {
        runningTotal += estimate.estimatedFlightTimeHours * PLACEHOLDER_HOURLY_RATE;
        if (includeLandingFeesValue) {
          runningTotal += PLACEHOLDER_LANDING_FEE_PER_LEG;
        }
      }
    });

    if (estimatedOvernightsValue > 0) {
      runningTotal += estimatedOvernightsValue * PLACEHOLDER_OVERNIGHT_FEE_PER_NIGHT;
    }
    if (medicsRequestedValue) {
      runningTotal += PLACEHOLDER_MEDICS_FEE;
    }
    if (cateringRequestedWatch) {
      runningTotal += PLACEHOLDER_CATERING_FEE;
    }

    setTotalEstimatedQuotePrice(runningTotal);

  }, [legsArray, legEstimates, includeLandingFeesValue, estimatedOvernightsValue, medicsRequestedValue, cateringRequestedWatch]);


  const handleEstimateFlightDetails = useCallback(async (legIndex: number) => {
    if (estimatingLegIndex === legIndex) return;
    if (estimatingLegIndex !== null && estimatingLegIndex !== legIndex) {
       toast({ title: "Estimation in Progress", description: `Still estimating leg ${estimatingLegIndex + 1}. Please wait.`, variant: "default" });
       return;
    }

    const legData = getValues(`legs.${legIndex}`);
    const currentAircraftTypeId = getValues('aircraftType');

    if (!legData?.origin || legData.origin.length < 3 || !legData?.destination || legData.destination.length < 3 || !currentAircraftTypeId) {
      toast({ title: "Missing Information", description: "Please provide origin, destination (min 3 chars each), and select an aircraft type before estimating.", variant: "destructive"});
      return;
    }

    const selectedAircraft = availableAircraft.find(ac => ac.id === currentAircraftTypeId);
    const aircraftNameForFlow = selectedAircraft ? selectedAircraft.name : currentAircraftTypeId;

    const currentEstimate = legEstimates[legIndex];
    if (currentEstimate &&
        !currentEstimate.error &&
        currentEstimate.estimatedForInputs?.origin === legData.origin.toUpperCase() &&
        currentEstimate.estimatedForInputs?.destination === legData.destination.toUpperCase() &&
        currentEstimate.estimatedForInputs?.aircraftType === aircraftNameForFlow) {
      toast({ title: "Estimate Exists", description: "Flight details already estimated for these inputs.", variant: "default" });
      return;
    }

    setEstimatingLegIndex(legIndex);

    setLegEstimates(prev => {
      const newEstimates = [...prev];
      newEstimates[legIndex] = null; 
      return newEstimates;
    });

    try {
      const result = await estimateFlightDetails({
        origin: legData.origin.toUpperCase(),
        destination: legData.destination.toUpperCase(),
        aircraftType: aircraftNameForFlow,
      });
      setLegEstimates(prev => {
        const newEstimates = [...prev];
        newEstimates[legIndex] = {
          ...result,
          estimatedForInputs: {
            origin: legData.origin.toUpperCase(),
            destination: legData.destination.toUpperCase(),
            aircraftType: aircraftNameForFlow
          }
        };
        return newEstimates;
      });
      toast({ title: "Flight Details Estimated", description: `Leg ${legIndex + 1}: ${result.estimatedMileageNM} NM, ${result.estimatedFlightTimeHours} hrs.` });
    } catch (e) {
      console.error("Error estimating flight details:", e);
      const errorMessage = e instanceof Error ? e.message : "AI failed to estimate details.";
      toast({ title: "Estimation Error", description: errorMessage, variant: "destructive" });
      setLegEstimates(prev => {
        const newEstimates = [...prev];
        newEstimates[legIndex] = {
          error: errorMessage,
          estimatedForInputs: {
            origin: legData.origin.toUpperCase(),
            destination: legData.destination.toUpperCase(),
            aircraftType: aircraftNameForFlow
          }
        } as LegEstimate; 
        return newEstimates;
      });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, legEstimates, toast, estimatingLegIndex]);


  const loadFbosForLeg = useCallback(async (legIndex: number, airportCode: string, type: 'origin' | 'destination') => {
    console.log(`[CLIENT DEBUG] loadFbosForLeg CALLED for leg ${legIndex + 1}, airport ${airportCode}, type ${type}`);

    if (!airportCode || airportCode.length < 3) {
      if (type === 'origin') setOriginFboOptionsPerLeg(prev => { const upd = [...prev]; upd[legIndex] = []; return upd; });
      else setDestinationFboOptionsPerLeg(prev => { const upd = [...prev]; upd[legIndex] = []; return upd; });
      return;
    }
    
    console.log(`[CLIENT DEBUG] loadFbosForLeg - Setting fetching to true for leg ${legIndex + 1}, type ${type}`);
    setFetchingFbosForLeg(prev => ({ ...prev, [legIndex]: { ...prev[legIndex], [type]: true } }));
    
    let fetchedFbos: FetchFbosOutput = [];
    let fetchError: any = null;

    try {
      console.log(`[CLIENT DEBUG] FBO Fetch Start for Leg ${legIndex + 1}, Airport: ${airportCode.toUpperCase()}, Type: ${type}`);
      const result = await fetchFbosForAirport({ airportCode: airportCode.toUpperCase() });
      console.log(`[CLIENT DEBUG] RAW RESULT from fetchFbosForAirport for Leg ${legIndex + 1} (${type}):`, JSON.stringify(result));


      if (Array.isArray(result)) {
        fetchedFbos = result;
      } else {
        console.error(`[CLIENT DEBUG] fetchFbosForAirport returned non-array for Leg ${legIndex + 1} (${type}):`, result);
        fetchedFbos = []; // Default to empty array if result is not an array
      }
      console.log(`[CLIENT DEBUG] Fetched FBOs for Leg ${legIndex + 1} (${type}), (processed as 'fetchedFbos'):`, JSON.stringify(fetchedFbos));

    } catch (error) {
      fetchError = error;
      console.error(`[CLIENT DEBUG] FBO Fetch Error for Leg ${legIndex + 1}, Airport: ${airportCode}, Type: ${type}:`, error);
      toast({ title: `Failed to load ${type} FBOs for ${airportCode}`, description: (error as Error).message, variant: "destructive" });
      fetchedFbos = []; // Ensure fbos is an empty array on error
    } finally {
      if (type === 'origin') {
        console.log(`[CLIENT DEBUG] SETTING Origin FBO Options for leg ${legIndex + 1} with:`, JSON.stringify(fetchedFbos));
        setOriginFboOptionsPerLeg(prev => { const upd = [...prev]; if(upd[legIndex] !== undefined) upd[legIndex] = fetchedFbos; else if (prev.length > legIndex) upd[legIndex] = fetchedFbos; return upd; });
      } else {
        console.log(`[CLIENT DEBUG] SETTING Destination FBO Options for leg ${legIndex + 1} with:`, JSON.stringify(fetchedFbos));
        setDestinationFboOptionsPerLeg(prev => { const upd = [...prev]; if(upd[legIndex] !== undefined) upd[legIndex] = fetchedFbos; else if (prev.length > legIndex) upd[legIndex] = fetchedFbos; return upd; });
      }
      setFetchingFbosForLeg(prev => ({ ...prev, [legIndex]: { ...prev[legIndex], [type]: false } }));
      console.log(`[CLIENT DEBUG] FBO Fetch Complete for Leg ${legIndex + 1}, Airport: ${airportCode}, Type: ${type}`);
    }
  }, [toast, setOriginFboOptionsPerLeg, setDestinationFboOptionsPerLeg, setFetchingFbosForLeg, getValues]);


  useEffect(() => {
    legsArray.forEach((leg, index) => {
      const currentOriginOptions = originFboOptionsPerLeg[index] || [];
      const currentDestinationOptions = destinationFboOptionsPerLeg[index] || [];

      // Determine if fetch is needed for origin
      const needsOriginFetch = leg.origin && leg.origin.length >= 3 && 
                              (!(fetchingFbosForLeg[index]?.origin)) && // Not already fetching
                              (currentOriginOptions.length === 0 || (currentOriginOptions[0]?.airportCode?.toUpperCase() !== leg.origin.toUpperCase())); // No options or options for different airport

      if (needsOriginFetch) {
        loadFbosForLeg(index, leg.origin, 'origin');
      } else if ((!leg.origin || leg.origin.length < 3) && currentOriginOptions.length > 0) {
        // Clear if airport code is removed/too short
        setOriginFboOptionsPerLeg(prev => { const upd = [...prev]; upd[legIndex] = []; return upd; });
      }

      // Determine if fetch is needed for destination
      const needsDestinationFetch = leg.destination && leg.destination.length >=3 &&
                                    (!(fetchingFbosForLeg[index]?.destination)) && // Not already fetching
                                    (currentDestinationOptions.length === 0 || (currentDestinationOptions[0]?.airportCode?.toUpperCase() !== leg.destination.toUpperCase())); // No options or options for different airport
      
      if (needsDestinationFetch) {
        loadFbosForLeg(index, leg.destination, 'destination');
      } else if ((!leg.destination || leg.destination.length < 3) && currentDestinationOptions.length > 0) {
         // Clear if airport code is removed/too short
        setDestinationFboOptionsPerLeg(prev => { const upd = [...prev]; upd[index] = []; return upd; });
      }
    });
  }, [legsArray, loadFbosForLeg, originFboOptionsPerLeg, destinationFboOptionsPerLeg, fetchingFbosForLeg]); // Added fetchingFbosForLeg

  const onSendQuote: SubmitHandler<FormData> = (data) => {
    startQuoteGenerationTransition(async () => {
      console.log('Quote Data (Send Quote):', data);
      const finalData = {
        ...data,
        totalEstimatedQuotePrice,
        cateringNotes: data.cateringRequested ? data.cateringNotes : undefined, 
        legsWithEstimates: data.legs.map((leg, index) => ({
          ...leg,
          estimation: legEstimates[index] && !legEstimates[index]?.error ? legEstimates[index] : undefined,
        }))
      };
      toast({
        title: "Quote Sent (Simulated)",
        description: (
          <pre className="mt-2 w-full max-w-[480px] rounded-md bg-slate-950 p-4 overflow-x-auto">
            <code className="text-white whitespace-pre-wrap">{JSON.stringify(finalData, null, 2)}</code>
          </pre>
        ),
        variant: "default",
      });
    });
  };

  const handlePreviewQuote = () => {
    console.log("Preview Quote Clicked. Current form data:", getValues());
    console.log("Current leg estimates:", legEstimates);
    console.log("Current total estimated price:", totalEstimatedQuotePrice);
    toast({
      title: "Quote Preview (Logged to Console)",
      description: "Check the browser console for the current quote details.",
    });
  };

  const handleAddLeg = () => {
    let newLegOrigin = '';
    let newLegDepartureDateTime: Date | undefined = undefined;
    let previousLegPax = 1;

    if (fields.length > 0) {
      const previousLegIndex = fields.length - 1;
      const previousLeg = getValues(`legs.${previousLegIndex}`);
      newLegOrigin = previousLeg.destination; 
      previousLegPax = previousLeg.passengerCount || 1; 


      const previousLegEstimate = legEstimates[previousLegIndex];
      if (previousLeg.departureDateTime && previousLegEstimate && previousLegEstimate.estimatedFlightTimeHours && !previousLegEstimate.error) {
        const previousLegDeparture = new Date(previousLeg.departureDateTime);
        const estimatedArrivalMillis = previousLegDeparture.getTime() + (previousLegEstimate.estimatedFlightTimeHours * 60 * 60 * 1000);
        newLegDepartureDateTime = new Date(estimatedArrivalMillis + (60 * 60 * 1000)); // 1 hour later
      } else if (previousLeg.departureDateTime) {
         newLegDepartureDateTime = new Date(new Date(previousLeg.departureDateTime).getTime() + (3 * 60 * 60 * 1000)); // Fallback: 3 hours later
      }
    }

    append({
      origin: newLegOrigin.toUpperCase(),
      destination: '',
      departureDateTime: newLegDepartureDateTime,
      legType: 'Charter',
      passengerCount: previousLegPax,
      originFbo: '',
      destinationFbo: '',
    });
  };

  const handleRemoveLeg = (index: number) => {
    remove(index);
    setLegEstimates(prev => {
        const newEstimates = [...prev];
        newEstimates.splice(index, 1);
        return newEstimates;
    });
     setOriginFboOptionsPerLeg(prev => {
        const newOptions = [...prev];
        newOptions.splice(index, 1);
        return newOptions;
    });
    setDestinationFboOptionsPerLeg(prev => {
        const newOptions = [...prev];
        newOptions.splice(index, 1);
        return newOptions;
    });
    // Also remove the fetching state for the removed leg
    setFetchingFbosForLeg(prev => {
        const newFetchingState = {...prev};
        delete newFetchingState[index];
        // Adjust keys for subsequent legs if necessary, though usually not needed if keys are numeric indices
        return newFetchingState;
    })
  };

  const handleCustomerSelect = (customerId: string) => {
    const selectedCustomer = sampleCustomerData.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email);
      setValue('clientPhone', selectedCustomer.phone || '');
      setValue('selectedCustomerId', customerId);
    } else {
      setValue('clientName', '');
      setValue('clientEmail', '');
      setValue('clientPhone', '');
      setValue('selectedCustomerId', undefined);
    }
  };


  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>New Quote Details</CardTitle>
        <CardDescription>Fill in the client and trip information to generate a quote.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSendQuote)}>
          <CardContent className="space-y-8">
            <FormField
              control={control}
              name="quoteId"
              render={({ field }) => (
                <FormItem className="mb-6">
                  <FormLabel>Quote ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., QT-ABCDE" {...field} value={field.value || ''} readOnly className="bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <section>
              <CardTitle className="text-xl border-b pb-2 mb-4">Client Information</CardTitle>
              <FormField
                control={control}
                name="selectedCustomerId"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        // field.onChange(value); // This updates selectedCustomerId
                        handleCustomerSelect(value); // This populates other fields and sets selectedCustomerId
                      }}
                      value={field.value || ""} 
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client to auto-fill details" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sampleCustomerData.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.company})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Choosing a client will auto-populate their details below.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <FormField control={control} name="clientName" render={({ field }) => ( <FormItem> <FormLabel>Client Name</FormLabel> <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={control} name="clientEmail" render={({ field }) => ( <FormItem> <FormLabel>Client Email</FormLabel> <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </div>
              <FormField control={control} name="clientPhone" render={({ field }) => ( <FormItem> <FormLabel>Client Phone</FormLabel> <FormControl><Input type="tel" placeholder="e.g., (555) 123-4567" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </section>

            <Separator />
            <section>
              <CardTitle className="text-xl border-b pb-2 mb-4">General Quote Options</CardTitle>
              <div className="grid grid-cols-1 gap-6 mb-6">
                <FormField control={control} name="aircraftType" render={({ field }) => ( <FormItem> <FormLabel>Aircraft Type</FormLabel> <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}> <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft type" /></SelectTrigger></FormControl> <SelectContent>{availableAircraft.map(aircraft => (<SelectItem key={aircraft.id} value={aircraft.id}>{aircraft.name}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
              </div>
            </section>
            <Separator />

            <section>
              <CardTitle className="text-xl border-b pb-2 mb-6">Flight Legs</CardTitle>
              {fields.map((legItem, index) => (
                <Card key={legItem.id} className="mb-6 p-4 border rounded-lg shadow-sm bg-background/50">
                  <CardHeader className="p-0 pb-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground" /> Leg {index + 1}
                      </CardTitle>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLeg(index)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove Leg</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Origin Airport</FormLabel> <FormControl><Input placeholder="e.g., KJFK" {...field} onChange={(e) => { field.onChange(e.target.value.toUpperCase()); trigger(`legs.${index}.origin`); }} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneLanding className="h-4 w-4" />Destination Airport</FormLabel> <FormControl><Input placeholder="e.g., KLAX" {...field} onChange={(e) => { field.onChange(e.target.value.toUpperCase()); trigger(`legs.${index}.destination`); }} /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.originFbo`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Building className="h-4 w-4" />Origin FBO</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}>
                                    <FormControl>
                                      <SelectTrigger
                                        disabled={fetchingFbosForLeg[index]?.origin}
                                      >
                                        <SelectValue placeholder={fetchingFbosForLeg[index]?.origin ? "Loading FBOs..." : "Select Origin FBO"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {(() => {
                                          const options = originFboOptionsPerLeg[index] || [];
                                          const isLoading = fetchingFbosForLeg[index]?.origin;
                                          const currentAirportCode = getValues(`legs.${index}.origin`);
                                          console.log(`[CLIENT DEBUG RENDER] Leg ${index + 1} Origin FBO SelectContent:`, { options: options ? JSON.stringify(options.slice(0,2)) + (options.length > 2 ? '...' : '') : 'undefined', isLoading, currentAirportCode });
                                          if (isLoading) {
                                            return <SelectItem value="loading" disabled>Loading FBOs...</SelectItem>;
                                          }
                                          if (!options || options.length === 0) {
                                            if (currentAirportCode && currentAirportCode.length >= 3) {
                                              return <SelectItem value="no-fbos" disabled>No FBOs found</SelectItem>;
                                            }
                                            return <SelectItem value="enter-airport" disabled>Enter airport code</SelectItem>;
                                          }
                                          return options.map(fbo => (
                                            <SelectItem key={fbo.id} value={fbo.name}>{fbo.name}</SelectItem>
                                          ));
                                        })()}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={control} name={`legs.${index}.destinationFbo`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Building className="h-4 w-4" />Destination FBO</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}>
                                     <FormControl>
                                      <SelectTrigger
                                        disabled={fetchingFbosForLeg[index]?.destination}
                                      >
                                        <SelectValue placeholder={fetchingFbosForLeg[index]?.destination ? "Loading FBOs..." : "Select Destination FBO"} />
                                      </SelectTrigger>
                                     </FormControl>
                                    <SelectContent>
                                      {(() => {
                                          const options = destinationFboOptionsPerLeg[index] || [];
                                          const isLoading = fetchingFbosForLeg[index]?.destination;
                                          const currentAirportCode = getValues(`legs.${index}.destination`);
                                          console.log(`[CLIENT DEBUG RENDER] Leg ${index + 1} Destination FBO SelectContent:`, { options: options ? JSON.stringify(options.slice(0,2)) + (options.length > 2 ? '...' : '') : 'undefined', isLoading, currentAirportCode });
                                          if (isLoading) {
                                            return <SelectItem value="loading" disabled>Loading FBOs...</SelectItem>;
                                          }
                                          if (!options || options.length === 0) {
                                            if (currentAirportCode && currentAirportCode.length >= 3) {
                                              return <SelectItem value="no-fbos" disabled>No FBOs found</SelectItem>;
                                            }
                                            return <SelectItem value="enter-airport" disabled>Enter airport code</SelectItem>;
                                          }
                                          return options.map(fbo => (
                                            <SelectItem key={fbo.id} value={fbo.name}>{fbo.name}</SelectItem>
                                          ));
                                        })()}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <FormField
                      control={control}
                      name={`legs.${index}.departureDateTime`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Desired Departure Date & Time</FormLabel>
                          {isClient ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(new Date(field.value), "PPP HH:mm") : <span>Pick a date and time</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true} initialFocus />
                                <div className="p-2 border-t border-border">
                                  <Input type="time" defaultValue={field.value ? format(new Date(field.value), "HH:mm") : ""} onChange={(e) => { const time = e.target.value; const [hours, minutes] = time.split(':').map(Number); const newDate = field.value ? new Date(field.value) : new Date(); newDate.setHours(hours, minutes); field.onChange(newDate); }} />
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : ( <Skeleton className="h-10 w-full" /> )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}> <FormControl><SelectTrigger><SelectValue placeholder="Select leg type" /></SelectTrigger></FormControl> <SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" />Passengers</FormLabel> <FormControl><Input type="number" placeholder="e.g., 2" {...field} min="0" /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !aircraftTypeValue} className="w-full sm:w-auto">
                        {estimatingLegIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Estimate Flight Details
                    </Button>
                    {!aircraftTypeValue && <FormDescription className="text-xs text-destructive">Select an aircraft type above to enable estimation.</FormDescription>}

                    {legEstimates[index] && (() => {
                      const estimate = legEstimates[index]!;
                      const legData = getValues(`legs.${index}`);
                      let formattedArrivalTime = 'N/A';
                      let costDisplay = 'N/A';

                      if (legData.departureDateTime && estimate.estimatedFlightTimeHours && !estimate.error) {
                        const departureTime = new Date(legData.departureDateTime);
                        const arrivalTimeMillis = departureTime.getTime() + (estimate.estimatedFlightTimeHours * 60 * 60 * 1000);
                        formattedArrivalTime = format(new Date(arrivalTimeMillis), "PPP HH:mm");

                        const calculatedCost = estimate.estimatedFlightTimeHours * PLACEHOLDER_HOURLY_RATE;
                        costDisplay = `$${calculatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      } else if (estimate.estimatedFlightTimeHours && !estimate.error) {
                        const calculatedCost = estimate.estimatedFlightTimeHours * PLACEHOLDER_HOURLY_RATE;
                        costDisplay = `$${calculatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }

                      return (
                        <Alert variant={estimate.error ? "destructive" : "default"} className="mt-4">
                          <Info className={`h-4 w-4 ${estimate.error ? '' : 'text-primary'}`} />
                          <AlertTitle>{estimate.error ? `Error Estimating Leg ${index + 1}` : `Leg ${index + 1} Estimate`}</AlertTitle>
                          <AlertDescription>
                            {estimate.error ? (
                              <p>{estimate.error}</p>
                            ) : (
                              <>
                                <p><strong>Distance:</strong> {estimate.estimatedMileageNM?.toLocaleString()} NM</p>
                                <p><strong>Est. Flight Time:</strong> {estimate.estimatedFlightTimeHours?.toFixed(1)} hours</p>
                                {legData.departureDateTime && <p><strong>Est. Arrival Time:</strong> {formattedArrivalTime}</p>}
                                <p><strong>Est. Leg Cost (Flight Only):</strong> {costDisplay} <em className="text-xs">(at ${PLACEHOLDER_HOURLY_RATE}/hr placeholder)</em></p>
                                <p><strong>Assumed Speed:</strong> {estimate.assumedCruiseSpeedKts?.toLocaleString()} kts</p>
                                <p className="text-xs mt-1"><em>{estimate.briefExplanation}</em></p>
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={handleAddLeg} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Leg
              </Button>
              {errors.legs && typeof errors.legs === 'object' && !Array.isArray(errors.legs) && (
                <FormMessage>{(errors.legs as any).message}</FormMessage> 
              )}
            </section>

            <Separator />
            {fields.length > 0 && (
              <section>
                <CardTitle className="text-xl border-b pb-2 mb-4">Itinerary Summary</CardTitle>
                <LegsSummaryTable
                  legs={legsArray}
                  legEstimates={legEstimates}
                />
              </section>
            )}
            <Separator />


            <section>
                <CardTitle className="text-xl border-b pb-2 mb-4">Additional Quote Options</CardTitle>
                <div className="space-y-4">
                    <FormField control={control} name="medicsRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Medics Requested</FormLabel></div> </FormItem> )} />
                    <FormField control={control} name="cateringRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> Catering Requested</FormLabel></div> </FormItem> )} />
                    {cateringRequestedValue && ( <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem className="pl-8"> <FormLabel>Catering Notes</FormLabel> <FormControl><Textarea placeholder="Specify catering details..." {...field} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> )}
                    <FormField control={control} name="includeLandingFees" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Include Estimated Landing Fees (per leg)</FormLabel></div> </FormItem> )} />
                    <FormField control={control} name="estimatedOvernights" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> Estimated Overnights</FormLabel> <FormControl><Input type="number" placeholder="e.g., 2" {...field} min="0" /></FormControl> <FormDescription>Number of overnight stays for crew/aircraft.</FormDescription> <FormMessage /> </FormItem> )} />
                </div>
            </section>

            <Separator />

            <FormField
              control={control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Quote Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Specific client preferences, discount applied..." {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-6" />
            <div className="space-y-2 text-right">
                <p className="text-lg font-semibold text-foreground">
                    Estimated Total Quote Price:
                </p>
                <p className="text-3xl font-bold text-primary">
                    ${totalEstimatedQuotePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                    Includes estimated flight time, selected options, and placeholder fees.
                </p>
            </div>

          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handlePreviewQuote}>
              <Eye className="mr-2 h-4 w-4" />
              Preview Quote
            </Button>
            <Button type="submit" disabled={isGeneratingQuote}>
              {isGeneratingQuote ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Send className="mr-2 h-4 w-4" /> )}
              Send Quote
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}



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
import { CalendarIcon, Loader2, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info, Eye, Send, Building, UserSearch, DollarSign, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, addHours } from "date-fns";
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
  originTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  destinationTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  flightTimeHours: z.coerce.number().min(0).optional(),
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
  includeLandingFees: z.boolean().optional().default(true),
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
export type LegFormData = z.infer<typeof legSchema>;
export type FullQuoteFormData = z.infer<typeof formSchema>;

type LegEstimate = EstimateFlightDetailsOutput & {
  error?: string;
  estimatedForInputs?: { origin: string; destination: string; aircraftType: string };
  blockTimeHours?: number;
};

const availableAircraft = [
  { id: 'N123AB', name: 'N123AB - Cessna Citation CJ3' },
  { id: 'N456CD', name: 'N456CD - Bombardier Global 6000' },
  { id: 'N789EF', name: 'N789EF - Gulfstream G650ER' },
  { id: 'LIGHT_JET', name: 'Category: Light Jet' },
  { id: 'MID_JET', name: 'Category: Midsize Jet' },
  { id: 'HEAVY_JET', name: 'Category: Heavy Jet' },
];

// Placeholder Cost Settings
const AIRCRAFT_HOURLY_RATES: { [key: string]: number } = {
  'N123AB - Cessna Citation CJ3': 3200,
  'N456CD - Bombardier Global 6000': 6500,
  'N789EF - Gulfstream G650ER': 8500,
  'Category: Light Jet': 2800,
  'Category: Midsize Jet': 4500,
  'Category: Heavy Jet': 7500,
};
const DEFAULT_AIRCRAFT_HOURLY_RATE = 4000;

const OTHER_COSTS = {
  LANDING_FEE_PER_LEG: 500,
  OVERNIGHT_FEE_PER_NIGHT: 1500,
  MEDICS_FEE: 2500,
  CATERING_FEE: 500, // Per quote, not per leg currently
};


const sampleCustomerData = [
  { id: 'CUST001', name: 'John Doe', company: 'Doe Industries', email: 'john.doe@example.com', phone: '555-1234' },
  { id: 'CUST002', name: 'Jane Smith', company: 'Smith Corp', email: 'jane.smith@example.com', phone: '555-5678' },
  { id: 'CUST003', name: 'Robert Brown', company: 'Brown & Co.', email: 'robert.brown@example.com', phone: '555-8765' },
  { id: 'CUST004', name: 'Emily White', company: 'White Solutions', email: 'emily.white@example.com', phone: '555-4321' },
];


export function CreateQuoteForm() {
  const [isGeneratingQuote, startQuoteGenerationTransition] = useTransition();
  const [estimatingLegIndex, setEstimatingLegIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [legEstimates, setLegEstimates] = useState<Array<LegEstimate | null>>([]);
  const [totalEstimatedQuotePrice, setTotalEstimatedQuotePrice] = useState(0);

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
        originTaxiTimeMinutes: 15,
        destinationTaxiTimeMinutes: 15,
        flightTimeHours: undefined,
      }],
      aircraftType: '',
      medicsRequested: false,
      cateringRequested: false,
      cateringNotes: "",
      includeLandingFees: true,
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
  }, [legsArray.length]);

  useEffect(() => {
    let runningTotal = 0;
    const selectedAircraftId = getValues('aircraftType');
    const selectedAircraft = availableAircraft.find(ac => ac.id === selectedAircraftId);
    const aircraftName = selectedAircraft?.name;
    const hourlyRate = aircraftName ? (AIRCRAFT_HOURLY_RATES[aircraftName] || DEFAULT_AIRCRAFT_HOURLY_RATE) : DEFAULT_AIRCRAFT_HOURLY_RATE;

    legsArray.forEach((leg) => {
      const flightTime = leg.flightTimeHours;
      if (flightTime && flightTime > 0) {
        runningTotal += flightTime * hourlyRate;
      }
      if (includeLandingFeesValue) {
        runningTotal += OTHER_COSTS.LANDING_FEE_PER_LEG;
      }
    });

    if (estimatedOvernightsValue > 0) {
      runningTotal += estimatedOvernightsValue * OTHER_COSTS.OVERNIGHT_FEE_PER_NIGHT;
    }
    if (medicsRequestedValue) {
      runningTotal += OTHER_COSTS.MEDICS_FEE;
    }
    if (cateringRequestedWatch) {
      runningTotal += OTHER_COSTS.CATERING_FEE;
    }

    setTotalEstimatedQuotePrice(runningTotal);

  }, [legsArray, aircraftTypeValue, includeLandingFeesValue, estimatedOvernightsValue, medicsRequestedValue, cateringRequestedWatch, getValues]);


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
      if(currentEstimate.estimatedFlightTimeHours !== undefined) {
        setValue(`legs.${legIndex}.flightTimeHours`, currentEstimate.estimatedFlightTimeHours);
      }
      return;
    }

    setEstimatingLegIndex(legIndex);
    setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates[legIndex] = null; return newEstimates; });

    try {
      const result = await estimateFlightDetails({
        origin: legData.origin.toUpperCase(),
        destination: legData.destination.toUpperCase(),
        aircraftType: aircraftNameForFlow,
      });
      
      if(result.estimatedFlightTimeHours !== undefined) {
        setValue(`legs.${legIndex}.flightTimeHours`, result.estimatedFlightTimeHours);
      }
      
      const originTaxi = legData.originTaxiTimeMinutes || 0;
      const destTaxi = legData.destinationTaxiTimeMinutes || 0;
      const flightTime = result.estimatedFlightTimeHours || 0;
      const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
      const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));


      setLegEstimates(prev => {
        const newEstimates = [...prev];
        newEstimates[legIndex] = {
          ...result,
          blockTimeHours: blockTimeHours,
          estimatedForInputs: {
            origin: legData.origin.toUpperCase(),
            destination: legData.destination.toUpperCase(),
            aircraftType: aircraftNameForFlow
          }
        };
        return newEstimates;
      });
      toast({ title: "Flight Details Estimated", description: `Leg ${legIndex + 1}: ${result.estimatedMileageNM} NM, ${result.estimatedFlightTimeHours} hrs flight time.` });
    } catch (e) {
      console.error("Error estimating flight details:", e);
      const errorMessage = e instanceof Error ? e.message : "AI failed to estimate details.";
      toast({ title: "Estimation Error", description: errorMessage, variant: "destructive" });
      setValue(`legs.${legIndex}.flightTimeHours`, undefined);
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
  }, [getValues, legEstimates, toast, estimatingLegIndex, setValue, setLegEstimates, setEstimatingLegIndex]);


  const onSendQuote: SubmitHandler<FormData> = (data) => {
    startQuoteGenerationTransition(async () => {
      const finalData = {
        ...data,
        totalEstimatedQuotePrice,
        cateringNotes: data.cateringRequested ? data.cateringNotes : undefined, 
        legsWithEstimatesAndBlockTime: data.legs.map((leg, index) => {
          const estimate = legEstimates[index];
          const originTaxi = leg.originTaxiTimeMinutes || 0;
          const destTaxi = leg.destinationTaxiTimeMinutes || 0;
          const flightTime = leg.flightTimeHours || 0;
          const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
          const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
          
          return {
            ...leg,
            estimationDetails: estimate && !estimate.error ? estimate : undefined,
            calculatedBlockTimeHours: blockTimeHours,
          };
        })
      };
      console.log('Quote Data (Send Quote):', finalData);
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
    trigger(); // Trigger validation before previewing
    const data = getValues();
     const finalData = {
        ...data,
        totalEstimatedQuotePrice,
        cateringNotes: data.cateringRequested ? data.cateringNotes : undefined, 
        legsWithEstimatesAndBlockTime: data.legs.map((leg, index) => {
          const estimate = legEstimates[index];
          const originTaxi = leg.originTaxiTimeMinutes || 0;
          const destTaxi = leg.destinationTaxiTimeMinutes || 0;
          const flightTime = leg.flightTimeHours || 0;
          const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
          const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
          
          return {
            ...leg,
            estimationDetails: estimate && !estimate.error ? estimate : undefined,
            calculatedBlockTimeHours: blockTimeHours,
          };
        })
      };
    console.log("Preview Quote Clicked. Current form data:", finalData);
    toast({
      title: "Quote Preview (Logged to Console)",
      description: "Check the browser console for the current quote details.",
    });
  };

  const handleAddLeg = () => {
    let newLegOrigin = '';
    let newLegDepartureDateTime: Date | undefined = undefined;
    let previousLegPax = 1;
    let previousLegOriginTaxi = 15;
    let previousLegDestTaxi = 15;
    let previousLegOriginFbo = '';


    if (fields.length > 0) {
      const previousLegIndex = fields.length - 1;
      const previousLeg = getValues(`legs.${previousLegIndex}`);
      newLegOrigin = previousLeg.destination; 
      previousLegPax = previousLeg.passengerCount || 1; 
      previousLegOriginTaxi = previousLeg.originTaxiTimeMinutes || 15;
      previousLegDestTaxi = previousLeg.destinationTaxiTimeMinutes || 15;
      previousLegOriginFbo = previousLeg.destinationFbo || ''; 

      const previousLegFlightTime = previousLeg.flightTimeHours;
      if (previousLeg.departureDateTime instanceof Date && !isNaN(previousLeg.departureDateTime.getTime()) && previousLegFlightTime && previousLegFlightTime > 0) {
        const previousLegDeparture = new Date(previousLeg.departureDateTime);
        const previousLegFlightMillis = previousLegFlightTime * 60 * 60 * 1000;
        const previousLegDestTaxiMillis = (previousLeg.destinationTaxiTimeMinutes || 0) * 60 * 1000;
        
        const estimatedArrivalMillis = previousLegDeparture.getTime() + previousLegFlightMillis + previousLegDestTaxiMillis;
        newLegDepartureDateTime = addHours(new Date(estimatedArrivalMillis), 1); 
      } else if (previousLeg.departureDateTime instanceof Date && !isNaN(previousLeg.departureDateTime.getTime())) {
         newLegDepartureDateTime = addHours(new Date(previousLeg.departureDateTime), 3); 
      }
    }

    append({
      origin: newLegOrigin.toUpperCase(),
      destination: '',
      departureDateTime: newLegDepartureDateTime,
      legType: 'Charter',
      passengerCount: previousLegPax,
      originFbo: previousLegOriginFbo, 
      destinationFbo: '',
      originTaxiTimeMinutes: previousLegOriginTaxi,
      destinationTaxiTimeMinutes: previousLegDestTaxi,
      flightTimeHours: undefined,
    });
  };

  const handleRemoveLeg = (index: number) => {
    remove(index);
    setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates.splice(index, 1); return newEstimates; });
  };

  const handleCustomerSelect = (customerId: string) => {
    if (!customerId) { 
      setValue('clientName', '');
      setValue('clientEmail', '');
      setValue('clientPhone', '');
      setValue('selectedCustomerId', undefined);
      return;
    }
    const selectedCustomer = sampleCustomerData.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email);
      setValue('clientPhone', selectedCustomer.phone || '');
      setValue('selectedCustomerId', customerId);
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
            <FormField control={control} name="quoteId" render={({ field }) => ( <FormItem className="mb-6"> <FormLabel>Quote ID</FormLabel> <FormControl><Input placeholder="e.g., QT-ABCDE" {...field} value={field.value || ''} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )} />
            
            <section>
              <CardTitle className="text-xl border-b pb-2 mb-4">Client Information</CardTitle>
              <FormField control={control} name="selectedCustomerId" render={({ field }) => ( <FormItem className="mb-4"> <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel> <Select onValueChange={(value) => { handleCustomerSelect(value); field.onChange(value); }} value={field.value || ""} name={field.name} > <FormControl><SelectTrigger><SelectValue placeholder="Select a client to auto-fill details" /></SelectTrigger></FormControl> <SelectContent>{sampleCustomerData.map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name} ({customer.company})</SelectItem>))}</SelectContent> </Select> <FormDescription>Choosing a client will auto-populate their details below.</FormDescription> <FormMessage /> </FormItem> )} />
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
                      <CardTitle className="text-lg flex items-center gap-2"><GripVertical className="h-5 w-5 text-muted-foreground" /> Leg {index + 1}</CardTitle>
                      {fields.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLeg(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove Leg</span></Button>)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Origin Airport</FormLabel> <FormControl><Input placeholder="e.g., KJFK" {...field} onChange={(e) => { field.onChange(e.target.value.toUpperCase()); trigger(`legs.${index}.origin`); }} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneLanding className="h-4 w-4" />Destination Airport</FormLabel> <FormControl><Input placeholder="e.g., KLAX" {...field} onChange={(e) => { field.onChange(e.target.value.toUpperCase()); trigger(`legs.${index}.destination`); }} /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.originFbo`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Building className="h-4 w-4" />Origin FBO (Optional)</FormLabel> <FormControl><Input placeholder="e.g., Signature, Atlantic" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.destinationFbo`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Building className="h-4 w-4" />Destination FBO (Optional)</FormLabel> <FormControl><Input placeholder="e.g., Signature, Atlantic" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => ( <FormItem className="flex flex-col"> <FormLabel>Desired Departure Date & Time</FormLabel> 
                        {isClient ? ( 
                            <Popover> 
                                <PopoverTrigger asChild> 
                                    <FormControl> 
                                        {/* TEMPORARILY STATIC BUTTON TO ISOLATE ERROR */}
                                        <Button variant={"outline"} className="w-full pl-3 text-left font-normal">
                                            <span>Pick a date and time (Static)</span>
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl> 
                                </PopoverTrigger> 
                                <PopoverContent className="w-auto p-0" align="start"> 
                                    <Calendar 
                                        mode="single" 
                                        selected={field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value : undefined} 
                                        onSelect={field.onChange} 
                                        disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true} 
                                        initialFocus 
                                    /> 
                                    <div className="p-2 border-t border-border"> 
                                        <Input 
                                            type="time" 
                                            defaultValue={field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "HH:mm") : ""} 
                                            onChange={(e) => { 
                                                const time = e.target.value; 
                                                const [hours, minutes] = time.split(':').map(Number); 
                                                let newDate = field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? new Date(field.value) : new Date(); 
                                                if (isNaN(newDate.getTime())) newDate = new Date(); 
                                                newDate.setHours(hours, minutes,0,0); 
                                                field.onChange(newDate); 
                                            }} 
                                        /> 
                                    </div> 
                                </PopoverContent> 
                            </Popover> 
                        ) : ( 
                            <Skeleton className="h-10 w-full" /> 
                        )} 
                        <FormMessage /> 
                    </FormItem> )} />
                    
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}> <FormControl><SelectTrigger><SelectValue placeholder="Select leg type" /></SelectTrigger></FormControl> <SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" />Passengers</FormLabel> <FormControl><Input type="number" placeholder="e.g., 2" {...field} min="0" /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <FormField control={control} name={`legs.${index}.originTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Clock className="h-4 w-4" />Origin Taxi (mins)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 15" {...field} min="0" /></FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.flightTimeHours`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Flight Time (hrs)</FormLabel> <FormControl><Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} /></FormControl> <FormDescription className="text-xs">Populated by AI, editable.</FormDescription><FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.destinationTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Clock className="h-4 w-4" />Dest. Taxi (mins)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 15" {...field} min="0" /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !aircraftTypeValue} className="w-full sm:w-auto"> {estimatingLegIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Estimate Flight Details </Button>
                    {!aircraftTypeValue && <FormDescription className="text-xs text-destructive">Select an aircraft type above to enable estimation.</FormDescription>}

                    {legEstimates[index] && (() => {
                      const estimate = legEstimates[index]!;
                      const legData = getValues(`legs.${index}`);
                      let formattedArrivalTime = 'N/A';
                      let formattedBlockTime = 'N/A';
                      let legCost = 0;

                      if (legData.departureDateTime && legData.departureDateTime instanceof Date && !isNaN(legData.departureDateTime.getTime()) && legData.flightTimeHours && legData.flightTimeHours > 0) {
                        const departureTime = new Date(legData.departureDateTime);
                        const flightTimeMillis = (legData.flightTimeHours || 0) * 60 * 60 * 1000;
                        const arrivalTimeMillis = departureTime.getTime() + flightTimeMillis;
                        formattedArrivalTime = format(new Date(arrivalTimeMillis), "PPP HH:mm");
                      }

                      const originTaxiMins = legData.originTaxiTimeMinutes || 0;
                      const destTaxiMins = legData.destinationTaxiTimeMinutes || 0;
                      const flightTimeHoursForBlock = legData.flightTimeHours || 0;
                      if (flightTimeHoursForBlock > 0) {
                        const blockTimeTotalMinutes = originTaxiMins + (flightTimeHoursForBlock * 60) + destTaxiMins;
                        const blockHours = Math.floor(blockTimeTotalMinutes / 60);
                        const blockMinutes = Math.round(blockTimeTotalMinutes % 60);
                        formattedBlockTime = `${String(blockHours).padStart(2, '0')}:${String(blockMinutes).padStart(2, '0')} hrs`;
                      }
                      
                      const selectedAircraftId = getValues('aircraftType');
                      const selectedAircraftDetails = availableAircraft.find(ac => ac.id === selectedAircraftId);
                      const aircraftNameForRate = selectedAircraftDetails?.name;
                      const hourlyRateForLeg = aircraftNameForRate ? (AIRCRAFT_HOURLY_RATES[aircraftNameForRate] || DEFAULT_AIRCRAFT_HOURLY_RATE) : DEFAULT_AIRCRAFT_HOURLY_RATE;
                      if (legData.flightTimeHours && legData.flightTimeHours > 0) {
                        legCost = legData.flightTimeHours * hourlyRateForLeg;
                      }


                      return (
                        <Alert variant={estimate.error ? "destructive" : "default"} className="mt-4 text-xs">
                          <Info className={`h-4 w-4 ${estimate.error ? '' : 'text-primary'}`} />
                          <AlertTitle className="text-sm">{estimate.error ? `Error Estimating Leg ${index + 1}` : `Leg ${index + 1} AI Estimate Reference`}</AlertTitle>
                          <AlertDescription>
                            {estimate.error ? ( <p>{estimate.error}</p> ) : (
                              <>
                                <p><strong>AI Est. Distance:</strong> {estimate.estimatedMileageNM?.toLocaleString()} NM</p>
                                <p><strong>AI Est. Flight Time:</strong> {estimate.estimatedFlightTimeHours?.toFixed(1)} hours (Used to populate editable field above)</p>
                                {(legData.departureDateTime && legData.departureDateTime instanceof Date && !isNaN(legData.departureDateTime.getTime())) && <p><strong>Calc. Arrival Time:</strong> {formattedArrivalTime}</p>}
                                <p><strong>Calc. Block Time:</strong> {formattedBlockTime}</p>
                                <p><strong>Assumed Speed (AI):</strong> {estimate.assumedCruiseSpeedKts?.toLocaleString()} kts</p>
                                <p className="mt-1"><em>AI Explanation: {estimate.briefExplanation}</em></p>
                                <p className="mt-1 font-semibold"><strong>Est. Leg Flight Cost:</strong> ${legCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (at ${hourlyRateForLeg.toLocaleString()}/hr flight time - placeholder rate)</p>
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={handleAddLeg} className="w-full sm:w-auto"> <PlusCircle className="mr-2 h-4 w-4" /> Add New Leg </Button>
              {errors.legs && typeof errors.legs === 'object' && !Array.isArray(errors.legs) && ( <FormMessage>{(errors.legs as any).message}</FormMessage> )}
            </section>

            <Separator />
            {fields.length > 0 && ( <section> <CardTitle className="text-xl border-b pb-2 mb-4">Itinerary Summary</CardTitle> <LegsSummaryTable legs={legsArray} /> </section> )}
            <Separator />

            <section>
                <CardTitle className="text-xl border-b pb-2 mb-4">Additional Quote Options</CardTitle>
                <div className="space-y-4">
                    <FormField control={control} name="medicsRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Medics Requested (+${OTHER_COSTS.MEDICS_FEE.toLocaleString()})</FormLabel></div> </FormItem> )} />
                    <FormField control={control} name="cateringRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> Catering Requested (+${OTHER_COSTS.CATERING_FEE.toLocaleString()})</FormLabel></div> </FormItem> )} />
                    {cateringRequestedValue && ( <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem className="pl-8"> <FormLabel>Catering Notes</FormLabel> <FormControl><Textarea placeholder="Specify catering details..." {...field} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> )}
                    <FormField control={control} name="includeLandingFees" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Include Landing Fees (+${OTHER_COSTS.LANDING_FEE_PER_LEG.toLocaleString()} per leg)</FormLabel></div> </FormItem> )} />
                    <FormField control={control} name="estimatedOvernights" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> Estimated Overnights (+${OTHER_COSTS.OVERNIGHT_FEE_PER_NIGHT.toLocaleString()} per night)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 2" {...field} min="0" /></FormControl> <FormDescription>Number of overnight stays for crew/aircraft.</FormDescription> <FormMessage /> </FormItem> )} />
                </div>
            </section>

            <Separator />
            <FormField control={control} name="notes" render={({ field }) => ( <FormItem> <FormLabel>General Quote Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="e.g., Specific client preferences, discount applied..." {...field} rows={4} /></FormControl> <FormMessage /> </FormItem> )} />

            <Separator className="my-6" />
            <div className="space-y-2 text-right p-4 bg-muted/30 rounded-lg shadow">
                <p className="text-lg font-semibold text-foreground flex justify-between items-center">
                    <span>Estimated Total Quote Price:</span>
                    <span className="text-3xl font-bold text-primary flex items-center gap-1">
                       <DollarSign className="h-7 w-7" /> {totalEstimatedQuotePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </p>
                <p className="text-xs text-muted-foreground">
                    Includes estimated flight time, selected options, and placeholder fees.
                </p>
            </div>

          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handlePreviewQuote}> <Eye className="mr-2 h-4 w-4" /> Preview Quote </Button>
            <Button type="submit" disabled={isGeneratingQuote}> {isGeneratingQuote ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Send className="mr-2 h-4 w-4" /> )} Send Quote </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}


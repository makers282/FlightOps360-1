
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
import { CalendarIcon, Loader2, Save, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const legTypes = [
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

const legSchema = z.object({
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5, "Origin airport code too long."),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5, "Destination airport code too long."),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }),
  legType: z.enum(legTypes, { required_error: "Leg type is required." }),
});

const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  
  legs: z.array(legSchema).min(1, "At least one flight leg is required."),

  passengerCount: z.coerce.number().min(1, "At least one passenger is required.").int(),
  aircraftType: z.string().min(1, "Aircraft type is required."), 
  medicsRequested: z.boolean().optional().default(false),
  cateringRequested: z.boolean().optional().default(false),
  cateringNotes: z.string().optional(),
  includeLandingFees: z.boolean().optional().default(false),
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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

const PLACEHOLDER_HOURLY_RATE = 3200; // Placeholder for aircraft hourly rate

export function CreateQuoteForm() {
  const [isGeneratingQuote, startQuoteGenerationTransition] = useTransition();
  const [estimatingLegIndex, setEstimatingLegIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [legEstimates, setLegEstimates] = useState<Array<LegEstimate | null>>([]);


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quoteId: '', 
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      legs: [{ origin: '', destination: '', legType: 'Charter', departureDateTime: undefined as Date | undefined}],
      passengerCount: 1,
      aircraftType: '',
      medicsRequested: false,
      cateringRequested: false,
      cateringNotes: "",
      includeLandingFees: false,
      estimatedOvernights: 0,
      notes: '',
    },
  });

  const { control, setValue, getValues, watch, formState: { errors } } = form;
  const cateringRequestedValue = watch("cateringRequested");
  const legsArray = watch("legs"); 

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
        if (prevEstimates[index]) {
          newEstimates[index] = prevEstimates[index];
        }
      });
      return newEstimates;
    });
  }, [legsArray.length]);


  const handleEstimateFlightDetails = useCallback(async (legIndex: number) => {
    if (estimatingLegIndex === legIndex) return; // Already estimating this leg
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
        currentEstimate.estimatedForInputs?.origin === legData.origin &&
        currentEstimate.estimatedForInputs?.destination === legData.destination &&
        currentEstimate.estimatedForInputs?.aircraftType === aircraftNameForFlow) {
      toast({ title: "Estimate Exists", description: "Flight details already estimated for these inputs.", variant: "default" });
      return;
    }

    setEstimatingLegIndex(legIndex);
    
    // Clear previous estimate for this leg before fetching new one
    setLegEstimates(prev => {
      const newEstimates = [...prev];
      newEstimates[legIndex] = null; 
      return newEstimates;
    });

    try {
      const result = await estimateFlightDetails({
        origin: legData.origin,
        destination: legData.destination,
        aircraftType: aircraftNameForFlow,
      });
      setLegEstimates(prev => {
        const newEstimates = [...prev];
        newEstimates[legIndex] = { 
          ...result, 
          estimatedForInputs: { 
            origin: legData.origin, 
            destination: legData.destination, 
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
            origin: legData.origin, 
            destination: legData.destination, 
            aircraftType: aircraftNameForFlow
          } 
        } as LegEstimate; 
        return newEstimates;
      });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, legEstimates, toast, estimatingLegIndex]);

  const onSubmit: SubmitHandler<FormData> = (data) => {
    startQuoteGenerationTransition(async () => {
      console.log('Quote Data:', data);
      const finalData = {
        ...data,
        cateringNotes: data.cateringRequested ? data.cateringNotes : undefined,
        legsWithEstimates: data.legs.map((leg, index) => ({
          ...leg,
          estimation: legEstimates[index] && !legEstimates[index]?.error ? legEstimates[index] : undefined,
        }))
      };
      toast({
        title: "Quote Generation Submitted",
        description: (
          <pre className="mt-2 w-full max-w-[480px] rounded-md bg-slate-950 p-4 overflow-x-auto">
            <code className="text-white whitespace-pre-wrap">{JSON.stringify(finalData, null, 2)}</code>
          </pre>
        ),
        variant: "default",
      });
    });
  };
  
  const handleAddLeg = () => {
    let newLegOrigin = '';
    let newLegDepartureDateTime: Date | undefined = undefined;

    if (fields.length > 0) {
      const previousLegIndex = fields.length - 1;
      const previousLeg = getValues(`legs.${previousLegIndex}`);
      newLegOrigin = previousLeg.destination;

      const previousLegEstimate = legEstimates[previousLegIndex];
      if (previousLeg.departureDateTime && previousLegEstimate && previousLegEstimate.estimatedFlightTimeHours && !previousLegEstimate.error) {
        const previousLegDeparture = new Date(previousLeg.departureDateTime);
        const estimatedArrivalMillis = previousLegDeparture.getTime() + (previousLegEstimate.estimatedFlightTimeHours * 60 * 60 * 1000);
        newLegDepartureDateTime = new Date(estimatedArrivalMillis + (60 * 60 * 1000)); // Add 1 hour ground time
      }
    }

    append({
      origin: newLegOrigin, 
      destination: '',
      departureDateTime: newLegDepartureDateTime, 
      legType: 'Charter',
    });
  };

  const handleRemoveLeg = (index: number) => {
    remove(index);
  };


  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>New Quote Details</CardTitle>
        <CardDescription>Fill in the client and trip information to generate a quote.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <section>
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
              <CardTitle className="text-xl border-b pb-2 mb-4">Client Information</CardTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <FormField control={control} name="clientName" render={({ field }) => ( <FormItem> <FormLabel>Client Name</FormLabel> <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={control} name="clientEmail" render={({ field }) => ( <FormItem> <FormLabel>Client Email</FormLabel> <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </div>
              <FormField control={control} name="clientPhone" render={({ field }) => ( <FormItem> <FormLabel>Client Phone (Optional)</FormLabel> <FormControl><Input type="tel" placeholder="e.g., (555) 123-4567" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </section>

            <Separator />
            <section>
              <CardTitle className="text-xl border-b pb-2 mb-4">General Quote Options</CardTitle>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
                <FormField control={control} name="passengerCount" render={({ field }) => ( <FormItem> <FormLabel>Number of Passengers</FormLabel> <FormControl><Input type="number" placeholder="e.g., 4" {...field} min="1" /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={control} name="aircraftType" render={({ field }) => ( <FormItem> <FormLabel>Aircraft Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft type" /></SelectTrigger></FormControl> <SelectContent>{availableAircraft.map(aircraft => (<SelectItem key={aircraft.id} value={aircraft.id}>{aircraft.name}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
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
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Origin Airport</FormLabel> <FormControl><Input placeholder="e.g., KJFK" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneLanding className="h-4 w-4" />Destination Airport</FormLabel> <FormControl><Input placeholder="e.g., KLAX" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
                    <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select leg type" /></SelectTrigger></FormControl> <SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                    
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !getValues('aircraftType')} className="w-full sm:w-auto">
                        {estimatingLegIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Estimate Flight Details
                    </Button>
                    {!getValues('aircraftType') && <FormDescription className="text-xs text-destructive">Select an aircraft type above to enable estimation.</FormDescription>}

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
                        // Can still calculate cost if flight time is available but departure is not
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
                                <p><strong>Est. Leg Cost:</strong> {costDisplay} (at ${PLACEHOLDER_HOURLY_RATE}/hr placeholder)</p>
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
            <section>
                <CardTitle className="text-xl border-b pb-2 mb-4">Additional Quote Options</CardTitle>
                <div className="space-y-4">
                    <FormField control={control} name="medicsRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Medics Requested</FormLabel></div> </FormItem> )} />
                    <FormField control={control} name="cateringRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> Catering Requested</FormLabel></div> </FormItem> )} />
                    {cateringRequestedValue && ( <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem className="pl-8"> <FormLabel>Catering Notes</FormLabel> <FormControl><Textarea placeholder="Specify catering details..." {...field} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> )}
                    <FormField control={control} name="includeLandingFees" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Include Estimated Landing Fees</FormLabel></div> </FormItem> )} />
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
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isGeneratingQuote} className="w-full sm:w-auto">
              {isGeneratingQuote ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Save className="mr-2 h-4 w-4" /> )}
              Generate Quote
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

    

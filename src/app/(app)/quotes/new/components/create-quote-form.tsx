
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import React, { useState, useTransition, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info, Eye, Send, Building, UserSearch, DollarSign, Fuel, SaveIcon, ListChecks, Plane as PlaneIconUI, Edit3 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, parseISO } from "date-fns";
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
import { estimateFlightDetails, type EstimateFlightDetailsOutput } from '@/ai/flows/estimate-flight-details-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAircraftRates, type AircraftRate } from '@/ai/flows/manage-aircraft-rates-flow';
import {
  fetchCompanyProfile,
  type CompanyProfile,
  type ServiceFeeRate,
} from '@/ai/flows/manage-company-profile-flow';
import { fetchAircraftPerformance, type AircraftPerformanceData } from '@/ai/flows/manage-aircraft-performance-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as DialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LegsSummaryTable } from './legs-summary-table';
import { CostsSummaryDisplay, type LineItem } from './costs-summary-display';
import { saveQuote, fetchQuoteById } from '@/ai/flows/manage-quotes-flow';
import { sendQuoteEmail } from '@/ai/flows/send-quote-email-flow';
import type { Quote, SaveQuoteInput, QuoteLeg, QuoteLineItem, quoteStatuses as QuoteStatusType } from '@/ai/schemas/quote-schemas';
import { quoteStatuses, legTypes } from '@/ai/schemas/quote-schemas';
import { useRouter } from 'next/navigation';
import { fetchCustomers, type Customer } from '@/ai/flows/manage-customers-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClientOnly } from '@/components/client-only';


const legSchema = z.object({
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5, "Origin airport code too long.").toUpperCase(),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5, "Destination airport code too long.").toUpperCase(),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }).optional(),
  legType: z.enum(legTypes, { required_error: "Leg type is required." }),
  passengerCount: z.coerce.number().min(0, "Passenger count cannot be negative.").int().default(1),
  originFbo: z.string().optional(),
  destinationFbo: z.string().optional(),
  originTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  destinationTaxiTimeMinutes: z.coerce.number().min(0).optional().default(15),
  flightTimeHours: z.coerce.number().min(0).optional(),
});

const optionalServiceSchema = z.object({
  serviceKey: z.string(),
  displayDescription: z.string(),
  unitDescription: z.string(),
  defaultBuyRate: z.number(),
  defaultSellRate: z.number(),
  selected: z.boolean().default(false),
  customSellPrice: z.coerce.number().optional(),
  isActiveFromConfig: z.boolean(),
  quantityInputType: z.enum(["none", "legs", "nights", "block_hours"]).optional().default("none"),
});
type OptionalServiceFormData = z.infer<typeof optionalServiceSchema>;


const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  legs: z.array(legSchema).min(1, "At least one flight leg is required."),
  aircraftId: z.string().min(1, "Aircraft selection is required.").optional(),
  
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  optionalServices: z.array(optionalServiceSchema).optional().default([]),

  cateringNotes: z.string().optional(),
  notes: z.string().optional(),
});

export type LegFormData = z.infer<typeof legSchema>;
export type FullQuoteFormData = z.infer<typeof formSchema>;

type LegEstimate = EstimateFlightDetailsOutput & {
  error?: string;
  estimatedForInputs?: { origin: string; destination: string; aircraftModel: string; knownCruiseSpeedKts?: number };
  blockTimeHours?: number;
};

interface AircraftSelectOption {
  value: string;
  label: string;
  model: string;
}

const DEFAULT_AIRCRAFT_RATE_FALLBACK: Pick<AircraftRate, 'buy' | 'sell'> = {
  buy: 3500,
  sell: 4000,
};

interface CreateQuoteFormProps {
  isEditMode?: boolean;
  quoteIdToEdit?: string;
}

const formatCurrencyLocal = (amount: number | undefined) => {
  if (amount === undefined || isNaN(amount)) return 'N/A';
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export function CreateQuoteForm({ isEditMode = false, quoteIdToEdit }: CreateQuoteFormProps) {
  const [isSaving, startSavingTransition] = useTransition();
  const [estimatingLegIndex, setEstimatingLegIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [legEstimates, setLegEstimates] = useState<Array<LegEstimate | null>>([]);
  const [calculatedLineItems, setCalculatedLineItems] = useState<QuoteLineItem[]>([]);

  const [aircraftSelectOptions, setAircraftSelectOptions] = useState<AircraftSelectOption[]>([]);
  const [isLoadingAircraftList, setIsLoadingAircraftList] = useState(true);

  const [fetchedAircraftRates, setFetchedAircraftRates] = useState<AircraftRate[]>([]);
  const [fetchedCompanyProfile, setFetchedCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoadingDynamicRates, setIsLoadingDynamicRates] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingQuoteDataForEdit, setIsLoadingQuoteDataForEdit] = useState(false);

  const [showPreviewAlert, setShowPreviewAlert] = useState(false);
  const [formattedPreviewContent, setFormattedPreviewContent] = useState<React.ReactNode | null>(null);

  const [selectedAircraftPerformance, setSelectedAircraftPerformance] = useState<(AircraftPerformanceData & { aircraftId: string }) | null>(null);
  const [isLoadingSelectedAcPerf, setIsLoadingSelectedAcPerf] = useState(false);


  const form = useForm<FullQuoteFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quoteId: generateNewQuoteId(), // Generate ID on init for new quotes
      selectedCustomerId: undefined,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      legs: [{
        origin: '',
 destination: '',
        legType: 'Charter',
 departureDateTime: undefined, // It's okay for Date to be undefined initially
        passengerCount: 1,
        originFbo: '',
        destinationFbo: '',
        originTaxiTimeMinutes: 15,
        destinationTaxiTimeMinutes: 15,
        flightTimeHours: undefined,
      }],
      aircraftId: undefined,
      estimatedOvernights: 0,
      optionalServices: [],
      cateringNotes: "",
      notes: '',
    },
  });

  const { control, setValue, getValues, trigger, formState: { errors }, reset } = form;

  const legsArray = useWatch({ control, name: "legs", defaultValue: [] });
  const currentSelectedAircraftId = useWatch({ control, name: "aircraftId" });
  const formOptionalServices = useWatch({ control, name: "optionalServices", defaultValue: [] });
  const currentEstimatedOvernights = useWatch({ control, name: "estimatedOvernights" });


  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "legs",
  });
  
  const { fields: optionalServicesFields, replace: replaceOptionalServices } = useFieldArray({
    control,
    name: "optionalServices",
  });

 function generateNewQuoteId() {
    return `QT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
 }

   useEffect(() => {
    if (fetchedCompanyProfile?.serviceFeeRates && !isEditMode) { 
      const activeServicesFromConfig = Object.entries(fetchedCompanyProfile.serviceFeeRates)
        .filter(([_key, rate]) => rate.isActive)
        .map(([key, rate]) => {
            let quantityInputType: OptionalServiceFormData['quantityInputType'] = 'none';
            const unitDescUpper = rate.unitDescription.toUpperCase();
            if (unitDescUpper.includes("PER LEG") || unitDescUpper.includes("LANDING")) quantityInputType = "legs";
            else if (unitDescUpper.includes("PER NIGHT") || unitDescUpper.includes("OVERNIGHT")) quantityInputType = "nights";
            else if (unitDescUpper.includes("HOUR")) quantityInputType = "block_hours";

            return {
                serviceKey: key,
                displayDescription: rate.displayDescription,
                unitDescription: rate.unitDescription,
                defaultBuyRate: rate.buy,
                defaultSellRate: rate.sell,
                selected: false, 
                customSellPrice: undefined, 
                isActiveFromConfig: rate.isActive ?? true,
                quantityInputType,
            };
        });
      replaceOptionalServices(activeServicesFromConfig);
    }
  }, [fetchedCompanyProfile, replaceOptionalServices, isEditMode]);


  useEffect(() => {
    if (currentSelectedAircraftId) {
      setIsLoadingSelectedAcPerf(true);
      fetchAircraftPerformance({ aircraftId: currentSelectedAircraftId })
        .then(perfData => {
          if (perfData) {
             setSelectedAircraftPerformance({...perfData, aircraftId: currentSelectedAircraftId});
          } else {
             setSelectedAircraftPerformance(null);
          }
        })
        .catch(error => {
          console.warn(`Could not fetch performance data for aircraft ${currentSelectedAircraftId}:`, error);
          setSelectedAircraftPerformance(null);
        })
        .finally(() => setIsLoadingSelectedAcPerf(false));
    } else {
      setSelectedAircraftPerformance(null);
    }
  }, [currentSelectedAircraftId]);


 useEffect(() => {
    setIsClient(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinLegDepartureDate(today);

    const loadInitialDropdownData = async () => {
      setIsLoadingAircraftList(true);
      setIsLoadingDynamicRates(true);
      setIsLoadingCustomers(true);
      try {
        const [fleetData, ratesData, profileData, customersData] = await Promise.all([
          fetchFleetAircraft(),
          fetchAircraftRates(),
          fetchCompanyProfile(),
          fetchCustomers()
        ]);

        const options = fleetData.map(ac => ({
          value: ac.id,
          label: `${ac.tailNumber} - ${ac.model}`,
          model: ac.model
        }));
        setAircraftSelectOptions(options);
        setFetchedAircraftRates(ratesData);
        setFetchedCompanyProfile(profileData);
        setCustomers(customersData);

      } catch (error) {
        console.error("Failed to load initial data for quote form:", error);
        toast({ title: "Error Loading Configuration", description: "Could not load aircraft, pricing, or customer data. Using defaults where possible.", variant: "destructive" });
      } finally {
        setIsLoadingAircraftList(false);
        setIsLoadingDynamicRates(false);
        setIsLoadingCustomers(false);
      }
    };
    loadInitialDropdownData();
  }, [toast]); 

  useEffect(() => {
    if (isEditMode && quoteIdToEdit) {
      setIsLoadingQuoteDataForEdit(true);
      fetchQuoteById({ id: quoteIdToEdit })
        .then(quoteData => {
          if (quoteData) {
            const existingOptionalServicesMap = new Map<string, QuoteLineItem>();
            (quoteData.lineItems || []).forEach(item => {
                existingOptionalServicesMap.set(item.id, item);
            });
            
            const initialFormOptionalServices: OptionalServiceFormData[] = 
              Object.entries(fetchedCompanyProfile?.serviceFeeRates || {})
              .filter(([_key, rate]) => rate.isActive) // Only include active services as options
              .map(([key, rate]) => {
                const existingLineItem = (quoteData.lineItems || []).find(li => li.id === key); 
                let quantityInputType: OptionalServiceFormData['quantityInputType'] = 'none';
                const unitDescUpper = rate.unitDescription.toUpperCase();
                if (unitDescUpper.includes("PER LEG") || unitDescUpper.includes("LANDING")) quantityInputType = "legs";
                else if (unitDescUpper.includes("PER NIGHT") || unitDescUpper.includes("OVERNIGHT")) quantityInputType = "nights";
                else if (unitDescUpper.includes("HOUR")) quantityInputType = "block_hours";

                return {
                    serviceKey: key,
                    displayDescription: rate.displayDescription,
                    unitDescription: rate.unitDescription,
                    defaultBuyRate: rate.buy,
                    defaultSellRate: rate.sell,
                    selected: !!existingLineItem,
                    customSellPrice: existingLineItem?.sellRate,
                    isActiveFromConfig: rate.isActive ?? true,
                    quantityInputType,
                };
            });


            const formDataToReset: FullQuoteFormData = {
              quoteId: quoteData.quoteId,
              selectedCustomerId: quoteData.selectedCustomerId,
              clientName: quoteData.clientName,
              clientEmail: quoteData.clientEmail,
              clientPhone: quoteData.clientPhone || '',
              legs: quoteData.legs.map(leg => ({
                ...leg,
                departureDateTime: leg.departureDateTime ? parseISO(leg.departureDateTime) : undefined,
                passengerCount: leg.passengerCount || 1,
                originTaxiTimeMinutes: leg.originTaxiTimeMinutes === undefined ? 15 : leg.originTaxiTimeMinutes,
                destinationTaxiTimeMinutes: leg.destinationTaxiTimeMinutes === undefined ? 15 : leg.destinationTaxiTimeMinutes,
              })),
              aircraftId: quoteData.aircraftId,
              estimatedOvernights: quoteData.options.estimatedOvernights || 0,
              optionalServices: initialFormOptionalServices,
              cateringNotes: quoteData.options.cateringNotes || "",
              notes: quoteData.options.notes || '',
            };
            reset(formDataToReset);
            setCalculatedLineItems(quoteData.lineItems || []);
            setLegEstimates(new Array(quoteData.legs.length).fill(null));
            toast({ title: "Quote Loaded", description: `Editing quote ${quoteData.quoteId}.`, variant: "default"});
          } else {
            toast({ title: "Error", description: `Quote with ID ${quoteIdToEdit} not found.`, variant: "destructive"});
            router.push('/quotes');
          }
        })
        .catch(error => {
          console.error("Failed to fetch quote for editing:", error);
          toast({ title: "Error Loading Quote", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive"});
          router.push('/quotes');
        })
        .finally(() => setIsLoadingQuoteDataForEdit(false));
    } else { // For new quotes, the quoteId is already set by defaultValues
    }
  }, [isEditMode, quoteIdToEdit, reset, toast, router, setValue, getValues, generateNewQuoteId, fetchedCompanyProfile]);


  useEffect(() => {
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


  const handleCustomerSelect = (customerId: string | undefined) => {
    setValue('selectedCustomerId', customerId);
    if (!customerId) {
      setValue('clientName', '');
      setValue('clientEmail', '');
      setValue('clientPhone', '');
      return;
    }
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email || '');
      setValue('clientPhone', selectedCustomer.phone || '');
    }
  };

  const handleAddLeg = () => {
    let newLegDefaults: Partial<LegFormData> = {
      origin: '', destination: '', legType: 'Charter', passengerCount: 1, originTaxiTimeMinutes: 15, destinationTaxiTimeMinutes: 15, originFbo: '', destinationFbo: '', flightTimeHours: undefined,
    };
    if (fields.length > 0) {
      const previousLegIndex = fields.length - 1;
      const previousLeg = getValues(`legs.${previousLegIndex}`);

      newLegDefaults.origin = previousLeg.destination;
      newLegDefaults.passengerCount = Number(previousLeg.passengerCount || 1);
      newLegDefaults.originTaxiTimeMinutes = Number(previousLeg.originTaxiTimeMinutes || 15);
      newLegDefaults.destinationTaxiTimeMinutes = Number(previousLeg.destinationTaxiTimeMinutes || 15);
      newLegDefaults.originFbo = previousLeg.destinationFbo || '';
      newLegDefaults.destinationFbo = '';

      const previousLegFlightTime = Number(previousLeg.flightTimeHours || (legEstimates[previousLegIndex]?.estimatedFlightTimeHours || 0));

      if (previousLeg.departureDateTime && previousLeg.departureDateTime instanceof Date && isValidDate(previousLeg.departureDateTime) && previousLegFlightTime > 0) {
        const previousLegDeparture = new Date(previousLeg.departureDateTime);
        const previousLegFlightMillis = previousLegFlightTime * 60 * 60 * 1000;
        const previousLegDestTaxiMillis = (Number(previousLeg.destinationTaxiTimeMinutes || 0)) * 60 * 1000;
        const estimatedArrivalMillis = previousLegDeparture.getTime() + previousLegFlightMillis + previousLegDestTaxiMillis;
        newLegDefaults.departureDateTime = new Date(estimatedArrivalMillis + (60 * 60 * 1000)); 
      } else if (previousLeg.departureDateTime && previousLeg.departureDateTime instanceof Date && isValidDate(previousLeg.departureDateTime)) {
         newLegDefaults.departureDateTime = new Date(previousLeg.departureDateTime.getTime() + (3 * 60 * 60 * 1000)); 
      }
    }

    append(newLegDefaults as LegFormData);
  };

  const handleRemoveLeg = (index: number) => {
    remove(index);
    setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates.splice(index, 1); return newEstimates; });
  };

  
  useEffect(() => {
    const newItems: QuoteLineItem[] = [];
    if (isLoadingDynamicRates || !currentSelectedAircraftId || !formOptionalServices) {
        setCalculatedLineItems([]);
        return;
    }

    let totalFlightTimeBuyCost = 0;
    let totalBillableFlightHoursForAircraftLineItem = 0;
    let totalBlockHours = 0;

    const selectedAircraftRateProfile = fetchedAircraftRates.find(r => r.id === currentSelectedAircraftId);
    const aircraftBuyRate = selectedAircraftRateProfile?.buy ?? DEFAULT_AIRCRAFT_RATE_FALLBACK.buy;
    const aircraftSellRate = selectedAircraftRateProfile?.sell ?? DEFAULT_AIRCRAFT_RATE_FALLBACK.sell;

    legsArray.forEach(leg => {
        const flightTime = Number(leg.flightTimeHours || 0);
        const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
        const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
        const legBlockMinutes = originTaxi + (flightTime * 60) + destTaxi;
        const currentLegBlockHours = parseFloat((legBlockMinutes / 60).toFixed(2));
        totalBlockHours += currentLegBlockHours;

        if (flightTime > 0) {
            totalFlightTimeBuyCost += flightTime * aircraftBuyRate;
            
            // All leg types with flight time are considered billable at sell rate for the aircraft time line item.
            const billableAtSellRateLegTypes: LegFormData['legType'][] = [
                "Charter", "Owner", "Ambulance", "Cargo", "Positioning", "Ferry", "Maintenance"
            ];
            
            if (billableAtSellRateLegTypes.includes(leg.legType)) {
                totalBillableFlightHoursForAircraftLineItem += flightTime;
            }
        }
    });

    const totalFlightTimeSellPriceForAircraftLineItem = totalBillableFlightHoursForAircraftLineItem * aircraftSellRate;

    const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === currentSelectedAircraftId);
    const aircraftDisplayName = selectedAircraftInfo ? selectedAircraftInfo.label : "Selected Aircraft";

    if (totalBillableFlightHoursForAircraftLineItem > 0) {
        newItems.push({
            id: 'aircraftFlightTimeCost',
            description: `Aircraft Time (${aircraftDisplayName})`,
            buyRate: aircraftBuyRate,
            sellRate: aircraftSellRate,
            unitDescription: 'Hour (Flight)',
            quantity: parseFloat(totalBillableFlightHoursForAircraftLineItem.toFixed(2)),
            buyTotal: totalFlightTimeBuyCost, 
            sellTotal: totalFlightTimeSellPriceForAircraftLineItem,
        });
    } else if (totalFlightTimeBuyCost > 0 && totalBlockHours > 0) {
         // Fallback if no "billable at sell rate" hours, but there's still operational cost.
         // This might be for purely internal non-revenue flights not intended for client billing.
        newItems.push({
            id: 'aircraftFlightTimeCost_NonRevenue',
            description: `Aircraft Operational Time (${aircraftDisplayName})`,
            buyRate: aircraftBuyRate,
            sellRate: aircraftBuyRate, // Sell at buy rate (no margin)
            unitDescription: 'Hour (Flight)',
            quantity: parseFloat(legsArray.reduce((sum, leg) => sum + Number(leg.flightTimeHours || 0), 0).toFixed(2)),
            buyTotal: totalFlightTimeBuyCost,
            sellTotal: totalFlightTimeBuyCost,
        });
    }
    
    formOptionalServices.forEach(service => {
      if (service.selected && service.isActiveFromConfig) {
        let quantity = 1;
        const unitDescUpper = service.unitDescription.toUpperCase();

        if (service.quantityInputType === "legs" || unitDescUpper.includes("PER LEG") || unitDescUpper.includes("LANDING")) {
            quantity = legsArray.filter(leg => leg.origin && leg.destination && leg.origin.length >= 3 && leg.destination.length >= 3).length || 0;
        } else if (service.quantityInputType === "nights" || unitDescUpper.includes("PER NIGHT") || unitDescUpper.includes("OVERNIGHT")) {
            quantity = Number(currentEstimatedOvernights || 0);
        } else if (service.quantityInputType === "block_hours" || unitDescUpper.includes("HOUR")) {
            quantity = parseFloat(totalBlockHours.toFixed(2));
        }
        
        if (quantity > 0) {
            const sellRateToUse = typeof service.customSellPrice === 'number' ? service.customSellPrice : service.defaultSellRate;
            newItems.push({
                id: service.serviceKey,
                description: service.displayDescription,
                buyRate: service.defaultBuyRate,
                sellRate: sellRateToUse,
                unitDescription: service.unitDescription,
                quantity: quantity,
                buyTotal: service.defaultBuyRate * quantity,
                sellTotal: sellRateToUse * quantity,
            });
        }
      }
    });

    setCalculatedLineItems(newItems);

  }, [
    legsArray, currentSelectedAircraftId, aircraftSelectOptions, fetchedAircraftRates, 
    isLoadingDynamicRates, formOptionalServices, currentEstimatedOvernights
  ]);

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

    const inputsChanged = !currentEstimate || 
                          currentEstimate.error || 
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
      toast({ title: "Flight Details Estimated", description: `Leg ${legIndex + 1}: ${result.resolvedOriginName} to ${result.resolvedDestinationName}. ${result.estimatedMileageNM} NM, ${result.estimatedFlightTimeHours} hrs.` });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "AI failed to estimate details.";
      toast({ title: "Estimation Error", description: errorMessage, variant: "destructive" });
      setValue(`legs.${legIndex}.flightTimeHours`, undefined);
      setLegEstimates(prev => { const newEstimates = [...prev]; newEstimates[legIndex] = { ...newEstimates[legIndex]!, error: errorMessage, estimatedForInputs: {origin: legData.origin.toUpperCase(), destination: legData.destination.toUpperCase(), aircraftModel: aircraftModelForFlow, knownCruiseSpeedKts: knownCruiseSpeedForFlow} } as LegEstimate; return newEstimates; });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, toast, estimatingLegIndex, setValue, currentSelectedAircraftId, aircraftSelectOptions, selectedAircraftPerformance, legEstimates]);


  const handleSave = async (intendedStatus: typeof QuoteStatusType[number]) => {
    const isValidForm = await trigger();
    if (!isValidForm) {
      toast({ title: "Validation Error", description: "Please check the form for errors.", variant: "destructive" });
      return;
    }

    startSavingTransition(async () => {
      const data = getValues();
      const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === data.aircraftId);
      const totalBuyCost = calculatedLineItems.reduce((sum, item) => sum + item.buyTotal, 0);
      const totalSellPrice = calculatedLineItems.reduce((sum, item) => sum + item.sellTotal, 0);
      const marginAmount = totalSellPrice - totalBuyCost;
      const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : (totalSellPrice > 0 ? 100 : 0) ;


      const quoteToSave: SaveQuoteInput = {
        quoteId: data.quoteId,
        selectedCustomerId: data.selectedCustomerId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        aircraftId: data.aircraftId,
        aircraftLabel: selectedAircraftInfo?.label,
        legs: data.legs.map((leg) => {
          const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
          const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
          const flightTime = Number(leg.flightTimeHours || 0);
          const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
          const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
          return {
            ...leg,
            departureDateTime: leg.departureDateTime ? leg.departureDateTime.toISOString() : undefined,
            calculatedBlockTimeHours: blockTimeHours,
          };
        }),
        options: { 
          estimatedOvernights: data.estimatedOvernights,
          cateringNotes: data.cateringNotes,
          notes: data.notes,
          medicsRequested: calculatedLineItems.some(li => li.id.toUpperCase().includes("MEDICAL")),
          cateringRequested: calculatedLineItems.some(li => li.id.toUpperCase().includes("CATERING")),
          includeLandingFees: calculatedLineItems.some(li => li.id.toUpperCase().includes("LANDING")),
          fuelSurchargeRequested: calculatedLineItems.some(li => li.id.toUpperCase().includes("FUEL_SURCHARGE")),
        },
        lineItems: calculatedLineItems,
        totalBuyCost,
        totalSellPrice,
        marginAmount,
        marginPercentage,
        status: intendedStatus,
      };

      try {
        const savedQuote = await saveQuote(quoteToSave);
        let toastDescription = `Quote ${savedQuote.quoteId} (${intendedStatus}) has been ${isEditMode ? 'updated' : 'saved'} in Firestore.`;

        if (intendedStatus === "Sent") {
          try {
            const emailInput = {
                clientName: savedQuote.clientName,
                clientEmail: savedQuote.clientEmail,
                quoteId: savedQuote.quoteId,
                totalAmount: savedQuote.totalSellPrice,
                quoteLink: isEditMode ? `${window.location.origin}/quotes/${savedQuote.id}` : undefined
            };
            await sendQuoteEmail(emailInput);
            toastDescription += " Email simulation logged to console.";
          } catch (emailError) {
             console.error("Failed to send quote email (simulation):", emailError);
             toastDescription += " Email simulation failed (see console).";
          }
        }

        toast({
          title: isEditMode ? "Quote Updated" : "Quote Saved",
          description: toastDescription,
          variant: "default",
        });

        if (!isEditMode) {
          form.reset({
            quoteId: generateNewQuoteId(),
            selectedCustomerId: undefined,
            clientName: '', clientEmail: '', clientPhone: '',
            legs: [{ origin: '', destination: '', legType: 'Charter', departureDateTime: undefined, passengerCount: 1, originFbo: '', destinationFbo: '', originTaxiTimeMinutes: 15, destinationTaxiTimeMinutes: 15, flightTimeHours: undefined }],
            aircraftId: undefined,
            estimatedOvernights: 0,
            optionalServices: [],
            cateringNotes: "", notes: '',
          });
          setLegEstimates([]);
          setCalculatedLineItems([]);
            if (fetchedCompanyProfile?.serviceFeeRates) {
                const activeServicesFromConfig = Object.entries(fetchedCompanyProfile.serviceFeeRates)
                    .filter(([_key, rate]) => rate.isActive)
                    .map(([key, rate]) => {
                         let quantityInputType: OptionalServiceFormData['quantityInputType'] = 'none';
                        const unitDescUpper = rate.unitDescription.toUpperCase();
                        if (unitDescUpper.includes("PER LEG") || unitDescUpper.includes("LANDING")) quantityInputType = "legs";
                        else if (unitDescUpper.includes("PER NIGHT") || unitDescUpper.includes("OVERNIGHT")) quantityInputType = "nights";
                        else if (unitDescUpper.includes("HOUR")) quantityInputType = "block_hours";
                        return {
                            serviceKey: key, displayDescription: rate.displayDescription, unitDescription: rate.unitDescription,
                            defaultBuyRate: rate.buy, defaultSellRate: rate.sell, selected: false, customSellPrice: undefined,
                            isActiveFromConfig: rate.isActive ?? true, quantityInputType,
                        };
                    });
                replaceOptionalServices(activeServicesFromConfig);
            }

        } else {
          const updatedQuoteData = await fetchQuoteById({ id: savedQuote.id });
          if (updatedQuoteData) {
              const initialFormOptionalServices: OptionalServiceFormData[] = 
                Object.entries(fetchedCompanyProfile?.serviceFeeRates || {})
                .filter(([_key, rate]) => rate.isActive)
                .map(([key, rate]) => {
                    const existingLineItem = (updatedQuoteData.lineItems || []).find(li => li.id === key);
                    let quantityInputType: OptionalServiceFormData['quantityInputType'] = 'none';
                    const unitDescUpper = rate.unitDescription.toUpperCase();
                    if (unitDescUpper.includes("PER LEG") || unitDescUpper.includes("LANDING")) quantityInputType = "legs";
                    else if (unitDescUpper.includes("PER NIGHT") || unitDescUpper.includes("OVERNIGHT")) quantityInputType = "nights";
                    else if (unitDescUpper.includes("HOUR")) quantityInputType = "block_hours";
                    return {
                        serviceKey: key, displayDescription: rate.displayDescription, unitDescription: rate.unitDescription,
                        defaultBuyRate: rate.buy, defaultSellRate: rate.sell, selected: !!existingLineItem, customSellPrice: existingLineItem?.sellRate,
                        isActiveFromConfig: rate.isActive ?? true, quantityInputType,
                    };
                });

            const formDataToReset: FullQuoteFormData = {
              quoteId: updatedQuoteData.quoteId,
              selectedCustomerId: updatedQuoteData.selectedCustomerId,
              clientName: updatedQuoteData.clientName,
              clientEmail: updatedQuoteData.clientEmail,
              clientPhone: updatedQuoteData.clientPhone || '',
              legs: updatedQuoteData.legs.map(leg => ({
                ...leg,
                departureDateTime: leg.departureDateTime ? parseISO(leg.departureDateTime) : undefined,
                passengerCount: leg.passengerCount || 1,
                originTaxiTimeMinutes: leg.originTaxiTimeMinutes === undefined ? 15 : leg.originTaxiTimeMinutes,
                destinationTaxiTimeMinutes: leg.destinationTaxiTimeMinutes === undefined ? 15 : leg.destinationTaxiTimeMinutes,
              })),
              aircraftId: updatedQuoteData.aircraftId,
              estimatedOvernights: updatedQuoteData.options.estimatedOvernights || 0,
              optionalServices: initialFormOptionalServices,
              cateringNotes: updatedQuoteData.options.cateringNotes || "",
              notes: updatedQuoteData.options.notes || '',
            };
            reset(formDataToReset);
            setCalculatedLineItems(updatedQuoteData.lineItems || []);
          }
        }
      } catch (error) {
        console.error("Failed to save quote:", error);
        toast({
          title: "Error Saving Quote",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  const generateFormattedPreview = (data: FullQuoteFormData): React.ReactNode => {
    const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === data.aircraftId);
    const totalBuyCost = calculatedLineItems.reduce((sum, item) => sum + item.buyTotal, 0);
    const totalSellPrice = calculatedLineItems.reduce((sum, item) => sum + item.sellTotal, 0);
    const marginAmount = totalSellPrice - totalBuyCost;
    const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : (totalSellPrice > 0 ? 100 : 0);

    const formatTimeDecimalToHHMM = (timeDecimal: number | undefined) => {
      if (timeDecimal === undefined || timeDecimal <= 0 || isNaN(timeDecimal)) return "00:00";
      const hours = Math.floor(timeDecimal);
      const minutes = Math.round((timeDecimal - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    return (
      <ScrollArea className="max-h-[70vh] pr-2 text-xs">
        <div className="space-y-3 p-1">
          <h3 className="font-semibold text-base mb-2">Quote Preview: {data.quoteId}</h3>

          <Separator />
          <div className="py-1">
            <h4 className="font-medium text-sm mb-0.5">Client:</h4>
            <p>{data.clientName}</p>
            <p>{data.clientEmail}</p>
            {data.clientPhone && <p>Phone: {data.clientPhone}</p>}
          </div>

          <Separator />
          <div className="py-1">
            <h4 className="font-medium text-sm mb-0.5">Aircraft:</h4>
            <p>{selectedAircraftInfo?.label || 'N/A'}</p>
          </div>

          <Separator />
          <div className="py-1">
            <h4 className="font-medium text-sm mb-1">Itinerary:</h4>
            {data.legs.map((leg, index) => {
               const flightTime = Number(leg.flightTimeHours || 0);
               const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
               const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
               const legBlockMinutes = originTaxi + (flightTime * 60) + destTaxi;
               const blockTimeHours = parseFloat((legBlockMinutes / 60).toFixed(2));
              return (
                <div key={index} className="mb-1.5 p-1.5 border rounded-md bg-muted/20 text-xs">
                  <p><strong>Leg {index + 1}:</strong> {leg.origin || 'N/A'} to {leg.destination || 'N/A'} ({leg.legType})</p>
                  <p>Departure: {leg.departureDateTime && isValidDate(leg.departureDateTime) ? format(leg.departureDateTime, 'PPpp') : 'N/A'}</p>
                  <p>Pax: {leg.passengerCount}, Flight Time: {formatTimeDecimalToHHMM(leg.flightTimeHours)}, Block Time: {formatTimeDecimalToHHMM(blockTimeHours)}</p>
                </div>
              );
            })}
          </div>

          <Separator />
          <div className="py-1">
            <h4 className="font-medium text-sm mb-1">Financial Summary:</h4>
            {calculatedLineItems.map(item => (
              <div key={item.id} className="flex justify-between items-center text-xs py-0.5">
                <span>{item.description} (x{item.quantity.toFixed(2)} {item.unitDescription})</span>
                <span className="font-medium">{formatCurrencyLocal(item.sellTotal)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold mt-1.5 pt-1.5 border-t">
              <span>TOTAL QUOTE PRICE:</span>
              <span className="text-base">{formatCurrencyLocal(totalSellPrice)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
              <span>(Internal Buy Cost: {formatCurrencyLocal(totalBuyCost)})</span>
              <span>(Margin: {formatCurrencyLocal(marginAmount)} / {marginPercentage.toFixed(1)}%)</span>
            </div>
          </div>
          
          {formOptionalServices.some(s => s.selected && s.displayDescription.toUpperCase().includes("CATERING")) && data.cateringNotes &&
            <div className="py-1"><h4 className="font-medium text-sm">Catering Notes:</h4><p className="whitespace-pre-wrap bg-muted/20 p-1.5 rounded-md">{data.cateringNotes}</p></div>
          }
          {data.notes && <div className="py-1"><h4 className="font-medium text-sm">General Notes:</h4><p className="whitespace-pre-wrap bg-muted/20 p-1.5 rounded-md">{data.notes}</p></div>}
        </div>
      </ScrollArea>
    );
  };

  const handlePreviewQuote = async () => {
    const isValidForm = await trigger();
    if (!isValidForm) {
      toast({ title: "Validation Error", description: "Please check the form for errors before previewing.", variant: "destructive" });
      return;
    }
    const data = getValues();
    setFormattedPreviewContent(generateFormattedPreview(data));
    setShowPreviewAlert(true);
  };


  if (isEditMode && isLoadingQuoteDataForEdit) {
    return (
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-4 w-1/2" /> </CardHeader>
          <CardContent className="space-y-4"> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader> <Skeleton className="h-8 w-1/4 mb-2" /> </CardHeader>
          <CardContent className="space-y-4"> <Skeleton className="h-20 w-full" /> <Skeleton className="h-10 w-1/3" /> </CardContent>
        </Card>
        <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
      </div>
    );
  }


  return (
    <>
    <Form {...form}>
      <form>
        <div className="space-y-6">
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg">
                    {isEditMode ? `Editing Quote: ${getValues('quoteId')}` : "Core Quote Details"}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField control={control} name="quoteId" render={({ field }) => ( <FormItem> <FormLabel>Quote ID</FormLabel> <FormControl><Input {...field} value={field.value || ''} readOnly={isEditMode} className={isEditMode ? "bg-muted/30 cursor-not-allowed" : "bg-muted/30"} /></FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
        </Card>
        
        <ClientOnly fallback={<Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full mt-4" /></CardContent></Card>}>
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Client Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <FormField control={control} name="selectedCustomerId" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel> <Select onValueChange={(value) => { handleCustomerSelect(value); field.onChange(value); }} value={field.value || ""} disabled={isLoadingCustomers}> <FormControl><SelectTrigger><SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select a client or enter details manually"} /></SelectTrigger></FormControl> <SelectContent> {!isLoadingCustomers && customers.length === 0 && <SelectItem value="NO_CUSTOMERS" disabled>No customers</SelectItem>} {customers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} {c.customerType && `(${c.customerType})`}</SelectItem>))} </SelectContent> </Select> <FormDescription>Auto-fills client details if selected.</FormDescription> <FormMessage /> </FormItem> )} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={control} name="clientName" render={({ field }) => ( <FormItem> <FormLabel>Client Name</FormLabel> <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={control} name="clientEmail" render={({ field }) => ( <FormItem> <FormLabel>Client Email</FormLabel> <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </div>
              <FormField control={control} name="clientPhone" render={({ field }) => ( <FormItem> <FormLabel>Client Phone</FormLabel> <FormControl><Input type="tel" placeholder="e.g., (555) 123-4567" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
          </Card>
        </ClientOnly>
        
        <ClientOnly fallback={<Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>}>
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Aircraft Selection</CardTitle></CardHeader>
            <CardContent>
                <FormItem>
                    <FormLabel className="flex items-center gap-1">
                        <PlaneIconUI className="h-4 w-4" /> Aircraft
                        {isLoadingSelectedAcPerf && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
                    </FormLabel>
                    <FormField control={control} name="aircraftId" render={({ field }) => ( 
                        <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingAircraftList}> 
                            <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAircraftList ? "Loading aircraft..." : "Select an aircraft"} /></SelectTrigger></FormControl> 
                            <SelectContent> 
                                {!isLoadingAircraftList && aircraftSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT" disabled>No aircraft in fleet</SelectItem>} 
                                {aircraftSelectOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))} 
                            </SelectContent> 
                        </Select> 
                    )} />
                    <FormMessage>{form.formState.errors.aircraftId?.message}</FormMessage>
                </FormItem>
            </CardContent>
          </Card>
        </ClientOnly>

        <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Flight Legs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            {fields.map((legItem, index) => (
                <Card key={legItem.id} className="p-4 border rounded-lg shadow-inner bg-background/80">
                  <CardHeader className="p-0 pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-md flex items-center gap-2"><GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" /> Leg {index + 1}</CardTitle>
                      {fields.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLeg(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove Leg</span></Button>)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Origin</FormLabel> <FormControl><Input placeholder="KJFK" value={field.value || ''} onChange={(e) => field.onChange(e.target.value.toUpperCase())} onBlur={field.onBlur} name={field.name} ref={field.ref}/></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneLanding className="h-4 w-4" />Destination</FormLabel> <FormControl><Input placeholder="KLAX" value={field.value || ''} onChange={(e) => field.onChange(e.target.value.toUpperCase())} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.originFbo`} render={({ field }) => ( <FormItem> <FormLabel><Building className="inline h-4 w-4 mr-1"/>Origin FBO</FormLabel> <FormControl><Input placeholder="Optional" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}/></FormControl> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.destinationFbo`} render={({ field }) => ( <FormItem> <FormLabel><Building className="inline h-4 w-4 mr-1"/>Destination FBO</FormLabel> <FormControl><Input placeholder="Optional" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}/></FormControl> </FormItem> )} />
                    </div>
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Desired Departure Date & Time</FormLabel>
                        <FormControl>
                          {isClient ? (
                            <Popover modal={false}>
                              <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !(field.value && field.value instanceof Date && isValidDate(field.value)) && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  <span>{field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "PPP HH:mm") : "Pick a date and time"}</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                                <Calendar mode="single" selected={field.value && field.value instanceof Date && isValidDate(field.value) ? field.value : undefined} onSelect={field.onChange} disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true} initialFocus />
                                <div className="p-2 border-t"><Input type="time" defaultValue={field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "HH:mm") : ""} onChange={(e) => { const time = e.target.value; const [hours, minutes] = time.split(':').map(Number); let newDate = field.value && field.value instanceof Date && isValidDate(field.value) ? new Date(field.value) : new Date(); if (!isValidDate(newDate)) newDate = new Date(); newDate.setHours(hours, minutes,0,0); field.onChange(newDate); }} /></div>
                              </PopoverContent>
                            </Popover>
                          ) : ( <Skeleton className="h-10 w-full" /> )}
                        </FormControl><FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}> <FormControl><SelectTrigger><SelectValue placeholder="Select leg type" /></SelectTrigger></FormControl><SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" />Passengers</FormLabel> 
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            value={String(field.value ?? '')} 
                            onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} 
                            onBlur={field.onBlur} name={field.name} ref={field.ref} 
                            min="0"
                          />
                        </FormControl> 
                      <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField control={control} name={`legs.${index}.originTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel>Orig. Taxi (min)</FormLabel> <FormControl><Input type="number" placeholder="15" value={String(field.value ?? '')} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} onBlur={field.onBlur} name={field.name} ref={field.ref} min="0" /></FormControl> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.flightTimeHours`} render={({ field }) => ( <FormItem> <FormLabel>Flight Time (hr)</FormLabel> <FormControl><Input type="number" step="0.1" placeholder="e.g., 2.5" value={String(field.value ?? '')} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl> </FormItem> )} />
                      <FormField control={control} name={`legs.${index}.destinationTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel>Dest. Taxi (min)</FormLabel> <FormControl><Input type="number" placeholder="15" value={String(field.value ?? '')} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} onBlur={field.onBlur} name={field.name} ref={field.ref} min="0" /></FormControl> </FormItem> )} />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !currentSelectedAircraftId || isLoadingAircraftList || isLoadingSelectedAcPerf} className="w-full sm:w-auto text-xs"> {estimatingLegIndex === index || isLoadingSelectedAcPerf ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />} Estimate Flight Details </Button>
                    {legEstimates[index] && (
                        <Alert variant={legEstimates[index]!.error ? "destructive" : "default"} className="mt-2 text-xs">
                            <Info className={`h-4 w-4 ${legEstimates[index]!.error ? '' : 'text-primary'}`} />
                            <AlertTitle className="text-sm">
                                {legEstimates[index]!.error ? `Error Estimating Leg ${index + 1}` : `Leg ${index + 1} AI Estimate Reference`}
                            </AlertTitle>
                            <AlertDescription className="space-y-1">
                                {legEstimates[index]!.error ? ( <p>{legEstimates[index]!.error}</p> ) : (
                                <>
                                    <p><strong>Origin:</strong> {legEstimates[index]!.resolvedOriginName} ({legEstimates[index]!.resolvedOriginIcao})</p>
                                    <p><strong>Destination:</strong> {legEstimates[index]!.resolvedDestinationName} ({legEstimates[index]!.resolvedDestinationIcao})</p>
                                    <p><strong>AI Est. Distance:</strong> {legEstimates[index]!.estimatedMileageNM?.toLocaleString()} NM</p>
                                    <p><strong>AI Est. Flight Time:</strong> {legEstimates[index]!.estimatedFlightTimeHours?.toFixed(1)} hours</p>
                                    <p><strong>Assumed Speed (AI):</strong> {legEstimates[index]!.assumedCruiseSpeedKts?.toLocaleString()} kts</p>
                                    <p className="mt-1"><em>AI Explanation: {legEstimates[index]!.briefExplanation}</em></p>
                                </>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            <Button type="button" variant="outline" onClick={handleAddLeg} className="w-full sm:w-auto mt-2"> <PlusCircle className="mr-2 h-4 w-4" /> Add New Leg </Button>
            {form.formState.errors.legs && typeof form.formState.errors.legs === 'object' && !Array.isArray(form.formState.errors.legs) && ( <FormMessage>{(form.formState.errors.legs as any).message}</FormMessage> )}
            </CardContent>
        </Card>

        {legsArray && legsArray.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Itinerary Summary</CardTitle></CardHeader>
            <CardContent><LegsSummaryTable legs={legsArray} /></CardContent>
          </Card>
        )}
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="additional-options">
            <AccordionTrigger className="p-0 hover:no-underline -mb-2">
              <Card className="w-full shadow-sm hover:bg-muted/30 rounded-b-none border-b-0"> 
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Additional Quote Options & Pricing
                        </CardTitle>
                    </div>
                    <CardDescription>Select desired services. Active services from Quote Configuration are listed here.</CardDescription>
                </CardHeader>
              </Card>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <Card className="rounded-t-none border-t-0 shadow-sm"> 
                <CardContent className="pt-4">
                    <div className="space-y-4">
                    {optionalServicesFields.length === 0 && !isLoadingDynamicRates && (<p className="text-sm text-muted-foreground">No active optional services configured in Quote Configuration.</p>)}
                    {optionalServicesFields.map((serviceField, index) => (
                        <div key={serviceField.id} className="space-y-2 p-3 border rounded-md hover:bg-muted/50">
                            <FormField
                                control={control} name={`optionalServices.${index}.selected`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="font-normal flex items-center gap-2">
                                            {serviceField.displayDescription}
                                            <span className="text-xs text-muted-foreground">({formatCurrencyLocal(serviceField.customSellPrice ?? serviceField.defaultSellRate)} / {serviceField.unitDescription})</span>
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            {formOptionalServices[index]?.selected && (
                                <FormField
                                    control={control} name={`optionalServices.${index}.customSellPrice`}
                                    render={({ field }) => (
                                        <FormItem className="pl-10">
                                            <FormLabel className="text-xs">Override Sell Price (per {serviceField.unitDescription})</FormLabel>
                                            <FormControl><Input type="number" placeholder={`Default: ${formatCurrencyLocal(serviceField.defaultSellRate)}`} {...field} value={(typeof field.value === 'number' && !isNaN(field.value)) ? String(field.value) : ''} onChange={e => { const valStr = e.target.value; field.onChange(valStr === '' ? undefined : parseFloat(valStr)); }} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    ))}
                    <FormField control={control} name="estimatedOvernights" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> Estimated Overnights</FormLabel> <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={(typeof field.value === 'number' && !isNaN(field.value)) ? String(field.value) : ''} onChange={e => { const valStr = e.target.value; field.onChange(valStr === '' ? undefined : parseInt(valStr, 10)); }} min="0"/></FormControl> <FormDescription>Number of overnight stays for crew/aircraft.</FormDescription> <FormMessage /> </FormItem> )} />
                    </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>


        <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem> <FormLabel>Catering Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="Specify catering details if requested..." {...field} value={field.value || ''} rows={3} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={control} name="notes" render={({ field }) => ( <FormItem> <FormLabel>General Quote Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="e.g., Specific client preferences, discount applied..." {...field} value={field.value || ''} rows={4} /></FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
        </Card>

        <CostsSummaryDisplay lineItems={calculatedLineItems} />
        </div>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6 mt-6 border-t">
            <Button type="button" variant="outline" onClick={handlePreviewQuote} disabled={isSaving}> <Eye className="mr-2 h-4 w-4" /> Preview Quote </Button>
            <Button type="button" variant="secondary" onClick={() => handleSave("Draft")} disabled={isSaving}> {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SaveIcon className="mr-2 h-4 w-4" />} {isEditMode ? "Save Draft Updates" : "Save as Draft"} </Button>
            <Button type="button" onClick={async () => { if (isEditMode && quoteIdToEdit) { const currentQuote = await fetchQuoteById({ id: quoteIdToEdit }); handleSave(currentQuote?.status || "Sent"); } else { handleSave("Sent"); } }} disabled={isSaving}> {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} {isEditMode ? "Update & Send Quote" : "Save & Send Quote"} </Button>
        </CardFooter>
        </form>
    </Form>

    {showPreviewAlert && (
        <AlertDialog open={showPreviewAlert} onOpenChange={setShowPreviewAlert}>
          <AlertDialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Quote Preview</AlertDialogTitle>
              <DialogDescription>This is a preview of the quote details. Review carefully before sending.</DialogDescription>
            </AlertDialogHeader>
            {formattedPreviewContent}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowPreviewAlert(false)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}


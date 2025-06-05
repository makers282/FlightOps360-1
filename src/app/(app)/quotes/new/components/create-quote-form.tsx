
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
import { CalendarIcon, Loader2, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info, Eye, Send, Building, UserSearch, DollarSign, Fuel, SaveIcon } from 'lucide-react';
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
import { fetchAircraftPerformance, type AircraftPerformanceData } from '@/ai/flows/manage-aircraft-performance-flow'; // Import performance flow
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

const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  selectedCustomerId: z.string().optional(),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  legs: z.array(legSchema).min(1, "At least one flight leg is required."),
  aircraftId: z.string().min(1, "Aircraft selection is required.").optional(), 
  
  medicsRequested: z.boolean().optional().default(false),
  cateringRequested: z.boolean().optional().default(false),
  includeLandingFees: z.boolean().optional().default(true),
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  fuelSurchargeRequested: z.boolean().optional().default(true),

  sellPriceFuelSurchargePerHour: z.coerce.number().optional(),
  sellPriceMedics: z.coerce.number().optional(),
  sellPriceCatering: z.coerce.number().optional(),
  sellPriceLandingFeePerLeg: z.coerce.number().optional(),
  sellPriceOvernight: z.coerce.number().optional(),
  
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

const SERVICE_KEY_FUEL_SURCHARGE = "FUEL_SURCHARGE_PER_BLOCK_HOUR";
const SERVICE_KEY_MEDICS = "MEDICAL_TEAM";
const SERVICE_KEY_CATERING = "CATERING";
const SERVICE_KEY_LANDING_FEES = "LANDING_FEES_PER_LEG";
const SERVICE_KEY_OVERNIGHT_FEES = "OVERNIGHT_FEES_PER_NIGHT";

const DEFAULT_AIRCRAFT_RATE_FALLBACK: Pick<AircraftRate, 'buy' | 'sell'> = {
  buy: 3500,
  sell: 4000,
};

// These defaults are primarily for UI placeholders if company profile data is missing.
const UI_DEFAULT_SERVICE_RATES: Record<string, Pick<ServiceFeeRate, 'sell'>> = {
  [SERVICE_KEY_FUEL_SURCHARGE]: { sell: 400 },
  [SERVICE_KEY_LANDING_FEES]: { sell: 500 },
  [SERVICE_KEY_OVERNIGHT_FEES]: { sell: 1300},
  [SERVICE_KEY_MEDICS]: { sell: 2500 }, 
  [SERVICE_KEY_CATERING]: { sell: 500 },
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
  
  const [selectedAircraftPerformance, setSelectedAircraftPerformance] = useState<AircraftPerformanceData | null>(null);
  const [isLoadingSelectedAcPerf, setIsLoadingSelectedAcPerf] = useState(false);


  const form = useForm<FullQuoteFormData>({ 
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
      aircraftId: undefined, 
      medicsRequested: false,
      cateringRequested: false,
      includeLandingFees: true,
      estimatedOvernights: 0,
      fuelSurchargeRequested: true,
      cateringNotes: "",
      notes: '',
      sellPriceFuelSurchargePerHour: undefined,
      sellPriceMedics: undefined,
      sellPriceCatering: undefined,
      sellPriceLandingFeePerLeg: undefined,
      sellPriceOvernight: undefined,
    },
  });

  const { control, setValue, getValues, trigger, formState: { errors }, reset } = form;
  
  const legsArray = useWatch({ control, name: "legs", defaultValue: [] });
  const currentSelectedAircraftId = useWatch({ control, name: "aircraftId" }); 
  const fuelSurchargeRequested = useWatch({ control, name: "fuelSurchargeRequested" });
  const sellPriceFuelSurchargePerHour = useWatch({ control, name: "sellPriceFuelSurchargePerHour" });
  const medicsRequested = useWatch({ control, name: "medicsRequested" });
  const sellPriceMedics = useWatch({ control, name: "sellPriceMedics" });
  const cateringRequested = useWatch({ control, name: "cateringRequested" });
  const sellPriceCatering = useWatch({ control, name: "sellPriceCatering" });
  const includeLandingFees = useWatch({ control, name: "includeLandingFees" });
  const sellPriceLandingFeePerLeg = useWatch({ control, name: "sellPriceLandingFeePerLeg" });
  const currentEstimatedOvernights = useWatch({ control, name: "estimatedOvernights" });
  const sellPriceOvernight = useWatch({ control, name: "sellPriceOvernight" });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "legs",
  });

  const generateNewQuoteId = useCallback(() => {
    return `QT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }, []);


  useEffect(() => {
    if (currentSelectedAircraftId) {
      setIsLoadingSelectedAcPerf(true);
      fetchAircraftPerformance({ aircraftId: currentSelectedAircraftId })
        .then(perfData => {
          setSelectedAircraftPerformance(perfData);
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

    const loadInitialData = async () => {
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
    loadInitialData();

    if (isEditMode && quoteIdToEdit) {
      setIsLoadingQuoteDataForEdit(true);
      fetchQuoteById({ id: quoteIdToEdit })
        .then(quoteData => {
          if (quoteData) {
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
              medicsRequested: quoteData.options.medicsRequested || false,
              cateringRequested: quoteData.options.cateringRequested || false,
              includeLandingFees: quoteData.options.includeLandingFees === undefined ? true : quoteData.options.includeLandingFees,
              estimatedOvernights: quoteData.options.estimatedOvernights || 0,
              fuelSurchargeRequested: quoteData.options.fuelSurchargeRequested === undefined ? true : quoteData.options.fuelSurchargeRequested,
              sellPriceFuelSurchargePerHour: quoteData.options.sellPriceFuelSurchargePerHour,
              sellPriceMedics: quoteData.options.sellPriceMedics,
              sellPriceCatering: quoteData.options.sellPriceCatering,
              sellPriceLandingFeePerLeg: quoteData.options.sellPriceLandingFeePerLeg,
              sellPriceOvernight: quoteData.options.sellPriceOvernight,
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
    } else {
      if (!getValues('quoteId')) {
        setValue('quoteId', generateNewQuoteId());
      }
    }
  }, [isEditMode, quoteIdToEdit, reset, toast, router, setValue, getValues, generateNewQuoteId]);


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

  useEffect(() => {
    const newItems: QuoteLineItem[] = [];
    if (isLoadingDynamicRates || !currentSelectedAircraftId) {
        setCalculatedLineItems([]);
        return;
    }

    let totalFlightTimeBuyCost = 0;
    let totalFlightTimeSellCost = 0;
    let totalBlockHours = 0;
    let totalRevenueFlightHours = 0;
    
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

        if (flightTime > 0 && ["Charter", "Owner", "Ambulance", "Cargo"].includes(leg.legType)) {
            totalFlightTimeBuyCost += flightTime * aircraftBuyRate;
            totalFlightTimeSellCost += flightTime * aircraftSellRate;
            totalRevenueFlightHours += flightTime;
        } else if (flightTime > 0 && ["Positioning", "Ferry", "Maintenance"].includes(leg.legType)) {
            totalFlightTimeBuyCost += flightTime * aircraftBuyRate;
            totalFlightTimeSellCost += flightTime * aircraftBuyRate; // Positioning legs sell at buy rate
        }
    });

    const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === currentSelectedAircraftId);
    const aircraftDisplayName = selectedAircraftInfo ? selectedAircraftInfo.label : "Selected Aircraft";
    
    const billableHoursForAircraft = totalRevenueFlightHours > 0 ? totalRevenueFlightHours : (totalBlockHours > 0 ? totalBlockHours : 0);

    if (billableHoursForAircraft > 0) {
        newItems.push({
            id: 'aircraftFlightTimeCost',
            description: `Aircraft Time (${aircraftDisplayName})`,
            buyRate: aircraftBuyRate,
            sellRate: aircraftSellRate,
            unitDescription: 'Hour (Std.)',
            quantity: parseFloat(billableHoursForAircraft.toFixed(2)),
            buyTotal: totalFlightTimeBuyCost, 
            sellTotal: totalFlightTimeSellCost, 
        });
    }
    
    const companyServiceRates = fetchedCompanyProfile?.serviceFeeRates || {};
    const getServiceRate = (key: string, type: 'buy' | 'sell', defaultAmount: number) => {
      return companyServiceRates[key]?.[type] ?? defaultAmount;
    };
    const getServiceUnit = (key: string, defaultUnit: string) => {
        return companyServiceRates[key]?.unitDescription ?? defaultUnit;
    }
    const getServiceDisplay = (key: string, defaultDisplay: string) => {
        return companyServiceRates[key]?.displayDescription ?? defaultDisplay;
    }


    if (fuelSurchargeRequested && totalBlockHours > 0) {
      const buyRate = getServiceRate(SERVICE_KEY_FUEL_SURCHARGE, 'buy', 300);
      const sellRate = sellPriceFuelSurchargePerHour ?? getServiceRate(SERVICE_KEY_FUEL_SURCHARGE, 'sell', 400);
      newItems.push({
        id: 'fuelSurcharge', description: getServiceDisplay(SERVICE_KEY_FUEL_SURCHARGE, "Fuel Surcharge"), 
        buyRate, sellRate, unitDescription: getServiceUnit(SERVICE_KEY_FUEL_SURCHARGE, "Block Hour"),
        quantity: parseFloat(totalBlockHours.toFixed(2)),
        buyTotal: buyRate * totalBlockHours, sellTotal: sellRate * totalBlockHours,
      });
    }

    if (medicsRequested) {
      const buyRate = getServiceRate(SERVICE_KEY_MEDICS, 'buy', 1800);
      const sellRate = sellPriceMedics ?? getServiceRate(SERVICE_KEY_MEDICS, 'sell', 2500);
      newItems.push({
        id: 'medicsFee', description: getServiceDisplay(SERVICE_KEY_MEDICS, "Medical Team"), 
        buyRate, sellRate, unitDescription: getServiceUnit(SERVICE_KEY_MEDICS, "Service"),
        quantity: 1, buyTotal: buyRate, sellTotal: sellRate,
      });
    }

    if (cateringRequested) {
      const buyRate = getServiceRate(SERVICE_KEY_CATERING, 'buy', 350);
      const sellRate = sellPriceCatering ?? getServiceRate(SERVICE_KEY_CATERING, 'sell', 500);
      newItems.push({
        id: 'cateringFee', description: getServiceDisplay(SERVICE_KEY_CATERING, "Catering"), 
        buyRate, sellRate, unitDescription: getServiceUnit(SERVICE_KEY_CATERING, "Service"),
        quantity: 1, buyTotal: buyRate, sellTotal: sellRate,
      });
    }

    const validLegsCount = legsArray.filter(leg => leg.origin && leg.destination && leg.origin.length >=3 && leg.destination.length >=3).length;
    if (includeLandingFees && validLegsCount > 0) {
      const buyRate = getServiceRate(SERVICE_KEY_LANDING_FEES, 'buy', 400);
      const sellRate = sellPriceLandingFeePerLeg ?? getServiceRate(SERVICE_KEY_LANDING_FEES, 'sell', 500);
      newItems.push({
        id: 'landingFees', description: getServiceDisplay(SERVICE_KEY_LANDING_FEES, "Landing Fees"), 
        buyRate, sellRate, unitDescription: getServiceUnit(SERVICE_KEY_LANDING_FEES, "Per Leg"),
        quantity: validLegsCount,
        buyTotal: buyRate * validLegsCount, sellTotal: sellRate * validLegsCount,
      });
    }

    const numericEstimatedOvernights = Number(currentEstimatedOvernights || 0);
    if (numericEstimatedOvernights > 0) {
      const buyRate = getServiceRate(SERVICE_KEY_OVERNIGHT_FEES, 'buy', 1000);
      const sellRate = sellPriceOvernight ?? getServiceRate(SERVICE_KEY_OVERNIGHT_FEES, 'sell', 1300);
      newItems.push({
        id: 'overnightFees', description: getServiceDisplay(SERVICE_KEY_OVERNIGHT_FEES, "Overnight Fees"), 
        buyRate, sellRate, unitDescription: getServiceUnit(SERVICE_KEY_OVERNIGHT_FEES, "Per Night"),
        quantity: numericEstimatedOvernights,
        buyTotal: buyRate * numericEstimatedOvernights, sellTotal: sellRate * numericEstimatedOvernights,
      });
    }
    
    setCalculatedLineItems(newItems);

  }, [
    legsArray, currentSelectedAircraftId, aircraftSelectOptions,
    fetchedAircraftRates, fetchedCompanyProfile,
    fuelSurchargeRequested, sellPriceFuelSurchargePerHour,
    medicsRequested, sellPriceMedics,
    cateringRequested, sellPriceCatering,
    includeLandingFees, sellPriceLandingFeePerLeg,
    currentEstimatedOvernights, sellPriceOvernight,
    isLoadingDynamicRates
  ]);

  const handleEstimateFlightDetails = useCallback(async (legIndex: number) => {
    if (estimatingLegIndex === legIndex) return; 
    if (estimatingLegIndex !== null && estimatingLegIndex !== legIndex) {
       toast({ title: "Estimation in Progress", description: `Still estimating leg ${estimatingLegIndex + 1}. Please wait.`, variant: "default" });
       return;
    }

    const legData = getValues(`legs.${legIndex}`);
    const selectedAircraft = aircraftSelectOptions.find(ac => ac.value === currentSelectedAircraftId);

    if (!legData?.origin || legData.origin.length < 3 || !legData?.destination || legData.destination.length < 3 || !currentSelectedAircraftId || !selectedAircraft) {
      toast({ title: "Missing Information", description: "Please provide origin, destination (min 3 chars each), and select an aircraft type before estimating.", variant: "destructive"});
      return;
    }
    
    const aircraftModelForFlow = selectedAircraft.model;
    const knownCruiseSpeedForFlow = selectedAircraftPerformance?.cruiseSpeed;
    const currentEstimate = legEstimates[legIndex];

    if (currentEstimate && !currentEstimate.error &&
        currentEstimate.estimatedForInputs?.origin === legData.origin.toUpperCase() &&
        currentEstimate.estimatedForInputs?.destination === legData.destination.toUpperCase() &&
        currentEstimate.estimatedForInputs?.aircraftModel === aircraftModelForFlow &&
        currentEstimate.estimatedForInputs?.knownCruiseSpeedKts === knownCruiseSpeedForFlow) {
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
        aircraftType: aircraftModelForFlow,
        knownCruiseSpeedKts: knownCruiseSpeedForFlow,
      });
      
      setValue(`legs.${legIndex}.flightTimeHours`, result.estimatedFlightTimeHours);
      const originTaxi = Number(legData.originTaxiTimeMinutes || 0);
      const destTaxi = Number(legData.destinationTaxiTimeMinutes || 0);
      const flightTime = Number(result.estimatedFlightTimeHours || 0); 
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
            aircraftModel: aircraftModelForFlow,
            knownCruiseSpeedKts: knownCruiseSpeedForFlow,
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
            aircraftModel: aircraftModelForFlow,
            knownCruiseSpeedKts: knownCruiseSpeedForFlow,
          }
        } as LegEstimate; 
        return newEstimates;
      });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, legEstimates, toast, estimatingLegIndex, setValue, setLegEstimates, setEstimatingLegIndex, aircraftSelectOptions, currentSelectedAircraftId, selectedAircraftPerformance]);

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
      const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : 0;

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
          medicsRequested: data.medicsRequested,
          cateringRequested: data.cateringRequested,
          includeLandingFees: data.includeLandingFees,
          estimatedOvernights: data.estimatedOvernights,
          fuelSurchargeRequested: data.fuelSurchargeRequested,
          cateringNotes: data.cateringRequested ? data.cateringNotes : undefined,
          notes: data.notes,
          sellPriceFuelSurchargePerHour: data.sellPriceFuelSurchargePerHour,
          sellPriceMedics: data.sellPriceMedics,
          sellPriceCatering: data.sellPriceCatering,
          sellPriceLandingFeePerLeg: data.sellPriceLandingFeePerLeg,
          sellPriceOvernight: data.sellPriceOvernight,
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
                quoteLink: `https://your-app.com/view-quote/${savedQuote.id}` 
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
            medicsRequested: false, cateringRequested: false, includeLandingFees: true, estimatedOvernights: 0, fuelSurchargeRequested: true,
            cateringNotes: "", notes: '',
            sellPriceFuelSurchargePerHour: undefined, sellPriceMedics: undefined, sellPriceCatering: undefined, sellPriceLandingFeePerLeg: undefined, sellPriceOvernight: undefined,
          });
          setLegEstimates([]);
          setCalculatedLineItems([]);
        } else {
          const updatedQuoteData = await fetchQuoteById({ id: savedQuote.id });
          if (updatedQuoteData) {
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
              medicsRequested: updatedQuoteData.options.medicsRequested || false,
              cateringRequested: updatedQuoteData.options.cateringRequested || false,
              includeLandingFees: updatedQuoteData.options.includeLandingFees === undefined ? true : updatedQuoteData.options.includeLandingFees,
              estimatedOvernights: updatedQuoteData.options.estimatedOvernights || 0,
              fuelSurchargeRequested: updatedQuoteData.options.fuelSurchargeRequested === undefined ? true : updatedQuoteData.options.fuelSurchargeRequested,
              sellPriceFuelSurchargePerHour: updatedQuoteData.options.sellPriceFuelSurchargePerHour,
              sellPriceMedics: updatedQuoteData.options.sellPriceMedics,
              sellPriceCatering: updatedQuoteData.options.sellPriceCatering,
              sellPriceLandingFeePerLeg: updatedQuoteData.options.sellPriceLandingFeePerLeg,
              sellPriceOvernight: updatedQuoteData.options.sellPriceOvernight,
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
    const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : 0;

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

          {(data.notes || data.cateringNotes || data.medicsRequested) && <Separator />}
          {data.medicsRequested && <div className="py-1"><p><strong>Medics Requested:</strong> Yes</p></div>}
          {data.cateringRequested && <div className="py-1"><p><strong>Catering Requested:</strong> Yes</p></div>}
          {data.cateringNotes && <div className="py-1"><h4 className="font-medium text-sm">Catering Notes:</h4><p className="whitespace-pre-wrap bg-muted/20 p-1.5 rounded-md">{data.cateringNotes}</p></div>}
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
  
  const getServiceLabel = (serviceKey: string, defaultLabel: string, unitDescription?: string) => {
    const serviceConfig = fetchedCompanyProfile?.serviceFeeRates?.[serviceKey];
    let label = serviceConfig?.displayDescription || defaultLabel;
    if (serviceConfig?.sell) {
      label += ` (${formatCurrencyLocal(serviceConfig.sell)}`;
      if (unitDescription || serviceConfig.unitDescription) {
        label += `/${unitDescription || serviceConfig.unitDescription}`;
      }
      label += ")";
    } else if(UI_DEFAULT_SERVICE_RATES[serviceKey]?.sell) { // Fallback for UI if profile not loaded
      label += ` (Default: ${formatCurrencyLocal(UI_DEFAULT_SERVICE_RATES[serviceKey]?.sell)}`;
      if (unitDescription) label += `/${unitDescription}`;
      label += ")";
    }
    return label;
  };

  const getServicePlaceholder = (serviceKey: string) => {
    const defaultSellRate = fetchedCompanyProfile?.serviceFeeRates?.[serviceKey]?.sell ?? UI_DEFAULT_SERVICE_RATES[serviceKey]?.sell ?? 0;
    return `Default: ${formatCurrencyLocal(defaultSellRate)}`;
  }

  if (isLoadingQuoteDataForEdit) {
    return (
      <Card className="shadow-lg max-w-4xl mx-auto">
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-8">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
    );
  }


  return (
    <>
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? `Editing Quote: ${getValues('quoteId')}` : "New Quote Details"}</CardTitle>
        <CardDescription>{isEditMode ? "Modify the details of this existing quote." : "Fill in the client and trip information to generate a quote."}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <CardContent className="space-y-8">
          <FormField control={control} name="quoteId" render={({ field }) => ( <FormItem className="mb-6"> <FormLabel>Quote ID</FormLabel> <FormControl><Input placeholder="e.g., QT-ABCDE" {...field} value={field.value || ''} readOnly={isEditMode} className={isEditMode ? "bg-muted/50 cursor-not-allowed" : "bg-muted/50"} /></FormControl> <FormMessage /> </FormItem> )} />
            
            <section>
              <CardTitle className="text-xl border-b pb-2 mb-4">Client Information</CardTitle>
              <FormField 
                control={control} 
                name="selectedCustomerId" 
                render={({ field }) => ( 
                  <FormItem className="mb-4"> 
                    <FormLabel className="flex items-center gap-1"><UserSearch className="h-4 w-4" /> Select Existing Client (Optional)</FormLabel> 
                    <Select 
                      onValueChange={(value) => { handleCustomerSelect(value); field.onChange(value); }} 
                      value={field.value || ""} 
                      name={field.name}
                      disabled={isLoadingCustomers}
                    > 
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select a client"} /></SelectTrigger></FormControl> 
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
                <FormField 
                    control={control} 
                    name="aircraftId" 
                    render={({ field }) => ( 
                        <FormItem> 
                            <FormLabel>Aircraft</FormLabel> 
                            <Select 
                                onValueChange={field.onChange} 
                                value={field.value || ""}
                                name={field.name}
                                disabled={isLoadingAircraftList || isLoadingDynamicRates}
                            > 
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingAircraftList ? "Loading aircraft..." : "Select an aircraft"} />
                                    </SelectTrigger>
                                </FormControl> 
                                <SelectContent>
                                    {!isLoadingAircraftList && aircraftSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT_CONFIGURED_PLACEHOLDER" disabled>No aircraft configured in fleet</SelectItem>}
                                    {aircraftSelectOptions.map(aircraft => (
                                        <SelectItem key={aircraft.value} value={aircraft.value}>
                                            {aircraft.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent> 
                            </Select> 
                            <FormMessage /> 
                        </FormItem> 
                    )} 
                />
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
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => ( 
                      <FormItem className="flex flex-col"> 
                        <FormLabel>Desired Departure Date & Time</FormLabel> 
                        <FormControl>
                          {isClient ? ( 
                            <Popover modal={false}> 
                              <PopoverTrigger asChild> 
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !(field.value && field.value instanceof Date && isValidDate(field.value)) && "text-muted-foreground")}> 
                                  <span>{field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "PPP HH:mm") : "Pick a date and time"}</span> 
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> 
                                </Button> 
                              </PopoverTrigger> 
                              <PopoverContent className="w-auto p-0 z-[100]" align="start"> 
                                <Calendar mode="single" selected={field.value && field.value instanceof Date && isValidDate(field.value) ? field.value : undefined} onSelect={field.onChange} disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true} initialFocus /> 
                                <div className="p-2 border-t border-border"> 
                                  <Input type="time" defaultValue={field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "HH:mm") : ""} onChange={(e) => { const time = e.target.value; const [hours, minutes] = time.split(':').map(Number); let newDate = field.value && field.value instanceof Date && isValidDate(field.value) ? new Date(field.value) : new Date(); if (!isValidDate(newDate)) newDate = new Date(); newDate.setHours(hours, minutes,0,0); field.onChange(newDate); }} /> 
                                </div> 
                              </PopoverContent> 
                            </Popover> 
                          ) : ( <Skeleton className="h-10 w-full" /> )} 
                        </FormControl>
                        <FormMessage /> 
                      </FormItem> 
                    )} />
                    
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => ( <FormItem> <FormLabel>Leg Type</FormLabel> <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}> <FormControl><SelectTrigger><SelectValue placeholder="Select leg type" /></SelectTrigger></FormControl> <SelectContent>{legTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" />Passengers</FormLabel> 
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 1" 
                              {...field} 
                              value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : field.value}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                field.onChange(isNaN(val) ? undefined : val);
                              }}
                              min="0"
                            />
                          </FormControl> 
                        <FormMessage /> </FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <FormField control={control} name={`legs.${index}.originTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1">Origin Taxi (mins)</FormLabel> 
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 15" 
                              {...field} 
                              value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                field.onChange(isNaN(val) ? undefined : val);
                              }}
                              min="0"
                            />
                          </FormControl> 
                        <FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.flightTimeHours`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><PlaneTakeoff className="h-4 w-4" />Flight Time (hrs)</FormLabel> 
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              placeholder="e.g., 2.5" 
                              {...field} 
                              value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                field.onChange(isNaN(val) ? undefined : val);
                              }}
                            />
                          </FormControl> 
                        <FormDescription className="text-xs">Populated by AI, editable.</FormDescription><FormMessage /> </FormItem> )} />
                        <FormField control={control} name={`legs.${index}.destinationTaxiTimeMinutes`} render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1">Dest. Taxi (mins)</FormLabel> 
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 15" 
                              {...field} 
                              value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                field.onChange(isNaN(val) ? undefined : val);
                              }}
                              min="0"
                            />
                          </FormControl> 
                        <FormMessage /> </FormItem> )} />
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !currentSelectedAircraftId || isLoadingDynamicRates || isLoadingSelectedAcPerf} className="w-full sm:w-auto"> {estimatingLegIndex === index || isLoadingSelectedAcPerf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Estimate Flight Details </Button>
                    {(!currentSelectedAircraftId && !isLoadingDynamicRates) && <FormDescription className="text-xs text-destructive">Select an aircraft to enable estimation.</FormDescription>}
                    {(isLoadingDynamicRates || isLoadingAircraftList) && <FormDescription className="text-xs">Loading aircraft & rate data...</FormDescription>}
                    {isLoadingSelectedAcPerf && <FormDescription className="text-xs">Loading performance data for selected aircraft...</FormDescription>}


                    {legEstimates[index] && (() => {
                      const estimate = legEstimates[index]!;
                      const legData = getValues(`legs.${index}`);
                      let formattedArrivalTime = 'N/A';
                      let formattedBlockTime = 'N/A';
                      
                      const legDepartureDateTime = legData.departureDateTime;
                      const legFlightTimeHours = Number(legData.flightTimeHours || 0); 

                      if (legDepartureDateTime && legDepartureDateTime instanceof Date && isValidDate(legDepartureDateTime) && legFlightTimeHours > 0) {
                        const departureTime = new Date(legDepartureDateTime);
                        const flightTimeMillis = legFlightTimeHours * 60 * 60 * 1000;
                        const arrivalTimeMillis = departureTime.getTime() + flightTimeMillis;
                        if (!isNaN(arrivalTimeMillis)) {
                           formattedArrivalTime = format(new Date(arrivalTimeMillis), "PPP HH:mm");
                        }
                      }

                      const originTaxiMins = Number(legData.originTaxiTimeMinutes || 0);
                      const destTaxiMins = Number(legData.destinationTaxiTimeMinutes || 0);
                      
                      if (legFlightTimeHours > 0 || originTaxiMins > 0 || destTaxiMins > 0) {
                        const blockTimeTotalMinutes = originTaxiMins + (legFlightTimeHours * 60) + destTaxiMins;
                        const blockHours = Math.floor(blockTimeTotalMinutes / 60);
                        const blockMinutes = Math.round(blockTimeTotalMinutes % 60);
                        formattedBlockTime = `${String(blockHours).padStart(2, '0')}:${String(blockMinutes).padStart(2, '0')} hrs`;
                      }
                      
                      return (
                        <Alert variant={estimate.error ? "destructive" : "default"} className="mt-4 text-xs">
                          <Info className={`h-4 w-4 ${estimate.error ? '' : 'text-primary'}`} />
                          <AlertTitle className="text-sm">{estimate.error ? `Error Estimating Leg ${index + 1}` : `Leg ${index + 1} AI Estimate Reference`}</AlertTitle>
                          <AlertDescription>
                            {estimate.error ? ( <p>{estimate.error}</p> ) : (
                              <>
                                <p><strong>AI Est. Distance:</strong> {estimate.estimatedMileageNM?.toLocaleString()} NM</p>
                                <p><strong>AI Est. Flight Time:</strong> {estimate.estimatedFlightTimeHours?.toFixed(1)} hours (Populated editable field above)</p>
                                {(legDepartureDateTime && legDepartureDateTime instanceof Date && isValidDate(legDepartureDateTime)) && <p><strong>Calc. Arrival Time:</strong> {formattedArrivalTime}</p>}
                                <p><strong>Calc. Block Time:</strong> {formattedBlockTime} (based on current taxi/flight times)</p>
                                <p><strong>Assumed Speed (AI):</strong> {estimate.assumedCruiseSpeedKts?.toLocaleString()} kts</p>
                                <p className="mt-1"><em>AI Explanation: {estimate.briefExplanation}</em></p>
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
                <CardTitle className="text-xl border-b pb-2 mb-4">Additional Quote Options & Pricing</CardTitle>
                <div className="space-y-4">
                    <FormField control={control} name="fuelSurchargeRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Fuel className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_FUEL_SURCHARGE, "Include Fuel Surcharge", "Block Hr")}</FormLabel></div> </FormItem> )} />
                    {fuelSurchargeRequested && <FormField control={control} name="sellPriceFuelSurchargePerHour" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Fuel Surcharge Sell Price (per Block Hour)</FormLabel> 
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={getServicePlaceholder(SERVICE_KEY_FUEL_SURCHARGE)} 
                          {...field} 
                          value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                          onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}
                        />
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="medicsRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_MEDICS, "Medics Requested")}</FormLabel></div> </FormItem> )} />
                    {medicsRequested && <FormField control={control} name="sellPriceMedics" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Medics Fee Sell Price</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={getServicePlaceholder(SERVICE_KEY_MEDICS)}  {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }} />
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}
                    
                    <FormField control={control} name="cateringRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_CATERING, "Catering Requested")}</FormLabel></div> </FormItem> )} />
                    {cateringRequested && ( <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem className="pl-8"> <FormLabel>Catering Notes</FormLabel> <FormControl><Textarea placeholder="Specify catering details..." {...field} value={field.value || ''} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> )}
                    {cateringRequested && <FormField control={control} name="sellPriceCatering" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Catering Fee Sell Price</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={getServicePlaceholder(SERVICE_KEY_CATERING)} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="includeLandingFees" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_LANDING_FEES, "Include Landing Fees", "Leg")}</FormLabel></div> </FormItem> )} />
                    {includeLandingFees && <FormField control={control} name="sellPriceLandingFeePerLeg" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Landing Fee Sell Price (per Leg)</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={getServicePlaceholder(SERVICE_KEY_LANDING_FEES)} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="estimatedOvernights" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> {getServiceLabel(SERVICE_KEY_OVERNIGHT_FEES, "Estimated Overnights", "Night")}</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder="e.g., 0" {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseInt(e.target.value, 10); field.onChange(isNaN(val) ? undefined : val); }} min="0"/>
                      </FormControl> 
                    <FormDescription>Number of overnight stays for crew/aircraft.</FormDescription> <FormMessage /> </FormItem> )} />
                    {Number(currentEstimatedOvernights || 0) > 0 && <FormField control={control} name="sellPriceOvernight" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Overnight Fee Sell Price (per Night)</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={getServicePlaceholder(SERVICE_KEY_OVERNIGHT_FEES)} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}
                </div>
            </section>

            <Separator />
            <FormField control={control} name="notes" render={({ field }) => ( <FormItem> <FormLabel>General Quote Notes (Optional)</FormLabel> <FormControl><Textarea placeholder="e.g., Specific client preferences, discount applied..." {...field} value={field.value || ''} rows={4} /></FormControl> <FormMessage /> </FormItem> )} />

            <Separator className="my-6" />
            <CostsSummaryDisplay lineItems={calculatedLineItems} />

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={handlePreviewQuote} disabled={isSaving}> <Eye className="mr-2 h-4 w-4" /> Preview Quote </Button>
            <Button 
                type="button" 
                variant="secondary" 
                onClick={() => handleSave("Draft")} 
                disabled={isSaving}
            > 
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SaveIcon className="mr-2 h-4 w-4" />}
              {isEditMode ? "Save Draft Updates" : "Save as Draft"}
            </Button>
            <Button 
                type="button" 
                onClick={async () => {
                    if (isEditMode) {
                        const currentQuote = await fetchQuoteById({ id: quoteIdToEdit! });
                        handleSave(currentQuote?.status || "Sent"); 
                    } else {
                        handleSave("Sent");
                    }
                }} 
                disabled={isSaving}
            > 
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isEditMode ? "Update & Send Quote" : "Save & Send Quote"}
            </Button>
          </CardFooter>
      </Form>
    </Card>

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


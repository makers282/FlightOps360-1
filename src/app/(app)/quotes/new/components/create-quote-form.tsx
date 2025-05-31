
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler, useFieldArray, useWatch } from 'react-hook-form';
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
import { CalendarIcon, Loader2, Users, Briefcase, Utensils, Landmark, BedDouble, PlaneTakeoff, PlaneLanding, PlusCircle, Trash2, GripVertical, Wand2, Info, Eye, Send, Building, UserSearch, DollarSign, Fuel, SaveIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate } from "date-fns";
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LegsSummaryTable } from './legs-summary-table';
import { CostsSummaryDisplay, type LineItem } from './costs-summary-display';
import { saveQuote } from '@/ai/flows/manage-quotes-flow';
import type { Quote, SaveQuoteInput, QuoteLeg, QuoteLineItem, quoteStatuses as QuoteStatusType } from '@/ai/schemas/quote-schemas';
import { quoteStatuses } from '@/ai/schemas/quote-schemas';
import { useRouter } from 'next/navigation';


export const legTypes = [ 
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

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
  estimatedForInputs?: { origin: string; destination: string; aircraftModel: string };
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

const DEFAULT_SERVICE_RATES: Record<string, ServiceFeeRate> = {
  [SERVICE_KEY_FUEL_SURCHARGE]: { displayDescription: "Fuel Surcharge", buy: 300, sell: 400, unitDescription: "Block Hour" },
  [SERVICE_KEY_LANDING_FEES]: { displayDescription: "Landing Fees", buy: 400, sell: 500, unitDescription: "Per Leg" },
  [SERVICE_KEY_OVERNIGHT_FEES]: { displayDescription: "Overnight Fees", buy: 1000, sell: 1300, unitDescription: "Per Night"},
  [SERVICE_KEY_MEDICS]: { displayDescription: "Medical Team", buy: 1800, sell: 2500, unitDescription: "Service" }, 
  [SERVICE_KEY_CATERING]: { displayDescription: "Catering", buy: 350, sell: 500, unitDescription: "Service" },
};

const sampleCustomerData = [
  { id: 'CUST001', name: 'John Doe', company: 'Doe Industries', email: 'john.doe@example.com', phone: '555-1234' },
  { id: 'CUST002', name: 'Jane Smith', company: 'Smith Corp', email: 'jane.smith@example.com', phone: '555-5678' },
];

export function CreateQuoteForm() {
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

  const { control, setValue, getValues, trigger, formState: { errors } } = form;
  
  const legsArray = useWatch({ control, name: "legs", defaultValue: [] });
  const aircraftId = useWatch({ control, name: "aircraftId" });
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "legs",
  });

  const generateNewQuoteId = useCallback(() => {
    return `QT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }, []);

  useEffect(() => {
    setIsClient(true);
    if (!getValues('quoteId')) {
      setValue('quoteId', generateNewQuoteId());
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinLegDepartureDate(today);

    const loadInitialData = async () => {
      setIsLoadingAircraftList(true);
      setIsLoadingDynamicRates(true);
      try {
        const [fleet, rates, profile] = await Promise.all([
          fetchFleetAircraft(),
          fetchAircraftRates(),
          fetchCompanyProfile()
        ]);
        
        const options = fleet.map(ac => ({ 
          value: ac.id, 
          label: `${ac.tailNumber} - ${ac.model}`,
          model: ac.model
        }));
        setAircraftSelectOptions(options);
        setFetchedAircraftRates(rates);
        setFetchedCompanyProfile(profile);

      } catch (error) {
        console.error("Failed to load initial data for quote form:", error);
        toast({ title: "Error Loading Configuration", description: "Could not load aircraft or pricing data. Using defaults.", variant: "destructive" });
      } finally {
        setIsLoadingAircraftList(false);
        setIsLoadingDynamicRates(false);
      }
    };
    loadInitialData();
  }, [setValue, getValues, toast, generateNewQuoteId]);

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
    if (isLoadingDynamicRates || !aircraftId) {
        setCalculatedLineItems([]);
        return;
    }

    let totalFlightTimeBuyCost = 0;
    let totalFlightTimeSellCost = 0;
    let totalBlockHours = 0;
    let totalRevenueFlightHours = 0;
    
    const selectedAircraftRateProfile = fetchedAircraftRates.find(r => r.id === aircraftId);
    const aircraftBuyRate = selectedAircraftRateProfile?.buy ?? DEFAULT_AIRCRAFT_RATE_FALLBACK.buy;
    const aircraftSellRate = selectedAircraftRateProfile?.sell ?? DEFAULT_AIRCRAFT_RATE_FALLBACK.sell;

    legsArray.forEach(leg => {
        const flightTime = Number(leg.flightTimeHours || 0);
        const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
        const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
        const legBlockMinutes = originTaxi + (flightTime * 60) + destTaxi;
        totalBlockHours += parseFloat((legBlockMinutes / 60).toFixed(2));

        if (flightTime > 0 && ["Charter", "Owner", "Ambulance", "Cargo"].includes(leg.legType)) {
            totalFlightTimeBuyCost += flightTime * aircraftBuyRate;
            totalFlightTimeSellCost += flightTime * aircraftSellRate;
            totalRevenueFlightHours += flightTime;
        } else if (flightTime > 0 && ["Positioning", "Ferry", "Maintenance"].includes(leg.legType)) {
            totalFlightTimeBuyCost += flightTime * aircraftBuyRate;
            totalFlightTimeSellCost += flightTime * aircraftBuyRate; 
        }
    });

    const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === aircraftId);
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

    if (fuelSurchargeRequested && totalBlockHours > 0) {
      const config = companyServiceRates[SERVICE_KEY_FUEL_SURCHARGE] || DEFAULT_SERVICE_RATES[SERVICE_KEY_FUEL_SURCHARGE];
      const buyRate = config.buy;
      const sellRate = sellPriceFuelSurchargePerHour ?? config.sell;
      newItems.push({
        id: 'fuelSurcharge', description: config.displayDescription, buyRate, sellRate, unitDescription: config.unitDescription,
        quantity: parseFloat(totalBlockHours.toFixed(2)),
        buyTotal: buyRate * totalBlockHours, sellTotal: sellRate * totalBlockHours,
      });
    }

    if (medicsRequested) {
      const config = companyServiceRates[SERVICE_KEY_MEDICS] || DEFAULT_SERVICE_RATES[SERVICE_KEY_MEDICS];
      const buyRate = config.buy;
      const sellRate = sellPriceMedics ?? config.sell;
      newItems.push({
        id: 'medicsFee', description: config.displayDescription, buyRate, sellRate, unitDescription: config.unitDescription,
        quantity: 1, buyTotal: buyRate, sellTotal: sellRate,
      });
    }

    if (cateringRequested) {
      const config = companyServiceRates[SERVICE_KEY_CATERING] || DEFAULT_SERVICE_RATES[SERVICE_KEY_CATERING];
      const buyRate = config.buy;
      const sellRate = sellPriceCatering ?? config.sell;
      newItems.push({
        id: 'cateringFee', description: config.displayDescription, buyRate, sellRate, unitDescription: config.unitDescription,
        quantity: 1, buyTotal: buyRate, sellTotal: sellRate,
      });
    }

    const validLegsCount = legsArray.filter(leg => leg.origin && leg.destination && leg.origin.length >=3 && leg.destination.length >=3).length;
    if (includeLandingFees && validLegsCount > 0) {
      const config = companyServiceRates[SERVICE_KEY_LANDING_FEES] || DEFAULT_SERVICE_RATES[SERVICE_KEY_LANDING_FEES];
      const buyRate = config.buy;
      const sellRate = sellPriceLandingFeePerLeg ?? config.sell;
      newItems.push({
        id: 'landingFees', description: config.displayDescription, buyRate, sellRate, unitDescription: config.unitDescription,
        quantity: validLegsCount,
        buyTotal: buyRate * validLegsCount, sellTotal: sellRate * validLegsCount,
      });
    }

    const numericEstimatedOvernights = Number(currentEstimatedOvernights || 0);
    if (numericEstimatedOvernights > 0) {
      const config = companyServiceRates[SERVICE_KEY_OVERNIGHT_FEES] || DEFAULT_SERVICE_RATES[SERVICE_KEY_OVERNIGHT_FEES];
      const buyRate = config.buy;
      const sellRate = sellPriceOvernight ?? config.sell;
      newItems.push({
        id: 'overnightFees', description: config.displayDescription, buyRate, sellRate, unitDescription: config.unitDescription,
        quantity: numericEstimatedOvernights,
        buyTotal: buyRate * numericEstimatedOvernights, sellTotal: sellRate * numericEstimatedOvernights,
      });
    }
    
    setCalculatedLineItems(newItems);

  }, [
    legsArray, aircraftId, aircraftSelectOptions,
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
    const currentAircraftId = getValues('aircraftId');
    const selectedAircraft = aircraftSelectOptions.find(ac => ac.value === currentAircraftId);

    if (!legData?.origin || legData.origin.length < 3 || !legData?.destination || legData.destination.length < 3 || !currentAircraftId || !selectedAircraft) {
      toast({ title: "Missing Information", description: "Please provide origin, destination (min 3 chars each), and select an aircraft type before estimating.", variant: "destructive"});
      return;
    }
    
    const aircraftModelForFlow = selectedAircraft.model;
    const currentEstimate = legEstimates[legIndex];

    if (currentEstimate && !currentEstimate.error &&
        currentEstimate.estimatedForInputs?.origin === legData.origin.toUpperCase() &&
        currentEstimate.estimatedForInputs?.destination === legData.destination.toUpperCase() &&
        currentEstimate.estimatedForInputs?.aircraftModel === aircraftModelForFlow) {
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
            aircraftModel: aircraftModelForFlow
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
            aircraftModel: aircraftModelForFlow
          }
        } as LegEstimate; 
        return newEstimates;
      });
    } finally {
      setEstimatingLegIndex(null);
    }
  }, [getValues, legEstimates, toast, estimatingLegIndex, setValue, setLegEstimates, setEstimatingLegIndex, aircraftSelectOptions]);

  const handleSave = async (status: typeof QuoteStatusType[number]) => {
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
        status: status,
      };
      
      try {
        const savedQuote = await saveQuote(quoteToSave);
        toast({
          title: `Quote ${status === 'Draft' ? 'Saved as Draft' : 'Saved & Sent'}`,
          description: `Quote ${savedQuote.quoteId} (${status}) has been saved to Firestore.`,
          variant: "default",
        });
        
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

  const handlePreviewQuote = async () => {
    const isValidForm = await trigger();
    if (!isValidForm) {
      toast({ title: "Validation Error", description: "Please check the form for errors before previewing.", variant: "destructive" });
      return;
    }
    const data = getValues();
    const selectedAircraftInfo = aircraftSelectOptions.find(ac => ac.value === data.aircraftId);
    const totalBuyCost = calculatedLineItems.reduce((sum, item) => sum + item.buyTotal, 0);
    const totalSellPrice = calculatedLineItems.reduce((sum, item) => sum + item.sellTotal, 0);
    const marginAmount = totalSellPrice - totalBuyCost;
    const marginPercentage = totalBuyCost > 0 ? (marginAmount / totalBuyCost) * 100 : 0;

    const previewData = {
      ...data,
      aircraftLabel: selectedAircraftInfo?.label,
      legs: data.legs.map((leg, index) => {
        const estimate = legEstimates[index];
        const originTaxi = Number(leg.originTaxiTimeMinutes || 0);
        const destTaxi = Number(leg.destinationTaxiTimeMinutes || 0);
        const flightTime = Number(leg.flightTimeHours || 0);
        const blockTimeTotalMinutes = originTaxi + (flightTime * 60) + destTaxi;
        const blockTimeHours = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));
        return {
          ...leg,
          departureDateTime: leg.departureDateTime ? leg.departureDateTime.toISOString() : undefined,
          calculatedBlockTimeHours: blockTimeHours,
          estimationDetails: estimate && !estimate.error ? estimate : undefined,
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
      },
      lineItems: calculatedLineItems,
      totalBuyCost,
      totalSellPrice,
      marginAmount,
      marginPercentage,
      status: "Draft", 
    };
    console.log("Preview Quote Clicked. Current form data:", previewData);
    toast({
      title: "Quote Preview (Logged to Console)",
      description: (
        <pre className="mt-2 w-full max-w-[480px] rounded-md bg-slate-950 p-4 overflow-x-auto">
          <code className="text-white whitespace-pre-wrap">{JSON.stringify(previewData, null, 2)}</code>
        </pre>
      ),
    });
  };

  const handleAddLeg = () => {
    let newLegOrigin = '';
    let newLegDepartureDateTime: Date | undefined = undefined;
    let previousLegPax = 1;
    let previousLegOriginTaxi = 15;
    let previousLegDestTaxi = 15;
    let previousLegOriginFbo = '';
    let previousLegDestinationFbo = '';

    if (fields.length > 0) {
      const previousLegIndex = fields.length - 1;
      const previousLeg = getValues(`legs.${previousLegIndex}`);
      
      newLegOrigin = previousLeg.destination; 
      previousLegPax = Number(previousLeg.passengerCount || 1); 
      previousLegOriginTaxi = Number(previousLeg.originTaxiTimeMinutes || 15);
      previousLegDestTaxi = Number(previousLeg.destinationTaxiTimeMinutes || 15);
      previousLegOriginFbo = previousLeg.destinationFbo || ''; 
      previousLegDestinationFbo = '';

      const previousLegFlightTime = Number(previousLeg.flightTimeHours || (legEstimates[previousLegIndex]?.estimatedFlightTimeHours || 0));

      if (previousLeg.departureDateTime && previousLeg.departureDateTime instanceof Date && isValidDate(previousLeg.departureDateTime) && previousLegFlightTime > 0) {
        const previousLegDeparture = new Date(previousLeg.departureDateTime);
        const previousLegFlightMillis = previousLegFlightTime * 60 * 60 * 1000;
        const previousLegDestTaxiMillis = (Number(previousLeg.destinationTaxiTimeMinutes || 0)) * 60 * 1000;
        const estimatedArrivalMillis = previousLegDeparture.getTime() + previousLegFlightMillis + previousLegDestTaxiMillis;
        newLegDepartureDateTime = new Date(estimatedArrivalMillis + (60 * 60 * 1000)); 
      } else if (previousLeg.departureDateTime && previousLeg.departureDateTime instanceof Date && isValidDate(previousLeg.departureDateTime)) {
         newLegDepartureDateTime = new Date(previousLeg.departureDateTime.getTime() + (3 * 60 * 60 * 1000)); 
      }
    }

    append({
      origin: newLegOrigin.toUpperCase(),
      destination: '',
      departureDateTime: newLegDepartureDateTime,
      legType: 'Charter',
      passengerCount: previousLegPax,
      originFbo: previousLegOriginFbo, 
      destinationFbo: previousLegDestinationFbo,
      originTaxiTimeMinutes: previousLegOriginTaxi,
      destinationTaxiTimeMinutes: previousLegDestTaxi,
      flightTimeHours: undefined,
    });
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
    const selectedCustomer = sampleCustomerData.find(c => c.id === customerId);
    if (selectedCustomer) {
      setValue('clientName', selectedCustomer.name);
      setValue('clientEmail', selectedCustomer.email);
      setValue('clientPhone', selectedCustomer.phone || '');
    }
  };
  
  const getServiceLabel = (serviceKey: string, defaultLabel: string, unitDescription?: string) => {
    const serviceConfig = fetchedCompanyProfile?.serviceFeeRates?.[serviceKey] || DEFAULT_SERVICE_RATES[serviceKey];
    let label = serviceConfig?.displayDescription || defaultLabel;
    if (serviceConfig?.sell) {
      label += ` ($${serviceConfig.sell.toLocaleString()}`;
      if (unitDescription || serviceConfig.unitDescription) {
        label += `/${unitDescription || serviceConfig.unitDescription}`;
      }
      label += ")";
    }
    return label;
  };

  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>New Quote Details</CardTitle>
        <CardDescription>Fill in the client and trip information to generate a quote.</CardDescription>
      </CardHeader>
      <Form {...form}>
        {/* No form tag here, buttons will trigger submission via type="button" and handler */}
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
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => ( <FormItem className="flex flex-col"> <FormLabel>Desired Departure Date & Time</FormLabel> {isClient ? ( <Popover> <PopoverTrigger asChild> 
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !(field.value && field.value instanceof Date && isValidDate(field.value)) && "text-muted-foreground")}> 
                          <span>{field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "PPP HH:mm") : "Pick a date and time"}</span> 
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> 
                        </Button> 
                        </PopoverTrigger> 
                        <PopoverContent className="w-auto p-0" align="start"> 
                          <Calendar mode="single" selected={field.value && field.value instanceof Date && isValidDate(field.value) ? field.value : undefined} onSelect={field.onChange} disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : true} initialFocus /> 
                          <div className="p-2 border-t border-border"> 
                            <Input type="time" defaultValue={field.value && field.value instanceof Date && isValidDate(field.value) ? format(field.value, "HH:mm") : ""} onChange={(e) => { const time = e.target.value; const [hours, minutes] = time.split(':').map(Number); let newDate = field.value && field.value instanceof Date && isValidDate(field.value) ? new Date(field.value) : new Date(); if (!isValidDate(newDate)) newDate = new Date(); newDate.setHours(hours, minutes,0,0); field.onChange(newDate); }} /> 
                          </div> 
                        </PopoverContent> 
                      </Popover> ) : ( <Skeleton className="h-10 w-full" /> )} <FormMessage /> </FormItem> )} />
                    
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

                    <Button type="button" variant="outline" size="sm" onClick={() => handleEstimateFlightDetails(index)} disabled={estimatingLegIndex === index || !aircraftId || isLoadingDynamicRates} className="w-full sm:w-auto"> {estimatingLegIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Estimate Flight Details </Button>
                    {(!aircraftId && !isLoadingDynamicRates) && <FormDescription className="text-xs text-destructive">Select an aircraft to enable estimation.</FormDescription>}
                    {(isLoadingDynamicRates || isLoadingAircraftList) && <FormDescription className="text-xs">Loading aircraft & rate data...</FormDescription>}

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
                          placeholder={`Default: $${(fetchedCompanyProfile?.serviceFeeRates?.[SERVICE_KEY_FUEL_SURCHARGE]?.sell || DEFAULT_SERVICE_RATES[SERVICE_KEY_FUEL_SURCHARGE]?.sell || 0).toLocaleString()}`} 
                          {...field} 
                          value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                          onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}
                        />
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="medicsRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_MEDICS, "Medics Requested")}</FormLabel></div> </FormItem> )} />
                    {medicsRequested && <FormField control={control} name="sellPriceMedics" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Medics Fee Sell Price</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={`Default: $${(fetchedCompanyProfile?.serviceFeeRates?.[SERVICE_KEY_MEDICS]?.sell || DEFAULT_SERVICE_RATES[SERVICE_KEY_MEDICS]?.sell || 0).toLocaleString()}`}  {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }} />
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}
                    
                    <FormField control={control} name="cateringRequested" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_CATERING, "Catering Requested")}</FormLabel></div> </FormItem> )} />
                    {cateringRequested && ( <FormField control={control} name="cateringNotes" render={({ field }) => ( <FormItem className="pl-8"> <FormLabel>Catering Notes</FormLabel> <FormControl><Textarea placeholder="Specify catering details..." {...field} value={field.value || ''} rows={3} /></FormControl> <FormMessage /> </FormItem> )} /> )}
                    {cateringRequested && <FormField control={control} name="sellPriceCatering" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Catering Fee Sell Price</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={`Default: $${(fetchedCompanyProfile?.serviceFeeRates?.[SERVICE_KEY_CATERING]?.sell || DEFAULT_SERVICE_RATES[SERVICE_KEY_CATERING]?.sell || 0).toLocaleString()}`} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="includeLandingFees" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl> <div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> {getServiceLabel(SERVICE_KEY_LANDING_FEES, "Include Landing Fees", "Leg")}</FormLabel></div> </FormItem> )} />
                    {includeLandingFees && <FormField control={control} name="sellPriceLandingFeePerLeg" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Landing Fee Sell Price (per Leg)</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={`Default: $${(fetchedCompanyProfile?.serviceFeeRates?.[SERVICE_KEY_LANDING_FEES]?.sell || DEFAULT_SERVICE_RATES[SERVICE_KEY_LANDING_FEES]?.sell || 0).toLocaleString()}`} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
                      </FormControl> 
                    <FormMessage /> </FormItem> )} />}

                    <FormField control={control} name="estimatedOvernights" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> {getServiceLabel(SERVICE_KEY_OVERNIGHT_FEES, "Estimated Overnights", "Night")}</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder="e.g., 0" {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseInt(e.target.value, 10); field.onChange(isNaN(val) ? undefined : val); }} min="0"/>
                      </FormControl> 
                    <FormDescription>Number of overnight stays for crew/aircraft.</FormDescription> <FormMessage /> </FormItem> )} />
                    {Number(currentEstimatedOvernights || 0) > 0 && <FormField control={control} name="sellPriceOvernight" render={({ field }) => (<FormItem className="pl-8"> <FormLabel>Overnight Fee Sell Price (per Night)</FormLabel> 
                      <FormControl>
                        <Input type="number" placeholder={`Default: $${(fetchedCompanyProfile?.serviceFeeRates?.[SERVICE_KEY_OVERNIGHT_FEES]?.sell || DEFAULT_SERVICE_RATES[SERVICE_KEY_OVERNIGHT_FEES]?.sell || 0).toLocaleString()}`} {...field} value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)} onChange={e => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val); }}/>
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
            <Button type="button" variant="secondary" onClick={() => handleSave("Draft")} disabled={isSaving}> 
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SaveIcon className="mr-2 h-4 w-4" />}
              Save as Draft 
            </Button>
            <Button type="button" onClick={() => handleSave("Sent")} disabled={isSaving}> 
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Save & Send Quote
            </Button>
          </CardFooter>
        {/* </form> */} {/* Form tag removed as buttons handle submission type */}
      </Form>
    </Card>
  );
}

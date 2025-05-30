
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlaneTakeoff as PerformanceIcon, Save, Copy, Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestAircraftPerformance, type SuggestAircraftPerformanceInput, type AircraftPerformanceOutput } from '@/ai/flows/suggest-aircraft-performance-flow';
import { fetchAircraftRates, type AircraftRate } from '@/ai/flows/manage-aircraft-rates-flow'; // Import fetchAircraftRates

const aircraftPerformanceSchema = z.object({
  takeoffSpeed: z.coerce.number().min(0).optional(),
  landingSpeed: z.coerce.number().min(0).optional(),
  climbSpeed: z.coerce.number().min(0).optional(),
  climbRate: z.coerce.number().min(0).optional(),
  cruiseSpeed: z.coerce.number().min(0).optional(),
  cruiseAltitude: z.coerce.number().min(0).optional(),
  descentSpeed: z.coerce.number().min(0).optional(),
  descentRate: z.coerce.number().min(0).optional(),
  fuelType: z.string().optional(),
  fuelBurn: z.coerce.number().min(0).optional(),
  maxRange: z.coerce.number().min(0).optional(),
  maxAllowableTakeoffWeight: z.coerce.number().min(0).optional(),
});

type AircraftPerformanceFormData = z.infer<typeof aircraftPerformanceSchema>;

interface AircraftOption {
  id: string; // This is the aircraft ID/Name key from aircraftRates
  name: string; // This is the display label
}

const fuelTypes = ["Jet Fuel", "Avgas", "Other"];

// Placeholder for initial data for each aircraft
// This will be managed more dynamically or fetched if integrated with a backend
const initialPerformanceData: Record<string, Partial<AircraftPerformanceFormData>> = {
  'N123AB - Cessna Citation CJ3': { takeoffSpeed: 100, cruiseSpeed: 415, cruiseAltitude: 45000, fuelBurn: 150, maxRange: 1800, maxAllowableTakeoffWeight: 13870, fuelType: "Jet Fuel" },
  'N456CD - Bombardier Global 6000': { takeoffSpeed: 130, cruiseSpeed: 488, cruiseAltitude: 51000, fuelBurn: 450, maxRange: 6000, maxAllowableTakeoffWeight: 99500, fuelType: "Jet Fuel" },
  'N630MW - Piper Cheyenne PA-31T2': { takeoffSpeed: 101, landingSpeed: 104, climbSpeed: 165, climbRate: 1750, cruiseSpeed: 255, cruiseAltitude: 25000, descentSpeed: 255, descentRate: 1500, fuelType: "Jet Fuel", fuelBurn: 81.0, maxRange: 1145, maxAllowableTakeoffWeight: 9474 },
  'N789EF - Gulfstream G650ER': { takeoffSpeed: 140, cruiseSpeed: 516, cruiseAltitude: 51000, fuelBurn: 500, maxRange: 7500, maxAllowableTakeoffWeight: 103600, fuelType: "Jet Fuel" },
};


export function AircraftPerformanceForm() {
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(undefined);
  const [performanceDataStore, setPerformanceDataStore] = useState(initialPerformanceData);
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();
  const [isSuggestingWithAi, startAiSuggestionTransition] = useTransition();

  const [aircraftSelectOptions, setAircraftSelectOptions] = useState<AircraftOption[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);

  const form = useForm<AircraftPerformanceFormData>({
    resolver: zodResolver(aircraftPerformanceSchema),
    defaultValues: {}, // Default values will be set by useEffect based on selection
  });

  useEffect(() => {
    const loadAircraft = async () => {
      setIsLoadingAircraft(true);
      try {
        const rates = await fetchAircraftRates();
        const options = rates.map(rate => ({ id: rate.id, name: rate.id })); // Assuming rate.id is the name/key
        setAircraftSelectOptions(options);
        if (options.length > 0 && !selectedAircraftId) {
          setSelectedAircraftId(options[0].id); // Select the first aircraft by default
        }
      } catch (error) {
        console.error("Failed to fetch aircraft options:", error);
        toast({ title: "Error", description: "Could not load aircraft list.", variant: "destructive" });
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraft();
  }, [toast, selectedAircraftId]); // Added selectedAircraftId to re-evaluate if it changes elsewhere

  useEffect(() => {
    if (selectedAircraftId) {
      form.reset(performanceDataStore[selectedAircraftId] || {});
    } else {
      form.reset({}); 
    }
  }, [selectedAircraftId, performanceDataStore, form]);

  const onSubmit: SubmitHandler<AircraftPerformanceFormData> = (data) => {
    startSaveTransition(() => {
      if (!selectedAircraftId) {
        toast({ title: "Error", description: "Please select an aircraft.", variant: "destructive" });
        return;
      }
      setPerformanceDataStore(prev => ({
        ...prev,
        [selectedAircraftId]: data,
      }));
      toast({ title: "Success", description: `Performance settings for ${selectedAircraftId} saved (client-side).` });
      console.log("Saved data for", selectedAircraftId, data);
    });
  };

  const handleSetupWithAi = async () => {
    if (!selectedAircraftId) {
      toast({ title: "No Aircraft Selected", description: "Please select an aircraft first.", variant: "destructive" });
      return;
    }
    const selectedAircraftObject = aircraftSelectOptions.find(ac => ac.id === selectedAircraftId);
    if (!selectedAircraftObject) {
      toast({ title: "Error", description: "Could not find selected aircraft details.", variant: "destructive" });
      return;
    }

    startAiSuggestionTransition(async () => {
      try {
        const aiInput: SuggestAircraftPerformanceInput = { aircraftName: selectedAircraftObject.name }; // Use the name property
        const suggestedData: AircraftPerformanceOutput = await suggestAircraftPerformance(aiInput);
        
        const validatedData: Partial<AircraftPerformanceFormData> = {};
        for (const key in suggestedData) {
            const typedKey = key as keyof AircraftPerformanceOutput;
            if (suggestedData[typedKey] !== null && suggestedData[typedKey] !== undefined) {
                // Ensure the key exists in the schema before attempting to check its type or assign
                if (aircraftPerformanceSchema.shape[typedKey as keyof typeof aircraftPerformanceSchema.shape]) {
                    if (typeof aircraftPerformanceSchema.shape[typedKey as keyof typeof aircraftPerformanceSchema.shape]._def.typeName === 'ZodNumber') {
                        (validatedData as any)[typedKey] = Number(suggestedData[typedKey]);
                    } else {
                        (validatedData as any)[typedKey] = suggestedData[typedKey];
                    }
                }
            }
        }
        form.reset(validatedData); 
        toast({ title: "AI Suggestions Applied", description: "Review and save the suggested performance parameters.", variant: "default", action: <Wand2 className="text-green-500"/> });
      } catch (e) {
        console.error("Error suggesting aircraft performance:", e);
        const errorMessage = e instanceof Error ? e.message : "AI failed to suggest performance data.";
        toast({ title: "AI Suggestion Error", description: errorMessage, variant: "destructive", action: <AlertTriangle className="text-white"/> });
      }
    });
  };


  const renderInputWithUnit = (name: keyof AircraftPerformanceFormData, label: string, unit: string, placeholder?: string, type: string = "number") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input 
                type={type} 
                placeholder={placeholder || "0"} 
                {...field} 
                value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : field.value}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  field.onChange(isNaN(val) ? undefined : val);
                }}
              />
            </FormControl>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{unit}</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Select Aircraft</CardTitle>
                <CardDescription>Choose an aircraft to view or edit its performance settings.</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={handleSetupWithAi} disabled={!selectedAircraftId || isSuggestingWithAi || isSaving || isLoadingAircraft}>
                {isSuggestingWithAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Setup with AI
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              onValueChange={setSelectedAircraftId} 
              value={selectedAircraftId || ""} 
              disabled={isLoadingAircraft}
            >
              <SelectTrigger className="w-full sm:w-[350px]">
                <SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select an aircraft"} />
              </SelectTrigger>
              <SelectContent>
                 {!isLoadingAircraft && aircraftSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT_CONFIGURED_PLACEHOLDER" disabled>No aircraft configured</SelectItem>}
                {aircraftSelectOptions.map(aircraft => (
                  <SelectItem key={aircraft.id} value={aircraft.id}>
                    {aircraft.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox id="copy-type" disabled /> {/* Placeholder */}
              <label
                htmlFor="copy-type"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Copy to all aircraft of this type (placeholder)
              </label>
            </div>
          </CardContent>
        </Card>

        {selectedAircraftId && (
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PerformanceIcon className="h-6 w-6 text-primary" />
                <CardTitle>Performance Settings for {aircraftSelectOptions.find(ac => ac.id === selectedAircraftId)?.name || selectedAircraftId}</CardTitle>
              </div>
              <CardDescription>Adjust the performance parameters below. AI suggestions can provide a starting point.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
                {renderInputWithUnit("takeoffSpeed", "Takeoff Speed", "kts")}
                {renderInputWithUnit("landingSpeed", "Landing Speed", "kts")}
                {renderInputWithUnit("climbSpeed", "Climb Speed", "kts")}
                {renderInputWithUnit("climbRate", "Climb Rate", "ft/min")}
                {renderInputWithUnit("cruiseSpeed", "Cruise Speed", "kts")}
                {renderInputWithUnit("cruiseAltitude", "Cruise Altitude", "ft")}
                {renderInputWithUnit("descentSpeed", "Descent Speed", "kts")}
                {renderInputWithUnit("descentRate", "Descent Rate", "ft/min")}
                
                <FormField
                  control={form.control}
                  name="fuelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fuel type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fuelTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {renderInputWithUnit("fuelBurn", "Fuel Burn", "gls/hr")}
                {renderInputWithUnit("maxRange", "Maximum Range", "nm")}
                {renderInputWithUnit("maxAllowableTakeoffWeight", "Max Allowable T/O Weight", "lb")}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSaving || isSuggestingWithAi || isLoadingAircraft}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Performance Settings
              </Button>
            </CardFooter>
          </Card>
        )}
        {!selectedAircraftId && !isLoadingAircraft && (
            <div className="text-center py-10 text-muted-foreground">
                Please select an aircraft to view or edit its performance settings.
            </div>
        )}
        {isLoadingAircraft && (
            <div className="text-center py-10 text-muted-foreground flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading aircraft data...
            </div>
        )}
      </form>
    </Form>
  );
}


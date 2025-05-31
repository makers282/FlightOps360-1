
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
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
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { 
  fetchAircraftPerformance, 
  saveAircraftPerformance,
  type AircraftPerformanceData
} from '@/ai/flows/manage-aircraft-performance-flow';
import type { SaveAircraftPerformanceInput } from '@/ai/schemas/aircraft-performance-schemas';


// Schema for form validation, aligned with AircraftPerformanceData
const aircraftPerformanceFormValidationSchema = z.object({
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

// Type for form data matches AircraftPerformanceData
type AircraftPerformanceFormData = AircraftPerformanceData;

interface FleetAircraftSelectOption {
  id: string;    // aircraft.id from fleet
  label: string; // tailNumber - model
  model: string; // aircraft.model for AI
}

const fuelTypes = ["Jet Fuel", "Avgas", "Other"];

export function AircraftPerformanceForm() {
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();
  const [isSuggestingWithAi, startAiSuggestionTransition] = useTransition();
  const [isFetchingPerformance, startFetchingPerformanceTransition] = useTransition();

  const [fleetSelectOptions, setFleetSelectOptions] = useState<FleetAircraftSelectOption[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);

  const form = useForm<AircraftPerformanceFormData>({
    resolver: zodResolver(aircraftPerformanceFormValidationSchema),
    defaultValues: {}, 
  });

  useEffect(() => {
    const loadFleet = async () => {
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        const options = fleet.map(ac => ({ 
          id: ac.id, 
          label: `${ac.tailNumber} - ${ac.model}`,
          model: ac.model 
        }));
        setFleetSelectOptions(options);
        if (options.length > 0 && !selectedAircraftId) {
          // Don't auto-select here, let user choose or load from URL param in future
        }
      } catch (error) {
        console.error("Failed to fetch aircraft options:", error);
        toast({ title: "Error", description: "Could not load aircraft list.", variant: "destructive" });
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadFleet();
  }, [toast]); 

  const loadPerformanceDataForAircraft = useCallback(async (aircraftId: string) => {
    startFetchingPerformanceTransition(async () => {
      form.reset({}); // Clear form while loading
      try {
        const data = await fetchAircraftPerformance({ aircraftId });
        if (data) {
          form.reset(data);
          toast({ title: "Performance Data Loaded", description: `Showing data for ${fleetSelectOptions.find(ac => ac.id === aircraftId)?.label}.`, variant: "default" });
        } else {
          form.reset({}); // Clear form if no data found, ready for AI or manual input
          toast({ title: "No Saved Data", description: `No performance data found for this aircraft. You can enter new data or use AI suggestion.`, variant: "default" });
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
        toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        form.reset({});
      }
    });
  }, [form, toast, fleetSelectOptions, startFetchingPerformanceTransition]);

  useEffect(() => {
    if (selectedAircraftId) {
      loadPerformanceDataForAircraft(selectedAircraftId);
    } else {
      form.reset({}); // Clear form if no aircraft selected
    }
  }, [selectedAircraftId, loadPerformanceDataForAircraft, form]);


  const onSubmit: SubmitHandler<AircraftPerformanceFormData> = (formData) => {
    if (!selectedAircraftId) {
      toast({ title: "Error", description: "Please select an aircraft to save settings for.", variant: "destructive" });
      return;
    }
    startSaveTransition(async () => {
      try {
        const inputToSave: SaveAircraftPerformanceInput = {
          aircraftId: selectedAircraftId,
          performanceData: formData, // formData already matches AircraftPerformanceData
        };
        await saveAircraftPerformance(inputToSave);
        const selectedAircraftLabel = fleetSelectOptions.find(ac => ac.id === selectedAircraftId)?.label || selectedAircraftId;
        toast({ title: "Success", description: `Performance settings for ${selectedAircraftLabel} saved to Firestore.` });
      } catch (error) {
        console.error("Failed to save performance data:", error);
        toast({ title: "Error Saving Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  };

  const handleSetupWithAi = async () => {
    if (!selectedAircraftId) {
      toast({ title: "No Aircraft Selected", description: "Please select an aircraft first.", variant: "destructive" });
      return;
    }
    const selectedAircraftObject = fleetSelectOptions.find(ac => ac.id === selectedAircraftId);
    if (!selectedAircraftObject) {
      toast({ title: "Error", description: "Could not find selected aircraft details.", variant: "destructive" });
      return;
    }

    startAiSuggestionTransition(async () => {
      try {
        const aiInput: SuggestAircraftPerformanceInput = { aircraftName: selectedAircraftObject.model };
        const suggestedData: AircraftPerformanceOutput = await suggestAircraftPerformance(aiInput);
        
        // Prepare data for form reset, ensuring numbers are numbers
        const validatedData: Partial<AircraftPerformanceFormData> = {};
        for (const key in suggestedData) {
            const typedKey = key as keyof AircraftPerformanceOutput;
            if (suggestedData[typedKey] !== null && suggestedData[typedKey] !== undefined) {
                if (aircraftPerformanceFormValidationSchema.shape[typedKey as keyof typeof aircraftPerformanceFormValidationSchema.shape]) {
                    const fieldSchema = aircraftPerformanceFormValidationSchema.shape[typedKey as keyof typeof aircraftPerformanceFormValidationSchema.shape];
                    if (fieldSchema instanceof z.ZodNumber || (fieldSchema instanceof z.ZodOptional && fieldSchema._def.innerType instanceof z.ZodNumber)) {
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
                value={(typeof field.value === 'number' && isNaN(field.value)) || field.value === undefined ? '' : String(field.value)}
                onChange={e => {
                  const valStr = e.target.value;
                  if (valStr === '') field.onChange(undefined);
                  else { const num = parseFloat(valStr); field.onChange(isNaN(num) ? undefined : num); }
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
              <Button type="button" variant="outline" onClick={handleSetupWithAi} disabled={!selectedAircraftId || isSuggestingWithAi || isSaving || isLoadingAircraft || isFetchingPerformance}>
                {isSuggestingWithAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Setup with AI
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              onValueChange={setSelectedAircraftId} 
              value={selectedAircraftId || ""} 
              disabled={isLoadingAircraft || isFetchingPerformance}
            >
              <SelectTrigger className="w-full sm:w-[350px]">
                <SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select an aircraft"} />
              </SelectTrigger>
              <SelectContent>
                 {!isLoadingAircraft && fleetSelectOptions.length === 0 && <SelectItem value="NO_AIRCRAFT_CONFIGURED_PLACEHOLDER" disabled>No aircraft configured in fleet</SelectItem>}
                {fleetSelectOptions.map(aircraft => (
                  <SelectItem key={aircraft.id} value={aircraft.id}>
                    {aircraft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox id="copy-type" disabled />
              <label
                htmlFor="copy-type"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Copy to all aircraft of this type (placeholder)
              </label>
            </div>
          </CardContent>
        </Card>

        {isFetchingPerformance && selectedAircraftId && (
             <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        Loading Performance Data...
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
             </Card>
        )}

        {selectedAircraftId && !isFetchingPerformance && (
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PerformanceIcon className="h-6 w-6 text-primary" />
                <CardTitle>Performance Settings for {fleetSelectOptions.find(ac => ac.id === selectedAircraftId)?.label || selectedAircraftId}</CardTitle>
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
              <Button type="submit" disabled={isSaving || isSuggestingWithAi || isLoadingAircraft || isFetchingPerformance}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Performance Settings
              </Button>
            </CardFooter>
          </Card>
        )}
        {!selectedAircraftId && !isLoadingAircraft && !isFetchingPerformance && (
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


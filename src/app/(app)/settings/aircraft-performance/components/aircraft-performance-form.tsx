
"use client";

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlaneTakeoff as PerformanceIcon, Save, Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestAircraftPerformance, type SuggestAircraftPerformanceInput, type AircraftPerformanceOutput } from '@/ai/flows/suggest-aircraft-performance-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import {
  fetchAircraftPerformance,
  saveAircraftPerformance,
} from '@/ai/flows/manage-aircraft-performance-flow';
import type { AircraftPerformanceData, SaveAircraftPerformanceInput } from '@/ai/schemas/aircraft-performance-schemas';
import { AircraftPerformanceDataSchema } from '@/ai/schemas/aircraft-performance-schemas';
import { Skeleton } from '@/components/ui/skeleton';

type AircraftPerformanceFormData = AircraftPerformanceData;

interface FleetAircraftSelectOption {
  id: string;
  label: string;
  model: string;
}

const fuelTypes = ["Jet Fuel", "Avgas", "Other", "Unknown"];

export function AircraftPerformanceForm() {
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();
  const [isSuggestingWithAi, startAiSuggestionTransition] = useTransition();
  const [isFetchingPerformance, startFetchingPerformanceTransition] = useTransition();

  const [fleetSelectOptions, setFleetSelectOptions] = useState<FleetAircraftSelectOption[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);

  const form = useForm<AircraftPerformanceFormData>({
    resolver: zodResolver(AircraftPerformanceDataSchema),
    defaultValues: {
        takeoffSpeed: undefined, landingSpeed: undefined, climbSpeed: undefined, climbRate: undefined,
        cruiseSpeed: undefined, cruiseAltitude: undefined, descentSpeed: undefined, descentRate: undefined,
        fuelType: undefined, fuelBurn: undefined, maxRange: undefined, maxAllowableTakeoffWeight: undefined,
    },
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
      form.reset({
        takeoffSpeed: undefined, landingSpeed: undefined, climbSpeed: undefined, climbRate: undefined,
        cruiseSpeed: undefined, cruiseAltitude: undefined, descentSpeed: undefined, descentRate: undefined,
        fuelType: undefined, fuelBurn: undefined, maxRange: undefined, maxAllowableTakeoffWeight: undefined,
      });
      try {
        const data = await fetchAircraftPerformance({ aircraftId });
        if (data) {
          const processedData: Partial<AircraftPerformanceFormData> = {};
          const schemaKeys = Object.keys(AircraftPerformanceDataSchema.shape) as Array<keyof AircraftPerformanceFormData>;
          
          schemaKeys.forEach(key => {
            const value = data[key as keyof typeof data];
            if (value !== null && value !== undefined && String(value).trim() !== '') {
              const fieldSchemaDef = (AircraftPerformanceDataSchema.shape[key] as any)._def;
              const isNumericField = (fieldSchemaDef.typeName === 'ZodNumber') || 
                                   (fieldSchemaDef.typeName === 'ZodOptional' && fieldSchemaDef.innerType?._def?.typeName === 'ZodNumber') || 
                                   (fieldSchemaDef.typeName === 'ZodCoerce' && fieldSchemaDef.coerceType === 'number');
              if (isNumericField) {
                 const numValue = Number(value);
                 (processedData as any)[key] = isNaN(numValue) ? undefined : numValue;
              } else {
                 (processedData as any)[key] = value;
              }
            } else {
              (processedData as any)[key] = undefined;
            }
          });
          form.reset(processedData);
          const aircraftLabel = fleetSelectOptions.find(ac => ac.id === aircraftId)?.label || `Aircraft ID ${aircraftId}`;
          toast({ title: "Performance Data Loaded", description: `Showing data for ${aircraftLabel}.`, variant: "default" });
        } else {
          toast({ title: "No Saved Data", description: `No performance data found for this aircraft. You can enter new data or use AI suggestion.`, variant: "default" });
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
        toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
      }
    });
  }, [form, toast, fleetSelectOptions, startFetchingPerformanceTransition]);

  useEffect(() => {
    if (selectedAircraftId) {
      loadPerformanceDataForAircraft(selectedAircraftId);
    } else {
      form.reset({
        takeoffSpeed: undefined, landingSpeed: undefined, climbSpeed: undefined, climbRate: undefined,
        cruiseSpeed: undefined, cruiseAltitude: undefined, descentSpeed: undefined, descentRate: undefined,
        fuelType: undefined, fuelBurn: undefined, maxRange: undefined, maxAllowableTakeoffWeight: undefined,
      });
    }
  }, [selectedAircraftId, loadPerformanceDataForAircraft, form]);

  const onSubmit: SubmitHandler<AircraftPerformanceFormData> = (formData) => {
    if (!selectedAircraftId) {
      toast({ title: "Error", description: "Please select an aircraft to save settings for.", variant: "destructive" });
      return;
    }
    startSaveTransition(async () => {
      try {
        const dataToSave: Partial<AircraftPerformanceData> = {};
        const schemaKeys = Object.keys(AircraftPerformanceDataSchema.shape) as Array<keyof AircraftPerformanceFormData>;
        
        schemaKeys.forEach(key => {
            const value = formData[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                const fieldSchemaDef = (AircraftPerformanceDataSchema.shape[key] as any)._def;
                const isNumericField = (fieldSchemaDef.typeName === 'ZodNumber') || 
                                     (fieldSchemaDef.typeName === 'ZodOptional' && fieldSchemaDef.innerType?._def?.typeName === 'ZodNumber') || 
                                     (fieldSchemaDef.typeName === 'ZodCoerce' && fieldSchemaDef.coerceType === 'number');
                if (isNumericField) {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                       (dataToSave as any)[key] = numValue;
                    }
                } else {
                   (dataToSave as any)[key] = value;
                }
            } else {
                (dataToSave as any)[key] = undefined; 
            }
        });

        const inputToSave: SaveAircraftPerformanceInput = {
          aircraftId: selectedAircraftId,
          performanceData: dataToSave as AircraftPerformanceData,
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

  const handleSetupWithAi = useCallback(async () => {
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
        const suggestedDataFromAI: AircraftPerformanceOutput = await suggestAircraftPerformance(aiInput);
        
        const processedData: Partial<AircraftPerformanceFormData> = {};
        const schemaKeys = Object.keys(AircraftPerformanceDataSchema.shape) as Array<keyof AircraftPerformanceFormData>;

        schemaKeys.forEach(key => {
            const aiValue = (suggestedDataFromAI as any)[key];
            const fieldSchemaDef = (AircraftPerformanceDataSchema.shape[key] as any)._def;
            const isNumericField = (fieldSchemaDef.typeName === 'ZodNumber') || 
                                 (fieldSchemaDef.typeName === 'ZodOptional' && fieldSchemaDef.innerType?._def?.typeName === 'ZodNumber') ||
                                 (fieldSchemaDef.typeName === 'ZodCoerce' && fieldSchemaDef.coerceType === 'number');
            const isStringField = (fieldSchemaDef.typeName === 'ZodString') || 
                                (fieldSchemaDef.typeName === 'ZodOptional' && fieldSchemaDef.innerType?._def?.typeName === 'ZodString');

            if (aiValue === null || aiValue === undefined || String(aiValue).trim() === '') {
                (processedData as any)[key] = undefined;
            } else if (isNumericField) {
                const numValue = Number(aiValue);
                if (isNaN(numValue)) {
                    (processedData as any)[key] = undefined;
                } else {
                    (processedData as any)[key] = Math.round(numValue); 
                }
            } else if (isStringField) {
                const strValue = String(aiValue).trim();
                (processedData as any)[key] = strValue === '' ? undefined : strValue;
            } else {
                 (processedData as any)[key] = aiValue;
            }
        });
        form.reset(processedData);
        toast({ title: "AI Suggestions Applied", description: "Review and save the suggested performance parameters.", variant: "default", action: <Wand2 className="text-green-500"/> });
      } catch (e) {
        console.error("Error suggesting aircraft performance:", e);
        const errorMessage = e instanceof Error ? e.message : "AI failed to suggest performance data.";
        toast({ title: "AI Suggestion Error", description: errorMessage, variant: "destructive", action: <AlertTriangle className="text-white"/> });
      }
    });
  }, [selectedAircraftId, fleetSelectOptions, startAiSuggestionTransition, form, toast]);

  const renderInputWithUnit = useCallback((name: keyof AircraftPerformanceFormData, label: string, unit: string, placeholder?: string) => {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  type="number"
                  placeholder={placeholder || "e.g., 120"}
                  {...field}
                  value={(field.value === undefined || field.value === null || (typeof field.value === 'number' && isNaN(field.value))) ? '' : String(field.value)}
                  onChange={e => {
                    const valStr = e.target.value;
                    if (valStr === '') {
                       field.onChange(undefined);
                    } else {
                      const num = parseFloat(valStr);
                      field.onChange(isNaN(num) ? undefined : num);
                    }
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
  }, [form.control]);

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
          </CardContent>
        </Card>

        {isFetchingPerformance && selectedAircraftId && (
             <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        Loading Performance Data...
                    </CardTitle>
                </Header>
                <CardContent className="space-y-4 pt-6">
                    <Skeleton className="h-10 w-full mb-2" />
                    <Skeleton className="h-10 w-full mb-2" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
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
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
                {renderInputWithUnit("takeoffSpeed", "Takeoff Speed", "kts", "e.g., 120")}
                {renderInputWithUnit("landingSpeed", "Landing Speed", "kts", "e.g., 110")}
                {renderInputWithUnit("climbSpeed", "Climb Speed", "kts", "e.g., 250")}
                {renderInputWithUnit("climbRate", "Climb Rate", "ft/min", "e.g., 3000")}
                {renderInputWithUnit("cruiseSpeed", "Cruise Speed", "kts", "e.g., 450")}
                {renderInputWithUnit("cruiseAltitude", "Cruise Altitude", "ft", "e.g., 41000")}
                {renderInputWithUnit("descentSpeed", "Descent Speed", "kts", "e.g., 280")}
                {renderInputWithUnit("descentRate", "Descent Rate", "ft/min", "e.g., 2000")}

                <FormField
                  control={form.control}
                  name="fuelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Type</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                        value={field.value || ""}
                        name={field.name}
                       >
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
                {renderInputWithUnit("fuelBurn", "Fuel Burn", "gls/hr", "e.g., 300")}
                {renderInputWithUnit("maxRange", "Maximum Range", "nm", "e.g., 2000")}
                {renderInputWithUnit("maxAllowableTakeoffWeight", "Max Allowable T/O Weight", "lbs", "e.g., 18000")}
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
        {isLoadingAircraft && !selectedAircraftId && (
            <div className="text-center py-10 text-muted-foreground flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading aircraft data...
            </div>
        )}
      </form>
    </Form>
  );
}


"use client";

import * as React from 'react'; // Explicit React import
import { useState, useEffect, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Save, XCircle, PlusCircle, Trash2, Plane, Users, CalendarIcon, Info, Edit3, FileText as FileTextIcon, Package as PackageIcon, UserPlus, FileUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { saveTrip } from '@/ai/flows/manage-trips-flow';
import type { Trip, SaveTripInput, TripLeg as TripLegType, TripStatus } from '@/ai/schemas/trip-schemas';
import { TripLegSchema, TripSchema as FullTripSchema, tripStatuses, legTypes } from '@/ai/schemas/trip-schemas';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const TripFormSchema = FullTripSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  legs: z.array(TripLegSchema.extend({
    departureDateTime: z.date().optional(),
    arrivalDateTime: z.date().optional(),
  })).min(1, "At least one flight leg is required.")
});

type TripFormData = z.infer<typeof TripFormSchema>;

interface TripFormProps {
  initialTripData?: Trip | null;
  isEditMode: boolean;
}

export function TripForm({ initialTripData, isEditMode }: TripFormProps) {
  const [isSaving, startSavingTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [minLegDepartureDate, setMinLegDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [aircraftOptions, setAircraftOptions] = useState<{ value: string, label: string }[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);

  const form = useForm<TripFormData>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: {
      tripId: '',
      clientName: '',
      aircraftId: undefined,
      legs: [{
        origin: '', destination: '', departureDateTime: undefined, arrivalDateTime: undefined, legType: 'Charter', passengerCount: 1,
        originFbo: '', destinationFbo: '', flightTimeHours: undefined, blockTimeHours: undefined
      }],
      status: 'Scheduled',
      notes: '',
      quoteId: undefined,
      customerId: undefined,
      aircraftLabel: undefined,
    },
  });

  const { control, handleSubmit, reset, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "legs",
  });

  const generateNewUserFacingTripId = useCallback(() => {
    return `TRP-${Date.now().toString().slice(-6)}`;
  }, []);

  useEffect(() => {
    setIsClient(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinLegDepartureDate(today);

    const loadAircraft = async () => {
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        setAircraftOptions(fleet.map(ac => ({ value: ac.id, label: `${ac.tailNumber} - ${ac.model}` })));
      } catch (error) {
        toast({ title: "Error loading aircraft", description: "Could not fetch aircraft list.", variant: "destructive" });
      } finally {
        setIsLoadingAircraft(false);
      }
    };
    loadAircraft();
  }, [toast]);

  useEffect(() => {
    if (isEditMode && initialTripData) {
      reset({
        ...initialTripData,
        legs: initialTripData.legs.map(leg => ({
          ...leg,
          departureDateTime: leg.departureDateTime ? parseISO(leg.departureDateTime) : undefined,
          arrivalDateTime: leg.arrivalDateTime ? parseISO(leg.arrivalDateTime) : undefined,
        })),
      });
    } else if (!isEditMode) {
      reset({
        tripId: generateNewUserFacingTripId(),
        clientName: '',
        aircraftId: undefined,
        legs: [{ origin: '', destination: '', departureDateTime: undefined, arrivalDateTime: undefined, legType: 'Charter', passengerCount: 1, originFbo: '', destinationFbo: '', flightTimeHours: undefined, blockTimeHours: undefined }],
        status: 'Scheduled',
        notes: '',
        quoteId: undefined,
        customerId: undefined,
        aircraftLabel: undefined,
      });
    }
  }, [isEditMode, initialTripData, reset, generateNewUserFacingTripId]);

  const onSubmit: SubmitHandler<TripFormData> = (data) => {
    startSavingTransition(async () => {
      const selectedAircraft = aircraftOptions.find(opt => opt.value === data.aircraftId);

      const tripDataToSave: SaveTripInput = {
        ...data,
        aircraftLabel: selectedAircraft?.label || data.aircraftId,
        legs: data.legs.map(leg => ({
          ...leg,
          departureDateTime: leg.departureDateTime ? leg.departureDateTime.toISOString() : undefined,
          arrivalDateTime: leg.arrivalDateTime ? leg.arrivalDateTime.toISOString() : undefined,
        })),
      };

      try {
        const savedTrip = await saveTrip(tripDataToSave);
        toast({
          title: isEditMode ? "Trip Updated" : "Trip Created",
          description: `Trip ${savedTrip.tripId} has been successfully ${isEditMode ? 'updated' : 'created'}.`,
        });
        if (isEditMode) {
           router.push(`/trips/details/${savedTrip.id}`);
        } else {
          router.push(`/trips/list`);
        }
      } catch (error) {
        toast({
          title: "Error Saving Trip",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  const titleText = isEditMode ? `Edit Trip: ${initialTripData?.tripId || 'N/A'}` : "Create New Trip";
  const descriptionText = isEditMode ? "Modify the details of this existing trip." : "Enter the details for the new trip.";

  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <Plane className="h-6 w-6 text-primary" />}
          {titleText}
        </CardTitle>
        <CardDescription>{descriptionText}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">

            <section>
              <CardTitle className="text-lg border-b pb-2 mb-4">Core Trip Details</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="tripId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip ID</FormLabel>
                    <FormControl><Input placeholder="e.g., TRP-12345" {...field} readOnly={isEditMode || !isEditMode} className={isEditMode || !isEditMode ? "bg-muted/50 cursor-not-allowed" : ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl><Input placeholder="Client Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FormField control={control} name="aircraftId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aircraft</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingAircraft}>
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select aircraft"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {aircraftOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                         {!isLoadingAircraft && aircraftOptions.length === 0 && (<SelectItem value="no-aircraft" disabled>No aircraft in fleet</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Scheduled"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {tripStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </section>

            <Separator />
            <section>
              <CardTitle className="text-lg border-b pb-2 mb-4">Flight Legs</CardTitle>
              {fields.map((legItem, index) => (
                <Card key={legItem.id} className="mb-6 p-4 border rounded-lg shadow-sm bg-muted/10">
                  <CardHeader className="p-0 pb-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Leg {index + 1}</CardTitle>
                      {fields.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove Leg</span></Button>)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={control} name={`legs.${index}.origin`} render={({ field }) => (<FormItem><FormLabel>Origin</FormLabel><FormControl><Input placeholder="e.g., KJFK" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={control} name={`legs.${index}.destination`} render={({ field }) => (<FormItem><FormLabel>Destination</FormLabel><FormControl><Input placeholder="e.g., KLAX" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={control} name={`legs.${index}.departureDateTime`} render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Departure Date & Time</FormLabel>
                        {isClient ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP HH:mm") : <span>Pick a date and time</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={(date) => minLegDepartureDate ? date < minLegDepartureDate : false} />
                              <div className="p-2 border-t border-border">
                                <Input type="time" defaultValue={field.value ? format(field.value, "HH:mm") : ""}
                                  onChange={(e) => {
                                    const time = e.target.value;
                                    const [hours, minutesValue] = time.split(':').map(Number);
                                    const newDate = field.value ? new Date(field.value) : new Date();
                                    newDate.setHours(hours, minutesValue);
                                    field.onChange(newDate);
                                  }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : <Skeleton className="h-10 w-full" />}
                        <FormMessage />
                      </FormItem>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <FormField control={control} name={`legs.${index}.legType`} render={({ field }) => (
                        <FormItem><FormLabel>Leg Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "Charter"}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                            <SelectContent>{legTypes.map(lt => <SelectItem key={lt} value={lt}>{lt}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>)} />
                      <FormField control={control} name={`legs.${index}.passengerCount`} render={({ field }) => (<FormItem><FormLabel>Passengers</FormLabel><FormControl><Input type="number" placeholder="e.g., 2" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name={`legs.${index}.originFbo`} render={({ field }) => (<FormItem><FormLabel>Origin FBO (Optional)</FormLabel><FormControl><Input placeholder="e.g., Signature" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={control} name={`legs.${index}.destinationFbo`} render={({ field }) => (<FormItem><FormLabel>Destination FBO (Optional)</FormLabel><FormControl><Input placeholder="e.g., Atlantic" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={control} name={`legs.${index}.flightTimeHours`} render={({ field }) => (<FormItem><FormLabel>Flight Time (hrs)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={control} name={`legs.${index}.blockTimeHours`} render={({ field }) => (<FormItem><FormLabel>Block Time (hrs)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 3.0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ origin: '', destination: '', legType: 'Charter', passengerCount: 1, departureDateTime: undefined, arrivalDateTime: undefined, originFbo: '', destinationFbo: '', flightTimeHours: undefined, blockTimeHours: undefined })} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Leg
              </Button>
            </section>

            <Separator />
             <section>
                <CardTitle className="text-lg border-b pb-2 mb-4">Notes</CardTitle>
                <FormField control={control} name="notes" render={({ field }) => (
                    <FormItem>
                        <FormLabel>General Trip Notes</FormLabel>
                        <FormControl><Textarea placeholder="Any specific instructions or details for this trip..." {...field} value={field.value || ''} rows={4} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </section>
            
            <Separator />
            {/* Placeholder Sections */}
            <Card className="bg-muted/30 border-dashed">
              <CardHeader><CardTitle className="text-base text-muted-foreground flex items-center gap-2"><Users className="h-5 w-5"/>Crew Assignment</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic">Placeholder: Crew assignment UI will be implemented here.</p></CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-dashed">
              <CardHeader><CardTitle className="text-base text-muted-foreground flex items-center gap-2"><UserPlus className="h-5 w-5"/>Passenger Manifest</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic">Placeholder: Passenger details and manifest management UI will be here.</p></CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-dashed">
              <CardHeader><CardTitle className="text-base text-muted-foreground flex items-center gap-2"><PackageIcon className="h-5 w-5"/>Cargo & Load</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic">Placeholder: Cargo details, load manifest, and Hazmat declaration UI will be here.</p></CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-dashed">
              <CardHeader><CardTitle className="text-base text-muted-foreground flex items-center gap-2"><FileUp className="h-5 w-5"/>Files & Documents</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic">Placeholder: File attachment UI for this trip will be implemented here.</p></CardContent>
            </Card>

          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditMode ? 'Save Changes' : 'Create Trip'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

    
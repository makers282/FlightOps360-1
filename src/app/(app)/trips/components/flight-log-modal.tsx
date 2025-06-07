
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, Users } from 'lucide-react';
import { FlightLogLegDataSchema, type FlightLogLegData, approachTypes, fuelUnits } from '@/ai/schemas/flight-log-schemas';
import { differenceInMinutes, parse as parseTime, setHours, setMinutes } from 'date-fns';

interface FlightLogModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  tripId: string;
  legIndex: number;
  legOrigin: string;
  legDestination: string;
  initialData?: Partial<FlightLogLegData> | null;
  onSave: (data: FlightLogLegData) => Promise<void>; // onSave will now receive only FlightLogLegData
  isSaving: boolean;
}

const timeToDecimal = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
};

const decimalToHHMM = (decimalHours: number): string => {
  if (isNaN(decimalHours) || decimalHours < 0) return "00:00";
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export function FlightLogModal({
  isOpen,
  setIsOpen,
  tripId, // Not used directly in form, but available if onSave needs it contextually
  legIndex,
  legOrigin,
  legDestination,
  initialData,
  onSave,
  isSaving,
}: FlightLogModalProps) {

  const form = useForm<FlightLogLegData>({
    resolver: zodResolver(FlightLogLegDataSchema),
    defaultValues: {
      taxiOutTimeMins: 15,
      takeOffTime: "12:00",
      hobbsTakeOff: undefined,
      landingTime: "13:00",
      hobbsLanding: undefined,
      taxiInTimeMins: 15,
      approaches: 0,
      approachType: undefined,
      dayLandings: 0,
      nightLandings: 0,
      nightTimeDecimal: 0.0,
      instrumentTimeDecimal: 0.0,
      fobStartingFuel: undefined,
      fuelPurchasedAmount: 0.0,
      fuelPurchasedUnit: "Lbs",
      endingFuel: undefined,
      fuelCost: 0.0,
      postLegApuTimeDecimal: 0.0,
      ...initialData, // Spread initialData to override defaults if provided
    },
  });

  const { control, handleSubmit, watch, setValue, formState: { errors } } = form;

  const [
    takeOffTimeStr, landingTimeStr, 
    hobbsTakeOff, hobbsLanding, 
    taxiOutTimeMins, taxiInTimeMins,
    fobStartingFuel, fuelPurchasedAmount, endingFuel
  ] = watch([
    "takeOffTime", "landingTime", 
    "hobbsTakeOff", "hobbsLanding",
    "taxiOutTimeMins", "taxiInTimeMins",
    "fobStartingFuel", "fuelPurchasedAmount", "endingFuel"
  ]);

  const calculatedFlightTimeDecimal = useMemo(() => {
    try {
        // Hobbs takes precedence if both are valid
        if (typeof hobbsTakeOff === 'number' && typeof hobbsLanding === 'number' && hobbsLanding > hobbsTakeOff) {
            return parseFloat((hobbsLanding - hobbsTakeOff).toFixed(1));
        }
        // Fallback to actual times
        const takeOff = parseTime(takeOffTimeStr, "HH:mm", new Date());
        const landing = parseTime(landingTimeStr, "HH:mm", new Date());
        if (takeOff > landing) landing.setDate(landing.getDate() + 1); // Handle crossing midnight
        const diffMins = differenceInMinutes(landing, takeOff);
        return parseFloat((diffMins / 60).toFixed(1));
    } catch (e) {
      return 0;
    }
  }, [takeOffTimeStr, landingTimeStr, hobbsTakeOff, hobbsLanding]);

  const calculatedBlockTimeDecimal = useMemo(() => {
    const flightTime = calculatedFlightTimeDecimal || 0;
    const taxiOut = Number(taxiOutTimeMins || 0) / 60;
    const taxiIn = Number(taxiInTimeMins || 0) / 60;
    return parseFloat((taxiOut + flightTime + taxiIn).toFixed(1));
  }, [calculatedFlightTimeDecimal, taxiOutTimeMins, taxiInTimeMins]);

  const calculatedFuelBurn = useMemo(() => {
    const startFuel = Number(fobStartingFuel || 0);
    const purchased = Number(fuelPurchasedAmount || 0);
    const endFuel = Number(endingFuel || 0);
    if (isNaN(startFuel) || isNaN(purchased) || isNaN(endFuel)) return 0;
    return parseFloat(((startFuel + purchased) - endFuel).toFixed(1));
  }, [fobStartingFuel, fuelPurchasedAmount, endingFuel]);


  useEffect(() => {
    if (isOpen && initialData) {
      form.reset({
        ...FlightLogLegDataSchema.shape, // Ensures all keys from schema are present
        ...initialData, // Then spread initialData to override defaults
        // Ensure numbers are numbers, not strings, if they come from initialData
        taxiOutTimeMins: Number(initialData.taxiOutTimeMins ?? 15),
        hobbsTakeOff: Number(initialData.hobbsTakeOff),
        hobbsLanding: Number(initialData.hobbsLanding),
        taxiInTimeMins: Number(initialData.taxiInTimeMins ?? 15),
        approaches: Number(initialData.approaches ?? 0),
        dayLandings: Number(initialData.dayLandings ?? 0),
        nightLandings: Number(initialData.nightLandings ?? 0),
        nightTimeDecimal: Number(initialData.nightTimeDecimal ?? 0.0),
        instrumentTimeDecimal: Number(initialData.instrumentTimeDecimal ?? 0.0),
        fobStartingFuel: Number(initialData.fobStartingFuel),
        fuelPurchasedAmount: Number(initialData.fuelPurchasedAmount ?? 0.0),
        endingFuel: Number(initialData.endingFuel),
        fuelCost: Number(initialData.fuelCost ?? 0.0),
        postLegApuTimeDecimal: Number(initialData.postLegApuTimeDecimal ?? 0.0),
      });
    } else if (isOpen && !initialData) {
      form.reset(); // Reset to defaultValues if adding new
    }
  }, [isOpen, initialData, form]);


  const onSubmitHandler: SubmitHandler<FlightLogLegData> = async (data) => {
    await onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Flight Log for Leg {legIndex + 1}: {legOrigin || 'N/A'} - {legDestination || 'N/A'}
          </DialogTitle>
          <DialogDescription>Edit this leg's flight log details. Ensure all times are in local time for the event.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <Form {...form}>
            <form id="flight-log-form" onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6 p-1">
              
              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary border-b pb-1">Flight Log Times</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  <FormField control={control} name="taxiOutTimeMins" render={({ field }) => (<FormItem><FormLabel>Taxi-Out Time (mins)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="takeOffTime" render={({ field }) => (<FormItem><FormLabel>Take-Off Time (HH:MM 24hr)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="hobbsTakeOff" render={({ field }) => (<FormItem><FormLabel>Hobbs Take-Off</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="hobbsLanding" render={({ field }) => (<FormItem><FormLabel>Hobbs Landing</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="landingTime" render={({ field }) => (<FormItem><FormLabel>Landing Time (HH:MM 24hr)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="taxiInTimeMins" render={({ field }) => (<FormItem><FormLabel>Taxi-In Time (mins)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm p-2 bg-muted rounded-md">
                  <div><strong>Flight Time:</strong> <span className="text-green-600 font-semibold">{decimalToHHMM(calculatedFlightTimeDecimal)} ({calculatedFlightTimeDecimal.toFixed(1)})</span></div>
                  <div><strong>Block Time:</strong> <span className="text-blue-600 font-semibold">{decimalToHHMM(calculatedBlockTimeDecimal)} ({calculatedBlockTimeDecimal.toFixed(1)})</span></div>
                </div>
              </section>

              <section className="space-y-4 p-4 border rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-primary border-b pb-1">Approaches, Landings, Fuel, etc.</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                  <FormField control={control} name="approaches" render={({ field }) => (<FormItem><FormLabel>Approaches</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="approachType" render={({ field }) => (<FormItem><FormLabel>Approach Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{approachTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={control} name="dayLandings" render={({ field }) => (<FormItem><FormLabel>Day Landings</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="nightLandings" render={({ field }) => (<FormItem><FormLabel>Night Landings</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  <FormField control={control} name="nightTimeDecimal" render={({ field }) => (<FormItem><FormLabel>Night Time (decimal)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="instrumentTimeDecimal" render={({ field }) => (<FormItem><FormLabel>Instrument Time (decimal)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
                  <FormField control={control} name="fobStartingFuel" render={({ field }) => (<FormItem><FormLabel>Starting Fuel (FOB)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="fuelPurchasedAmount" render={({ field }) => (<FormItem><FormLabel>Fuel Purchased</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="fuelPurchasedUnit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{fuelUnits.map(unit => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={control} name="endingFuel" render={({ field }) => (<FormItem><FormLabel>Ending Fuel</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <FormField control={control} name="fuelCost" render={({ field }) => (<FormItem><FormLabel>Total Fuel Cost</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormItem>
                        <FormLabel>Calculated Fuel Burn</FormLabel>
                        <Input type="number" value={calculatedFuelBurn.toFixed(1)} readOnly className="bg-muted/50 cursor-not-allowed" />
                    </FormItem>
                    <FormField control={control} name="postLegApuTimeDecimal" render={({ field }) => (<FormItem><FormLabel>Post-Leg APU Time</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
              </section>
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button form="flight-log-form" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

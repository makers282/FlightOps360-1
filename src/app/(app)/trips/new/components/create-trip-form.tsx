
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, Save, Users } from 'lucide-react';
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

const formSchema = z.object({
  tripId: z.string().min(3, "Trip ID must be at least 3 characters."),
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }),
  arrivalDateTime: z.date({ required_error: "Arrival date and time are required." }),
  aircraftId: z.string().min(1, "Aircraft selection is required."),
  passengerCount: z.coerce.number().min(1, "At least one passenger is required.").int(),
  clientName: z.string().min(2, "Client name is required."), // In a real app, this might be a lookup/select from Customers
  status: z.enum(["Scheduled", "En Route", "Awaiting Closeout", "Completed", "Cancelled"]),
  selectedCrewIds: z.array(z.string()).refine(value => value.length > 0, {
    message: "At least one crew member must be selected.",
  }).optional().default([]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Sample data - replace with actual data fetching in a real app
const availableAircraft = [
  { id: 'N123AB', name: 'N123AB - Cessna Citation CJ3' },
  { id: 'N456CD', name: 'N456CD - Bombardier Global 6000' },
  { id: 'N789EF', name: 'N789EF - Gulfstream G650ER' },
];

const sampleCrewData = [
  { id: 'CRW001', name: 'Capt. Ava Williams', qualification: 'Pilot, PIC Type A' },
  { id: 'CRW002', name: 'FO Ben Carter', qualification: 'First Officer, Type A/B' },
  { id: 'CRW003', name: 'FA Chloe Davis', qualification: 'Flight Attendant, Lead' },
  { id: 'CRW004', name: 'Capt. John Smith', qualification: 'Pilot, PIC Type B' },
  { id: 'CRW005', name: 'FA Olivia Green', qualification: 'Flight Attendant' },
];

const tripStatuses = ["Scheduled", "En Route", "Awaiting Closeout", "Completed", "Cancelled"] as const;


export function CreateTripForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tripId: `TRP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      origin: '',
      destination: '',
      aircraftId: '',
      passengerCount: 1,
      clientName: '',
      status: "Scheduled",
      selectedCrewIds: [],
      notes: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    startTransition(async () => {
      console.log('Trip Data:', data);
      toast({
        title: "Trip Creation Submitted",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <code className="text-white">{JSON.stringify(data, null, 2)}</code>
          </pre>
        ),
        variant: "default",
      });
      // form.reset(); // Optionally reset form after submission
    });
  };

  return (
    <Card className="shadow-lg max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>New Trip Details</CardTitle>
        <CardDescription>Fill in the information below to log a new flight trip.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="tripId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., TRP-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin Airport</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., KJFK" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Airport</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., KLAX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="departureDateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Departure Date & Time</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP HH:mm")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) }
                          initialFocus
                        />
                         <div className="p-2 border-t border-border">
                            <Input 
                              type="time" 
                              defaultValue={field.value ? format(field.value, "HH:mm") : ""}
                              onChange={(e) => {
                                const time = e.target.value;
                                const [hours, minutes] = time.split(':').map(Number);
                                const newDate = field.value ? new Date(field.value) : new Date();
                                newDate.setHours(hours, minutes);
                                field.onChange(newDate);
                              }}
                            />
                         </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="arrivalDateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Arrival Date & Time</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP HH:mm")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => form.getValues("departureDateTime") ? date < form.getValues("departureDateTime") : date < new Date(new Date().setHours(0,0,0,0)) }
                          initialFocus
                        />
                        <div className="p-2 border-t border-border">
                            <Input 
                              type="time" 
                              defaultValue={field.value ? format(field.value, "HH:mm") : ""}
                              onChange={(e) => {
                                const time = e.target.value;
                                const [hours, minutes] = time.split(':').map(Number);
                                const newDate = field.value ? new Date(field.value) : new Date();
                                newDate.setHours(hours, minutes);
                                field.onChange(newDate);
                              }}
                            />
                         </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="aircraftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an aircraft" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableAircraft.map(aircraft => (
                        <SelectItem key={aircraft.id} value={aircraft.id}>
                          {aircraft.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="passengerCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Passengers</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 4" {...field} min="1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe Aviation LLC" {...field} />
                    </FormControl>
                    <FormDescription>For a real app, this might be a searchable select from your customer list.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="selectedCrewIds"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Assign Crew</FormLabel>
                    <FormDescription>
                      Select the crew members assigned to this trip.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sampleCrewData.map((crew) => (
                    <FormField
                      key={crew.id}
                      control={form.control}
                      name="selectedCrewIds"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={crew.id}
                            className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(crew.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value || [], crew.id])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== crew.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                              {crew.name} <span className="text-xs text-muted-foreground">({crew.qualification})</span>
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trip status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tripStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter any additional notes for the trip..." {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Create Trip
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

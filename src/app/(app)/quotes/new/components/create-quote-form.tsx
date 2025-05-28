
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save } from 'lucide-react';
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

const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional(),
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }),
  passengerCount: z.coerce.number().min(1, "At least one passenger is required.").int(),
  aircraftType: z.string().optional(), // Or make it required if always needed for a quote
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const availableAircraft = [
  { id: 'N123AB', name: 'N123AB - Cessna Citation CJ3' },
  { id: 'N456CD', name: 'N456CD - Bombardier Global 6000' },
  { id: 'N789EF', name: 'N789EF - Gulfstream G650ER' },
  { id: 'ANY_LIGHT', name: 'Any Light Jet' },
  { id: 'ANY_MID', name: 'Any Midsize Jet' },
  { id: 'ANY_HEAVY', name: 'Any Heavy Jet' },
];

export function CreateQuoteForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [minDepartureDate, setMinDepartureDate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quoteId: '', 
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      origin: '',
      destination: '',
      passengerCount: 1,
      aircraftType: '',
      notes: '',
    },
  });

  const { setValue, getValues } = form;

  useEffect(() => {
    setIsClient(true);
    if (!getValues('quoteId')) {
      setValue('quoteId', `QT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setMinDepartureDate(today);
  }, [setValue, getValues]);

  const onSubmit: SubmitHandler<FormData> = (data) => {
    startTransition(async () => {
      console.log('Quote Data:', data);
      toast({
        title: "Quote Generation Submitted",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <code className="text-white">{JSON.stringify(data, null, 2)}</code>
          </pre>
        ),
        variant: "default",
      });
      // form.reset(); 
    });
  };

  return (
    <Card className="shadow-lg max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>New Quote Details</CardTitle>
        <CardDescription>Fill in the client and trip information to generate a quote.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="quoteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quote ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., QT-ABCDE" {...field} value={field.value || ''} readOnly className="bg-muted/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <CardTitle className="text-xl border-b pb-2">Client Information</CardTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
            <CardTitle className="text-xl border-b pb-2 pt-4">Trip Details</CardTitle>
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

            <FormField
              control={form.control}
              name="departureDateTime"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Desired Departure Date & Time</FormLabel>
                  {isClient ? (
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
                          disabled={(date) => minDepartureDate ? date < minDepartureDate : true}
                          initialFocus
                        />
                        <div className="p-2 border-t border-border">
                            <Input 
                              type="time" 
                              defaultValue={field.value ? format(new Date(field.value), "HH:mm") : ""}
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
                  ) : (
                     <>
                      <Skeleton className="h-10 w-full" />
                      <span className="text-xs text-muted-foreground">Loading calendar...</span>
                     </>
                  )}
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
                name="aircraftType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Aircraft Type (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an aircraft type" />
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
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests / Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Catering requirements, specific FBO preference..." {...field} rows={4} />
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
              Generate Quote
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

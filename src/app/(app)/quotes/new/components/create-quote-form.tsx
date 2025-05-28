
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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2, Save, Users, Briefcase, Utensils,Landmark, BedDouble } from 'lucide-react';
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

const legTypes = [
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

const formSchema = z.object({
  quoteId: z.string().min(3, "Quote ID must be at least 3 characters."),
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Invalid email address."),
  clientPhone: z.string().min(7, "Phone number seems too short.").optional().or(z.literal('')),
  origin: z.string().min(3, "Origin airport code (e.g., JFK).").max(5),
  destination: z.string().min(3, "Destination airport code (e.g., LAX).").max(5),
  departureDateTime: z.date({ required_error: "Departure date and time are required." }),
  passengerCount: z.coerce.number().min(1, "At least one passenger is required.").int(),
  aircraftType: z.string().min(1, "Aircraft type is required."), 
  legType: z.enum(legTypes, { required_error: "Leg type is required." }),
  medicsRequested: z.boolean().optional().default(false),
  cateringRequested: z.boolean().optional().default(false),
  cateringNotes: z.string().optional(),
  includeLandingFees: z.boolean().optional().default(false),
  estimatedOvernights: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const availableAircraft = [
  { id: 'N123AB', name: 'N123AB - Cessna Citation CJ3' },
  { id: 'N456CD', name: 'N456CD - Bombardier Global 6000' },
  { id: 'N789EF', name: 'N789EF - Gulfstream G650ER' },
  { id: 'LIGHT_JET', name: 'Category: Light Jet' },
  { id: 'MID_JET', name: 'Category: Midsize Jet' },
  { id: 'HEAVY_JET', name: 'Category: Heavy Jet' },
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
      legType: "Charter",
      medicsRequested: false,
      cateringRequested: false,
      cateringNotes: "",
      includeLandingFees: false,
      estimatedOvernights: 0,
      notes: '',
    },
  });

  const { setValue, getValues, watch } = form;
  const cateringRequestedValue = watch("cateringRequested");

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
      // Filter out cateringNotes if cateringRequested is false
      const finalData = {
        ...data,
        cateringNotes: data.cateringRequested ? data.cateringNotes : undefined,
      };
      toast({
        title: "Quote Generation Submitted",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <code className="text-white">{JSON.stringify(finalData, null, 2)}</code>
          </pre>
        ),
        variant: "default",
      });
      // form.reset(); // Consider if resetting is desired or not
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
                              format(new Date(field.value), "PPP HH:mm")
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
                    <FormLabel>Aircraft Type</FormLabel>
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
                name="legType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leg Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leg type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {legTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <CardTitle className="text-xl border-b pb-2 pt-4">Additional Options</CardTitle>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="medicsRequested"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Medics Requested</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cateringRequested"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> Catering Requested</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              {cateringRequestedValue && (
                <FormField
                  control={form.control}
                  name="cateringNotes"
                  render={({ field }) => (
                    <FormItem className="pl-8">
                      <FormLabel>Catering Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Specify catering details (e.g., vegan options, specific drinks)..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               <FormField
                control={form.control}
                name="includeLandingFees"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Include Estimated Landing Fees</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedOvernights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary"/> Estimated Overnights</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 2" {...field} min="0" />
                    </FormControl>
                    <FormDescription>Number of overnight stays for crew/aircraft if applicable.</FormDescription>
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
                  <FormLabel>General Quote Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Specific client preferences, discount applied..." {...field} rows={4} />
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


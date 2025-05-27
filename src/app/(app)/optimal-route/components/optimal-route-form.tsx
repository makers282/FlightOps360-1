"use client";

import type { SuggestOptimalRouteInput, SuggestOptimalRouteOutput } from '@/ai/flows/suggest-optimal-route';
import { suggestOptimalRoute } from '@/ai/flows/suggest-optimal-route';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, AlertTriangle, CheckCircle2, Clock, Fuel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  origin: z.string().min(3, "Origin airport code must be at least 3 characters (e.g., JFK).").max(5),
  destination: z.string().min(3, "Destination airport code must be at least 3 characters (e.g., LAX).").max(5),
  aircraftType: z.string().min(3, "Aircraft type is required (e.g., Boeing 737-800)."),
  currentWeather: z.string().min(10, "Please provide a summary of current weather conditions."),
  airTraffic: z.string().min(10, "Please provide a summary of current air traffic conditions."),
});

type FormData = z.infer<typeof formSchema>;

export function OptimalRouteForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SuggestOptimalRouteOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      origin: '',
      destination: '',
      aircraftType: '',
      currentWeather: '',
      airTraffic: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const flowResult = await suggestOptimalRoute(data as SuggestOptimalRouteInput);
        setResult(flowResult);
        toast({
          title: "Route Suggested",
          description: "Optimal route analysis complete.",
          variant: "default",
          action: <CheckCircle2 className="text-green-500" />,
        });
      } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        setError(errorMessage);
        toast({
          title: "Error Suggesting Route",
          description: errorMessage,
          variant: "destructive",
          action: <AlertTriangle className="text-white" />,
        });
      }
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Flight Details</CardTitle>
          <CardDescription>Enter the required information to get an optimal route suggestion.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin Airport (ICAO/IATA)</FormLabel>
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
                      <FormLabel>Destination Airport (ICAO/IATA)</FormLabel>
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
                name="aircraftType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aircraft Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Boeing 737-800" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentWeather"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Weather Conditions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe weather along potential routes (e.g., clear skies, scattered thunderstorms)" {...field} rows={4} />
                    </FormControl>
                    <FormDescription>Provide a brief summary of notable weather phenomena.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="airTraffic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Air Traffic Conditions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe air traffic (e.g., light traffic, moderate congestion over Chicago center)" {...field} rows={4} />
                    </FormControl>
                    <FormDescription>Summarize any significant air traffic control advisories or congestion.</FormDescription>
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
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Suggest Optimal Route
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <div className="space-y-6">
        {isPending && (
          <Card className="shadow-lg animate-pulse">
            <CardHeader>
              <CardTitle>Analyzing Route...</CardTitle>
              <CardDescription>Please wait while we calculate the optimal route.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="shadow-lg border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle /> Error Generating Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive-foreground_muted">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && !isPending && (
          <Card className="shadow-lg border-primary">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <CheckCircle2 /> Optimal Route Suggestion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Suggested Route:</h3>
                <p className="text-muted-foreground bg-muted p-3 rounded-md">{result.optimalRoute}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <Fuel className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Est. Fuel Consumption</p>
                    <p className="text-lg font-semibold">{result.estimatedFuelConsumption.toLocaleString()} gallons</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <Clock className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Est. Arrival Time</p>
                    <p className="text-lg font-semibold">{result.estimatedArrivalTime}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mt-4">Explanation:</h3>
                <p className="text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md">{result.explanation}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

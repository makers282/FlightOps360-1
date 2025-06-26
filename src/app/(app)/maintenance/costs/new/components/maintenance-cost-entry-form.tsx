
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay } from "date-fns";

import { DollarSign, ArrowLeft, Save, Loader2, CalendarIcon, PlusCircle, Trash2, UploadCloud } from 'lucide-react';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { saveMaintenanceCost } from '@/ai/flows/manage-maintenance-costs-flow';
import type { MaintenanceCost } from '@/ai/schemas/maintenance-cost-schemas';


// Form Schemas
const costBreakdownSchema = z.object({
  category: z.enum(['Labor', 'Parts', 'Shop Fees', 'Other']),
  projectedCost: z.coerce.number().min(0, "Must be non-negative.").optional().default(0),
  actualCost: z.coerce.number().min(0, "Must be non-negative.").optional().default(0),
  description: z.string().optional(),
});
type CostBreakdownFormData = z.infer<typeof costBreakdownSchema>;

const costEntryFormSchema = z.object({
  aircraftId: z.string().min(1, "An aircraft must be selected."),
  invoiceDate: z.date({ required_error: "Invoice date is required." }),
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  costType: z.enum(['Scheduled', 'Unscheduled']),
  costBreakdowns: z.array(costBreakdownSchema).min(1, "At least one cost breakdown item is required."),
  notes: z.string().optional(),
});
export type CostEntryFormData = z.infer<typeof costEntryFormSchema>;


// Helper Components
const formatCurrency = (value: number | undefined) => {
  if (value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

interface MaintenanceCostEntryFormProps {
  initialData?: MaintenanceCost | null;
  isEditing: boolean;
}

// Main Form Component
export function MaintenanceCostEntryForm({ initialData, isEditing }: MaintenanceCostEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [aircraftList, setAircraftList] = useState<FleetAircraft[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  
  const form = useForm<CostEntryFormData>({
    resolver: zodResolver(costEntryFormSchema),
    defaultValues: {
      aircraftId: '',
      invoiceDate: startOfDay(new Date()),
      invoiceNumber: '',
      costType: 'Scheduled',
      costBreakdowns: [{ category: 'Parts', projectedCost: 0, actualCost: 0, description: '' }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'costBreakdowns',
  });

  const watchedBreakdowns = useWatch({
    control: form.control,
    name: 'costBreakdowns',
  });

  const costSummary = React.useMemo(() => {
    const summary = watchedBreakdowns.reduce(
      (acc, item) => {
        acc.projected += Number(item.projectedCost) || 0;
        acc.actual += Number(item.actualCost) || 0;
        return acc;
      },
      { projected: 0, actual: 0 }
    );
    summary.variance = summary.actual - summary.projected;
    return summary;
  }, [watchedBreakdowns]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        aircraftId: initialData.aircraftId,
        invoiceDate: parseISO(initialData.invoiceDate),
        invoiceNumber: initialData.invoiceNumber,
        costType: initialData.costType,
        costBreakdowns: initialData.costBreakdowns,
        notes: initialData.notes,
      });
    }
  }, [initialData, form]);

  useEffect(() => {
    async function loadAircraft() {
      setIsLoadingAircraft(true);
      try {
        const fleet = await fetchFleetAircraft();
        setAircraftList(fleet);
      } catch (error) {
        toast({ title: "Error", description: "Could not load aircraft list.", variant: "destructive" });
      } finally {
        setIsLoadingAircraft(false);
      }
    }
    loadAircraft();
  }, [toast]);

  const onSubmit = async (data: CostEntryFormData) => {
    setIsSaving(true);
    try {
      const aircraft = aircraftList.find(ac => ac.id === data.aircraftId);
      if (!aircraft) throw new Error("Selected aircraft not found.");
      
      const payload = {
        id: isEditing ? initialData?.id : undefined,
        aircraftId: data.aircraftId,
        tailNumber: aircraft.tailNumber,
        invoiceDate: format(data.invoiceDate, 'yyyy-MM-dd'),
        invoiceNumber: data.invoiceNumber,
        costType: data.costType,
        costBreakdowns: data.costBreakdowns,
        notes: data.notes,
      };

      await saveMaintenanceCost(payload);

      toast({
        title: `Cost Entry ${isEditing ? 'Updated' : 'Saved'}`,
        description: `Invoice ${data.invoiceNumber} for ${aircraft.tailNumber} has been recorded.`,
      });
      router.push('/maintenance/costs');
      router.refresh();
    } catch (error) {
      console.error("Failed to save maintenance cost:", error);
      toast({ title: "Error", description: `Could not save cost entry. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id="maintenance-cost-form" className="pb-24 lg:pb-0">
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-6">
              <Card><CardHeader><CardTitle>Aircraft & Date</CardTitle></CardHeader><CardContent className="space-y-4"> <FormField control={form.control} name="aircraftId" render={({ field }) => ( <FormItem> <FormLabel>Aircraft</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAircraft}> <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl> <SelectContent>{aircraftList.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber} - {ac.model}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/> <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem> <FormLabel>Invoice Date</FormLabel> <Popover> <PopoverTrigger asChild>
                <FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {field.value ? format(field.value, "PPP") : <span>Pick a date</span>} </Button></FormControl>
              </PopoverTrigger> <PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent> </Popover> <FormMessage /> </FormItem> )}/> </CardContent></Card>
              <Card><CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader><CardContent className="space-y-4"> <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input placeholder="e.g., INV-12345" {...field} /></FormControl><FormMessage /></FormItem> )}/> <FormField control={form.control} name="costType" render={({ field }) => ( <FormItem><FormLabel>Cost Type</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl> <SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Unscheduled">Unscheduled</SelectItem></SelectContent> </Select> <FormMessage /> </FormItem> )}/> </CardContent></Card>
              <Card><CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-4 text-center"> <div><p className="text-sm text-muted-foreground">Total Projected</p><p className="text-xl font-bold">{formatCurrency(costSummary.projected)}</p></div> <div><p className="text-sm text-muted-foreground">Total Actual</p><p className="text-xl font-bold">{formatCurrency(costSummary.actual)}</p></div> <div><p className="text-sm text-muted-foreground">Total Variance</p><p className={`text-xl font-bold ${costSummary.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>{costSummary.variance >= 0 ? '+' : ''}{formatCurrency(costSummary.variance)}</p></div> </CardContent></Card>
            </div>
            <div className="flex flex-col gap-6">
                <Card><CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader><CardContent className="space-y-3"> {fields.map((item, index) => ( <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background"> <div className="grid grid-cols-1 md:grid-cols-2 gap-2"> <FormField control={form.control} name={`costBreakdowns.${index}.category`} render={({ field }) => ( <FormItem><FormLabel>Category</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger></FormControl> <SelectContent> <SelectItem value="Labor">Labor</SelectItem><SelectItem value="Parts">Parts</SelectItem> <SelectItem value="Shop Fees">Shop Fees</SelectItem><SelectItem value="Other">Other</SelectItem> </SelectContent> </Select><FormMessage /> </FormItem> )}/> <div className="flex items-end"> <p className="text-sm font-medium text-right w-full">Variance: <span className={`font-bold ${((watchedBreakdowns[index]?.actualCost || 0) - (watchedBreakdowns[index]?.projectedCost || 0)) >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency((watchedBreakdowns[index]?.actualCost || 0) - (watchedBreakdowns[index]?.projectedCost || 0))}</span></p> </div> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-2"> <FormField control={form.control} name={`costBreakdowns.${index}.projectedCost`} render={({ field }) => ( <FormItem><FormLabel>Projected</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/> <FormField control={form.control} name={`costBreakdowns.${index}.actualCost`} render={({ field }) => ( <FormItem><FormLabel>Actual</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/> </div> {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>} </div> ))} <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => append({ category: 'Labor', projectedCost: 0, actualCost: 0, description: '' })}> <PlusCircle className="mr-2 h-4 w-4" />Add Category </Button> </CardContent></Card>
                <Card><CardHeader><CardTitle>Additional Notes</CardTitle></CardHeader><CardContent> <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any notes relevant to this cost entry..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} /> </CardContent></Card>
                <Card><CardHeader><CardTitle>Attachments</CardTitle></CardHeader><CardContent> <div className="flex items-center justify-center w-full"> <label htmlFor="file-upload-desktop" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted"> <div className="flex flex-col items-center justify-center pt-5 pb-6"> <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" /> <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p> <p className="text-xs text-muted-foreground">PDF, PNG, JPG (MAX. 10MB)</p> </div> <Input id="file-upload-desktop" type="file" className="hidden" /> </label> </div> </CardContent></Card>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.push('/maintenance/costs')} className="mr-2">
                        <ArrowLeft className="mr-2 h-4 w-4"/> Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving || !form.formState.isValid}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {isEditing ? 'Update Cost Entry' : 'Save Cost Entry'}
                    </Button>
                </div>
            </div>
          </div>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.push('/maintenance/costs')}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={isSaving || !form.formState.isValid}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
              </Button>
          </div>
      </form>
    </Form>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import { DollarSign, ArrowLeft, Save, Loader2, CalendarIcon, PlusCircle, Trash2, UploadCloud, File, X } from 'lucide-react';

import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';


// Form Schemas
const costBreakdownSchema = z.object({
  category: z.enum(['Labor', 'Parts', 'Shop Fees', 'Other'], { required_error: "Category is required." }),
  projectedCost: z.coerce.number().min(0, "Must be non-negative.").optional().default(0),
  actualCost: z.coerce.number().min(0, "Must be non-negative.").optional().default(0),
});
type CostBreakdownFormData = z.infer<typeof costBreakdownSchema>;

const costEntryFormSchema = z.object({
  tailNumber: z.string().min(1, "An aircraft must be selected."),
  invoiceDate: z.date({ required_error: "Invoice date is required." }),
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  costType: z.enum(['Scheduled', 'Unscheduled'], { required_error: "Cost type is required." }),
  costBreakdowns: z.array(costBreakdownSchema).min(1, "At least one cost breakdown item is required."),
  notes: z.string().optional(),
});
type CostEntryFormData = z.infer<typeof costEntryFormSchema>;


// Helper Components
const formatCurrency = (value: number | undefined) => {
  if (value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Main Form Component
export function MaintenanceCostEntryForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [aircraftList, setAircraftList] = useState<FleetAircraft[]>([]);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  
  const form = useForm<CostEntryFormData>({
    resolver: zodResolver(costEntryFormSchema),
    defaultValues: {
      tailNumber: '',
      invoiceDate: new Date(),
      invoiceNumber: '',
      costType: undefined,
      costBreakdowns: [{ category: 'Parts', projectedCost: 0, actualCost: 0 }],
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
    // Placeholder for actual save logic
    console.log("Saving Maintenance Cost Data:", data);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
      title: "Cost Entry Saved (Simulated)",
      description: `Invoice ${data.invoiceNumber} for ${data.tailNumber} has been recorded.`,
    });
    setIsSaving(false);
    router.push('/maintenance/costs');
  };

  const PageContent = ({ isMobile }: { isMobile: boolean }) => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column (Desktop) or Accordion (Mobile) */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Aircraft & Date</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="tailNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingAircraft}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl>
                    <SelectContent>{aircraftList.map(ac => <SelectItem key={ac.id} value={ac.tailNumber}>{ac.tailNumber} - {ac.model}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
           <Card>
            <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                <FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input placeholder="e.g., INV-12345" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="costType" render={({ field }) => (
                <FormItem><FormLabel>Cost Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Unscheduled">Unscheduled</SelectItem></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-sm text-muted-foreground">Total Projected</p><p className="text-xl font-bold">{formatCurrency(costSummary.projected)}</p></div>
              <div><p className="text-sm text-muted-foreground">Total Actual</p><p className="text-xl font-bold">{formatCurrency(costSummary.actual)}</p></div>
              <div><p className="text-sm text-muted-foreground">Total Variance</p><p className={`text-xl font-bold ${costSummary.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(costSummary.variance)}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Desktop) or Accordion (Mobile) */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {fields.map((item, index) => (
                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <FormField control={form.control} name={`costBreakdowns.${index}.category`} render={({ field }) => (
                      <FormItem><FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Labor">Labor</SelectItem><SelectItem value="Parts">Parts</SelectItem>
                            <SelectItem value="Shop Fees">Shop Fees</SelectItem><SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex items-end">
                      <p className="text-sm font-medium text-right w-full">Variance: <span className={`font-bold ${((item.actualCost || 0) - (item.projectedCost || 0)) >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency((item.actualCost || 0) - (item.projectedCost || 0))}</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                     <FormField control={form.control} name={`costBreakdowns.${index}.projectedCost`} render={({ field }) => (
                      <FormItem><FormLabel>Projected Cost</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`costBreakdowns.${index}.actualCost`} render={({ field }) => (
                      <FormItem><FormLabel>Actual Cost</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => append({ category: 'Labor', projectedCost: 0, actualCost: 0 })}>
                <PlusCircle className="mr-2 h-4 w-4" />Add Category
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Additional Notes</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any notes relevant to this cost entry..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>
           <Card>
            <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
            <CardContent>
                <div className="flex items-center justify-center w-full">
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                            <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PDF, PNG, JPG (MAX. 10MB)</p>
                        </div>
                        <Input id="file-upload" type="file" className="hidden" />
                    </label>
                </div>
                {/* Placeholder for uploaded file list */}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title="New Maintenance Cost"
        icon={DollarSign}
        actions={
          <div className="hidden lg:flex">
             <Button type="button" variant="outline" onClick={() => router.push('/maintenance/costs')} className="mr-2">
                <ArrowLeft className="mr-2 h-4 w-4"/> Cancel
             </Button>
             <Button type="submit" form="maintenance-cost-form" disabled={isSaving || !form.formState.isValid}>
               {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
               Save Cost Entry
             </Button>
          </div>
        }
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} id="maintenance-cost-form" className="pb-24 lg:pb-0">
            <div className="block lg:hidden">
                 <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full space-y-4">
                    <AccordionItem value="item-1" className="border rounded-lg bg-card"><AccordionTrigger className="p-4"><h3 className="font-semibold">Invoice Details</h3></AccordionTrigger><AccordionContent className="p-4 pt-0">
                      <div className="space-y-4">
                        <FormField control={form.control} name="tailNumber" render={({ field }) => ( <FormItem> <FormLabel>Aircraft</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingAircraft}> <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl> <SelectContent>{aircraftList.map(ac => <SelectItem key={ac.id} value={ac.tailNumber}>{ac.tailNumber} - {ac.model}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                        <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem> <FormLabel>Invoice Date</FormLabel> <Popover> <PopoverTrigger asChild> <FormControl> <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {field.value ? format(field.value, "PPP") : <span>Pick a date</span>} </Button> </FormControl> </PopoverTrigger> <PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent> </Popover> <FormMessage /> </FormItem> )}/>
                        <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input placeholder="e.g., INV-12345" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="costType" render={({ field }) => ( <FormItem><FormLabel>Cost Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl> <SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Unscheduled">Unscheduled</SelectItem></SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                      </div>
                    </AccordionContent></AccordionItem>
                    <AccordionItem value="item-2" className="border rounded-lg bg-card"><AccordionTrigger className="p-4"><h3 className="font-semibold">Cost Breakdown</h3></AccordionTrigger><AccordionContent className="p-4 pt-0">
                       <div className="space-y-3">
                          <Card>
                            <CardHeader className="p-3"><CardTitle className="text-base">Cost Summary</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-3 gap-2 text-center p-3">
                              <div><p className="text-xs text-muted-foreground">Projected</p><p className="font-bold">{formatCurrency(costSummary.projected)}</p></div>
                              <div><p className="text-xs text-muted-foreground">Actual</p><p className="font-bold">{formatCurrency(costSummary.actual)}</p></div>
                              <div><p className="text-xs text-muted-foreground">Variance</p><p className={`font-bold ${costSummary.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(costSummary.variance)}</p></div>
                            </CardContent>
                          </Card>
                          {fields.map((item, index) => (
                            <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                              <div className="grid grid-cols-1 gap-2">
                                <FormField control={form.control} name={`costBreakdowns.${index}.category`} render={({ field }) => ( <FormItem><FormLabel>Category</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger></FormControl> <SelectContent> <SelectItem value="Labor">Labor</SelectItem><SelectItem value="Parts">Parts</SelectItem> <SelectItem value="Shop Fees">Shop Fees</SelectItem><SelectItem value="Other">Other</SelectItem> </SelectContent> </Select><FormMessage /> </FormItem> )}/>
                                 <div className="grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name={`costBreakdowns.${index}.projectedCost`} render={({ field }) => ( <FormItem><FormLabel>Projected</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/>
                                    <FormField control={form.control} name={`costBreakdowns.${index}.actualCost`} render={({ field }) => ( <FormItem><FormLabel>Actual</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/>
                                </div>
                              </div>
                              {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>}
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => append({ category: 'Labor', projectedCost: 0, actualCost: 0 })}>
                            <PlusCircle className="mr-2 h-4 w-4" />Add Category
                          </Button>
                        </div>
                    </AccordionContent></AccordionItem>
                    <AccordionItem value="item-3" className="border rounded-lg bg-card"><AccordionTrigger className="p-4"><h3 className="font-semibold">Notes & Attachments</h3></AccordionTrigger><AccordionContent className="p-4 pt-0 space-y-4">
                      <div>
                        <Label>Additional Notes</Label>
                        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any notes relevant to this cost entry..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div>
                        <Label>Attachments</Label>
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="file-upload-mobile" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                    <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span></p>
                                </div>
                                <Input id="file-upload-mobile" type="file" className="hidden" />
                            </label>
                        </div>
                      </div>
                    </AccordionContent></AccordionItem>
                </Accordion>
            </div>
            <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="flex flex-col gap-6">
                <Card><CardHeader><CardTitle>Aircraft & Date</CardTitle></CardHeader><CardContent className="space-y-4"> <FormField control={form.control} name="tailNumber" render={({ field }) => ( <FormItem> <FormLabel>Aircraft</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingAircraft}> <FormControl><SelectTrigger><SelectValue placeholder="Select an aircraft" /></SelectTrigger></FormControl> <SelectContent>{aircraftList.map(ac => <SelectItem key={ac.id} value={ac.tailNumber}>{ac.tailNumber} - {ac.model}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/> <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem> <FormLabel>Invoice Date</FormLabel> <Popover> <PopoverTrigger asChild> <FormControl> <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {field.value ? format(field.value, "PPP") : <span>Pick a date</span>} </Button> </FormControl> </PopoverTrigger> <PopoverContent><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent> </Popover> <FormMessage /> </FormItem> )}/> </CardContent></Card>
                <Card><CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader><CardContent className="space-y-4"> <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input placeholder="e.g., INV-12345" {...field} /></FormControl><FormMessage /></FormItem> )}/> <FormField control={form.control} name="costType" render={({ field }) => ( <FormItem><FormLabel>Cost Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl> <SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Unscheduled">Unscheduled</SelectItem></SelectContent> </Select> <FormMessage /> </FormItem> )}/> </CardContent></Card>
                <Card><CardHeader><CardTitle>Cost Summary</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-4 text-center"> <div><p className="text-sm text-muted-foreground">Total Projected</p><p className="text-xl font-bold">{formatCurrency(costSummary.projected)}</p></div> <div><p className="text-sm text-muted-foreground">Total Actual</p><p className="text-xl font-bold">{formatCurrency(costSummary.actual)}</p></div> <div><p className="text-sm text-muted-foreground">Total Variance</p><p className={`text-xl font-bold ${costSummary.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>{costSummary.variance >= 0 ? '+' : ''}{formatCurrency(costSummary.variance)}</p></div> </CardContent></Card>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6">
                 <Card><CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader><CardContent className="space-y-3"> {fields.map((item, index) => ( <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background"> <div className="grid grid-cols-1 md:grid-cols-2 gap-2"> <FormField control={form.control} name={`costBreakdowns.${index}.category`} render={({ field }) => ( <FormItem><FormLabel>Category</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger></FormControl> <SelectContent> <SelectItem value="Labor">Labor</SelectItem><SelectItem value="Parts">Parts</SelectItem> <SelectItem value="Shop Fees">Shop Fees</SelectItem><SelectItem value="Other">Other</SelectItem> </SelectContent> </Select><FormMessage /> </FormItem> )}/> <div className="flex items-end"> <p className="text-sm font-medium text-right w-full">Variance: <span className={`font-bold ${((item.actualCost || 0) - (item.projectedCost || 0)) >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency((item.actualCost || 0) - (item.projectedCost || 0))}</span></p> </div> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-2"> <FormField control={form.control} name={`costBreakdowns.${index}.projectedCost`} render={({ field }) => ( <FormItem><FormLabel>Projected</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/> <FormField control={form.control} name={`costBreakdowns.${index}.actualCost`} render={({ field }) => ( <FormItem><FormLabel>Actual</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /> </FormItem> )}/> </div> {fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>} </div> ))} <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => append({ category: 'Labor', projectedCost: 0, actualCost: 0 })}> <PlusCircle className="mr-2 h-4 w-4" />Add Category </Button> </CardContent></Card>
                 <Card><CardHeader><CardTitle>Additional Notes</CardTitle></CardHeader><CardContent> <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any notes relevant to this cost entry..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} /> </CardContent></Card>
                 <Card><CardHeader><CardTitle>Attachments</CardTitle></CardHeader><CardContent> <div className="flex items-center justify-center w-full"> <label htmlFor="file-upload-desktop" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted"> <div className="flex flex-col items-center justify-center pt-5 pb-6"> <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" /> <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p> <p className="text-xs text-muted-foreground">PDF, PNG, JPG (MAX. 10MB)</p> </div> <Input id="file-upload-desktop" type="file" className="hidden" /> </label> </div> </CardContent></Card>
              </div>
            </div>

            {/* Save/Cancel for Mobile */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => router.push('/maintenance/costs')}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={isSaving || !form.formState.isValid}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                </Button>
            </div>
        </form>
      </Form>
    </>
  );
}

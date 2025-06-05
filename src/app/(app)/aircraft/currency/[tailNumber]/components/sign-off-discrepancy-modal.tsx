
"use client";

import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as ModalDialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, ShieldCheck } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate, startOfDay } from "date-fns";
import type { AircraftDiscrepancy } from '@/ai/schemas/aircraft-discrepancy-schemas';
import { Checkbox } from '@/components/ui/checkbox';

const signOffFormSchema = z.object({
  correctiveAction: z.string().min(5, "Corrective action details are required."),
  dateCorrected: z.date({ required_error: "Date corrected is required." }),
  correctedBy: z.string().min(1, "Corrected By is required."),
  correctedByCertNumber: z.string().optional(),
  signOffConfirmation: z.boolean().default(false),
}).refine(data => data.signOffConfirmation === true, {
  message: "You must confirm the sign-off.",
  path: ["signOffConfirmation"],
});

export type SignOffFormData = z.infer<typeof signOffFormSchema>;

interface SignOffDiscrepancyModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSignOff: (discrepancyId: string, data: SignOffFormData) => Promise<void>;
  discrepancy: AircraftDiscrepancy | null;
  isSaving: boolean;
}

export function SignOffDiscrepancyModal({
  isOpen,
  setIsOpen,
  onSignOff,
  discrepancy,
  isSaving,
}: SignOffDiscrepancyModalProps) {
  
  const form = useForm<SignOffFormData>({
    resolver: zodResolver(signOffFormSchema),
    defaultValues: {
      correctiveAction: '',
      dateCorrected: startOfDay(new Date()),
      correctedBy: '',
      correctedByCertNumber: '',
      signOffConfirmation: false,
    },
  });

  useEffect(() => {
    if (isOpen && discrepancy) {
      form.reset({
        correctiveAction: discrepancy.correctiveAction || '',
        dateCorrected: discrepancy.dateCorrected && isValidDate(parseISO(discrepancy.dateCorrected)) ? parseISO(discrepancy.dateCorrected) : startOfDay(new Date()),
        correctedBy: discrepancy.correctedBy || '',
        correctedByCertNumber: discrepancy.correctedByCertNumber || '',
        signOffConfirmation: false, 
      });
    } else if (isOpen && !discrepancy) {
        form.reset({
            correctiveAction: '',
            dateCorrected: startOfDay(new Date()),
            correctedBy: '',
            correctedByCertNumber: '',
            signOffConfirmation: false,
        });
    }
  }, [isOpen, discrepancy, form]);

  const onSubmit: SubmitHandler<SignOffFormData> = async (formData) => {
    if (!discrepancy) return;
    await onSignOff(discrepancy.id, formData);
  };

  if (!discrepancy) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[calc(100vh-8rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Clear Discrepancy: {discrepancy.description.substring(0,30)}...
          </DialogTitle>
          <ModalDialogDescription>
            Enter the corrective action details to close out this discrepancy for aircraft {discrepancy.aircraftTailNumber || discrepancy.aircraftId}.
          </ModalDialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <Form {...form}>
            <form id="sign-off-discrepancy-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                  control={form.control}
                  name="correctiveAction"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Corrective Action Taken</FormLabel>
                      <FormControl><Textarea placeholder="e.g., Replaced #2 main tire, torqued B-nut on engine oil line..." {...field} rows={4} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="dateCorrected"
                  render={({ field }) => (
                  <FormItem className="flex flex-col">
                      <FormLabel>Date Corrected</FormLabel>
                      <FormControl>
                        <Popover modal={false}>
                          <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date): undefined)} initialFocus /></PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="correctedBy"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Corrected By</FormLabel>
                      <FormControl><Input placeholder="e.g., Maintenance Staff, John Doe" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="correctedByCertNumber"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Corrected By Cert # (Optional)</FormLabel>
                      <FormControl><Input placeholder="e.g., A&P 7654321" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                control={form.control}
                name="signOffConfirmation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-muted/30">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        Sign-Off Confirmation
                      </FormLabel>
                      <FormDescription className="text-xs">
                        I certify that the corrective action described above has been completed and this entry is accurate and constitutes my official sign-off.
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button 
            form="sign-off-discrepancy-form" 
            type="submit" 
            disabled={isSaving || !form.formState.isValid}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Sign Off & Close Discrepancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


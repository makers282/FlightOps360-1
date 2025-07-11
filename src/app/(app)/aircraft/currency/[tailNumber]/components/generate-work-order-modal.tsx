"use client";

import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Printer } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";

const workOrderFormSchema = z.object({
  workOrderNumber: z.string().min(1, "Work Order # is required."),
  shopName: z.string().min(1, "Shop Name is required."),
  dateDue: z.date().optional(),
  notes: z.string().optional(),
});

export type WorkOrderFormData = z.infer<typeof workOrderFormSchema>;

interface GenerateWorkOrderModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onGenerate: (formData: WorkOrderFormData) => void;
  isGenerating: boolean;
  aircraftTailNumber?: string;
}

export function GenerateWorkOrderModal({ isOpen, setIsOpen, onGenerate, isGenerating, aircraftTailNumber }: GenerateWorkOrderModalProps) {
  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: {
      workOrderNumber: '',
      shopName: '',
      dateDue: undefined,
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        workOrderNumber: `WO-${format(new Date(), 'yyyyMMdd')}-${aircraftTailNumber || ''}`,
        shopName: '',
        dateDue: undefined,
        notes: '',
      });
    }
  }, [isOpen, aircraftTailNumber, form]);

  const onSubmit: SubmitHandler<WorkOrderFormData> = (data) => {
    onGenerate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Work Order</DialogTitle>
          <DialogDescription>
            Enter the details for this work package. This information will be included in the generated PDF.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="generate-wo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="workOrderNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Order #</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shopName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Center / Shop Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Constant Aviation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateDue"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a due date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes for Service Center (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Please provide cost estimate before proceeding." {...field} value={field.value || ''} rows={3}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isGenerating}>Cancel</Button>
          </DialogClose>
          <Button type="submit" form="generate-wo-form" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

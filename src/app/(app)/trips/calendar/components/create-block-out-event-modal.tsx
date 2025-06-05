
"use client";

import React, { useState, useEffect } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Lock, Save } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, isValid as isValidDate, startOfDay } from "date-fns";
import type { AircraftFilterOption } from '../page';

const blockOutFormSchema = z.object({
  aircraftId: z.string().min(1, "Aircraft selection is required."),
  title: z.string().min(3, "A title or reason is required (e.g., Maintenance, Owner Use)."),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
}).refine(data => data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

export type BlockOutFormData = z.infer<typeof blockOutFormSchema>;

interface CreateBlockOutEventModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: BlockOutFormData) => Promise<void>; // Changed to Promise<void>
  aircraftOptions: AircraftFilterOption[];
  isLoadingAircraft: boolean;
}

export function CreateBlockOutEventModal({
  isOpen,
  setIsOpen,
  onSave,
  aircraftOptions,
  isLoadingAircraft,
}: CreateBlockOutEventModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [minStartDate, setMinStartDate] = useState<Date | null>(null);

  const form = useForm<BlockOutFormData>({
    resolver: zodResolver(blockOutFormSchema),
    defaultValues: {
      aircraftId: undefined,
      title: '',
      startDate: startOfDay(new Date()),
      endDate: startOfDay(new Date()),
    },
  });

  useEffect(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    setMinStartDate(today);
  }, []);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        aircraftId: undefined,
        title: '',
        startDate: startOfDay(new Date()),
        endDate: startOfDay(new Date()),
      });
    }
  }, [isOpen, form]);

  const onSubmit: SubmitHandler<BlockOutFormData> = async (data) => {
    setIsSaving(true);
    await onSave(data); // Call the onSave prop which now handles Firestore interaction
    setIsSaving(false);
    // setModalOpen(false) is now handled by the parent component after successful save in onSave
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!isSaving) setIsOpen(open);}}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            Schedule Aircraft Block Out
          </DialogTitle>
          <DialogDescription>
            Block out an aircraft for maintenance, owner use, or other reasons. This will be saved to Firestore.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          {/* Changed form id to avoid conflicts if this modal is ever used multiple times on one page, though unlikely here */}
          <form id="createBlockOutEventModalFormInternal" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="aircraftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    name={field.name}
                    disabled={isLoadingAircraft}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAircraft ? "Loading aircraft..." : "Select an aircraft"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {!isLoadingAircraft && aircraftOptions.length === 0 && <SelectItem value="NO_AIRCRAFT_PLACEHOLDER" disabled>No aircraft available</SelectItem>}
                      {aircraftOptions.map(option => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title / Reason</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Scheduled Maintenance, Owner Trip" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date ? startOfDay(date) : undefined);
                            if (date && form.getValues("endDate") < date) {
                                form.setValue("endDate", startOfDay(date));
                            }
                          }}
                          disabled={(date) => minStartDate ? date < minStartDate && !isValidDate(form.getValues("startDate")) : false}
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
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)}
                          disabled={(date) => {
                            const startDate = form.getValues("startDate");
                            return startDate ? date < startDate : (minStartDate ? date < minStartDate : false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        
        <DialogFooter className="pt-4">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          {/* Changed form id to match the form inside Form tag */}
          <Button type="submit" form="createBlockOutEventModalFormInternal" disabled={isSaving || isLoadingAircraft}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Block Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

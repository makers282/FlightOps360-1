
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
import type { CrewMember } from '@/ai/schemas/crew-member-schemas';
import { crewBlockOutReasons } from '@/ai/schemas/crew-block-out-schemas';
import { Textarea } from '@/components/ui/textarea';

const blockOutFormSchema = z.object({
  reason: z.enum(crewBlockOutReasons, { required_error: "A reason is required." }),
  notes: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
}).refine(data => data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

export type CrewBlockOutFormData = z.infer<typeof blockOutFormSchema>;

interface CreateCrewBlockOutModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: CrewBlockOutFormData) => Promise<void>;
  crewMember: CrewMember | null;
  initialDate?: Date;
}

export function CreateCrewBlockOutModal({
  isOpen,
  setIsOpen,
  onSave,
  crewMember,
  initialDate,
}: CreateCrewBlockOutModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [minStartDate, setMinStartDate] = useState<Date | null>(null);

  const form = useForm<CrewBlockOutFormData>({
    resolver: zodResolver(blockOutFormSchema),
    defaultValues: {
      reason: undefined,
      notes: '',
      startDate: initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
      endDate: initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
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
        reason: undefined,
        notes: '',
        startDate: initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
        endDate: initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
      });
    }
  }, [isOpen, initialDate, form]);

  const onSubmit: SubmitHandler<CrewBlockOutFormData> = async (data) => {
    setIsSaving(true);
    await onSave(data);
    setIsSaving(false);
  };

  if (!crewMember) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!isSaving) setIsOpen(open);}}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            Schedule Crew Block Out
          </DialogTitle>
          <DialogDescription>
            Block out {crewMember.firstName} {crewMember.lastName} for a specific period.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="createCrewBlockOutModalForm" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    name={field.name}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason for the block out" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {crewBlockOutReasons.map(reason => (
                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
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
                    <Textarea placeholder="Add any relevant notes..." {...field} />
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
                    <FormControl>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
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
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
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
                    <FormControl>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        
        <DialogFooter className="pt-4">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button type="submit" form="createCrewBlockOutModalForm" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Block Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


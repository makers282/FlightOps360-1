
"use client";

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form';
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
import { PropellerDetailSchema, type PropellerDetail } from '@/ai/schemas/fleet-aircraft-schemas';
import { PlusCircle, Save, Trash2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle as ModalCardTitle } from '@/components/ui/card'; // Renamed CardTitle to avoid conflict
import { cn } from "@/lib/utils";


const managePropellersFormSchema = z.object({
  propellers: z.array(PropellerDetailSchema),
});

type ManagePropellersFormData = z.infer<typeof managePropellersFormSchema>;

interface ManagePropellerDetailsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialPropellerDetails: PropellerDetail[];
  onSave: (updatedPropellerDetails: PropellerDetail[]) => void;
}

export function ManagePropellerDetailsModal({ isOpen, setIsOpen, initialPropellerDetails, onSave }: ManagePropellerDetailsModalProps) {
  
  const form = useForm<ManagePropellersFormData>({
    resolver: zodResolver(managePropellersFormSchema),
    defaultValues: {
      propellers: initialPropellerDetails || [],
    },
  });

  const { control, handleSubmit, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "propellers",
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({ propellers: initialPropellerDetails || [] });
    }
  }, [isOpen, initialPropellerDetails, reset]);

  const onSubmit: SubmitHandler<ManagePropellersFormData> = (data) => {
    onSave(data.propellers);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage Propeller Details</DialogTitle>
          <DialogDescription>
            Add, edit, or remove propeller model and serial number information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-5">
            <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                {fields.map((item, index) => (
                <Card key={item.id} className="p-4 border rounded-md shadow-sm bg-muted/30">
                    <CardHeader className="p-0 pb-3">
                        <div className="flex justify-between items-center">
                            <ModalCardTitle className="text-md">Propeller {index + 1}</ModalCardTitle>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove Propeller {index + 1}</span>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-3">
                    <FormField
                        control={control}
                        name={`propellers.${index}.model`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Propeller Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Hartzell Voyager" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`propellers.${index}.serialNumber`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Propeller Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., HC-12345" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </CardContent>
                </Card>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ model: '', serialNumber: '' })}
                    className="w-full"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Propeller
                </Button>
                
                <DialogFooter className="pt-6 border-t mt-6">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">
                        <Save className="mr-2 h-4 w-4" /> Save Propeller Details
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


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
import { EngineDetailSchema, type EngineDetail } from '@/ai/schemas/fleet-aircraft-schemas'; // Updated import path
import { PlusCircle, Save, Trash2, XCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const manageEnginesFormSchema = z.object({
  engines: z.array(EngineDetailSchema),
});

type ManageEnginesFormData = z.infer<typeof manageEnginesFormSchema>;

interface ManageEngineDetailsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialEngineDetails: EngineDetail[];
  onSave: (updatedEngineDetails: EngineDetail[]) => void;
}

export function ManageEngineDetailsModal({ isOpen, setIsOpen, initialEngineDetails, onSave }: ManageEngineDetailsModalProps) {
  
  const form = useForm<ManageEnginesFormData>({
    resolver: zodResolver(manageEnginesFormSchema),
    defaultValues: {
      engines: initialEngineDetails || [],
    },
  });

  const { control, handleSubmit, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "engines",
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({ engines: initialEngineDetails || [] });
    }
  }, [isOpen, initialEngineDetails, reset]);

  const onSubmit: SubmitHandler<ManageEnginesFormData> = (data) => {
    onSave(data.engines);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage Engine Details</DialogTitle>
          <DialogDescription>
            Add, edit, or remove engine model and serial number information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-5">
            <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                {fields.map((item, index) => (
                <Card key={item.id} className="p-4 border rounded-md shadow-sm bg-muted/30">
                    <CardHeader className="p-0 pb-3">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-md">Engine {index + 1}</CardTitle>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove Engine {index + 1}</span>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 space-y-3">
                    <FormField
                        control={control}
                        name={`engines.${index}.model`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Engine Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., PT6A-67D" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`engines.${index}.serialNumber`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Engine Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., PCE-123456" {...field} value={field.value || ''} />
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
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Engine
                </Button>
                
                <DialogFooter className="pt-6 border-t mt-6">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">
                        <Save className="mr-2 h-4 w-4" /> Save Engine Details
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Dummy Card components if not globally available or for isolation. 
// If you have Card, CardHeader, CardContent globally, these can be removed.
const Card = ({className, ...props}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("border bg-card text-card-foreground shadow-sm", className)} {...props} />;
const CardHeader = ({className, ...props}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
const CardTitle = ({className, ...props}: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
const CardContent = ({className, ...props}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-6 pt-0", className)} {...props} />;
const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' '); // Basic cn utility

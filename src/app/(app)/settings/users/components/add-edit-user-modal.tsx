
"use client";

import React, { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { type Role } from '@/ai/flows/manage-roles-flow';
import { type User } from '@/ai/flows/manage-users-flow';

const userFormSchema = z.object({
  displayName: z.string().min(1, "Name is required."),
  email: z.string().email("Invalid email address."),
  roles: z.array(z.string()).min(1, "At least one role must be selected."),
});

export type UserFormData = z.infer<typeof userFormSchema>;

interface AddEditUserModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: UserFormData, userId?: string) => Promise<void>;
  isSaving: boolean;
  isEditing: boolean;
  initialData?: User | null;
  roles: Role[];
  isLoadingRoles: boolean;
}

export function AddEditUserModal({ 
  isOpen, 
  setIsOpen, 
  onSave, 
  isSaving, 
  isEditing, 
  initialData, 
  roles, 
  isLoadingRoles 
}: AddEditUserModalProps) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      roles: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          displayName: initialData.displayName || '',
          email: initialData.email || '',
          roles: initialData.roles || [],
        });
      } else {
        form.reset({
          displayName: '',
          email: '',
          roles: [],
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<UserFormData> = async (formData) => {
    await onSave(formData, isEditing ? initialData?.uid : undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for this user.' : 'Enter the details for the new user. An invitation will be sent to their email address.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} disabled={isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={() => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  {isLoadingRoles ? <p>Loading roles...</p> : roles.map(role => (
                    <FormField
                      key={role.id}
                      control={form.control}
                      name="roles"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(role.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, role.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== role.id
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {role.name}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button form="user-form" type="submit" disabled={isSaving || isLoadingRoles}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

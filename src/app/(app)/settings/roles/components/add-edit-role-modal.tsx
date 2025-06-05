
"use client";

import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import type { Role, SaveRoleInput, Permission } from '@/ai/schemas/role-schemas';
import { availablePermissions } from '@/ai/schemas/role-schemas';

const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required."),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]), // Using string array for form handling, will map to Permission enum on save
  isSystemRole: z.boolean().optional().default(false),
});

export type RoleFormData = z.infer<typeof roleFormSchema>;

interface AddEditRoleModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: SaveRoleInput) => Promise<void>;
  initialData?: Role | null;
  isEditing?: boolean;
  isSaving: boolean;
}

export function AddEditRoleModal({
  isOpen,
  setIsOpen,
  onSave,
  initialData,
  isEditing,
  isSaving,
}: AddEditRoleModalProps) {
  
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
      isSystemRole: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        form.reset({
          name: initialData.name,
          description: initialData.description || '',
          permissions: initialData.permissions || [],
          isSystemRole: initialData.isSystemRole || false,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          permissions: [],
          isSystemRole: false,
        });
      }
    }
  }, [isOpen, isEditing, initialData, form]);

  const onSubmit: SubmitHandler<RoleFormData> = async (data) => {
    const dataToSave: SaveRoleInput = {
      ...data,
      id: isEditing && initialData ? initialData.id : undefined,
      // Ensure permissions are correctly typed as Permission[]
      permissions: data.permissions as Permission[], 
      isSystemRole: data.isSystemRole, // Pass the value from the form
    };
    await onSave(dataToSave);
  };

  const modalTitle = isEditing ? `Edit Role: ${initialData?.name || ''}` : 'Add New Role';
  const modalDescription = isEditing
    ? "Update the role's details and permissions."
    : "Define a new user role and assign permissions.";
  
  // Determine if the 'System Role' checkbox should be disabled
  // It's disabled if:
  // 1. We are editing an existing role that IS ALREADY a system role (to prevent unmarking it).
  const isSystemRoleCheckboxDisabled = !!(isEditing && initialData?.isSystemRole);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) setIsOpen(open); }}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {modalTitle}
          </DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="role-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Role Name</FormLabel>
                <FormControl><Input placeholder="e.g., Administrator, Flight Crew" {...field} disabled={initialData?.isSystemRole} /></FormControl>
                {initialData?.isSystemRole && <FormDescription className="text-xs">System role names cannot be changed.</FormDescription>}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl><Textarea placeholder="Briefly describe this role..." {...field} value={field.value || ''} rows={2} disabled={initialData?.isSystemRole && !form.getValues('isSystemRole')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormItem>
              <FormLabel>Permissions</FormLabel>
              <FormDescription className="text-xs mb-2">Select the permissions this role will have.</FormDescription>
              <ScrollArea className="h-60 rounded-md border p-3 bg-muted/30">
                <div className="space-y-2">
                  {availablePermissions.map((permission) => (
                    <FormField
                      key={permission}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-1.5 px-2 rounded hover:bg-background/70 transition-colors">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(permission)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), permission])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== permission
                                      )
                                    );
                              }}
                              disabled={initialData?.isSystemRole && (initialData?.permissions?.includes(permission) || false) && !form.getValues('isSystemRole')}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer flex-1">
                            {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </ScrollArea>
              <FormMessage>{form.formState.errors.permissions?.message}</FormMessage>
            </FormItem>

            <FormField control={form.control} name="isSystemRole" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-muted/20">
                <FormControl>
                    <Checkbox 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={isSystemRoleCheckboxDisabled}
                    />
                </FormControl>
                <div className="space-y-0.5">
                    <FormLabel className="text-sm font-normal">System Role</FormLabel>
                    <FormDescription className="text-xs">
                        {isSystemRoleCheckboxDisabled 
                            ? "This is a core system role and its system status cannot be changed here." 
                            : "System roles have special status and may have restricted editing capabilities."}
                    </FormDescription>
                </div>
              </FormItem>
            )} />
            
            {initialData?.isSystemRole && !form.getValues('isSystemRole') && (
                <p className="text-xs text-destructive-foreground bg-destructive/80 p-2 rounded-md">
                    Warning: You are attempting to modify a core system role. Some properties like name, description, and core permissions might be protected.
                </p>
            )}


          </form>
        </Form>
        
        <DialogFooter className="pt-4 border-t mt-2">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button 
            form="role-form" 
            type="submit" 
            disabled={isSaving || (initialData?.isSystemRole && !Object.keys(form.formState.dirtyFields).some(key => key === 'permissions' || key === 'isSystemRole') && initialData.isSystemRole === form.getValues('isSystemRole'))}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


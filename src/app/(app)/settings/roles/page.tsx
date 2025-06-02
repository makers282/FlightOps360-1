
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, ShieldCheck, PlusCircle, Edit3, Trash2, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { fetchRoles, saveRole, deleteRole } from '@/ai/flows/manage-roles-flow';
import type { Role, SaveRoleInput, Permission } from '@/ai/schemas/role-schemas';
import { availablePermissions } from '@/ai/schemas/role-schemas'; // Import availablePermissions for predefining
import { AddEditRoleModal } from './components/add-edit-role-modal';
import { useToast } from '@/hooks/use-toast';

const formatPermissionName = (permission: Permission | string) => {
  return permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const predefinedRoles: Omit<SaveRoleInput, 'id'>[] = [
  {
    name: "Administrator",
    description: "Full access to all system features and settings.",
    permissions: [...availablePermissions], // All defined permissions
    isSystemRole: true,
  },
  {
    name: "Flight Crew",
    description: "Access to flight schedules, aircraft status, and FRAT submission.",
    permissions: ["VIEW_TRIPS", "ACCESS_FRAT_PAGE", "ACCESS_DOCUMENTS_PAGE", "VIEW_DASHBOARD"],
    isSystemRole: true,
  },
  {
    name: "Dispatch",
    description: "Manages trip scheduling, flight releases, and optimal routing.",
    permissions: ["MANAGE_TRIPS", "VIEW_TRIPS", "ACCESS_OPTIMAL_ROUTE_PAGE", "VIEW_DASHBOARD"],
    isSystemRole: true,
  },
  {
    name: "Maintenance",
    description: "Tracks aircraft compliance and maintenance schedules.",
    permissions: ["MANAGE_AIRCRAFT_MAINTENANCE_DATA", "VIEW_DASHBOARD"],
    isSystemRole: true,
  },
  {
    name: "Sales",
    description: "Manages quotes and customer communication.",
    permissions: ["CREATE_QUOTES", "VIEW_ALL_QUOTES", "MANAGE_CUSTOMERS", "VIEW_DASHBOARD"],
    isSystemRole: true,
  },
  {
    name: "FAA Inspector",
    description: "Read-only access to compliance and operational data.",
    permissions: ["ACCESS_DOCUMENTS_PAGE", "VIEW_TRIPS", "VIEW_DASHBOARD"],
    isSystemRole: true,
  }
];


export default function UserRolesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentRoleForModal, setCurrentRoleForModal] = useState<Role | null>(null);
  const [isSavingRole, startSavingRoleTransition] = useTransition();
  
  const [isDeletingRole, startDeletingRoleTransition] = useTransition();
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const seedPredefinedRoles = async (existingRoles: Role[]) => {
    const rolesToCreate = predefinedRoles.filter(
      pRole => !existingRoles.some(eRole => eRole.name === pRole.name && eRole.isSystemRole)
    );

    if (rolesToCreate.length > 0) {
      toast({ title: "Initializing System Roles", description: `Creating ${rolesToCreate.length} predefined roles...` });
      try {
        for (const roleData of rolesToCreate) {
          await saveRole(roleData);
        }
        toast({ title: "System Roles Initialized", description: "Predefined roles have been added to Firestore.", variant: "default" });
        return true; // Indicate that roles were seeded
      } catch (error) {
        console.error("Failed to seed predefined roles:", error);
        toast({ title: "Error Seeding Roles", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        return false;
      }
    }
    return false; // No roles needed to be seeded
  };

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      let fetchedRoles = await fetchRoles();
      const wasSeeded = await seedPredefinedRoles(fetchedRoles);
      if (wasSeeded) {
        fetchedRoles = await fetchRoles(); // Re-fetch after seeding
      }
      setRolesList(fetchedRoles);
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast({ title: "Error Loading Roles", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleOpenAddModal = () => {
    setIsEditingModal(false);
    setCurrentRoleForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (role: Role) => {
    setIsEditingModal(true);
    setCurrentRoleForModal(role);
    setIsModalOpen(true);
  };

  const handleSaveRole = async (data: SaveRoleInput) => {
    startSavingRoleTransition(async () => {
      try {
        // For new roles, ensure isSystemRole is false unless specifically set by predefined logic (which it isn't here)
        const dataToSave = isEditingModal ? data : { ...data, isSystemRole: data.isSystemRole || false };
        const savedData = await saveRole(dataToSave);
        toast({
          title: isEditingModal ? "Role Updated" : "Role Added",
          description: `Role "${savedData.name}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadRoles(); 
      } catch (error) {
        console.error("Failed to save role:", error);
        toast({
          title: "Error Saving Role",
          description: (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteClick = (role: Role) => {
    if (role.isSystemRole) {
        toast({ title: "Action Not Allowed", description: "System roles cannot be deleted.", variant: "destructive" });
        return;
    }
    setRoleToDelete(role);
    setShowDeleteConfirm(true);
  };

  const executeDeleteRole = async () => {
    if (!roleToDelete) return;
    if (roleToDelete.isSystemRole) { // Double check here, though button should be disabled
        toast({ title: "Action Not Allowed", description: "System roles cannot be deleted.", variant: "destructive" });
        setShowDeleteConfirm(false);
        return;
    }
    startDeletingRoleTransition(async () => {
      try {
        await deleteRole({ roleId: roleToDelete.id });
        toast({ title: "Role Deleted", description: `Role "${roleToDelete.name}" has been removed.` });
        setShowDeleteConfirm(false);
        setRoleToDelete(null);
        await loadRoles(); 
      } catch (error) {
        console.error("Failed to delete role:", error);
        toast({ title: "Error Deleting Role", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setRoleToDelete(null);
      }
    });
  };

  const filteredRoles = rolesList.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <TooltipProvider>
      <PageHeader 
        title="User Roles &amp; Permissions" 
        description="Define and manage user roles and their access levels across the platform."
        icon={Users}
        actions={
          <Button onClick={handleOpenAddModal} disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Manage Roles</CardTitle>
          <CardDescription>Assign permissions to roles to control access to SkyBase features.</CardDescription>
           <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search roles (name, description)..." 
              className="pl-8 w-full sm:w-1/2 lg:w-1/3" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading || rolesList.length === 0 && !searchTerm}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading roles from Firestore...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Key Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                      No roles found{rolesList.length > 0 && searchTerm ? " matching your search" : ". Add a role to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <ShieldCheck className={`h-5 w-5 ${role.isSystemRole ? 'text-blue-500' : 'text-primary'}`} /> 
                        {role.name}
                        {role.isSystemRole && <Badge variant="secondary" className="text-xs">System Role</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{role.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(role.permissions || []).slice(0,3).map(permission => (
                            <Badge key={permission} variant="outline" className="text-xs">{formatPermissionName(permission)}</Badge>
                          ))}
                          {(role.permissions || []).length > 3 && <Badge variant="outline" className="text-xs">+{ (role.permissions || []).length - 3} more</Badge>}
                          {(role.permissions || []).length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-1" onClick={() => handleOpenEditModal(role)}>
                              <Edit3 className="h-4 w-4" />
                              <span className="sr-only">Edit Role</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Role</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive" 
                                onClick={() => handleDeleteClick(role)} 
                                disabled={isDeletingRole && roleToDelete?.id === role.id || role.isSystemRole}
                              >
                                {isDeletingRole && roleToDelete?.id === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Delete Role</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{role.isSystemRole ? "System roles cannot be deleted" : "Delete Role"}</p></TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditRoleModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveRole}
        initialData={currentRoleForModal}
        isEditing={isEditingModal}
        isSaving={isSavingRole}
      />

      {showDeleteConfirm && roleToDelete && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the role "{roleToDelete.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingRole}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={executeDeleteRole} disabled={isDeletingRole}>
                {isDeletingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </TooltipProvider>
  );
}


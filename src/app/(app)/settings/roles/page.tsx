
"use client";

import React, { useState, useEffect, useTransition, useMemo } from 'react';
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
import { fetchUsers } from '@/ai/flows/manage-users-flow';
import type { Role, SaveRoleInput, Permission } from '@/ai/schemas/role-schemas';
import type { User } from '@/ai/flows/manage-users-flow';
import { availablePermissions } from '@/ai/schemas/role-schemas';
import { AddEditRoleModal } from './components/add-edit-role-modal';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';

const formatPermissionName = (permission: Permission | string) => {
  return permission.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase());
};

const predefinedRoles: SaveRoleInput[] = [
  {
    name: "Administrator",
    description: "Full access to all system features and settings.",
    permissions: [...availablePermissions] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Flight Crew",
    description: "Access to flight schedules, aircraft status, and FRAT submission.",
    permissions: ["VIEW_TRIPS", "ACCESS_FRAT_PAGE", "ACCESS_DOCUMENTS_PAGE", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Dispatch",
    description: "Manages trip scheduling, flight releases, and optimal routing.",
    permissions: ["MANAGE_TRIPS", "VIEW_TRIPS", "ACCESS_OPTIMAL_ROUTE_PAGE", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Maintenance",
    description: "Tracks aircraft compliance and maintenance schedules.",
    permissions: ["MANAGE_AIRCRAFT_MAINTENANCE_DATA", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Sales",
    description: "Manages quotes and customer communication.",
    permissions: ["CREATE_QUOTES", "VIEW_ALL_QUOTES", "MANAGE_CUSTOMERS", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "FAA Inspector",
    description: "Read-only access to compliance and operational data.",
    permissions: ["ACCESS_DOCUMENTS_PAGE", "VIEW_TRIPS", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  }
].sort((a, b) => { 
    const order = ["Administrator", "Flight Crew", "Dispatch", "Maintenance", "Sales", "FAA Inspector"];
    return order.indexOf(a.name!) - order.indexOf(b.name!);
});


export default function UserRolesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [currentRoleForModal, setCurrentRoleForModal] = useState<Role | null>(null);
  const [isSavingRole, startSavingRoleTransition] = useTransition();
  
  const [isDeletingRole, startDeletingRoleTransition] = useTransition();
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        setIsUserAdmin(idTokenResult.claims.roles?.includes('Administrator'));
      }
    };
    checkAdminStatus();
  }, []);

  const seedPredefinedRoles = async (existingRoles: Role[]) => {
    const rolesToCreate = predefinedRoles.filter(
      pRole => !existingRoles.some(eRole => eRole.name === pRole.name && eRole.isSystemRole)
    );

    if (rolesToCreate.length > 0) {
      toast({ title: "Initializing System Roles", description: `Creating ${rolesToCreate.length} predefined roles...` });
      try {
        for (const roleData of rolesToCreate) {
          await saveRole({ ...roleData, permissions: roleData.permissions as Permission[] });
        }
        toast({ title: "System Roles Initialized", description: "Predefined roles have been added to Firestore.", variant: "default" });
        return true; 
      } catch (error) {
        console.error("Failed to seed predefined roles:", error);
        toast({ title: "Error Seeding Roles", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        return false;
      }
    }
    return false; 
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      let [fetchedRoles, fetchedUsers] = await Promise.all([fetchRoles(), fetchUsers()]);
      const wasSeeded = await seedPredefinedRoles(fetchedRoles);
      if (wasSeeded) {
        fetchedRoles = await fetchRoles(); 
      }
      setRolesList(fetchedRoles);
      setUsersList(fetchedUsers);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
        const dataToSave = isEditingModal ? data : { ...data, isSystemRole: data.isSystemRole || false };
        const savedData = await saveRole(dataToSave);
        toast({
          title: isEditingModal ? "Role Updated" : "Role Added",
          description: `Role "${savedData.name}" has been successfully ${isEditingModal ? 'updated' : 'saved'}.`,
        });
        setIsModalOpen(false);
        await loadData(); 
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
    if (role.isSystemRole && !isUserAdmin) {
        toast({ title: "Action Not Allowed", description: "System roles cannot be deleted.", variant: "destructive" });
        return;
    }
    setRoleToDelete(role);
    setShowDeleteConfirm(true);
  };

  const executeDeleteRole = async () => {
    if (!roleToDelete) return;
    if (roleToDelete.isSystemRole && !isUserAdmin) { 
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
        await loadData(); 
      } catch (error) {
        console.error("Failed to delete role:", error);
        toast({ title: "Error Deleting Role", description: (error instanceof Error ? error.message : "Unknown error"), variant: "destructive" });
        setShowDeleteConfirm(false);
        setRoleToDelete(null);
      }
    });
  };

  const roleUserCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rolesList.forEach(role => counts.set(role.id, 0));
    usersList.forEach(user => {
      user.roles?.forEach(roleId => {
        counts.set(roleId, (counts.get(roleId) || 0) + 1);
      });
    });
    return counts;
  }, [rolesList, usersList]);

  const sortedAndFilteredRoles = useMemo(() => {
    let sortedList = [...rolesList].sort((a, b) => {
      if (a.name === "Administrator" && a.isSystemRole) return -1;
      if (b.name === "Administrator" && b.isSystemRole) return 1;
      if (a.isSystemRole && !b.isSystemRole) return -1;
      if (!a.isSystemRole && b.isSystemRole) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    if (!searchTerm) return sortedList;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedList.filter(role =>
      role.name.toLowerCase().includes(lowerSearchTerm) ||
      (role.description && role.description.toLowerCase().includes(lowerSearchTerm))
    );
  }, [rolesList, searchTerm]);

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
          <CardDescription>
            Assign permissions to roles to control access to SkyBase features.
          </CardDescription>
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
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No roles found{rolesList.length > 0 && searchTerm ? " matching your search" : ". Add a role to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAndFilteredRoles.map((role) => (
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
                      <TableCell className="text-center text-sm font-medium">
                        {roleUserCounts.get(role.id) || 0}
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
                                disabled={isDeletingRole && roleToDelete?.id === role.id || (role.isSystemRole && !isUserAdmin)}
                              >
                                {isDeletingRole && roleToDelete?.id === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Delete Role</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{(role.isSystemRole && !isUserAdmin) ? "System roles cannot be deleted" : "Delete Role"}</p></TooltipContent>
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
        isUserAdmin={isUserAdmin}
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

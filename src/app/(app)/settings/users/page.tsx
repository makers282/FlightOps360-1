
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { PageHeader } from '@/components/page-header';
import { Users as UsersIcon, Loader2, Edit, Trash2, RefreshCw, MoreVertical } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, type User } from '@/ai/flows/manage-users-flow';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddEditUserModal, type UserFormData } from './components/add-edit-user-modal';
import { useToast } from '@/hooks/use-toast';
import { fetchRoles, type Role } from '@/ai/flows/manage-roles-flow';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showDisabled, setShowDisabled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, startSavingTransition] = useTransition();
  const [isTogglingStatus, startToggleStatusTransition] = useTransition();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userList, roleList] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(userList);
      setRoles(roleList);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaryData = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(user => !user.disabled).length;
    const disabledUsers = totalUsers - activeUsers;
    return { totalUsers, activeUsers, disabledUsers, pendingInvites: 0 }; // Set pending invites to 0 for now
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const searchMatch = searchTerm.length > 0 ?
          (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())) : true;
        
        const disabledMatch = showDisabled ? true : !user.disabled;
        
        const roleMatch = roleFilter === 'All' ? true : user.roles?.includes(roleFilter);

        return searchMatch && disabledMatch && roleMatch;
      })
      .sort((a, b) => {
        if (a.disabled && !b.disabled) return -1;
        if (!a.disabled && b.disabled) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
  }, [users, searchTerm, showDisabled, roleFilter]);

  const getInitials = (name: string | undefined) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleOpenNewUserModal = () => {
    setIsEditing(false);
    setCurrentUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditUserModal = (user: User) => {
    setIsEditing(true);
    setCurrentUser(user);
    setIsModalOpen(true);
  };
  
  const handleSaveUser = async (data: UserFormData, userId?: string) => {
    startSavingTransition(async () => {
      try {
          if (isEditing && userId) {
              await updateUser({ ...data, uid: userId, roles: data.roles });
              toast({ title: 'User Updated', description: 'The user has been updated successfully.' });
          } else {
              await createUser({ ...data, roles: data.roles });
              toast({ title: 'User Created', description: 'The new user has been created successfully.' });
          }
          setIsModalOpen(false);
          await loadData();
      } catch (error) {
        console.error('Failed to save user:', error);
        toast({ title: 'Error', description: 'Failed to save user.', variant: 'destructive' });
      }
    });
  };

  const handleToggleUserStatus = async (user: User) => {
    startToggleStatusTransition(async () => {
        try {
            await updateUser({ uid: user.uid, disabled: !user.disabled });
            toast({ title: `User ${!user.disabled ? 'Disabled' : 'Enabled'}`, description: `${user.displayName} has been updated.` });
            await loadData();
        } catch (error) {
            console.error('Failed to toggle user status:', error);
            toast({ title: 'Error', description: 'Failed to update user status.', variant: 'destructive' });
        }
    });
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.uid);
      toast({ title: 'User Deleted', description: 'The user has been deleted successfully.' });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({ title: 'Error', description: 'Failed to delete user.', variant: 'destructive' });
    }
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : roleId;
  };

  return (
    <div>
      <PageHeader
        title="Users Management"
        description="Manage user accounts and permissions."
        icon={UsersIcon}
        actions={<Button onClick={handleOpenNewUserModal}>+ New User</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disabled Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.disabledUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <UsersIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.pendingInvites}</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <div className="flex items-center space-x-4">
                  <Input 
                      placeholder="Search by name or email..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                  />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Role Filter" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Roles</SelectItem>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                      <Switch 
                          id="show-disabled" 
                          checked={showDisabled}
                          onCheckedChange={setShowDisabled}
                      />
                      <Label htmlFor="show-disabled">Show Disabled</Label>
                  </div>
                  <Button variant="ghost" onClick={() => { setSearchTerm(''); setRoleFilter('All'); setShowDisabled(false); }}>Clear Filters</Button>
              </div>
          </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading users...</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers.map((user) => (
                    <TableRow key={user.uid} className={user.disabled ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={(user as any).photoURL} />
                              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <span>{user.displayName || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map(roleId => (
                              <Badge key={roleId} variant="outline">{getRoleName(roleId)}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.disabled ? 'secondary' : 'default'} className={user.disabled ? "text-white bg-red-600" : "text-white bg-green-600"}>{user.disabled ? 'Disabled' : 'Active'}</Badge>
                        </TableCell>
                        <TableCell>
                          2 hours ago
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => loadData()} disabled={isTogglingStatus}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                <span>Refresh</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEditUserModal(user)} disabled={isTogglingStatus}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleUserStatus(user)} disabled={isTogglingStatus}>
                                {user.disabled ? (
                                  <>
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isTogglingStatus && 'animate-spin'}`} />
                                    <span>Enable</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isTogglingStatus && 'animate-spin'}`} />
                                    <span>Disable</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setUserToDelete(user); setShowDeleteConfirm(true);}} disabled={isTogglingStatus}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      <AddEditUserModal 
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSave={handleSaveUser}
        isSaving={isSaving}
        isEditing={isEditing}
        initialData={currentUser}
        roles={roles}
        isLoadingRoles={isLoading}
      />
       <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the user "{userToDelete?.displayName}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDeleteUser}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

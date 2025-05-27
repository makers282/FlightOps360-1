import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, ShieldCheck, PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const roles = [
  { id: '1', name: 'Administrator', description: 'Full access to all system features and settings.', userCount: 2, permissions: ['Manage Users', 'System Settings', 'Billing'] },
  { id: '2', name: 'Flight Crew', description: 'Access to flight schedules, aircraft status, and FRAT submission.', userCount: 15, permissions: ['View Schedule', 'Submit FRAT', 'Access Documents'] },
  { id: '3', name: 'Dispatch', description: 'Manages trip scheduling, flight releases, and optimal routing.', userCount: 5, permissions: ['Schedule Trips', 'Release Flights', 'Use Optimal Route Tool'] },
  { id: '4', name: 'Maintenance', description: 'Tracks aircraft compliance and maintenance schedules.', userCount: 3, permissions: ['Log Maintenance', 'Forecast Maintenance', 'View Aircraft Status'] },
  { id: '5', name: 'Sales', description: 'Manages quotes and customer communication.', userCount: 4, permissions: ['Create Quotes', 'View Customer Data'] },
  { id: '6', name: 'FAA Inspector', description: 'Read-only access to compliance and operational data.', userCount: 1, permissions: ['View Compliance Docs', 'View Flight Logs'] },
];


export default function UserRolesPage() {
  return (
    <>
      <PageHeader 
        title="User Roles & Permissions" 
        description="Define and manage user roles and their access levels across the platform."
        icon={Users}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Manage Roles</CardTitle>
          <CardDescription>Assign permissions to roles to control access to SkyBase features.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead>Key Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> {role.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{role.description}</TableCell>
                  <TableCell className="text-center">{role.userCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0,3).map(permission => (
                        <Badge key={permission} variant="secondary">{permission}</Badge>
                      ))}
                       {role.permissions.length > 3 && <Badge variant="outline">+{role.permissions.length - 3} more</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-1">
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit Role</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Role</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {roles.length === 0 && (
            <div className="text-center py-10 col-span-full">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No roles defined</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new user role.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

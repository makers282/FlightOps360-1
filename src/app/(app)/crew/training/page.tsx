
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, PlusCircle, Edit3, Trash2, Search, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const trainingRecords = [
  { id: 'TRN001', crewMember: 'Capt. Ava Williams', avatarUrl: 'https://placehold.co/40x40.png', dataAiHint: 'pilot portrait', courseName: 'Recurrent Training - CJ3', status: 'Completed', completionDate: '2024-06-15', expiryDate: '2025-06-15', notes: 'Passed with high marks.' },
  { id: 'TRN002', crewMember: 'FO Ben Carter', avatarUrl: 'https://placehold.co/40x40.png', dataAiHint: 'copilot portrait', courseName: 'CRM Refresher', status: 'Scheduled', completionDate: 'N/A', expiryDate: '2024-09-30', notes: 'Mandatory attendance.' },
  { id: 'TRN003', crewMember: 'FA Chloe Davis', avatarUrl: 'https://placehold.co/40x40.png', dataAiHint: 'attendant portrait', courseName: 'Emergency Procedures', status: 'Due', completionDate: 'N/A', expiryDate: '2024-08-20', notes: 'Critical for upcoming flights.' },
  { id: 'TRN004', crewMember: 'Capt. John Smith', avatarUrl: 'https://placehold.co/40x40.png', dataAiHint: 'pilot serious', courseName: 'International Procedures', status: 'Completed', completionDate: '2024-03-01', expiryDate: '2025-03-01', notes: '' },
];

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'completed': return 'default'; // Greenish or success
    case 'scheduled': return 'secondary'; // Blueish or informational
    case 'due': return 'destructive'; // Reddish or warning
    default: return 'outline';
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'scheduled': return <CalendarClock className="h-4 w-4 text-blue-500" />;
    case 'due': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <GraduationCap className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function CrewTrainingPage() {
  return (
    <>
      <PageHeader 
        title="Crew Training Records" 
        description="Manage and track all crew training, qualifications, and recurrency."
        icon={GraduationCap}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Training Record
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Training Records</CardTitle>
          <CardDescription>Monitor training status and upcoming expiry dates.</CardDescription>
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search training records..." className="pl-8 w-full sm:w-1/3" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crew Member</TableHead>
                <TableHead>Course Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completion Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={record.avatarUrl} alt={record.crewMember} data-ai-hint={record.dataAiHint} />
                        <AvatarFallback>{record.crewMember.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      {record.crewMember}
                    </div>
                  </TableCell>
                  <TableCell>{record.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(record.status)} className="flex items-center gap-1">
                      {getStatusIcon(record.status)}
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.completionDate}</TableCell>
                  <TableCell>{record.expiryDate}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-1">
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit Record</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Record</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {trainingRecords.length === 0 && (
            <div className="text-center py-10">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No training records found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new training record.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

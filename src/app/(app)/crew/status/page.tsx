
import React from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react'; // Using Users icon for crew status page

const crewData = [
  { id: 'CRW001', name: 'Capt. Ava Williams', role: 'Pilot', status: 'On Duty', assignment: 'FL123 (KMIA)', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'pilot portrait female' },
  { id: 'CRW002', name: 'FO Ben Carter', role: 'First Officer', status: 'Standby', assignment: 'KHPN Base', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'copilot portrait male' },
  { id: 'CRW003', name: 'FA Chloe Davis', role: 'Flight Attendant', status: 'Off Duty', assignment: '-', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'attendant portrait female' },
  { id: 'CRW004', name: 'Eng. Mike Brown', role: 'Engineer', status: 'Maintenance', assignment: 'N789EF Hangar 3', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'engineer man serious' },
  { id: 'CRW005', name: 'Capt. John Smith', role: 'Pilot', status: 'Available', assignment: 'KTEB Base', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'pilot portrait male' },
  { id: 'CRW006', name: 'FA Olivia Green', role: 'Flight Attendant', status: 'On Duty', assignment: 'FL456 (KORD)', avatarUrl: 'https://placehold.co/100x100.png', dataAiHint: 'attendant portrait professional' },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
    case 'off duty':
      return 'default'; // Greenish or neutral
    case 'on duty':
    case 'en route': // for pilots if different from on duty
      return 'secondary'; // Blueish or active
    case 'standby':
      return 'outline'; // Yellowish or warning
    case 'maintenance': // for engineers
       return 'destructive'; // Reddish for unavailable/issue
    default:
      return 'default';
  }
};

export default function CrewStatusPage() {
  return (
    <>
      <PageHeader 
        title="Crew Status" 
        description="View current status and assignments of all crew members."
        icon={Users}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Crew Members</CardTitle>
          <CardDescription>Monitor availability and assignments in real-time.</CardDescription>
        </CardHeader>
        <CardContent>
          {crewData.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No Crew Data</h3>
              <p className="mt-1 text-sm text-muted-foreground">No crew members found in the system.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {crewData.map((crew) => (
                <Card key={crew.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Avatar className="h-20 w-20 mb-3">
                      <AvatarImage src={crew.avatarUrl} alt={crew.name} data-ai-hint={crew.dataAiHint} />
                      <AvatarFallback>{crew.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-lg">{crew.name}</p>
                    <p className="text-sm text-muted-foreground">{crew.role}</p>
                    <Badge variant={getStatusBadgeVariant(crew.status)} className="mt-2 capitalize">{crew.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {crew.assignment !== '-' ? `Assignment: ${crew.assignment}` : 'No current assignment'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}


"use client";

import React, { useState, useMemo, useEffect } from 'react'; // Added useEffect
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Search, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Mock data similar to dashboard for consistency
const mockTripData = [
  { id: 'TRP-001', origin: 'KHPN', destination: 'KMIA', aircraft: 'N123AB', status: 'Scheduled', departure: '2024-08-15T10:00:00Z' },
  { id: 'TRP-002', origin: 'KTEB', destination: 'KSDL', aircraft: 'N456CD', status: 'En Route', departure: '2024-08-14T14:30:00Z' },
  { id: 'TRP-004', origin: 'KDAL', destination: 'KAPA', aircraft: 'N123AB', status: 'Awaiting Closeout', departure: '2024-08-15T18:00:00Z' },
  { id: 'TRP-003', origin: 'KLAX', destination: 'KLAS', aircraft: 'N789EF', status: 'Completed', departure: '2024-08-13T09:00:00Z' },
  { id: 'TRP-005', title: 'N520PW Challenger 300', aircraft: 'N520PW', origin: 'KVNY', destination: 'TXKF', status: 'Scheduled', departure: '2024-10-02T08:00:00Z' },
  { id: 'TRP-006', title: 'N123MW Gulfstream-G500', aircraft: 'N123MW', origin: 'KSFO', destination: 'KLAS', status: 'Completed', departure: '2024-10-02T10:00:00Z'},
  { id: 'TRP-007', title: 'N555VP Gulfstream-G650', aircraft: 'N555VP', origin: 'LFPB', destination: 'LKPR', status: 'En Route', departure: '2024-10-08T11:00:00Z'},
  { id: 'TRP-008', title: 'N345AG Gulfstream-4', aircraft: 'N345AG', origin: 'KDAL', destination: 'KOPF', status: 'Awaiting Closeout', departure: '2024-10-09T10:00:00Z'},
];

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'available':
      return 'default';
    case 'en route':
    case 'on duty':
      return 'secondary';
    case 'scheduled':
    case 'awaiting closeout':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
  }
};

export default function TripListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredTrips = useMemo(() => {
    if (!searchTerm) return mockTripData;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return mockTripData.filter(trip => 
      trip.id.toLowerCase().includes(lowerSearchTerm) ||
      trip.origin.toLowerCase().includes(lowerSearchTerm) ||
      trip.destination.toLowerCase().includes(lowerSearchTerm) ||
      trip.aircraft.toLowerCase().includes(lowerSearchTerm) ||
      trip.status.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MM/dd/yyyy HH:mm zz');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <>
      <PageHeader
        title="Trip List View"
        description="View all trips in a filterable and sortable list format."
        icon={ListChecks}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Trips</CardTitle>
          <CardDescription>Browse and manage all scheduled and completed trips.</CardDescription>
          <div className="mt-4 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search trips (ID, route, aircraft, status)..." 
              className="pl-8 w-full md:w-1/2 lg:w-1/3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Aircraft</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No trips found{searchTerm ? " matching your search" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.id}</TableCell>
                    <TableCell>{trip.origin} &rarr; {trip.destination}</TableCell>
                    <TableCell>{trip.aircraft}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(trip.status)}>{trip.status}</Badge>
                    </TableCell>
                    <TableCell>{isMounted ? formatDate(trip.departure) : "Loading..."}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/trips/details/${trip.id}`}> 
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

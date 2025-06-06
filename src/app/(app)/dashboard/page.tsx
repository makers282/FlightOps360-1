
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, Plane, CalendarDays, LayoutDashboard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow'; // Keep for aircraft labels in trips

// Removed complex status-related imports and types

export default function DashboardPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [isBulletinAccordionOpen, setIsBulletinAccordionOpen] = useState(true);


  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  
  const [fleetForLabels, setFleetForLabels] = useState<FleetAircraft[]>([]); // For aircraft labels
  const [isLoadingFleetForLabels, setIsLoadingFleetForLabels] = useState(true);

  const { toast } = useToast();

  const getBulletinTypeBadgeVariant = (type: BulletinType): "default" | "destructive" | "secondary" => {
    switch (type) {
      case 'Urgent': return 'destructive';
      case 'Important': return 'secondary';
      default: return 'default';
    }
  };

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    setIsBulletinModalOpen(true);
  };

  const loadInitialDashboardData = useCallback(async () => {
    setIsLoadingBulletins(true);
    setIsLoadingTrips(true);
    setIsLoadingFleetForLabels(true);

    try {
      const [fetchedBulletins, fetchedTrips, fetchedFleet] = await Promise.all([
        fetchBulletins(),
        fetchTrips(),
        fetchFleetAircraft(), // Fetch fleet for aircraft labels
      ]);

      const activeAndSortedBulletins = fetchedBulletins
        .filter(b => b.isActive)
        .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime());
      setBulletins(activeAndSortedBulletins);
      
      setFleetForLabels(fetchedFleet); // Store the fetched fleet

      const now = new Date();
      // Use the fetchedFleet to add aircraftLabel to trips
      const sortedUpcomingTrips = fetchedTrips
        .filter(trip => trip.legs?.[0]?.departureDateTime && parseISO(trip.legs[0].departureDateTime) >= now)
        .map(trip => {
          const aircraftInfo = fetchedFleet.find(ac => ac.id === trip.aircraftId);
          return {
            ...trip,
            aircraftLabel: aircraftInfo ? `${aircraftInfo.tailNumber} - ${aircraftInfo.model}` : trip.aircraftLabel || trip.aircraftId,
          };
        })
        .sort((a, b) => parseISO(a.legs![0].departureDateTime!).getTime() - parseISO(b.legs![0].departureDateTime!).getTime())
        .slice(0, 5);
      setUpcomingTrips(sortedUpcomingTrips);

    } catch (error) {
      console.error("Failed to load initial dashboard data:", error);
      toast({ title: "Error Loading Dashboard Data", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
    } finally {
      setIsLoadingBulletins(false);
      setIsLoadingTrips(false);
      setIsLoadingFleetForLabels(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialDashboardData();
  }, [loadInitialDashboardData]);

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of flight operations." icon={LayoutDashboard} />
      
      {/* Row 1: Company Bulletin Board - Full Width */}
      <Card className="mb-6 shadow-md border-primary/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Company Bulletin Board</CardTitle>
              {!isLoadingBulletins && bulletins.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{bulletins.length}</Badge>
              )}
            </div>
          </div>
          <CardDescription className="mt-1">Latest news and announcements from Firestore.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion
            type="single"
            collapsible
            value={isBulletinAccordionOpen ? "bulletin-item" : ""}
            onValueChange={(value) => setIsBulletinAccordionOpen(value === "bulletin-item")}
            className="w-full"
          >
            <AccordionItem value="bulletin-item" className="border-none">
              <AccordionTrigger className="text-sm hover:no-underline py-2 px-1 [&[data-state=open]>svg]:rotate-180">
                View {isLoadingBulletins ? '...' : bulletins.length} Bulletin(s)
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {isLoadingBulletins ? (
                  <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading bulletins...</p></div>
                ) : bulletins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No active company bulletins.</p>
                ) : (
                  <List>
                    {bulletins.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <ListItem
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                          onClick={() => handleBulletinClick(item)} role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBulletinClick(item);}}
                        >
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-semibold">{item.title}
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                - {item.publishedAt && isValid(parseISO(item.publishedAt)) ? format(parseISO(item.publishedAt), 'MMM d, yy HH:mm') : 'N/A'}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-prose">{item.message}</p>
                          </div>
                          <Badge variant={getBulletinTypeBadgeVariant(item.type)} className="capitalize">{item.type}</Badge>
                        </ListItem>
                        {index < bulletins.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Row 2: Upcoming Trips Card - Full Width */}
      <Card className="mb-6 shadow-md">
        <CardHeader>
           <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Upcoming Trips</CardTitle>
            </div>
          <CardDescription>Next 5 scheduled trips from Firestore.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrips || isLoadingFleetForLabels ? (
            <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading trips...</p></div>
          ) : upcomingTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No upcoming trips.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Trip ID</TableHead><TableHead>Client</TableHead><TableHead>Route</TableHead><TableHead>Aircraft</TableHead><TableHead>Departure</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcomingTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell><Link href={`/trips/details/${trip.id}`} className="text-primary hover:underline">{trip.tripId}</Link></TableCell>
                    <TableCell>{trip.clientName}</TableCell>
                    <TableCell>{trip.legs?.[0]?.origin} - {trip.legs?.[trip.legs.length -1]?.destination}</TableCell>
                    <TableCell>{trip.aircraftLabel}</TableCell> 
                    <TableCell>{trip.legs?.[0]?.departureDateTime && isValid(parseISO(trip.legs[0].departureDateTime)) ? format(parseISO(trip.legs[0].departureDateTime), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Aircraft Status & System Alerts - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md"> {/* Aircraft Status takes 2/3 width on lg */}
          <CardHeader>
            <div className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /><CardTitle>Aircraft Status Overview</CardTitle></div>
            <CardDescription>Simplified aircraft operational readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFleetForLabels ? (
                <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading aircraft...</p></div>
            ) : fleetForLabels.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-3">No aircraft in fleet to display status for.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Tail #</TableHead><TableHead>Model</TableHead><TableHead>Base</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fleetForLabels.filter(ac => ac.isMaintenanceTracked).slice(0, 5).map(ac => ( // Display first 5 tracked aircraft
                    <TableRow key={ac.id}>
                      <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="text-primary hover:underline">{ac.tailNumber}</Link></TableCell>
                      <TableCell>{ac.model}</TableCell>
                      <TableCell>{ac.baseLocation || 'N/A'}</TableCell>
                      {/* Reverted to a simple "Active" placeholder as per request to simplify */}
                      <TableCell><Badge variant="default">Active</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {fleetForLabels.filter(ac => ac.isMaintenanceTracked).length > 5 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 5 tracked aircraft. More on currency page.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md"> {/* System Alerts takes 1/3 width on lg */}
          <CardHeader>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Active System Alerts</CardTitle></div>
            <CardDescription>Important system notifications.</CardDescription>
          </CardHeader>
          <CardContent>
             {/* Reverted to static placeholder as per request */}
             <p className="text-sm text-muted-foreground text-center py-3">No critical system alerts at this time.</p>
          </CardContent>
        </Card>
      </div>

      {selectedBulletin && (
        <AlertDialog open={isBulletinModalOpen} onOpenChange={setIsBulletinModalOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Badge variant={getBulletinTypeBadgeVariant(selectedBulletin.type)} className="capitalize text-xs mr-2">{selectedBulletin.type}</Badge>
                {selectedBulletin.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Published: {selectedBulletin.publishedAt && isValid(parseISO(selectedBulletin.publishedAt)) ? format(parseISO(selectedBulletin.publishedAt), 'PPP HH:mm') : 'N/A'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] mt-2"><div className="whitespace-pre-wrap p-1 text-sm">{selectedBulletin.message}</div></ScrollArea>
            <AlertDialogFooter className="mt-4"><AlertDialogCancel onClick={() => setIsBulletinModalOpen(false)}>Close</AlertDialogCancel></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

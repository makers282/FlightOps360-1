
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, ListItem } from '@/components/ui/list';
import { Megaphone, Loader2, AlertTriangle, Plane, CalendarDays, LayoutDashboard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
// Accordion imports are no longer needed for the bulletin board, but might be used by other cards if they were restored.
// For now, assume they are not used by other parts of this simplified version.
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';

import { fetchBulletins, type Bulletin, type BulletinType } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';

// Simplified status for dashboard display
interface SimplifiedAircraftStatus {
  label: "Active" | "Maintenance" | "Info";
  variant: "default" | "secondary" | "destructive" | "outline";
  details?: string;
}

export default function DashboardPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoadingBulletins, setIsLoadingBulletins] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);

  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  
  const [fleetList, setFleetList] = useState<FleetAircraft[]>([]); // For aircraft status and labels
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);

  // This state will hold the simplified status for each aircraft on the dashboard.
  const [aircraftDashboardStatus, setAircraftDashboardStatus] = useState<Map<string, SimplifiedAircraftStatus>>(new Map());
  const [isLoadingAircraftStatus, setIsLoadingAircraftStatus] = useState(true);
  
  // Placeholder for dynamic system alerts. Will be populated based on critical aircraft statuses or other events.
  const [activeSystemAlerts, setActiveSystemAlerts] = useState<any[]>([]); // Replace 'any' with a proper SystemAlert type later

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
    setIsLoadingFleet(true);
    setIsLoadingAircraftStatus(true); // Start loading for aircraft status
    setActiveSystemAlerts([]); // Clear previous alerts

    try {
      const [fetchedBulletins, fetchedTrips, fetchedFleetList] = await Promise.all([
        fetchBulletins(),
        fetchTrips(),
        fetchFleetAircraft(),
      ]);

      const activeAndSortedBulletins = fetchedBulletins
        .filter(b => b.isActive)
        .sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime());
      setBulletins(activeAndSortedBulletins);
      
      setFleetList(fetchedFleetList);

      const now = new Date();
      const sortedUpcomingTrips = fetchedTrips
        .filter(trip => trip.legs?.[0]?.departureDateTime && parseISO(trip.legs[0].departureDateTime) >= now)
        .map(trip => {
          const aircraftInfo = fetchedFleetList.find(ac => ac.id === trip.aircraftId);
          return {
            ...trip,
            aircraftLabel: aircraftInfo ? `${aircraftInfo.tailNumber} - ${aircraftInfo.model}` : trip.aircraftLabel || trip.aircraftId,
          };
        })
        .sort((a, b) => parseISO(a.legs![0].departureDateTime!).getTime() - parseISO(b.legs![0].departureDateTime!).getTime())
        .slice(0, 5);
      setUpcomingTrips(sortedUpcomingTrips);

      // Simplified aircraft status logic for dashboard (placeholder)
      const newDashboardStatus = new Map<string, SimplifiedAircraftStatus>();
      const tempSystemAlerts: any[] = []; // Placeholder for actual alert objects

      for (const ac of fetchedFleetList) {
        if (ac.isMaintenanceTracked) {
          // In a full implementation, you would fetch discrepancies and maintenance tasks here
          // For this simplified reversion, assume 'Active' unless a placeholder 'Maintenance' condition is met
          let status: SimplifiedAircraftStatus = { label: "Active", variant: "default", details: "All Clear" };
          
          // Example placeholder logic for critical/maintenance status
          // if (ac.tailNumber.includes("1")) { // Example: if tail number contains "1", mark as maintenance
          //   status = { label: "Maintenance", variant: "destructive", details: "Example Critical Issue" };
          //   tempSystemAlerts.push({
          //       id: `alert_${ac.id}`,
          //       type: 'aircraft',
          //       severity: 'critical',
          //       title: `Aircraft Grounded: ${ac.tailNumber}`,
          //       message: `Example Critical Issue for ${ac.model}.`,
          //       link: `/aircraft/currency/${ac.tailNumber}`,
          //       icon: AlertTriangle
          //   });
          // } else if (ac.tailNumber.includes("2")) { // Example: if tail number contains "2", mark as warning
          //    status = { label: "Maintenance", variant: "secondary", details: "Example Minor Issue" };
          //    // Optionally add to tempSystemAlerts with 'warning' severity
          // }
          newDashboardStatus.set(ac.id, status);
        } else {
          newDashboardStatus.set(ac.id, { label: "Info", variant: "outline", details: "Not Tracked" });
        }
      }
      setAircraftDashboardStatus(newDashboardStatus);
      // setActiveSystemAlerts(tempSystemAlerts.slice(0, 5)); // Show top 5 alerts


    } catch (error) {
      console.error("Failed to load initial dashboard data:", error);
      toast({ title: "Error Loading Dashboard Data", description: (error instanceof Error ? error.message : "Unknown error."), variant: "destructive" });
    } finally {
      setIsLoadingBulletins(false);
      setIsLoadingTrips(false);
      setIsLoadingFleet(false);
      setIsLoadingAircraftStatus(false); // Finish loading for aircraft status
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
        <CardContent className="pt-2"> {/* Changed from pt-0 to pt-2 for a bit of spacing if needed */}
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
          {isLoadingTrips || isLoadingFleet ? (
            <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading trips...</p></div>
          ) : upcomingTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No upcoming trips.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Trip ID</TableHead><TableHead>Client</TableHead><TableHead>Route</TableHead><TableHead>Aircraft</TableHead><TableHead>Departure</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcomingTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell><Link href={`/trips/details/${trip.id}`} className="text-primary hover:underline">{trip.tripId}</Link></TableCell>
                    <TableCell>{trip.clientName}</TableCell>
                    <TableCell>{trip.legs?.[0]?.origin} - {trip.legs?.[trip.legs.length -1]?.destination}</TableCell>
                    <TableCell>{trip.aircraftLabel}</TableCell> 
                    <TableCell>{trip.legs?.[0]?.departureDateTime && isValid(parseISO(trip.legs[0].departureDateTime)) ? format(parseISO(trip.legs[0].departureDateTime), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                    <TableCell><Badge variant={trip.status === "Scheduled" ? "outline" : "default"}>{trip.status}</Badge></TableCell>
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
            {isLoadingFleet || isLoadingAircraftStatus ? (
                <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading aircraft status...</p></div>
            ) : fleetList.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-3">No aircraft in fleet to display status for.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Tail #</TableHead><TableHead>Model</TableHead><TableHead>Base</TableHead><TableHead>Status</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fleetList.filter(ac => aircraftDashboardStatus.has(ac.id)).slice(0, 5).map(ac => {
                    const statusInfo = aircraftDashboardStatus.get(ac.id) || { label: "Info", variant: "outline", details: "Status Unavailable" };
                    return (
                      <TableRow key={ac.id}>
                        <TableCell><Link href={`/aircraft/currency/${ac.tailNumber}`} className="text-primary hover:underline">{ac.tailNumber}</Link></TableCell>
                        <TableCell>{ac.model}</TableCell>
                        <TableCell>{ac.baseLocation || 'N/A'}</TableCell>
                        <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{statusInfo.details}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {fleetList.filter(ac => aircraftDashboardStatus.has(ac.id)).length > 5 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 5 aircraft. More on currency page.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-md"> {/* System Alerts takes 1/3 width on lg */}
          <CardHeader>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Active System Alerts</CardTitle></div>
            <CardDescription>Important system notifications requiring attention.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingAircraftStatus ? (
                <div className="flex items-center justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading alerts...</p></div>
             ) : activeSystemAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No critical system alerts at this time.</p>
             ) : (
                <List>
                    {activeSystemAlerts.map(alert => (
                        <ListItem key={alert.id} className="py-2 border-b last:border-b-0">
                            <div className="flex items-start gap-2">
                                {alert.icon && <alert.icon className={`h-5 w-5 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'}`} />}
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{alert.title}</p>
                                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                                    {alert.link && <Link href={alert.link} className="text-xs text-primary hover:underline">View Details</Link>}
                                </div>
                                {alert.severity && <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="capitalize text-xs">{alert.severity}</Badge>}
                            </div>
                        </ListItem>
                    ))}
                </List>
             )}
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

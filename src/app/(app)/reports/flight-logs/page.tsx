
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from '@/components/ui/skeleton';
import { PlaneTakeoff, Download, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, parseISO, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

// Data fetching flows
import { fetchAllFlightLogs, type FlightLogLeg } from '@/ai/flows/manage-flight-logs-flow';
import { fetchTrips, type Trip, type TripLeg } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchCustomers, type Customer } from '@/ai/flows/manage-customers-flow';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';

// Helper for time formatting
const formatHours = (hours: number | undefined) => {
    if (hours === undefined || isNaN(hours)) return '0.0';
    return hours.toFixed(1);
}

// Combined type for our report row
type ReportableLeg = {
    legDate: string;
    tripId: string;
    tripDocId: string;
    origin: string;
    destination: string;
    legType: TripLeg['legType'];
    crewName: string;
    aircraftLabel: string;
    airTime: number;
    blockTime: number;
    landings: number;
    fuelBurn: number;
    customerName: string;
    customerId?: string;
    aircraftId: string;
};

// Main Component
export default function FlightLogsReportPage() {
    const [allLogs, setAllLogs] = useState<FlightLogLeg[]>([]);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [allFleet, setAllFleet] = useState<FleetAircraft[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [allCrew, setAllCrew] = useState<CrewMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Filter states
    const [aircraftFilter, setAircraftFilter] = useState('all');
    const [customerFilter, setCustomerFilter] = useState('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [logs, trips, fleet, customers, crew] = await Promise.all([
                fetchAllFlightLogs(),
                fetchTrips(),
                fetchFleetAircraft(),
                fetchCustomers(),
                fetchCrewMembers(),
            ]);
            setAllLogs(logs);
            setAllTrips(trips.filter(t => t.status === 'Completed')); // Only use completed trips
            setAllFleet(fleet);
            setAllCustomers(customers);
            setAllCrew(crew);
        } catch (error) {
            console.error("Failed to load flight log report data:", error);
            toast({ title: "Error Loading Data", description: (error instanceof Error ? error.message : "Could not load report data."), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const reportableLegs = useMemo<ReportableLeg[]>(() => {
        if (isLoading) return [];
        
        const tripMap = new Map(allTrips.map(t => [t.id, t]));
        const crewMap = new Map(allCrew.map(c => [c.id, c]));
        const customerMap = new Map(allCustomers.map(c => [c.id, c]));

        return allLogs.map(log => {
            const trip = tripMap.get(log.tripId);
            if (!trip) return null;
            const leg = trip.legs[log.legIndex];
            if (!leg) return null;
            
            const takeOff = log.takeOffTime ? parseISO(`2000-01-01T${log.takeOffTime}:00Z`) : new Date(0);
            const landing = log.landingTime ? parseISO(`2000-01-01T${log.landingTime}:00Z`) : new Date(0);
            if (landing < takeOff) landing.setDate(landing.getDate() + 1); // Handle midnight crossing

            const airTimeMins = (landing.getTime() - takeOff.getTime()) / (1000 * 60);
            const airTimeHours = airTimeMins > 0 ? airTimeMins / 60 : 0;
            const blockTimeHours = airTimeHours + ((log.taxiOutTimeMins || 0) + (log.taxiInTimeMins || 0)) / 60;
            const landings = (log.dayLandings || 0) + (log.nightLandings || 0);
            const fuelBurn = (log.fobStartingFuel || 0) + (log.fuelPurchasedAmount || 0) - (log.endingFuel || 0);
            
            const pic = crewMap.get(trip.assignedPilotId || '');
            const crewName = pic ? `${pic.lastName}, ${pic.firstName?.[0]}` : 'N/A';
            const customer = customerMap.get(trip.customerId || '');

            return {
                legDate: format(parseISO(leg.departureDateTime || log.createdAt), 'yyyy-MM-dd HH:mm'),
                tripId: trip.tripId,
                tripDocId: trip.id,
                origin: leg.origin,
                destination: leg.destination,
                legType: leg.legType,
                crewName: crewName,
                aircraftLabel: trip.aircraftLabel || trip.aircraftId,
                airTime: airTimeHours,
                blockTime: blockTimeHours,
                landings: landings,
                fuelBurn: fuelBurn > 0 ? fuelBurn : 0,
                customerName: customer?.name || trip.clientName,
                customerId: trip.customerId,
                aircraftId: trip.aircraftId,
            };
        }).filter((item): item is ReportableLeg => item !== null)
        .sort((a,b) => parseISO(b.legDate).getTime() - parseISO(a.legDate).getTime());

    }, [isLoading, allLogs, allTrips, allCrew, allCustomers]);
    
    const filteredLegs = useMemo(() => {
        return reportableLegs.filter(leg => {
             const dateMatch = !dateRange?.from || isWithinInterval(parseISO(leg.legDate), { start: dateRange.from, end: dateRange.to || dateRange.from });
             const aircraftMatch = aircraftFilter === 'all' || leg.aircraftId === aircraftFilter;
             const customerMatch = customerFilter === 'all' || leg.customerId === customerFilter;
             return dateMatch && aircraftMatch && customerMatch;
        });
    }, [reportableLegs, aircraftFilter, customerFilter, dateRange]);
    
    const totalTimes = useMemo(() => {
        const aircraft = allFleet.find(ac => ac.id === aircraftFilter);
        const isTwin = aircraft && (aircraft.engineDetails?.length || 0) > 1;

        return filteredLegs.reduce((acc, leg) => {
            acc.airTime += leg.airTime;
            acc.blockTime += leg.blockTime;
            acc.landings += leg.landings;
            acc.fuelBurn += leg.fuelBurn;
            acc.eng1Time += leg.airTime;
            acc.eng1Cyc += leg.landings;
            if (isTwin) {
                acc.eng2Time += leg.airTime;
                acc.eng2Cyc += leg.landings;
            }
            return acc;
        }, { airTime: 0, blockTime: 0, landings: 0, eng1Time: 0, eng1Cyc: 0, eng2Time: 0, eng2Cyc: 0, fuelBurn: 0 });
    }, [filteredLegs, aircraftFilter, allFleet]);
    
    const selectedAircraftLabel = allFleet.find(f => f.id === aircraftFilter)?.tailNumber;
    const selectedCustomerLabel = allCustomers.find(c => c.id === customerFilter)?.name;

    return (
        <div className="space-y-6">
            <PageHeader title="Flight Log Report" description="View, sort, and reconcile all completed flights." icon={PlaneTakeoff} actions={<Button variant="outline" disabled><Download className="mr-2 h-4"/> Print Report</Button>} />

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
                            <SelectTrigger><SelectValue placeholder="Filter by Aircraft"/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Aircraft</SelectItem>{allFleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                            <SelectTrigger><SelectValue placeholder="Filter by Customer"/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Customers</SelectItem>{allCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : <span>Pick a date</span>}</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent>
                        </Popover>
                         <Button variant="link" onClick={() => { setAircraftFilter('all'); setCustomerFilter('all'); setDateRange(undefined); }}>Clear Filters</Button>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader><CardTitle>Report Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="font-semibold text-muted-foreground">Aircraft:</span> {selectedAircraftLabel || 'All'}</div>
                    <div><span className="font-semibold text-muted-foreground">Customer:</span> {selectedCustomerLabel || 'All'}</div>
                    <div><span className="font-semibold text-muted-foreground">Report Range:</span> {dateRange?.from ? format(dateRange.from, "MM/dd/yyyy") : 'N/A'} - {dateRange?.to ? format(dateRange.to, "MM/dd/yyyy") : 'N/A'}</div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader><CardTitle>Total Times</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-center">
                        <thead><tr className="border-b text-sm text-muted-foreground">
                            <th className="p-2 font-medium">Air Time</th><th className="p-2 font-medium">Block Time</th><th className="p-2 font-medium">Landings</th><th className="p-2 font-medium">Eng 1 Time</th><th className="p-2 font-medium">Eng 1 Cyc</th><th className="p-2 font-medium">Eng 2 Time</th><th className="p-2 font-medium">Eng 2 Cyc</th><th className="p-2 font-medium">Fuel Burn</th>
                        </tr></thead>
                        <tbody><tr>
                            <td className="p-2 font-semibold text-lg">{formatHours(totalTimes.airTime)}</td><td className="p-2 font-semibold text-lg">{formatHours(totalTimes.blockTime)}</td><td className="p-2 font-semibold text-lg">{totalTimes.landings}</td><td className="p-2 font-semibold text-lg">{formatHours(totalTimes.eng1Time)}</td><td className="p-2 font-semibold text-lg">{totalTimes.eng1Cyc}</td><td className="p-2 font-semibold text-lg">{formatHours(totalTimes.eng2Time)}</td><td className="p-2 font-semibold text-lg">{totalTimes.eng2Cyc}</td><td className="p-2 font-semibold text-lg">{totalTimes.fuelBurn.toLocaleString()}</td>
                        </tr></tbody>
                    </table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Detailed Times</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Date</TableHead><TableHead>Trip ID</TableHead><TableHead>Depart</TableHead><TableHead>Arrive</TableHead><TableHead>Trip Type</TableHead><TableHead>Crew</TableHead>
                            <TableHead className="text-right">Air Time</TableHead><TableHead className="text-right">Block Time</TableHead><TableHead className="text-right">Landings</TableHead><TableHead className="text-right">Fuel Burn</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={10} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filteredLegs.length === 0 ? (
                                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No flight logs match the selected filters.</TableCell></TableRow>
                            ) : (
                                filteredLegs.map((leg, index) => (
                                    <TableRow key={`${leg.tripDocId}-${index}`}>
                                        <TableCell className="text-xs">{leg.legDate}</TableCell>
                                        <TableCell><Link href={`/trips/details/${leg.tripDocId}`} className="text-primary hover:underline font-medium">{leg.tripId}</Link></TableCell>
                                        <TableCell>{leg.origin}</TableCell><TableCell>{leg.destination}</TableCell><TableCell>{leg.legType}</TableCell><TableCell>{leg.crewName}</TableCell>
                                        <TableCell className="text-right">{formatHours(leg.airTime)}</TableCell><TableCell className="text-right">{formatHours(leg.blockTime)}</TableCell><TableCell className="text-right">{leg.landings}</TableCell><TableCell className="text-right">{leg.fuelBurn.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

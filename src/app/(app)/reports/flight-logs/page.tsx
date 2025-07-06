
"use client";

import React, { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
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
import { format, isWithinInterval, parseISO, subDays, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

// Data fetching flows
import { fetchAllFlightLogs, type FlightLogLeg } from '@/ai/flows/manage-flight-logs-flow';
import { fetchTrips, type Trip, type TripLeg } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchCustomers, type Customer } from '@/ai/flows/manage-customers-flow';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchCompanyProfile } from '@/ai/flows/manage-company-profile-flow';


// Helper for time formatting
const formatHours = (hours: number | undefined) => {
    if (hours === undefined || isNaN(hours) || hours < 0) return '00:00';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    const [isPrinting, startPrintTransition] = useTransition();

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
    
    const calculateFlightTimeFromLog = (log: FlightLogLeg | null): number => {
        if (!log) return 0;
        if (typeof log.hobbsTakeOff === 'number' && typeof log.hobbsLanding === 'number' && log.hobbsLanding > log.hobbsTakeOff) {
            return parseFloat((log.hobbsLanding - log.hobbsTakeOff).toFixed(2));
        }
        if (log.takeOffTime && log.landingTime) {
            try {
                const takeOff = parseISO(`2000-01-01T${log.takeOffTime}:00Z`);
                let landing = parseISO(`2000-01-01T${log.landingTime}:00Z`);
                if (landing < takeOff) { landing.setDate(landing.getDate() + 1); }
                const diffMs = landing.getTime() - takeOff.getTime();
                if (diffMs < 0) return 0;
                return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
            } catch (e) {
                console.error("Error parsing flight log times:", e);
                return 0;
            }
        }
        return 0;
    };
    
    const calculateBlockTimeFromLog = (log: FlightLogLeg | null): number => {
        if (!log) return 0;
        const flightTimeDecimal = calculateFlightTimeFromLog(log);
        const taxiOutMins = Number(log.taxiOutTimeMins || 0);
        const taxiInMins = Number(log.taxiInTimeMins || 0);
        return parseFloat(((taxiOutMins / 60) + flightTimeDecimal + (taxiInMins / 60)).toFixed(2));
    };


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
            
            const airTimeHours = calculateFlightTimeFromLog(log);
            const blockTimeHours = calculateBlockTimeFromLog(log);
            const landings = (log.dayLandings || 0) + (log.nightLandings || 0);
            const fuelBurn = (log.fobStartingFuel || 0) + (log.fuelPurchasedAmount || 0) - (log.endingFuel || 0);
            
            const pic = crewMap.get(trip.assignedPilotId || '');
            const crewName = pic ? `${pic.lastName}, ${pic.firstName?.[0]}` : 'N/A';
            const customer = customerMap.get(trip.customerId || '');

            return {
                legDate: leg.departureDateTime || log.createdAt,
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
        // Create a map for quick lookups inside the reducer
        const fleetMap = new Map(allFleet.map(ac => [ac.id, ac]));

        return filteredLegs.reduce((acc, leg) => {
            acc.airTime += leg.airTime;
            acc.blockTime += leg.blockTime;
            acc.landings += leg.landings;
            acc.fuelBurn += leg.fuelBurn;
            
            // Accumulate Eng 1 for every leg, as all aircraft have at least one engine.
            acc.eng1Time += leg.airTime;
            acc.eng1Cyc += leg.landings;
            
            // Check if the specific aircraft for THIS leg is a twin.
            const aircraftForLeg = fleetMap.get(leg.aircraftId);
            const isTwin = aircraftForLeg && (aircraftForLeg.engineDetails?.length || 0) > 1;

            if (isTwin) {
                acc.eng2Time += leg.airTime;
                acc.eng2Cyc += leg.landings;
            }
            
            return acc;
        }, { airTime: 0, blockTime: 0, landings: 0, eng1Time: 0, eng1Cyc: 0, eng2Time: 0, eng2Cyc: 0, fuelBurn: 0 });
    }, [filteredLegs, allFleet]);


    const handleDatePresetChange = (value: string) => {
      if (value === 'all') {
        setDateRange(undefined);
        return;
      }
      const days = parseInt(value, 10);
      if (isNaN(days)) return;
      
      const to = new Date();
      const from = subDays(to, days);
      setDateRange({ from, to });
    };

    const handlePrintReport = () => {
        if (isLoading || filteredLegs.length === 0) {
            toast({ title: "No Data to Print", description: "Cannot generate a report for an empty or loading dataset.", variant: "destructive" });
            return;
        }

        startPrintTransition(async () => {
            try {
                const { jsPDF } = await import('jspdf');
                const { default: autoTable } = await import('jspdf-autotable');

                const profile = await fetchCompanyProfile();
                const doc = new jsPDF({ orientation: 'landscape' });

                // Add Logo
                if (profile?.logoUrl) {
                    try {
                        const response = await fetch(profile.logoUrl);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        await new Promise<void>((resolve, reject) => {
                            reader.onloadend = () => {
                                doc.addImage(reader.result as string, 'PNG', 15, 10, 40, 15);
                                resolve();
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        console.error("Could not load company logo for PDF:", e);
                    }
                }

                // Header
                doc.setFontSize(18);
                doc.text("Flight Log Report", 148, 15, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`Generated on: ${format(new Date(), 'MM/dd/yyyy HH:mm')}`, 148, 22, { align: 'center' });

                // Summary Table
                autoTable(doc, {
                    startY: 30,
                    head: [['Aircraft', 'Customer', 'Date Range', 'Total Air Time', 'Total Block Time', 'Total Landings', 'Total Fuel Burn']],
                    body: [[
                        aircraftFilter === 'all' ? 'All' : allFleet.find(f => f.id === aircraftFilter)?.tailNumber || 'N/A',
                        customerFilter === 'all' ? 'All' : allCustomers.find(c => c.id === customerFilter)?.name || 'N/A',
                        dateRange?.from ? `${format(dateRange.from, 'MM/dd/yy')} - ${format(dateRange.to || dateRange.from, 'MM/dd/yy')}` : 'All Time',
                        formatHours(totalTimes.airTime),
                        formatHours(totalTimes.blockTime),
                        totalTimes.landings,
                        totalTimes.fuelBurn.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    ]],
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185] },
                });
                
                // Detailed Logs Table
                const detailHead = [['Date', 'Trip ID', 'Depart', 'Arrive', 'Trip Type', 'PIC', 'Air Time', 'Block Time', 'Landings', 'Fuel Burn']];
                const detailBody = filteredLegs.map(leg => [
                    format(parseISO(leg.legDate), 'MM/dd/yy HH:mm'),
                    leg.tripId,
                    leg.origin,
                    leg.destination,
                    leg.legType,
                    leg.crewName,
                    formatHours(leg.airTime),
                    formatHours(leg.blockTime),
                    leg.landings,
                    leg.fuelBurn.toLocaleString(undefined, { maximumFractionDigits: 0 })
                ]);

                autoTable(doc, {
                    head: detailHead,
                    body: detailBody,
                    theme: 'grid',
                    didDrawPage: (data: any) => {
                        // Footer
                        doc.setFontSize(8);
                        const pageCount = doc.getNumberOfPages();
                        doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
                        doc.text(`${profile?.companyName || 'FlightOps360'} - Confidential`, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right' });
                    }
                });


                doc.save(`FlightLogReport_${format(new Date(), 'yyyyMMdd')}.pdf`);
                toast({ title: "Report Generated", description: "Your PDF report should be downloading." });
            } catch (error) {
                console.error("Failed to generate PDF:", error);
                toast({ title: "Error Generating PDF", description: "There was a problem creating the report.", variant: "destructive" });
            }
        });
    };

    const selectedAircraftLabel = allFleet.find(f => f.id === aircraftFilter)?.tailNumber;
    const selectedCustomerLabel = allCustomers.find(c => c.id === customerFilter)?.name;

    return (
        <div className="space-y-6">
            <PageHeader title="Flight Log Report" description="View, sort, and reconcile all completed flights." icon={PlaneTakeoff} actions={<Button variant="outline" onClick={handlePrintReport} disabled={isLoading || isPrinting || filteredLegs.length === 0}>{isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} Print Report</Button>} />

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                        <Select value={aircraftFilter} onValueChange={setAircraftFilter}><SelectTrigger className="lg:col-span-1"><SelectValue placeholder="Filter by Aircraft"/></SelectTrigger><SelectContent><SelectItem value="all">All Aircraft</SelectItem>{allFleet.map(ac => <SelectItem key={ac.id} value={ac.id}>{ac.tailNumber}</SelectItem>)}</SelectContent></Select>
                        <Select value={customerFilter} onValueChange={setCustomerFilter}><SelectTrigger className="lg:col-span-1"><SelectValue placeholder="Filter by Customer"/></SelectTrigger><SelectContent><SelectItem value="all">All Customers</SelectItem>{allCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("lg:col-span-1 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : (<span>Pick a date range</span>)}</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent>
                        </Popover>
                        <Select onValueChange={handleDatePresetChange}>
                          <SelectTrigger className="lg:col-span-1"><SelectValue placeholder="Or select a preset..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="60">Last 60 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                            <SelectItem value="180">Last 180 Days</SelectItem>
                            <SelectItem value="365">Last 365 Days</SelectItem>
                          </SelectContent>
                        </Select>
                         <Button variant="link" onClick={() => { setAircraftFilter('all'); setCustomerFilter('all'); setDateRange(undefined); }} className="lg:col-span-1">Clear Filters</Button>
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
                                        <TableCell className="text-xs">{format(parseISO(leg.legDate), 'MM/dd/yy HH:mm')}</TableCell>
                                        <TableCell><Link href={`/trips/details/${leg.tripDocId}`} className="text-primary hover:underline font-medium">{leg.tripId}</Link></TableCell>
                                        <TableCell>{leg.origin}</TableCell><TableCell>{leg.destination}</TableCell><TableCell>{leg.legType}</TableCell><TableCell>{leg.crewName}</TableCell>
                                        <TableCell className="text-right">{formatHours(leg.airTime)}</TableCell><TableCell className="text-right">{formatHours(leg.blockTime)}</TableCell><TableCell className="text-right">{leg.landings}</TableCell><TableCell className="text-right">{leg.fuelBurn.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
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

    
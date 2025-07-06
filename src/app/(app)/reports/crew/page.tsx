
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay, isSameDay } from 'date-fns';

// Data fetching flows
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchAllFlightLogs, type FlightLogLeg } from '@/ai/flows/manage-flight-logs-flow';
import { fetchTrips, type Trip, type TripLeg } from '@/ai/flows/manage-trips-flow';

// Type Definitions
type DetailedLegInfo = {
    dutyPeriodId: string;
    isFirstInDuty: boolean;
    dutyStartTime: Date;
    dutyEndTime: Date;
    legStartTime: Date;
    airTime: number;
    blockTime: number;
    nightFlightTime: number;
    ifrFlightTime: number;
    approaches: number;
    dayLandings: number;
    nightLandings: number;
    dutyPosition: 'PIC' | 'SIC' | 'Other';
    part: 'Part 91' | 'Part 135';
    aircraftType: string;
};

// Helper Functions
const formatDecimalToHHMM = (decimalHours: number): string => {
    if (isNaN(decimalHours) || decimalHours < 0) return '00:00';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDecimalToHrsMins = (decimalHours: number): string => {
    if (isNaN(decimalHours) || decimalHours < 0) return '00 hrs 00 mins';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${String(hours).padStart(2, '0')} hrs ${String(minutes).padStart(2, '0')} mins`;
};


export default function CrewActivityReportPage() {
    const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
    const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [allLogs, setAllLogs] = useState<FlightLogLeg[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [crew, trips, logs] = await Promise.all([
                fetchCrewMembers(),
                fetchTrips(),
                fetchAllFlightLogs(),
            ]);
            const activePilots = crew.filter(c => c.isActive && c.onboardingData?.roles?.some(r => r.includes('Pilot')));
            setCrewMembers(activePilots);
            setAllTrips(trips);
            setAllLogs(logs);
            if (activePilots.length > 0 && !selectedCrewId) {
                setSelectedCrewId(activePilots[0].id);
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not load report data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, selectedCrewId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const processedData = useMemo(() => {
        if (!selectedCrewId) return { detailedLegs: [], totals: {} };

        const logsByTripLeg = new Map<string, FlightLogLeg>();
        allLogs.forEach(log => logsByTripLeg.set(`${log.tripId}_${log.legIndex}`, log));

        const crewLegs = allTrips.flatMap(trip => 
            trip.legs.map((leg, index) => ({ leg, index, trip }))
        ).filter(({ leg, trip }) => 
            (trip.assignedPilotId === selectedCrewId || trip.assignedCoPilotId === selectedCrewId) && leg.departureDateTime
        ).sort((a, b) => parseISO(a.leg.departureDateTime!).getTime() - parseISO(b.leg.departureDateTime!).getTime());
        
        const dutyPeriods: DetailedLegInfo[][] = [];
        let currentDutyPeriod: DetailedLegInfo[] = [];

        crewLegs.forEach((item, i) => {
            const log = logsByTripLeg.get(`${item.trip.id}_${item.index}`);
            if (!log) return; // Skip legs without logs

            const departureTime = parseISO(item.leg.departureDateTime!);
            
            // Start a new duty period if it's the first leg, or if there's a >12hr gap
            if (i === 0 || differenceInMinutes(departureTime, currentDutyPeriod[currentDutyPeriod.length-1].legStartTime) > 12 * 60) {
                if(currentDutyPeriod.length > 0) dutyPeriods.push(currentDutyPeriod);
                currentDutyPeriod = [];
            }

            const airTime = (log.hobbsLanding || 0) - (log.hobbsTakeOff || 0);
            const blockTime = airTime + ((log.taxiOutTimeMins || 0) + (log.taxiInTimeMins || 0)) / 60;
            
            const detailedLeg: Omit<DetailedLegInfo, 'dutyPeriodId' | 'isFirstInDuty' | 'dutyStartTime' | 'dutyEndTime'> = {
                legStartTime: departureTime,
                airTime: airTime,
                blockTime: blockTime,
                nightFlightTime: log.nightTimeDecimal || 0,
                ifrFlightTime: log.instrumentTimeDecimal || 0,
                approaches: log.approaches || 0,
                dayLandings: log.dayLandings || 0,
                nightLandings: log.nightLandings || 0,
                dutyPosition: item.trip.assignedPilotId === selectedCrewId ? 'PIC' : 'SIC',
                part: item.leg.legType === "Charter" ? 'Part 135' : 'Part 91',
                aircraftType: item.trip.aircraftLabel?.split(' - ')[1] || 'N/A',
            };
            currentDutyPeriod.push(detailedLeg as DetailedLegInfo);
        });
        if(currentDutyPeriod.length > 0) dutyPeriods.push(currentDutyPeriod);

        const finalLegs: DetailedLegInfo[] = [];
        dutyPeriods.forEach((period, i) => {
             const firstLeg = period[0];
             const lastLeg = period[period.length - 1];
             const dutyStart = new Date(firstLeg.legStartTime.getTime() - 60*60*1000);
             const dutyEnd = new Date(lastLeg.legStartTime.getTime() + (lastLeg.blockTime * 60*60*1000) + (30*60*1000));
            
            period.forEach((leg, j) => {
                finalLegs.push({
                    ...leg,
                    dutyPeriodId: `duty-${i}`,
                    isFirstInDuty: j === 0,
                    dutyStartTime: dutyStart,
                    dutyEndTime: dutyEnd,
                });
            });
        });

        const totals = finalLegs.reduce((acc, leg) => {
             acc.totalFlightTime += leg.airTime;
             if (leg.dutyPosition === 'PIC') acc.picFlightTime += leg.airTime;
             if (leg.dutyPosition === 'SIC') acc.sicFlightTime += leg.airTime;
             acc.totalNightTime += leg.nightFlightTime;
             acc.totalIfrTime += leg.ifrFlightTime;
             acc.totalApproaches += leg.approaches;
             acc.totalDayLandings += leg.dayLandings;
             acc.totalNightLandings += leg.nightLandings;
             return acc;
        }, { totalFlightTime: 0, picFlightTime: 0, sicFlightTime: 0, totalNightTime: 0, totalIfrTime: 0, totalApproaches: 0, totalDayLandings: 0, totalNightLandings: 0 });

        const uniqueDutyPeriods = new Map<string, { start: Date, end: Date }>();
        finalLegs.forEach(leg => {
            uniqueDutyPeriods.set(leg.dutyPeriodId, {start: leg.dutyStartTime, end: leg.dutyEndTime});
        });
        const totalDutyTime = Array.from(uniqueDutyPeriods.values()).reduce((sum, period) => {
            return sum + (differenceInMinutes(period.end, period.start) / 60);
        }, 0);

        return { detailedLegs: finalLegs, totals: { ...totals, totalDutyTime } };

    }, [selectedCrewId, allTrips, allLogs]);
    
    const { detailedLegs, totals } = processedData;

    if (isLoading) {
        return (
          <>
            <PageHeader title="Crew Activity Report" icon={Users} description="View detailed flight and duty logs for individual crew members." actions={<Button variant="outline" disabled><Download className="mr-2 h-4 w-4"/>Export Report</Button>}/>
            <div className="p-4"><Loader2 className="animate-spin" /> Loading Report Data...</div>
          </>
        );
    }

    return (
        <>
        <PageHeader title="Crew Activity Report" icon={Users} description="View detailed flight and duty logs for individual crew members." actions={<Button variant="outline" disabled><Download className="mr-2 h-4 w-4"/>Export Report</Button>}/>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Select value={selectedCrewId || ''} onValueChange={setSelectedCrewId}>
                        <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Select a Crew Member" />
                        </SelectTrigger>
                        <SelectContent>
                            {crewMembers.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Total Times</CardTitle>
                    <CardDescription>Aggregated totals for the selected pilot and period.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-4 text-center">
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Duty Time</div><div className="font-semibold">{formatDecimalToHrsMins(totals.totalDutyTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Admin Duty</div><div className="font-semibold">{formatDecimalToHrsMins(0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">FLT Time</div><div className="font-semibold">{formatDecimalToHrsMins(totals.totalFlightTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">PIC FLT Time</div><div className="font-semibold">{formatDecimalToHrsMins(totals.picFlightTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">SIC FLT Time</div><div className="font-semibold">{formatDecimalToHrsMins(totals.sicFlightTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Night FLT</div><div className="font-semibold">{formatDecimalToHrsMins(totals.totalNightTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">IFR FLT</div><div className="font-semibold">{formatDecimalToHrsMins(totals.totalIfrTime || 0)}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Approaches</div><div className="font-semibold">{totals.totalApproaches || 0}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Day Landings</div><div className="font-semibold">{totals.totalDayLandings || 0}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Night Landings</div><div className="font-semibold">{totals.totalNightLandings || 0}</div></div>
                    <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Time Off</div><div className="font-semibold">{formatDecimalToHrsMins(0)}</div></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Detailed Times</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Duty Time</TableHead>
                                <TableHead>Duty Len</TableHead>
                                <TableHead>Start Time</TableHead>
                                <TableHead>Air Time</TableHead>
                                <TableHead>Block Time</TableHead>
                                <TableHead>Night</TableHead>
                                <TableHead>IFR</TableHead>
                                <TableHead>Approaches</TableHead>
                                <TableHead>Day Lnd</TableHead>
                                <TableHead>Night Lnd</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Part</TableHead>
                                <TableHead>Aircraft</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailedLegs.map((leg, index) => (
                                <TableRow key={index}>
                                    {leg.isFirstInDuty && 
                                        <TableCell rowSpan={detailedLegs.filter(l => l.dutyPeriodId === leg.dutyPeriodId).length} className="align-top border-t">
                                            {format(leg.dutyStartTime, 'MM/dd/yyyy HH:mm')} - {format(leg.dutyEndTime, 'MM/dd/yyyy HH:mm')}
                                        </TableCell>
                                    }
                                     {leg.isFirstInDuty && 
                                        <TableCell rowSpan={detailedLegs.filter(l => l.dutyPeriodId === leg.dutyPeriodId).length} className="align-top border-t">
                                            {formatDecimalToHHMM(differenceInMinutes(leg.dutyEndTime, leg.dutyStartTime)/60)}
                                        </TableCell>
                                    }
                                    <TableCell>{format(leg.legStartTime, 'HH:mm')}</TableCell>
                                    <TableCell>{formatDecimalToHHMM(leg.airTime)}</TableCell>
                                    <TableCell>{formatDecimalToHHMM(leg.blockTime)}</TableCell>
                                    <TableCell>{formatDecimalToHHMM(leg.nightFlightTime)}</TableCell>
                                    <TableCell>{formatDecimalToHHMM(leg.ifrFlightTime)}</TableCell>
                                    <TableCell>{leg.approaches}</TableCell>
                                    <TableCell>{leg.dayLandings}</TableCell>
                                    <TableCell>{leg.nightLandings}</TableCell>
                                    <TableCell>{leg.dutyPosition}</TableCell>
                                    <TableCell>{leg.part}</TableCell>
                                    <TableCell>{leg.aircraftType}</TableCell>
                                </TableRow>
                            ))}
                             {detailedLegs.length === 0 && (
                                <TableRow><TableCell colSpan={13} className="text-center py-4 text-muted-foreground">No flight activity found for this crew member in the selected period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        </>
    );
}

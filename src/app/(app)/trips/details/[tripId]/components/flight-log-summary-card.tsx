
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { PlaneTakeoff, Loader2, Edit2 } from 'lucide-react'; // Changed ListChecks to PlaneTakeoff
import { format, parseISO, isValid } from 'date-fns';
import type { TripLeg } from '@/ai/schemas/trip-schemas';
import type { FlightLogLeg } from '@/ai/schemas/flight-log-schemas';

interface FlightLogSummaryCardProps {
  tripLegs: TripLeg[];
  flightLogs: Record<number, FlightLogLeg | null>; // Map legIndex to FlightLogLeg
  isLoadingLogs: boolean;
  onLogActualsClick: (legIndex: number) => void;
}

const decimalToHHMM = (decimalHours: number | undefined | null): string => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours) || decimalHours < 0) return "00:00";
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const calculateFlightTimeFromLog = (log: FlightLogLeg | null): string => {
    if (!log) return 'N/A';
    // Prioritize Hobbs for flight time if available and valid
    if (typeof log.hobbsTakeOff === 'number' && typeof log.hobbsLanding === 'number' && log.hobbsLanding > log.hobbsTakeOff) {
        return decimalToHHMM(log.hobbsLanding - log.hobbsTakeOff);
    }
    // Fallback to actual takeOffTime and landingTime
    if (log.takeOffTime && log.landingTime) {
        try {
            // Assuming times are on the same day or crossing midnight (handled by parsing logic if needed)
            // For simplicity, using ISO date for parsing with time
            const takeOffDate = parseISO(`2000-01-01T${log.takeOffTime}:00`);
            let landingDate = parseISO(`2000-01-01T${log.landingTime}:00`);

            if (landingDate < takeOffDate) { // Handle midnight crossing
                landingDate = new Date(landingDate.getTime() + 24 * 60 * 60 * 1000);
            }
            
            const diffMs = landingDate.getTime() - takeOffDate.getTime();
            if (diffMs < 0) return 'Invalid Times'; // Should not happen if midnight handled
            
            const diffHours = diffMs / (1000 * 60 * 60);
            return decimalToHHMM(diffHours);
        } catch (e) {
            console.error("Error parsing flight times:", e);
            return 'Error Calc';
        }
    }
    return 'N/A';
};

const calculateBlockTimeFromLog = (log: FlightLogLeg | null): string => {
    if (!log) return 'N/A';
    
    const flightTimeStr = calculateFlightTimeFromLog(log);
    if (flightTimeStr === 'N/A' || flightTimeStr === 'Invalid Times' || flightTimeStr === 'Error Calc') return flightTimeStr;

    const [flightHours, flightMinutes] = flightTimeStr.split(':').map(Number);
    const flightTimeDecimal = flightHours + (flightMinutes / 60);

    const taxiOutMins = Number(log.taxiOutTimeMins || 0);
    const taxiInMins = Number(log.taxiInTimeMins || 0);
    
    const blockDecimal = (taxiOutMins / 60) + flightTimeDecimal + (taxiInMins / 60);
    return decimalToHHMM(blockDecimal);
};


export function FlightLogSummaryCard({ tripLegs, flightLogs, isLoadingLogs, onLogActualsClick }: FlightLogSummaryCardProps) {
  if (isLoadingLogs && (!tripLegs || tripLegs.length === 0)) { // Show loading only if no legs to display yet
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlaneTakeoff className="h-5 w-5 text-primary"/>Flight Logs</CardTitle>
          <CardDescription>Actual flight times and details for each leg.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading flight logs...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!tripLegs || tripLegs.length === 0) {
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlaneTakeoff className="h-5 w-5 text-primary"/>Flight Logs</CardTitle>
          <CardDescription>Actual flight times and details for each leg.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 text-muted-foreground">
          No legs in this trip to log for.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PlaneTakeoff className="h-5 w-5 text-primary"/>Flight Logs</CardTitle>
        <CardDescription>Actual flight times and details for each leg. Click button to log/edit.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[5%]">#</TableHead>
              <TableHead>Leg</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Take Off</TableHead>
              <TableHead>Landing</TableHead>
              <TableHead className="text-right">Flight Time</TableHead>
              <TableHead className="text-right">Block Time</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tripLegs.map((leg, index) => {
              const logEntry = flightLogs[index];
              const legDate = leg.departureDateTime && isValid(parseISO(leg.departureDateTime)) 
                              ? format(parseISO(leg.departureDateTime), 'MM/dd/yyyy') 
                              : 'N/A';
              
              const flightTime = calculateFlightTimeFromLog(logEntry);
              const blockTime = calculateBlockTimeFromLog(logEntry);

              return (
                <TableRow key={`log-summary-${index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{leg.origin} - {leg.destination}</TableCell>
                  <TableCell>{logEntry ? (logEntry.takeOffTime ? legDate : 'N/A') : legDate}</TableCell>
                  <TableCell>{logEntry?.takeOffTime || 'N/A'}</TableCell>
                  <TableCell>{logEntry?.landingTime || 'N/A'}</TableCell>
                  <TableCell className="text-right">{flightTime}</TableCell>
                  <TableCell className="text-right">{blockTime}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onLogActualsClick(index)}>
                      {logEntry ? <Edit2 className="mr-2 h-4 w-4" /> : <PlaneTakeoff className="mr-2 h-4 w-4" />}
                      {logEntry ? 'Edit Log' : 'Log Actuals'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {isLoadingLogs && tripLegs.length > 0 && (
            <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                Refreshing log data...
            </div>
        )}
      </CardContent>
    </Card>
  );
}

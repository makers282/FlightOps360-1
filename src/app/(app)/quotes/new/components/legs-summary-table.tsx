
// src/app/(app)/quotes/new/components/legs-summary-table.tsx
"use client";

import type { LegFormData } from './create-quote-form'; 
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface LegsSummaryTableProps {
  legs: LegFormData[];
}

export function LegsSummaryTable({ legs }: LegsSummaryTableProps) {
  let totalRevenueFlightTimeHours = 0;
  let totalPositioningFlightTimeHours = 0;
  let totalRevenueBlockTimeHours = 0;
  let totalPositioningBlockTimeHours = 0;

  const formattedLegs = legs.map((leg, index) => {
    let estimatedArrivalTime = "N/A";
    const flightTimeHours = Number(leg.flightTimeHours || 0);
    
    const originTaxiMinutes = Number(leg.originTaxiTimeMinutes || 0);
    const destinationTaxiMinutes = Number(leg.destinationTaxiTimeMinutes || 0);
    const blockTimeTotalMinutes = originTaxiMinutes + (flightTimeHours * 60) + destinationTaxiMinutes;
    const blockTimeHoursCalculated = parseFloat((blockTimeTotalMinutes / 60).toFixed(2));


    if (leg.departureDateTime && flightTimeHours > 0) {
      const departureTime = new Date(leg.departureDateTime);
      const arrivalTimeMillis = departureTime.getTime() + (flightTimeHours * 60 * 60 * 1000);
      estimatedArrivalTime = format(new Date(arrivalTimeMillis), "MM/dd HH:mm");

      if (leg.legType === "Charter" || leg.legType === "Owner" || leg.legType === "Ambulance" || leg.legType === "Cargo") {
        totalRevenueFlightTimeHours += flightTimeHours;
        totalRevenueBlockTimeHours += blockTimeHoursCalculated;
      } else if (leg.legType === "Positioning" || leg.legType === "Ferry" || leg.legType === "Maintenance") {
        totalPositioningFlightTimeHours += flightTimeHours;
        totalPositioningBlockTimeHours += blockTimeHoursCalculated;
      }
    } else if (flightTimeHours > 0) { // Still add to totals if flight time exists but no departure date
        if (leg.legType === "Charter" || leg.legType === "Owner" || leg.legType === "Ambulance" || leg.legType === "Cargo") {
            totalRevenueFlightTimeHours += flightTimeHours;
            totalRevenueBlockTimeHours += blockTimeHoursCalculated;
        } else if (leg.legType === "Positioning" || leg.legType === "Ferry" || leg.legType === "Maintenance") {
            totalPositioningFlightTimeHours += flightTimeHours;
            totalPositioningBlockTimeHours += blockTimeHoursCalculated;
        }
    } else if (blockTimeHoursCalculated > 0) { // Add to block time totals if only taxi times exist
      if (leg.legType === "Charter" || leg.legType === "Owner" || leg.legType === "Ambulance" || leg.legType === "Cargo") {
        totalRevenueBlockTimeHours += blockTimeHoursCalculated;
      } else if (leg.legType === "Positioning" || leg.legType === "Ferry" || leg.legType === "Maintenance") {
        totalPositioningBlockTimeHours += blockTimeHoursCalculated;
      }
    }
    
    const formatTimeDecimalToHHMM = (timeDecimal: number | undefined) => {
      if (timeDecimal === undefined || timeDecimal <= 0 || isNaN(timeDecimal)) return "00:00";
      const hours = Math.floor(timeDecimal);
      const minutes = Math.round((timeDecimal - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    return {
      legNumber: index + 1,
      legType: leg.legType,
      departure: leg.departureDateTime && leg.departureDateTime instanceof Date && !isNaN(leg.departureDateTime.getTime()) ? format(leg.departureDateTime, "MM/dd HH:mm") : "N/A",
      origin: leg.origin ? leg.origin.toUpperCase() : "N/A",
      originFbo: leg.originFbo || "N/A",
      arrival: estimatedArrivalTime,
      destination: leg.destination ? leg.destination.toUpperCase() : "N/A",
      destinationFbo: leg.destinationFbo || "N/A",
      pax: leg.passengerCount,
      flightTime: formatTimeDecimalToHHMM(leg.flightTimeHours),
      blockTime: formatTimeDecimalToHHMM(blockTimeHoursCalculated),
    };
  });

  const totalOverallFlightTimeHours = totalRevenueFlightTimeHours + totalPositioningFlightTimeHours;
  const totalOverallBlockTimeHours = totalRevenueBlockTimeHours + totalPositioningBlockTimeHours;

  const formatTotalTime = (hours: number) => {
    if (hours <= 0 || isNaN(hours)) return "0h 0m";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="overflow-x-auto bg-card p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2 text-card-foreground">Itinerary Preview</h3>
      <Table className="min-w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px] px-2 py-2 text-xs">#</TableHead>
            <TableHead className="px-2 py-2 text-xs">Type</TableHead>
            <TableHead className="px-2 py-2 text-xs">Depart (Local)</TableHead>
            <TableHead className="px-2 py-2 text-xs">From</TableHead>
            <TableHead className="px-2 py-2 text-xs">Origin FBO</TableHead>
            <TableHead className="px-2 py-2 text-xs">Arrive (Local)</TableHead>
            <TableHead className="px-2 py-2 text-xs">At</TableHead>
            <TableHead className="px-2 py-2 text-xs">Dest. FBO</TableHead>
            <TableHead className="px-2 py-2 text-xs text-center">Pax</TableHead>
            <TableHead className="px-2 py-2 text-xs text-right">Flight Time</TableHead>
            <TableHead className="px-2 py-2 text-xs text-right">Block Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formattedLegs.map((leg) => (
            <TableRow key={leg.legNumber}>
              <TableCell className="font-medium px-2 py-2 text-xs">{leg.legNumber}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.legType}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.departure}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.origin}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.originFbo}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.arrival}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.destination}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.destinationFbo}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-center">{leg.pax}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right">{leg.flightTime}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right">{leg.blockTime}</TableCell>
            </TableRow>
          ))}
          {legs.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground py-4">
                No legs added yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {legs.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right font-semibold">Total Revenue Flight Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right font-semibold">{formatTotalTime(totalRevenueFlightTimeHours)}</TableCell>
            </TableRow>
             <TableRow>
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right text-muted-foreground">Total Positioning Flight Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right text-muted-foreground">{formatTotalTime(totalPositioningFlightTimeHours)}</TableCell>
            </TableRow>
            <TableRow className="border-t-2 border-primary">
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right font-bold">TOTAL OVERALL FLIGHT TIME:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right font-bold">{formatTotalTime(totalOverallFlightTimeHours)}</TableCell>
            </TableRow>
             <TableRow>
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right font-semibold">Total Revenue Block Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right font-semibold">{formatTotalTime(totalRevenueBlockTimeHours)}</TableCell>
            </TableRow>
             <TableRow>
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right text-muted-foreground">Total Positioning Block Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right text-muted-foreground">{formatTotalTime(totalPositioningBlockTimeHours)}</TableCell>
            </TableRow>
            <TableRow className="border-t-2 border-primary">
              <TableCell colSpan={10} className="px-2 py-2 text-xs text-right font-bold">TOTAL OVERALL BLOCK TIME:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right font-bold">{formatTotalTime(totalOverallBlockTimeHours)}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}


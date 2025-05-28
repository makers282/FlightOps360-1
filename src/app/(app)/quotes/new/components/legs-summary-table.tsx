
// src/app/(app)/quotes/new/components/legs-summary-table.tsx
"use client";

import type { EstimateFlightDetailsOutput } from '@/ai/flows/estimate-flight-details-flow';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

// Duplicating legTypes to avoid potential circular dependency issues if imported elsewhere
const legTypesForSummary = [
  "Charter", "Owner", "Positioning", "Ambulance", "Cargo", "Maintenance", "Ferry"
] as const;

interface LegDataForSummary {
  origin: string;
  destination: string;
  departureDateTime?: Date;
  legType: typeof legTypesForSummary[number];
}

interface LegEstimateForSummary extends EstimateFlightDetailsOutput {
  error?: string;
  estimatedForInputs?: { origin: string; destination: string; aircraftType: string };
}

interface LegsSummaryTableProps {
  legs: LegDataForSummary[];
  legEstimates: Array<LegEstimateForSummary | null>;
  passengerCount: number;
}

export function LegsSummaryTable({ legs, legEstimates, passengerCount }: LegsSummaryTableProps) {
  let totalRevenueFlightTime = 0;
  let totalPositioningFlightTime = 0;

  const formattedLegs = legs.map((leg, index) => {
    const estimate = legEstimates[index];
    let estimatedArrivalTime = "N/A";
    let estimatedTimeEnrouteHours = 0;

    if (leg.departureDateTime && estimate && estimate.estimatedFlightTimeHours && !estimate.error) {
      const departureTime = new Date(leg.departureDateTime);
      const arrivalTimeMillis = departureTime.getTime() + (estimate.estimatedFlightTimeHours * 60 * 60 * 1000);
      estimatedArrivalTime = format(new Date(arrivalTimeMillis), "MM/dd HH:mm");
      estimatedTimeEnrouteHours = estimate.estimatedFlightTimeHours;

      if (leg.legType === "Charter" || leg.legType === "Owner" || leg.legType === "Ambulance" || leg.legType === "Cargo") {
        totalRevenueFlightTime += estimatedTimeEnrouteHours;
      } else if (leg.legType === "Positioning" || leg.legType === "Ferry" || leg.legType === "Maintenance") {
        totalPositioningFlightTime += estimatedTimeEnrouteHours;
      }
    } else if (estimate && estimate.estimatedFlightTimeHours && !estimate.error) {
        estimatedTimeEnrouteHours = estimate.estimatedFlightTimeHours;
         if (leg.legType === "Charter" || leg.legType === "Owner" || leg.legType === "Ambulance" || leg.legType === "Cargo") {
            totalRevenueFlightTime += estimatedTimeEnrouteHours;
        } else if (leg.legType === "Positioning" || leg.legType === "Ferry" || leg.legType === "Maintenance") {
            totalPositioningFlightTime += estimatedTimeEnrouteHours;
        }
    }
    
    const formatETE = (hours: number) => {
      if (hours <= 0 || isNaN(hours)) return "N/A"; 
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      legNumber: index + 1,
      legType: leg.legType,
      departure: leg.departureDateTime ? format(new Date(leg.departureDateTime), "MM/dd HH:mm") : "N/A",
      origin: leg.origin ? leg.origin.toUpperCase() : "N/A",
      arrival: estimatedArrivalTime,
      destination: leg.destination ? leg.destination.toUpperCase() : "N/A",
      pax: passengerCount > 0 ? passengerCount : "N/A",
      distance: estimate && !estimate.error && estimate.estimatedMileageNM ? estimate.estimatedMileageNM.toLocaleString() : "N/A",
      ete: formatETE(estimatedTimeEnrouteHours),
    };
  });

  const totalFlightTime = totalRevenueFlightTime + totalPositioningFlightTime;

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
            <TableHead className="px-2 py-2 text-xs">Depart</TableHead>
            <TableHead className="px-2 py-2 text-xs">From</TableHead>
            <TableHead className="px-2 py-2 text-xs">Arrive</TableHead>
            <TableHead className="px-2 py-2 text-xs">At</TableHead>
            <TableHead className="px-2 py-2 text-xs text-center">Pax</TableHead>
            <TableHead className="px-2 py-2 text-xs text-right">Dist (NM)</TableHead>
            <TableHead className="px-2 py-2 text-xs text-right">ETE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formattedLegs.map((leg) => (
            <TableRow key={leg.legNumber}>
              <TableCell className="font-medium px-2 py-2 text-xs">{leg.legNumber}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.legType}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.departure}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.origin}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.arrival}</TableCell>
              <TableCell className="px-2 py-2 text-xs">{leg.destination}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-center">{leg.pax}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right">{leg.distance}</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right">{leg.ete}</TableCell>
            </TableRow>
          ))}
          {legs.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                No legs added yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {legs.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={8} className="px-2 py-2 text-xs text-right font-semibold">Total Flight Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right font-semibold">
                  {formatTotalTime(totalFlightTime)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={8} className="px-2 py-2 text-xs text-right text-muted-foreground">Revenue Flight Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right text-muted-foreground">
                  {formatTotalTime(totalRevenueFlightTime)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={8} className="px-2 py-2 text-xs text-right text-muted-foreground">Positioning/Other Flight Time:</TableCell>
              <TableCell className="px-2 py-2 text-xs text-right text-muted-foreground">
                  {formatTotalTime(totalPositioningFlightTime)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

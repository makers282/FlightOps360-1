
/**
 * @fileOverview Zod schemas and TypeScript types for flight log data.
 */
import { z } from 'zod';

export const approachTypes = ["ILS", "GPS", "VOR", "RNAV", "Visual", "NDB", "Other"] as const;
export const fuelUnits = ["Lbs", "Gal", "Kgs", "Ltrs"] as const;

// Base Zod object schema without refinements
const _FlightLogLegDataBaseSchema = z.object({
  taxiOutTimeMins: z.coerce.number({ required_error: "Taxi-out time is required."}).int().min(0, "Taxi time cannot be negative."),
  takeOffTime: z.string({ required_error: "Take-off time is required." })
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM in 24-hr)."),
  hobbsTakeOff: z.coerce.number({ required_error: "Hobbs take-off is required."}).min(0, "Hobbs time must be positive."),
  landingTime: z.string({ required_error: "Landing time is required." })
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM in 24-hr)."),
  hobbsLanding: z.coerce.number({ required_error: "Hobbs landing is required."}).min(0, "Hobbs time must be positive."),
  taxiInTimeMins: z.coerce.number({ required_error: "Taxi-in time is required."}).int().min(0, "Taxi time cannot be negative."),

  approaches: z.coerce.number().int().min(0).default(0),
  approachType: z.enum(approachTypes).optional(),
  dayLandings: z.coerce.number().int().min(0).default(0),
  nightLandings: z.coerce.number().int().min(0).default(0),

  nightTimeDecimal: z.coerce.number().min(0).optional().default(0.0),
  instrumentTimeDecimal: z.coerce.number().min(0).optional().default(0.0),

  fobStartingFuel: z.coerce.number({ required_error: "Starting fuel (FOB) is required."}).min(0),
  fuelPurchasedAmount: z.coerce.number().min(0).optional().default(0.0),
  fuelPurchasedUnit: z.enum(fuelUnits).default("Lbs"),
  endingFuel: z.coerce.number({ required_error: "Ending fuel is required."}).min(0),
  fuelCost: z.coerce.number().min(0).optional().default(0.0),
  postLegApuTimeDecimal: z.coerce.number().min(0).optional().default(0.0),
});

// Schema for form validation, including refinements
export const FlightLogLegDataSchema = _FlightLogLegDataBaseSchema
  .refine(data => data.hobbsLanding > data.hobbsTakeOff, {
    message: "Hobbs Landing must be greater than Hobbs Take-Off.",
    path: ["hobbsLanding"],
  })
  .refine(data => data.endingFuel <= (data.fobStartingFuel + (data.fuelPurchasedAmount || 0)), {
    message: "Ending fuel cannot be more than starting fuel plus purchased fuel.",
    path: ["endingFuel"],
  });

export type FlightLogLegData = z.infer<typeof FlightLogLegDataSchema>;

// Schema for saving to Firestore, including identifiers - extends the BASE schema
export const SaveFlightLogLegInputSchema = _FlightLogLegDataBaseSchema.extend({
  tripId: z.string(),
  legIndex: z.number().int().min(0), // Or a unique legId if available
  // Timestamps will be added by the flow
});
export type SaveFlightLogLegInput = z.infer<typeof SaveFlightLogLegInputSchema>;

// Full schema for a flight log entry in Firestore - extends the BASE schema
export const FlightLogLegSchema = _FlightLogLegDataBaseSchema.extend({
  id: z.string().describe("Unique Firestore document ID for the flight log entry."),
  tripId: z.string(),
  legIndex: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Calculated fields that might be stored or just used for display
  calculatedFlightTimeDecimal: z.number().optional(),
  calculatedBlockTimeDecimal: z.number().optional(),
  calculatedFuelBurn: z.number().optional(),
});
export type FlightLogLeg = z.infer<typeof FlightLogLegSchema>;

export const FetchFlightLogLegInputSchema = z.object({
    tripId: z.string(),
    legIndex: z.number().int().min(0),
});
export type FetchFlightLogLegInput = z.infer<typeof FetchFlightLogLegInputSchema>;

export const FetchFlightLogLegOutputSchema = FlightLogLegSchema.nullable();
export const SaveFlightLogLegOutputSchema = FlightLogLegSchema;
export const DeleteFlightLogLegInputSchema = z.object({ flightLogId: z.string()});
export const DeleteFlightLogLegOutputSchema = z.object({ success: z.boolean(), flightLogId: z.string()});

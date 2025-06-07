
/**
 * @fileOverview Zod schemas and TypeScript types for trips.
 */
import { z } from 'zod';
import { legTypes } from './quote-schemas'; // Re-use legTypes

export const TripLegSchema = z.object({
  origin: z.string().min(1, "Origin airport code is required."),
  destination: z.string().min(1, "Destination airport code is required."),
  departureDateTime: z.string().optional().describe("ISO string format for planned departure."),
  arrivalDateTime: z.string().optional().describe("ISO string format for planned arrival."),
  legType: z.enum(legTypes),
  passengerCount: z.number().int().min(0),
  originFbo: z.string().optional(),
  destinationFbo: z.string().optional(),
  flightTimeHours: z.number().min(0).optional(),
  blockTimeHours: z.number().min(0).optional(),
  // Fields for actuals to be added later
  // actualDepartureTime: z.string().optional(),
  // actualArrivalTime: z.string().optional(),
  // assignedCrewIds: z.array(z.string()).optional(), // This would be for individual leg assignments if needed
});
export type TripLeg = z.infer<typeof TripLegSchema>;

export const tripStatuses = ["Scheduled", "Confirmed", "Released", "Completed", "Cancelled", "Diverted", "Awaiting Closeout"] as const;
export type TripStatus = typeof tripStatuses[number];

export const TripSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the trip."),
  tripId: z.string().describe("User-facing Trip ID (e.g., TRP-XYZ)."),
  quoteId: z.string().optional().describe("ID of the source quote, if applicable."),
  // Customer details can be denormalized or fetched via customerId
  customerId: z.string().optional().describe("ID of the associated customer."),
  clientName: z.string().describe("Name of the client for this trip."),
  
  aircraftId: z.string().describe("ID of the assigned aircraft."),
  aircraftLabel: z.string().optional().describe("Display label for the aircraft (e.g., N123AB - Cessna CJ3)."),

  legs: z.array(TripLegSchema).min(1, "A trip must have at least one leg."),
  
  status: z.enum(tripStatuses).default("Scheduled"),
  
  // Crew assignments for the overall trip
  assignedPilotId: z.string().optional().describe("ID of the assigned Pilot in Command (PIC)."),
  assignedCoPilotId: z.string().optional().describe("ID of the assigned Second in Command (SIC) / Co-Pilot."),
  assignedFlightAttendantIds: z.array(z.string()).optional().default([]).describe("IDs of assigned Flight Attendants."),
  // assignedOtherCrewIds: z.array(z.string()).optional().default([]).describe("IDs of other assigned crew members like medics, loadmasters."),


  notes: z.string().optional().describe("Internal notes about the trip."),
  
  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type Trip = z.infer<typeof TripSchema>;

// Schema for saving a trip (input to the flow)
// id, createdAt, and updatedAt will be handled by the server.
export const SaveTripInputSchema = TripSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type SaveTripInput = z.infer<typeof SaveTripInputSchema>;

// Schema for the output of the save operation
export const SaveTripOutputSchema = TripSchema;

// For fetching multiple trips
export const FetchTripsOutputSchema = z.array(TripSchema);

// For fetching a single trip by ID (input schema)
export const FetchTripByIdInputSchema = z.object({
  id: z.string(), // Using the Firestore document ID here
});

// For deleting a trip
export const DeleteTripInputSchema = z.object({
  id: z.string(), // Using the Firestore document ID here
});
export type DeleteTripInput = z.infer<typeof DeleteTripInputSchema>;

export const DeleteTripOutputSchema = z.object({
  success: z.boolean(),
  tripId: z.string(), // Return the Firestore document ID for confirmation
});


import { z } from 'zod';

// Define the structure for an individual service/fee rate
export const ServiceFeeRateSchema = z.object({
  displayDescription: z.string().min(1, "Display description is required."),
  buy: z.number().min(0, "Buy rate must be non-negative."),
  sell: z.number().min(0, "Sell rate must be non-negative."),
  unitDescription: z.string().min(1, "Unit description is required (e.g., Per Leg, Per Service)."),
  isActive: z.boolean().optional().default(true).describe("Indicates if this service/fee is active and should be considered for default pricing on new quotes."),
});
export type ServiceFeeRate = z.infer<typeof ServiceFeeRateSchema>;

// Define the structure for the company profile
export const CompanyProfileSchema = z.object({
  id: z.string().default("main").describe("The fixed ID for the company profile document, typically 'main'."),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().optional(),
  companyPhone: z.string().optional(),
  logoUrl: z.string().url().optional().describe("URL of the company logo."),
  serviceFeeRates: z.record(ServiceFeeRateSchema).optional().default({}).describe("A map of service/fee keys to their rate details."),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// Schemas for flow inputs and outputs
export const SaveCompanyProfileInputSchema = CompanyProfileSchema;
export type SaveCompanyProfileInput = z.infer<typeof SaveCompanyProfileInputSchema>;

export const FetchCompanyProfileOutputSchema = CompanyProfileSchema.nullable(); // Can be null if no profile exists
export const SaveCompanyProfileOutputSchema = CompanyProfileSchema;

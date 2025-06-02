
/**
 * @fileOverview Zod schemas and TypeScript types for user roles and permissions.
 */
import { z } from 'zod';

// Define available permissions for the system
// These can be expanded as more granular control is needed.
export const availablePermissions = [
  // Company & System Management
  "MANAGE_COMPANY_SETTINGS", // Edit company profile, manage fleet in company settings (Covers "System Settings")
  "MANAGE_QUOTE_CONFIG",     // Manage aircraft hourly rates, standard service/fee rates (Part of "System Settings")
  "MANAGE_USERS_ROLES",      // Manage user roles and permissions (Covers Admin "Manage Users")
  "MANAGE_BILLING",          // New for Admin "Billing"

  // Customer Management
  "MANAGE_CUSTOMERS",        // Add, edit, delete customers (Covers Sales "View Customer Data" broadly)
  
  // Quote Management
  "CREATE_QUOTES",
  "VIEW_ALL_QUOTES",
  "MANAGE_ALL_QUOTES",       // Edit, delete any quote
  
  // Aircraft & Maintenance
  "MANAGE_AIRCRAFT_MAINTENANCE_DATA", // Manage tasks, component times, log maintenance, forecast (Covers Maintenance "Log Maintenance", "Forecast Maintenance", "View Aircraft Status")
  
  // Trip & Schedule Management
  "VIEW_TRIPS",              // View trip calendar, list, details (Covers Flight Crew "View Schedule", FAA "View Flight Logs")
  "MANAGE_TRIPS",            // Create, edit, delete trips (Covers Dispatch "Schedule Trips", "Release Flights")
  
  // Page/Feature Access
  "VIEW_DASHBOARD",
  "ACCESS_SETTINGS_MENU",    // General access to settings section
  "ACCESS_FRAT_PAGE",        // Access to FRAT page (Covers Flight Crew "Submit FRAT")
  "ACCESS_DOCUMENTS_PAGE",   // Access to Document Hub (Covers Flight Crew "Access Documents", FAA "View Compliance Docs")
  "ACCESS_OPTIMAL_ROUTE_PAGE",// Access to Optimal Route tool (Covers Dispatch "Use Optimal Route Tool")

] as const;
export const PermissionSchema = z.enum(availablePermissions);
export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the role."),
  name: z.string().min(1, "Role name is required."),
  description: z.string().optional(),
  permissions: z.array(PermissionSchema).default([]).describe("List of permissions granted to this role."),
  isSystemRole: z.boolean().optional().default(false).describe("Indicates if the role is a system-defined role and cannot be deleted/modified extensively."),
  createdAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
});
export type Role = z.infer<typeof RoleSchema>;

// Schema for saving a role (input to the flow)
// id is optional: if provided, it's an update; if not, it's a new role.
// createdAt and updatedAt will be handled by the server.
export const SaveRoleInputSchema = RoleSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  id: z.string().optional(), 
});
export type SaveRoleInput = z.infer<typeof SaveRoleInputSchema>;

// Schema for the output of the save operation
export const SaveRoleOutputSchema = RoleSchema;

// For fetching multiple roles
export const FetchRolesOutputSchema = z.array(RoleSchema);

// For deleting a role
export const DeleteRoleInputSchema = z.object({
  roleId: z.string(),
});
export const DeleteRoleOutputSchema = z.object({
  success: z.boolean(),
  roleId: z.string(),
});


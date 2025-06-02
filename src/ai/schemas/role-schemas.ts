
/**
 * @fileOverview Zod schemas and TypeScript types for user roles and permissions.
 */
import { z } from 'zod';

// Define available permissions for the system
// These can be expanded as more granular control is needed.
export const availablePermissions = [
  "MANAGE_COMPANY_SETTINGS", // Edit company profile, manage fleet in company settings
  "MANAGE_QUOTE_CONFIG",     // Manage aircraft hourly rates, standard service/fee rates
  "MANAGE_CUSTOMERS",        // Add, edit, delete customers
  "CREATE_QUOTES",
  "VIEW_ALL_QUOTES",
  "MANAGE_ALL_QUOTES",       // Edit, delete any quote
  "MANAGE_AIRCRAFT_MAINTENANCE_DATA", // Manage tasks, component times on currency page
  "VIEW_TRIPS",
  "MANAGE_TRIPS",            // Create, edit, delete trips
  "MANAGE_USERS_ROLES",      // Manage user roles and permissions
  "VIEW_DASHBOARD",
  "ACCESS_SETTINGS_MENU",    // General access to settings section
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

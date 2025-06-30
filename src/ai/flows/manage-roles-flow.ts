
'use server';
/**
 * @fileOverview Genkit flows for managing user roles and permissions using Firestore.
 *
 * - fetchRoles - Fetches all roles.
 * - saveRole - Saves (adds or updates) a role.
 * - deleteRole - Deletes a role.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Role, SaveRoleInput, Permission } from '@/ai/schemas/role-schemas';
import {
    RoleSchema,
    SaveRoleInputSchema,
    SaveRoleOutputSchema,
    FetchRolesOutputSchema,
    DeleteRoleInputSchema,
    DeleteRoleOutputSchema,
    availablePermissions,
} from '@/ai/schemas/role-schemas';


const ROLES_COLLECTION = 'roles';

const predefinedRoles: SaveRoleInput[] = [
  {
    name: "Administrator",
    description: "Full access to all system features and settings.",
    permissions: [...availablePermissions] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Flight Crew",
    description: "Access to flight schedules, aircraft status, and FRAT submission.",
    permissions: ["VIEW_TRIPS", "ACCESS_FRAT_PAGE", "ACCESS_DOCUMENTS_PAGE", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Dispatch",
    description: "Manages trip scheduling, flight releases, and optimal routing.",
    permissions: ["MANAGE_TRIPS", "VIEW_TRIPS", "ACCESS_OPTIMAL_ROUTE_PAGE", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Maintenance",
    description: "Tracks aircraft compliance and maintenance schedules.",
    permissions: ["MANAGE_AIRCRAFT_MAINTENANCE_DATA", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "Sales",
    description: "Manages quotes and customer communication.",
    permissions: ["CREATE_QUOTES", "VIEW_ALL_QUOTES", "MANAGE_CUSTOMERS", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  },
  {
    name: "FAA Inspector",
    description: "Read-only access to compliance and operational data.",
    permissions: ["ACCESS_DOCUMENTS_PAGE", "VIEW_TRIPS", "VIEW_DASHBOARD"] as Permission[],
    isSystemRole: true,
  }
];

// This function checks for and creates any missing system roles.
async function seedPredefinedRoles() {
  if (!db) return;
  const rolesCollectionRef = db.collection(ROLES_COLLECTION);
  const existingRolesSnapshot = await rolesCollectionRef.where('isSystemRole', '==', true).get();
  const existingSystemRoleNames = new Set(existingRolesSnapshot.docs.map(doc => doc.data().name));

  const rolesToCreate = predefinedRoles.filter(pRole => !existingSystemRoleNames.has(pRole.name!));
  
  if (rolesToCreate.length > 0) {
    console.log(`[seedPredefinedRoles] Seeding ${rolesToCreate.length} missing system roles...`);
    const batch = db.batch();
    for (const roleData of rolesToCreate) {
        // Use a consistent, predictable ID for system roles.
        const roleId = roleData.name!.toLowerCase().replace(/\s+/g, '-');
        const roleDocRef = rolesCollectionRef.doc(roleId);
        const dataWithTimestamps = {
            ...roleData,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(roleDocRef, dataWithTimestamps);
    }
    await batch.commit();
    console.log('[seedPredefinedRoles] System roles seeded successfully.');
    return true; // Indicate that seeding happened
  }
  return false; // No seeding was needed
}


// Exported async functions that clients will call
export async function fetchRoles(): Promise<Role[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchRoles (manage-roles-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchRoles.");
  }
  console.log('[ManageRolesFlow Firestore Admin] Attempting to fetch all roles.');
  return fetchRolesFlow();
}

export async function saveRole(input: SaveRoleInput): Promise<Role> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveRole (manage-roles-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveRole.");
  }
  const roleId = input.id || db.collection(ROLES_COLLECTION).doc().id;
  console.log('[ManageRolesFlow Firestore Admin] Attempting to save role:', roleId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }

  return saveRoleFlow({ roleId, roleData: dataToSaveInDb as Omit<SaveRoleInput, 'id'> });
}

export async function deleteRole(input: { roleId: string }): Promise<{ success: boolean; roleId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteRole (manage-roles-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteRole.");
  }
  console.log('[ManageRolesFlow Firestore Admin] Attempting to delete role ID:', input.roleId);
  return deleteRoleFlow(input);
}

// Genkit Flow Definitions
const fetchRolesFlow = ai.defineFlow(
  {
    name: 'fetchRolesFlow',
    outputSchema: FetchRolesOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchRolesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchRolesFlow.");
    }
    console.log('Executing fetchRolesFlow - Firestore');

    // Ensure system roles exist before fetching
    await seedPredefinedRoles();

    try {
      const rolesCollectionRef = db.collection(ROLES_COLLECTION);
      const snapshot = await rolesCollectionRef.get();
      const rolesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          // Ensure permissions is always an array, even if undefined in DB
          permissions: data.permissions || [],
          isSystemRole: data.isSystemRole || false,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Role;
      });
      console.log('Fetched roles from Firestore:', rolesList.length, 'roles.');
      return rolesList;
    } catch (error) {
      console.error('Error fetching roles from Firestore:', error);
      throw new Error(`Failed to fetch roles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const InternalSaveRoleInputSchema = z.object({
    roleId: z.string(),
    roleData: SaveRoleInputSchema.omit({id: true}), // Data without the ID field
});

const saveRoleFlow = ai.defineFlow(
  {
    name: 'saveRoleFlow',
    inputSchema: InternalSaveRoleInputSchema,
    outputSchema: SaveRoleOutputSchema,
  },
  async ({ roleId, roleData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveRoleFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveRoleFlow.");
    }
    console.log('Executing saveRoleFlow with input - Firestore:', roleId);
    try {
      const roleDocRef = db.collection(ROLES_COLLECTION).doc(roleId);
      const docSnap = await roleDocRef.get();

      const dataWithTimestamps = {
        ...roleData,
        permissions: roleData.permissions || [], // Ensure permissions is an array
        isSystemRole: roleData.isSystemRole || false,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await roleDocRef.set(dataWithTimestamps, { merge: true });
      console.log('Saved role in Firestore:', roleId);
      
      const savedDoc = await roleDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error(`Failed to retrieve saved role data for ID: ${roleId}`);
      }

      return {
        id: roleId,
        ...savedData,
        permissions: savedData?.permissions || [],
        isSystemRole: savedData?.isSystemRole || false,
        createdAt: (savedData?.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData?.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Role;
    } catch (error) {
      console.error('Error saving role to Firestore:', error);
      throw new Error(`Failed to save role ${roleId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteRoleFlow = ai.defineFlow(
  {
    name: 'deleteRoleFlow',
    inputSchema: DeleteRoleInputSchema,
    outputSchema: DeleteRoleOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteRoleFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteRoleFlow.");
    }
    console.log('Executing deleteRoleFlow for role ID - Firestore:', input.roleId);
    try {
      const roleDocRef = db.collection(ROLES_COLLECTION).doc(input.roleId);
      const docSnap = await roleDocRef.get();

      if (docSnap.exists && docSnap.data()?.isSystemRole) {
          throw new Error("System roles cannot be deleted.");
      }

      await roleDocRef.delete();
      console.log('Deleted role from Firestore:', input.roleId);
      return { success: true, roleId: input.roleId };
    } catch (error) {
      console.error('Error deleting role from Firestore:', error);
      throw new Error(`Failed to delete role ${input.roleId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

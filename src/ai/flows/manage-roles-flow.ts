
'use server';
/**
 * @fileOverview Genkit flows for managing user roles and permissions using Firestore.
 *
 * - fetchRoles - Fetches all roles.
 * - saveRole - Saves (adds or updates) a role.
 * - deleteRole - Deletes a role.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import type { Role, SaveRoleInput } from '@/ai/schemas/role-schemas';
import {
    RoleSchema,
    SaveRoleInputSchema,
    SaveRoleOutputSchema,
    FetchRolesOutputSchema,
    DeleteRoleInputSchema,
    DeleteRoleOutputSchema
} from '@/ai/schemas/role-schemas';
import { z } from 'zod';

const ROLES_COLLECTION = 'roles';

// Exported async functions that clients will call
export async function fetchRoles(): Promise<Role[]> {
  console.log('[ManageRolesFlow Firestore] Attempting to fetch all roles.');
  return fetchRolesFlow();
}

export async function saveRole(input: SaveRoleInput): Promise<Role> {
  const roleId = input.id || doc(collection(db, ROLES_COLLECTION)).id;
  console.log('[ManageRolesFlow Firestore] Attempting to save role:', roleId);

  const dataToSaveInDb = { ...input };
  if (dataToSaveInDb.id) {
    delete (dataToSaveInDb as any).id;
  }

  return saveRoleFlow({ roleId, roleData: dataToSaveInDb as Omit<SaveRoleInput, 'id'> });
}

export async function deleteRole(input: { roleId: string }): Promise<{ success: boolean; roleId: string }> {
  console.log('[ManageRolesFlow Firestore] Attempting to delete role ID:', input.roleId);
  return deleteRoleFlow(input);
}

// Genkit Flow Definitions
const fetchRolesFlow = ai.defineFlow(
  {
    name: 'fetchRolesFlow',
    outputSchema: FetchRolesOutputSchema,
  },
  async () => {
    console.log('Executing fetchRolesFlow - Firestore');
    try {
      const rolesCollectionRef = collection(db, ROLES_COLLECTION);
      const snapshot = await getDocs(rolesCollectionRef);
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
    console.log('Executing saveRoleFlow with input - Firestore:', roleId);
    try {
      const roleDocRef = doc(db, ROLES_COLLECTION, roleId);
      const docSnap = await getDoc(roleDocRef);

      const dataWithTimestamps = {
        ...roleData,
        permissions: roleData.permissions || [], // Ensure permissions is an array
        isSystemRole: roleData.isSystemRole || false,
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(roleDocRef, dataWithTimestamps, { merge: true });
      console.log('Saved role in Firestore:', roleId);
      
      const savedDoc = await getDoc(roleDocRef);
      const savedData = savedDoc.data();

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
    console.log('Executing deleteRoleFlow for role ID - Firestore:', input.roleId);
    try {
      const roleDocRef = doc(db, ROLES_COLLECTION, input.roleId);
      const docSnap = await getDoc(roleDocRef);

      if (docSnap.exists() && docSnap.data().isSystemRole) {
          throw new Error("System roles cannot be deleted.");
      }

      await deleteDoc(roleDocRef);
      console.log('Deleted role from Firestore:', input.roleId);
      return { success: true, roleId: input.roleId };
    } catch (error) {
      console.error('Error deleting role from Firestore:', error);
      throw new Error(`Failed to delete role ${input.roleId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

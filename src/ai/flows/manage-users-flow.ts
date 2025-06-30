
'use server';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import { adminApp } from '@/lib/firebase-admin';
import { fetchRoles } from './manage-roles-flow';
import { saveCrewMember } from './manage-crew-flow';

const adminAuth = getAuth(adminApp);

const UserSchema = z.object({
    uid: z.string(),
    email: z.string().optional(),
    displayName: z.string().optional(),
    disabled: z.boolean(),
    roles: z.array(z.string()).optional(),
});
export type User = z.infer<typeof UserSchema>;

const FetchUsersOutputSchema = z.array(UserSchema);

const CreateUserInputSchema = z.object({
    email: z.string().email(),
    displayName: z.string(),
    roles: z.array(z.string()).min(1, "At least one role must be assigned."),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

const UpdateUserInputSchema = z.object({
    uid: z.string(),
    displayName: z.string().optional(),
    email: z.string().email().optional(),
    roles: z.array(z.string()).min(1, "At least one role must be assigned.").optional(),
    disabled: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

const DeleteUserInputSchema = z.object({
    uid: z.string(),
});

export async function fetchUsers(): Promise<User[]> {
    return fetchUsersFlow();
}

export async function createUser(input: CreateUserInput): Promise<User> {
    return createUserFlow(input);
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
    return updateUserFlow(input);
}

export async function deleteUser(uid: string): Promise<void> {
    return deleteUserFlow({ uid });
}

const fetchUsersFlow = ai.defineFlow(
    {
        name: 'fetchUsersFlow',
        outputSchema: FetchUsersOutputSchema,
    },
    async () => {
        try {
            const userRecords = await adminAuth.listUsers();
            return Promise.all(userRecords.users.map(async user => {
                const customClaims = (await adminAuth.getUser(user.uid)).customClaims;
                return {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    disabled: user.disabled,
                    roles: customClaims?.roles || [],
                }
            }));
        } catch (error) {
            console.error('Error fetching users:', error);
            throw new Error('Failed to fetch users.');
        }
    }
);

const createUserFlow = ai.defineFlow(
    {
        name: 'createUserFlow',
        inputSchema: CreateUserInputSchema,
        outputSchema: UserSchema,
    },
    async (input) => {
        try {
            const userRecord = await adminAuth.createUser({
                email: input.email,
                displayName: input.displayName,
                emailVerified: false, 
                disabled: false,
            });

            await adminAuth.setCustomUserClaims(userRecord.uid, { roles: input.roles });
            
            // Check if user should be added to the crew roster
            const allRoles = await fetchRoles();
            const flightCrewRole = allRoles.find(r => r.name === 'Flight Crew');

            if (flightCrewRole && input.roles.includes(flightCrewRole.id)) {
                console.log(`User ${input.email} has 'Flight Crew' role. Creating crew member profile.`);
                const [firstName, ...lastNameParts] = (input.displayName || '').split(' ');
                const lastName = lastNameParts.join(' ');
                
                await saveCrewMember({
                    firstName: firstName || 'New',
                    lastName: lastName || 'Crew',
                    email: input.email,
                    userId: userRecord.uid,
                    role: 'Other', // Let them set the primary role in onboarding
                    isActive: true,
                    // onboardingStatus will default to 'Pending' in the schema
                });
                console.log(`Crew member profile created for ${input.email}.`);
            }


            return {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                disabled: userRecord.disabled,
                roles: input.roles,
            };
        } catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user.');
        }
    }
);

const updateUserFlow = ai.defineFlow(
    {
        name: 'updateUserFlow',
        inputSchema: UpdateUserInputSchema,
        outputSchema: UserSchema,
    },
    async (input) => {
        const { uid, roles, ...updateData } = input;
        try {
            const updatedUserRecord = await adminAuth.updateUser(uid, updateData);

            if (roles) {
                 await adminAuth.setCustomUserClaims(uid, { roles });
            }

            const customClaims = (await adminAuth.getUser(uid)).customClaims;
            
            return {
                uid: updatedUserRecord.uid,
                email: updatedUserRecord.email,
                displayName: updatedUserRecord.displayName,
                disabled: updatedUserRecord.disabled,
                roles: customClaims?.roles || [],
            };
        } catch (error) {
            console.error(`Error updating user ${uid}:`, error);
            throw new Error(`Failed to update user.`);
        }
    }
);

const deleteUserFlow = ai.defineFlow(
    {
        name: 'deleteUserFlow',
        inputSchema: DeleteUserInputSchema,
    },
    async ({ uid }) => {
        try {
            await adminAuth.deleteUser(uid);
            console.log(`Successfully deleted user ${uid}`);
        } catch (error) {
            console.error(`Error deleting user ${uid}:`, error);
            throw new Error(`Failed to delete user.`);
        }
    }
);

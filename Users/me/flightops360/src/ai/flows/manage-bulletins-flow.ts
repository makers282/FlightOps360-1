'use server';
/**
 * @fileOverview Genkit flows for managing company bulletins using Firestore via the Admin SDK.
 *
 * - saveBulletin – Adds or updates a bulletin.
 * - fetchBulletins – Pulls all bulletins, sorted newest first.
 * - deleteBulletin – Removes a bulletin.
 */

import { ai } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';               // your initialized Admin Firestore
import { FieldValue } from 'firebase-admin/firestore';        // for serverTimestamp()
import { z } from 'zod';
import type { Bulletin, SaveBulletinInput } from '@/ai/schemas/bulletin-schemas';
import {
  SaveBulletinInputSchema,
  SaveBulletinsOutputSchema as SaveBulletinOutputSchema,
  FetchBulletinsOutputSchema,
  DeleteBulletinInputSchema,
  DeleteBulletinOutputSchema,
} from '@/ai/schemas/bulletin-schemas';
import { createNotification } from '@/ai/flows/manage-notifications-flow';

const BULLETINS = 'bulletins';

export async function saveBulletin(input: SaveBulletinInput): Promise<Bulletin> {
  // generate an ID if none was passed
  const id = input.id || adminDb.collection(BULLETINS).doc().id;
  const { id: _discard, ...payload } = input;
  return saveBulletinFlow({ id, payload });
}

export async function fetchBulletins(): Promise<Bulletin[]> {
  return fetchBulletinsFlow();
}

export async function deleteBulletin(input: { bulletinId: string }): Promise<{ success: boolean; bulletinId: string }> {
  return deleteBulletinFlow(input);
}

// --- internal schema for Genkit ---
const InternalSaveBulletin = z.object({
  id: z.string(),
  payload: SaveBulletinInputSchema.omit({ id: true }),
});

// --- save flow ---
const saveBulletinFlow = ai.defineFlow(
  {
    name: 'saveBulletinFlow',
    inputSchema: InternalSaveBulletin,
    outputSchema: SaveBulletinOutputSchema,
  },
  async ({ id, payload }) => {
    const ref = adminDb.collection(BULLETINS).doc(id);
    const before = await ref.get();
    const wasActive = before.exists && before.data()?.isActive === true;

    // build our Firestore data
    const data = {
      ...payload,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt:
        before.exists && before.data()?.createdAt
          ? before.data()!.createdAt
          : FieldValue.serverTimestamp(),
    };

    await ref.set(data, { merge: true });
    const after = await ref.get();
    if (!after.exists) throw new Error(`Bulletin ${id} vanished after save!`);

    const doc = after.data()!;
    // if they just flipped active → true, fire off a notification:
    if (doc.isActive === true && !wasActive) {
      await createNotification({
        type: 'info',
        title: `New Bulletin: ${doc.title}`,
        message: `A bulletin titled "${doc.title}" has just been published.`,
        timestamp: new Date().toISOString(),
        isRead: false,
        link: '/dashboard',
      });
    }

    return {
      id,
      ...doc,
      publishedAt: (doc.publishedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
      createdAt:   (doc.createdAt   as FirebaseFirestore.Timestamp).toDate().toISOString(),
      updatedAt:   (doc.updatedAt   as FirebaseFirestore.Timestamp).toDate().toISOString(),
    } as Bulletin;
  }
);

// --- fetch flow ---
const fetchBulletinsFlow = ai.defineFlow(
  {
    name: 'fetchBulletinsFlow',
    outputSchema: FetchBulletinsOutputSchema,
  },
  async () => {
    const snap = await adminDb
      .collection(BULLETINS)
      .orderBy('publishedAt', 'desc')
      .get();

    return snap.docs.map(d => {
      const data = d.data()!;
      return {
        id: d.id,
        ...data,
        publishedAt: (data.publishedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
        createdAt:   (data.createdAt   as FirebaseFirestore.Timestamp).toDate().toISOString(),
        updatedAt:   (data.updatedAt   as FirebaseFirestore.Timestamp).toDate().toISOString(),
      } as Bulletin;
    });
  }
);

// --- delete flow ---
const deleteBulletinFlow = ai.defineFlow(
  {
    name: 'deleteBulletinFlow',
    inputSchema: DeleteBulletinInputSchema,
    outputSchema: DeleteBulletinOutputSchema,
  },
  async ({ bulletinId }) => {
    await adminDb.collection(BULLETINS).doc(bulletinId).delete();
    return { success: true, bulletinId };
  }
);
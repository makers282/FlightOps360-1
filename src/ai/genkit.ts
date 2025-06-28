
// src/ai/genkit.ts
import { genkit as initializeAI } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';

export const ai = initializeAI({
  plugins: [
    googleAI(),
    firebase(),
  ],
});

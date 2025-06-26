
import { genkit, flow } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { firebase as firebaseGenkitPlugin } from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI(),
    firebaseGenkitPlugin,
  ],
  model: 'googleai/gemini-1.5-flash',
});

export { flow };

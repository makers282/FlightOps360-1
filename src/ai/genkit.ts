
import { genkit, flow } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import next from '@genkit-ai/next';

export const ai = genkit({
  plugins: [
    googleAI(),
    next, // Pass the plugin object directly, don't call it as a function
  ],
  model: 'googleai/gemini-1.5-flash',
});

export { flow };

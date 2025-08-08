
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI(),
    enableFirebaseTelemetry(), // Correctly placed inside the plugins array
  ],
  // The 'telemetry' and 'logLevel' options are configured via plugins or environment variables in Genkit 1.x
  model: 'gemini-1.5-flash', // Example model
});


import { genkit, type GenkitOpenTelemetry } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

// The 'googleAI' plugin handles the model provider.
// The 'enableFirebaseTelemetry' function is called to configure telemetry,
// it does not return a plugin object to be placed in the plugins array.
// We call it once to set up the connection.
enableFirebaseTelemetry();

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // The 'telemetry' and 'logLevel' options are configured via plugins or environment variables in Genkit 1.x
  // The 'enableFirebaseTelemetry()' call above handles the necessary setup.
  model: 'gemini-1.5-flash', // Example model
});

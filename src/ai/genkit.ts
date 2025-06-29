
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
  telemetry: {
    instrumentation: {
      // You can add other OTel instrumentations here if needed
    },
    // The logger can be configured here if you don't want the default
  },
  model: 'gemini-1.5-flash', // Example model
});

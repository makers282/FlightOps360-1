
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-optimal-route.ts';
import '@/ai/flows/estimate-flight-details-flow.ts';
import '@/ai/flows/fetch-fbos-flow.ts'; 
import '@/ai/flows/manage-aircraft-rates-flow.ts'; 
import '@/ai/flows/suggest-aircraft-performance-flow.ts'; 
import '@/ai/flows/manage-fleet-flow.ts';
import '@/ai/flows/manage-maintenance-tasks-flow.ts'; // Added new maintenance tasks flow
import '@/ai/flows/manage-component-times-flow.ts'; // Added new component times flow
import '@/ai/flows/manage-company-profile-flow.ts'; // Added company profile flow

// Schemas are not Genkit plugins and should not be imported here for registration.
// They are imported directly by flows or components that use them.
// import '@/ai/schemas/aircraft-rate-schemas.ts'; 


// Tools are typically not registered here directly in dev.ts unless they are part of a flow that gets auto-registered
// However, ensure the tool file (get-fbos-tool.ts) is processed if it defines and registers tools used by flows.
// Genkit usually picks up tools if they are defined with ai.defineTool and imported/used by a registered flow.



import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-optimal-route.ts';
import '@/ai/flows/estimate-flight-details-flow.ts';
import '@/ai/flows/fetch-fbos-flow.ts'; 
import '@/ai/flows/manage-aircraft-rates-flow.ts'; 
import '@/ai/flows/suggest-aircraft-performance-flow.ts'; 
import '@/ai/flows/manage-fleet-flow.ts';
import '@/ai/flows/manage-maintenance-tasks-flow.ts';
import '@/ai/flows/manage-component-times-flow.ts';
import '@/ai/flows/manage-company-profile-flow.ts';
import '@/ai/flows/manage-quotes-flow.ts';
import '@/ai/flows/manage-customers-flow.ts'; 
import '@/ai/flows/manage-aircraft-performance-flow.ts'; 
import '@/ai/flows/send-quote-email-flow.ts'; 
import '@/ai/flows/manage-roles-flow.ts'; 
import '@/ai/flows/manage-users-flow.ts'; 
import '@/ai/flows/manage-trips-flow.ts'; 
import '@/ai/flows/manage-crew-flow.ts'; 
import '@/ai/flows/manage-aircraft-block-outs-flow.ts'; 
import '@/ai/flows/manage-crew-documents-flow.ts'; 
import '@/ai/flows/manage-aircraft-documents-flow.ts'; 
import '@/ai/flows/upload-aircraft-document-flow.ts'; 
import '@/ai/flows/manage-company-documents-flow.ts'; 
import '@/ai/flows/manage-bulletins-flow.ts'; 
import '@/ai/flows/manage-notifications-flow.ts'; 
import '@/ai/flows/manage-aircraft-discrepancies-flow.ts'; 
import '@/ai/flows/manage-mel-items-flow.ts'; 
import '@/ai/flows/manage-flight-logs-flow.ts';
import '@/ai/flows/manage-maintenance-costs-flow.ts';

// Schemas are not Genkit plugins and should not be imported here for registration.
// They are imported directly by flows or components that use them.


// Tools are typically not registered here directly in dev.ts unless they are part of a flow that gets auto-registered
// However, ensure the tool file (get-fbos-tool.ts) is processed if it defines and registers tools used by flows.
// Genkit usually picks up tools if they are defined with ai.defineTool and imported/used by a registered flow.









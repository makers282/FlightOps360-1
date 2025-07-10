
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft maintenance tasks using Firestore.
 * Tasks are associated with specific aircraft from the fleet.
 *
 * - fetchMaintenanceTasksForAircraft - Fetches all tasks for a given aircraft.
 * - fetchAllMaintenanceTasks - Fetches all tasks for all aircraft.
 * - saveMaintenanceTask - Saves (adds or updates) a maintenance task.
 * - deleteMaintenanceTask - Deletes a maintenance task.
 * - generateMaintenanceWorkOrder - Generates a work order PDF from selected tasks.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { fetchFleetAircraft } from './manage-fleet-flow';
import { fetchCompanyProfile } from './manage-company-profile-flow'; // Import company profile
import { fetchComponentTimesForAircraft } from './manage-component-times-flow'; // Import component times
import { format, parseISO, isValid, addDays, addMonths, addYears, endOfMonth } from 'date-fns';


// This schema should align closely with MaintenanceTaskFormData from the modal,
// plus an 'id' for the task itself and 'aircraftId' for association.
const MaintenanceTaskSchema = z.object({
  id: z.string().describe("Unique identifier for the maintenance task (document ID)."),
  aircraftId: z.string().describe("Identifier of the aircraft this task belongs to."),
  itemTitle: z.string().min(1, "Item title is required"),
  referenceNumber: z.string().optional(),
  partNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  itemType: z.enum(["Inspection", "Service Bulletin", "Airworthiness Directive", "Component Replacement", "Overhaul", "Life Limited Part", "Other"]),
  associatedComponent: z.string().optional(),
  details: z.string().optional(),
  isActive: z.boolean().default(true),
  trackType: z.enum(["Interval", "One Time", "Dont Alert"]).default("Interval"),
  isTripsNotAffected: z.boolean().default(false),
  
  lastCompletedDate: z.string().optional().describe("YYYY-MM-DD format"),
  lastCompletedHours: z.number().nonnegative().optional(),
  lastCompletedCycles: z.number().nonnegative().int().optional(),
  lastCompletedNotes: z.string().optional(),

  isHoursDueEnabled: z.boolean().default(false),
  hoursDue: z.number().positive("Must be positive when enabled.").optional(),
  hoursTolerance: z.number().min(0, "Cannot be negative").optional(),
  alertHoursPrior: z.number().min(0, "Cannot be negative").optional(),

  isCyclesDueEnabled: z.boolean().default(false),
  cyclesDue: z.number().positive("Must be positive when enabled.").int().optional(),
  cyclesTolerance: z.number().min(0, "Cannot be negative").int().optional(),
  alertCyclesPrior: z.number().min(0, "Cannot be negative").int().optional(),

  isDaysDueEnabled: z.boolean().default(false),
  daysIntervalType: z.enum(["days", "months_specific_day", "months_eom", "years_specific_day"]).optional(),
  daysDueValue: z.string().optional().describe("Can be number of days for interval, or YYYY-MM-DD for one-time"),
  daysTolerance: z.number().min(0, "Cannot be negative").int().optional(),
  alertDaysPrior: z.number().min(0, "Cannot be negative").int().optional(),
});
export type MaintenanceTask = z.infer<typeof MaintenanceTaskSchema>;

const FetchTasksInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft for which to fetch tasks."),
});
export type FetchTasksInput = z.infer<typeof FetchTasksInputSchema>;

const SaveTaskInputSchema = MaintenanceTaskSchema; // The whole task object is needed for saving
export type SaveTaskInput = z.infer<typeof SaveTaskInputSchema>;

const DeleteTaskInputSchema = z.object({
  taskId: z.string().describe("The ID of the maintenance task to delete."),
  // aircraftId is not strictly needed for deletion if taskId is globally unique, but can be good for namespacing or validation
});
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

const GenerateWorkOrderInputSchema = z.object({
    aircraftId: z.string(),
    taskIds: z.array(z.string()),
});
export type GenerateWorkOrderInput = z.infer<typeof GenerateWorkOrderInputSchema>;

const FetchTasksOutputSchema = z.array(MaintenanceTaskSchema);
const SaveTaskOutputSchema = MaintenanceTaskSchema; // Returns the saved task
const DeleteTaskOutputSchema = z.object({
  success: z.boolean(),
  taskId: z.string(),
});

const MAINTENANCE_TASKS_COLLECTION = 'maintenanceTasks';

// Exported async functions that clients will call
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraft.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to fetch tasks for aircraft ID:', input.aircraftId);
  return fetchMaintenanceTasksForAircraftFlow(input);
}

export async function fetchAllMaintenanceTasks(): Promise<MaintenanceTask[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasks (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasks.");
  }
  return fetchAllMaintenanceTasksFlow();
}

export async function saveMaintenanceTask(input: SaveTaskInput): Promise<MaintenanceTask> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTask.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to save task ID:', input.id, 'for aircraft ID:', input.aircraftId);
  return saveMaintenanceTaskFlow(input);
}

export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMaintenanceTask (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteMaintenanceTask.");
  }
  console.log('[ManageMaintenanceTasksFlow Firestore Admin] Attempting to delete task ID:', input.taskId);
  return deleteMaintenanceTaskFlow(input);
}

export async function generateMaintenanceWorkOrder(input: GenerateWorkOrderInput): Promise<string> {
    if (!db) {
        throw new Error("Firestore admin instance is not initialized.");
    }
    return generateMaintenanceWorkOrderFlow(input);
}


// Genkit Flow Definitions
const fetchMaintenanceTasksForAircraftFlow = ai.defineFlow(
  {
    name: 'fetchMaintenanceTasksForAircraftFlow',
    inputSchema: FetchTasksInputSchema,
    outputSchema: FetchTasksOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchMaintenanceTasksForAircraftFlow.");
    }
    console.log('Executing fetchMaintenanceTasksForAircraftFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
      const q = tasksCollectionRef.where("aircraftId", "==", input.aircraftId);
      const snapshot = await q.get();
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
      console.log('Fetched', tasksList.length, 'tasks for aircraft from Firestore:', input.aircraftId);
      return tasksList;
    } catch (error) {
      console.error('Error fetching tasks from Firestore for aircraft', input.aircraftId, ':', error);
      throw new Error(`Failed to fetch tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchAllMaintenanceTasksFlow = ai.defineFlow(
  {
    name: 'fetchAllMaintenanceTasksFlow',
    outputSchema: FetchTasksOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasksFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasksFlow.");
    }
    console.log('Executing fetchAllMaintenanceTasksFlow - Firestore');
    try {
      const tasksCollectionRef = db.collection(MAINTENANCE_TASKS_COLLECTION);
      const snapshot = await tasksCollectionRef.get();
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTask));
      console.log('Fetched all', tasksList.length, 'tasks from Firestore');
      return tasksList;
    } catch (error) {
      console.error('Error fetching all tasks from Firestore:', error);
      throw new Error(`Failed to fetch all tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


const saveMaintenanceTaskFlow = ai.defineFlow(
  {
    name: 'saveMaintenanceTaskFlow',
    inputSchema: SaveTaskInputSchema,
    outputSchema: SaveTaskOutputSchema,
  },
  async (taskData) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveMaintenanceTaskFlow.");
    }
    console.log('Executing saveMaintenanceTaskFlow with input - Firestore:', JSON.stringify(taskData));
    try {
      // The taskData.id should be the Firestore document ID.
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(taskData.id);
      // Firestore will create the document if it doesn't exist, or update it if it does.
      // We spread taskData but explicitly exclude 'id' from being written as a field within the document itself.
      const { id, ...dataToSet } = taskData;
      await taskDocRef.set(dataToSet); 
      console.log('Saved maintenance task in Firestore:', taskData.id);
      return taskData; // Return the full input object as it was passed (and saved)
    } catch (error) {
      console.error('Error saving maintenance task to Firestore:', error);
      throw new Error(`Failed to save task ${taskData.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteMaintenanceTaskFlow = ai.defineFlow(
  {
    name: 'deleteMaintenanceTaskFlow',
    inputSchema: DeleteTaskInputSchema,
    outputSchema: DeleteTaskOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMaintenanceTaskFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteMaintenanceTaskFlow.");
    }
    console.log('Executing deleteMaintenanceTaskFlow for task ID - Firestore:', input.taskId);
    try {
      const taskDocRef = db.collection(MAINTENANCE_TASKS_COLLECTION).doc(input.taskId);
      const docSnap = await taskDocRef.get(); // Check if it exists before deleting

      if (!docSnap.exists()) {
          console.warn(`Maintenance task with ID ${input.taskId} not found for deletion in Firestore.`);
          throw new Error(`Task ${input.taskId} not found.`);
      }
      
      await taskDocRef.delete();
      console.log('Deleted maintenance task from Firestore:', input.taskId);
      return { success: true, taskId: input.taskId };
    } catch (error) {
      console.error('Error deleting maintenance task from Firestore:', error);
      throw new Error(`Failed to delete task ${input.taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const generateMaintenanceWorkOrderFlow = ai.defineFlow(
    {
        name: 'generateMaintenanceWorkOrderFlow',
        inputSchema: GenerateWorkOrderInputSchema,
        outputSchema: z.string(), // Returns a single HTML string
    },
    async ({ aircraftId, taskIds }) => {
        // 1. Fetch all necessary data concurrently
        const [allAircraft, allTasks, companyProfile, componentTimes] = await Promise.all([
            fetchFleetAircraft(),
            fetchMaintenanceTasksForAircraft({ aircraftId }),
            fetchCompanyProfile(),
            fetchComponentTimesForAircraft({ aircraftId }),
        ]);

        // 2. Find the specific aircraft and filter the selected tasks
        const aircraft = allAircraft.find(ac => ac.id === aircraftId);
        if (!aircraft) throw new Error(`Aircraft with ID ${aircraftId} not found.`);

        const selectedTasks = allTasks.filter(task => taskIds.includes(task.id));
        if (selectedTasks.length === 0) return "<p>No tasks selected or found for work order.</p>";
        
        const airframeTime = componentTimes?.['Airframe']?.time?.toFixed(1) || 'N/A';
        const airframeCycles = componentTimes?.['Airframe']?.cycles?.toLocaleString() || 'N/A';
        
        // 3. Construct the HTML string
        const status = "Opened"; // Default status for new work order
        const statusColors = {
            Opened: '#4A90E2', InProgress: '#F5A623', Completed: '#7ED321', 'Closed/Canceled': '#9CA3AF'
        };

        const workOrderHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Roboto', 'Inter', sans-serif; color: #333333; font-size: 10px; margin: 0;}
                    .page { width: 100%; page-break-after: always; }
                    .header { background-color: #0A2540; color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px 6px 0 0; }
                    .header h1 { font-size: 24px; font-weight: 600; margin: 0; }
                    .status-pill { padding: 4px 12px; border-radius: 9999px; font-weight: 600; color: white; background-color: ${statusColors[status as keyof typeof statusColors] || '#9CA3AF'}; }
                    .sub-header { display: flex; justify-content: space-between; padding: 12px 16px; border: 1px solid #e5e7eb; border-top: none; }
                    .info-section { display: flex; justify-content: space-between; padding: 12px 16px; border: 1px solid #e5e7eb; border-top: none; }
                    .info-box { width: 48%; }
                    .table-wrapper { padding: 16px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
                    th { font-weight: 600; font-size: 11px; background-color: #f7f9fb; text-transform: uppercase; }
                    tr:nth-child(even) { background-color: #f7f9fb; }
                    .task-desc { white-space: pre-wrap; }
                    .overdue { color: #D0021B; font-weight: 600; }
                    .footer { position: fixed; bottom: 0; width: 100%; text-align: center; }
                    .sign-off-section { position: absolute; bottom: 40px; left: 16px; right: 16px; display: flex; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
                    .signature-line { width: 30%; border-top: 1px solid #333333; padding-top: 8px; }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <h1>Work Order</h1>
                        <span class="status-pill">${status}</span>
                    </div>
                    <div class="sub-header">
                        <div><strong>Aircraft:</strong> ${aircraft.tailNumber} / ${aircraft.model} / ${aircraft.serialNumber || 'N/A'}</div>
                        <div><strong>A/C Times:</strong> ${airframeTime} hrs / ${airframeCycles} cyc</div>
                        <div><strong>WO#:</strong> WO-${format(new Date(), 'yyyyMMdd')}-${aircraft.tailNumber || ''}</div>
                    </div>
                    <div class="info-section">
                        <div class="info-box">
                            <strong>Operator:</strong><br/>
                            ${companyProfile?.companyName || 'N/A'}<br/>
                            ${companyProfile?.companyAddress?.replace(/, /g, '<br/>') || ''}
                        </div>
                        <div class="info-box">
                            <strong>Shop:</strong><br/>
                            ${'N/A'}<br/>
                            <strong>Analyst:</strong> ${'N/A'}
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>SEQ</th>
                                    <th>PN/SN</th>
                                    <th style="width: 40%;">Description</th>
                                    <th>Interval</th>
                                    <th>Due</th>
                                    <th>State</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${selectedTasks.map((task, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${task.partNumber || ''}<br/>${task.serialNumber || ''}</td>
                                        <td class="task-desc"><strong>${task.itemTitle}</strong><br/><small>${task.details || ''}</small></td>
                                        <td>${task.isHoursDueEnabled ? `${task.hoursDue}h ` : ''}${task.isCyclesDueEnabled ? `${task.cyclesDue}c ` : ''}${task.isDaysDueEnabled ? `${task.daysDueValue}${task.daysIntervalType ? task.daysIntervalType.charAt(0) : 'd'}` : ''}</td>
                                        <td>${task.daysDueValue && isValid(parseISO(task.daysDueValue)) ? format(parseISO(task.daysDueValue), 'yyyy-MM-dd') : 'N/A'}</td>
                                        <td>Opened</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                     <div class="sign-off-section">
                        <div class="signature-line">Mechanic Signature</div>
                        <div class="signature-line">Inspector Signature</div>
                        <div class="signature-line">Date</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        return workOrderHtml;
    }
);

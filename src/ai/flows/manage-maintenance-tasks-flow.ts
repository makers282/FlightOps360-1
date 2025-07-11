

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
import { fetchComponentTimesForAircraft, type AircraftComponentTimes } from './manage-component-times-flow'; // Import component times
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
});
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

const GenerateWorkOrderInputSchema = z.object({
    aircraftId: z.string(),
    taskIds: z.array(z.string()),
    workOrderNumber: z.string(),
    shopName: z.string(),
    dateDue: z.string().optional(),
    notes: z.string().optional(),
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
    async ({ aircraftId, taskIds, workOrderNumber, shopName, dateDue, notes }) => {
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
        
        const issuedDate = format(new Date(), 'yyyy-MM-dd');

        const tasksHtml = selectedTasks.map((task, index) => {
            const intervalParts = [];
            if (task.isHoursDueEnabled && task.hoursDue) intervalParts.push(`${task.hoursDue}h`);
            if (task.isCyclesDueEnabled && task.cyclesDue) intervalParts.push(`${task.cyclesDue}c`);
            if (task.isDaysDueEnabled && task.daysDueValue) {
               if (task.trackType === 'Interval') {
                   const intervalType = task.daysIntervalType?.charAt(0) || 'd';
                   intervalParts.push(`${task.daysDueValue}${intervalType}`);
               }
            }
            const interval = intervalParts.length > 0 ? intervalParts.join(' / ') : 'One-Time';
             
            let dueDateStr = 'N/A';
            if(task.isDaysDueEnabled && task.daysDueValue && task.trackType === 'One Time' && isValid(parseISO(task.daysDueValue))) {
               dueDateStr = format(parseISO(task.daysDueValue), 'yyyy-MM-dd');
            }

            const isOverdue = dueDateStr !== 'N/A' && isValid(parseISO(dueDateStr)) && parseISO(dueDateStr) < new Date();

            return `
            <tr>
              <td>${index + 1}</td>
              <td>${task.partNumber || '-'}<br/>${task.serialNumber || '-'}</td>
              <td class="task-desc"><strong>${task.itemTitle}</strong><br/><small>${task.details || ''}</small></td>
              <td>${interval}</td>
              <td class="${isOverdue ? 'overdue' : ''}">${dueDateStr} ${isOverdue ? 'OVD' : ''}</td>
              <td>Opened</td>
            </tr>
          `;
        }).join('');

        const status = "Opened"; 
        const statusColors: { [key: string]: string } = { Opened: '#4A90E2', 'In Progress': '#F5A623', Completed: '#7ED321', 'Closed/Canceled': '#9CA3AF' };
        const statusColor = statusColors[status as keyof typeof statusColors] || '#9CA3AF';

        // 3. Construct the HTML string
        const workOrderHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { 
                      font-family: 'Inter', 'Roboto', sans-serif; 
                      color: #333333; 
                      font-size: 10px; 
                      margin: 0;
                    }
                    .page { width: 100%; }
                    .pdf-header { 
                      display: flex; 
                      background-color: #0A2540; 
                      color: white; 
                      padding: 16px; 
                      align-items: center; 
                      border-radius: 6px 6px 0 0; 
                    }
                    .pdf-header .logo img { height: 48px; width: auto; max-width: 200px; }
                    .pdf-header .title { flex: 1; text-align: center; }
                    .pdf-header .title h1 { margin: 0; font-size: 20px; font-weight: 600; }
                    .pdf-header .status { 
                      display: inline-block;
                      padding: 4px 12px; 
                      border-radius: 4px; 
                      font-size: 12px; 
                      font-weight: 600;
                      color: white;
                      background-color: ${statusColor};
                      margin-top: 4px;
                    }
                    .pdf-header .dates { text-align: right; font-size: 12px; line-height: 1.4; min-width: 100px; }
                    .sub-header { 
                      display: flex; 
                      justify-content: space-between; 
                      padding: 8px 16px; 
                      border: 1px solid #e5e7eb; 
                      border-top: none;
                      font-size: 11px;
                      background: #f9fafb;
                    }
                    .info-section { 
                      display: flex; 
                      gap: 16px; 
                      margin: 16px 0; 
                    }
                    .info-box { 
                      flex: 1; 
                      border: 1px solid #0A2540; 
                      padding: 12px; 
                      border-radius: 4px; 
                    }
                    .info-box h2 { 
                      margin: 0 0 8px; 
                      font-size: 14px; 
                      font-weight: 600;
                      color: #0A2540; 
                    }
                    .info-box p { margin: 0; font-size: 12px; line-height: 1.5; color: #333; }
                    .tasks-table { 
                      width: 100%; 
                      border-collapse: collapse; 
                      margin-top: 16px; 
                      font-size: 10px;
                      page-break-inside: auto;
                    }
                    .tasks-table th, .tasks-table td { 
                      border: 1px solid #ccc; 
                      padding: 4px 8px; 
                      text-align: left; 
                      vertical-align: top; 
                    }
                    .tasks-table th { font-weight: 600; font-size: 11px; background-color: #E5E7EB; text-transform: uppercase; }
                    .tasks-table tr { page-break-inside: avoid; page-break-after: auto; }
                    .tasks-table tbody tr:nth-child(even) { background-color: #F7F9FB; }
                    .tasks-table tbody tr:nth-child(odd) { background-color: #FFFFFF; }
                    .task-desc { white-space: pre-wrap; word-break: break-word; }
                    .overdue { color: #D0021B; font-weight: 600; }
                    .footer-container { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; }
                    .signoff-footer {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                    }
                    .sig-line {
                        flex-basis: 30%;
                        padding-top: 40px; /* Space for signature */
                        border-top: 1px solid #333;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <header class="pdf-header">
                        <div class="logo">
                          ${companyProfile?.logoUrl ? `<img src="${companyProfile.logoUrl}" alt="Company Logo">` : `<span style="font-size: 20px; font-weight: bold;">${companyProfile?.companyName || 'FlightOps360'}</span>`}
                        </div>
                        <div class="title">
                            <h1>Work Order</h1>
                            <span class="status">${workOrderNumber}</span>
                        </div>
                        <div class="dates">
                            <div><strong>In:</strong> ${issuedDate}</div>
                            <div><strong>Out:</strong> ${dateDue || 'N/A'}</div>
                        </div>
                    </header>
                    <section class="sub-header">
                        <div><strong>Aircraft:</strong> ${aircraft.tailNumber} / ${aircraft.model}</div>
                        <div><strong>S/N:</strong> ${aircraft.serialNumber || 'N/A'}</div>
                        <div><strong>Times:</strong> ${airframeTime} hrs / ${airframeCycles} cyc</div>
                    </section>
                    <section class="info-section">
                        <div class="info-box">
                          <h2>Company</h2>
                          <p>${(companyProfile?.companyName || 'N/A').replace(/\\n/g, '<br/>')}<br/>${(companyProfile?.companyAddress || '').replace(/\\n/g, '<br/>')}</p>
                        </div>
                        <div class="info-box">
                           <h2>Service Center</h2>
                           <p>${shopName}<br/>${(notes || '').replace(/\\n/g, '<br/>')}</p>
                        </div>
                    </section>
                    <section>
                      <table class="tasks-table">
                          <thead>
                            <tr><th>SEQ</th><th>PN/SN</th><th style="width: 40%;">Description</th><th>Interval</th><th>Due</th><th>State</th></tr>
                          </thead>
                          <tbody>${tasksHtml}</tbody>
                      </table>
                    </section>
                    <div class="footer-container">
                        <footer class="signoff-footer">
                            <div class="sig-line">Mechanic Signature</div>
                            <div class="sig-line">Inspector Signature</div>
                            <div class="sig-line">Date</div>
                        </footer>
                    </div>
                </div>
            </body>
            </html>
        `;

        return workOrderHtml;
    }
);

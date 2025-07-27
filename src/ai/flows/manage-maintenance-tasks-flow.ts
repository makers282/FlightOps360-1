

'use server';
/**
 * @fileOverview Genkit flows for managing aircraft maintenance tasks using Firestore.
 * Tasks are associated with specific aircraft from the fleet.
 *
 * - fetchMaintenanceTasksForAircraft - Fetches all tasks for a given aircraft. (Moved to service)
 * - fetchAllMaintenanceTasks - Fetches all tasks for all aircraft.
 * - saveMaintenanceTask - Saves (adds or updates) a maintenance task. (Moved to service)
 * - deleteMaintenanceTask - Deletes a maintenance task.
 * - generateMaintenanceWorkOrder - Generates a work order PDF from selected tasks.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { fetchFleetAircraft } from './manage-fleet-flow';
import { fetchCompanyProfile } from './manage-company-profile-flow'; // Import company profile
import { fetchComponentTimesForAircraft } from './manage-component-times-flow'; // Import component times
import { format, parseISO, isValid, addDays, addMonths, addYears, endOfMonth, differenceInCalendarDays } from 'date-fns';
import {
    fetchMaintenanceTasksForAircraft as fetchTasksFromService,
    saveMaintenanceTask as saveTaskToService,
    deleteMaintenanceTask as deleteTaskFromService
} from './maintenance-task-service';
import type { MaintenanceTask, SaveTaskInput, FetchTasksInput, DeleteTaskInput } from '@/ai/schemas/maintenance-task-schemas';


const GenerateWorkOrderInputSchema = z.object({
    aircraftId: z.string(),
    taskIds: z.array(z.string()),
    workOrderNumber: z.string(),
    shopName: z.string(),
    dateDue: z.string().optional(),
    notes: z.string().optional(),
});
export type GenerateWorkOrderInput = z.infer<typeof GenerateWorkOrderInputSchema>;


// Exported async functions that clients will call
// These now wrap the service calls
export async function fetchMaintenanceTasksForAircraft(input: FetchTasksInput): Promise<MaintenanceTask[]> {
    return fetchTasksFromService(input);
}

export async function saveMaintenanceTask(input: SaveTaskInput): Promise<MaintenanceTask> {
    return saveTaskToService(input);
}

export async function deleteMaintenanceTask(input: DeleteTaskInput): Promise<{ success: boolean; taskId: string }> {
    return deleteTaskFromService(input);
}


export async function fetchAllMaintenanceTasks(): Promise<MaintenanceTask[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasks (manage-maintenance-tasks-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasks.");
  }
  return fetchAllMaintenanceTasksFlow();
}


export async function generateMaintenanceWorkOrder(input: GenerateWorkOrderInput): Promise<string> {
    if (!db) {
        throw new Error("Firestore admin instance is not initialized.");
    }
    return generateMaintenanceWorkOrderFlow(input);
}


// Genkit Flow Definitions
const fetchAllMaintenanceTasksFlow = ai.defineFlow(
  {
    name: 'fetchAllMaintenanceTasksFlow',
    outputSchema: z.array(z.custom<MaintenanceTask>()),
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasksFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAllMaintenanceTasksFlow.");
    }
    console.log('Executing fetchAllMaintenanceTasksFlow - Firestore');
    try {
      const tasksCollectionRef = db.collection('maintenanceTasks');
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
            fetchTasksFromService({ aircraftId }), // Use service
            fetchCompanyProfile(),
            fetchComponentTimesForAircraft({ aircraftId }),
        ]);

        // 2. Find the specific aircraft and filter the selected tasks
        const aircraft = allAircraft.find(ac => ac.id === aircraftId);
        if (!aircraft) throw new Error(`Aircraft with ID ${aircraftId} not found.`);

        const selectedTasks = allTasks.filter(task => taskIds.includes(task.id));
        if (selectedTasks.length === 0) return "<p>No tasks selected or found for work order.</p>";

        const issuedDate = format(new Date(), 'yyyy-MM-dd');
        
        let subHeaderTimes = `<strong>A/F TT:</strong> ${componentTimes?.['Airframe']?.time?.toFixed(1) || 'N/A'} | <strong>A/F TC:</strong> ${componentTimes?.['Airframe']?.cycles?.toLocaleString() || 'N/A'}`;
        (aircraft.engineDetails || []).forEach((engine, index) => {
            const engineName = `Engine ${index + 1}`;
            subHeaderTimes += ` | <strong>${engineName} TT:</strong> ${componentTimes?.[engineName]?.time?.toFixed(1) || 'N/A'} | <strong>TC:</strong> ${componentTimes?.[engineName]?.cycles?.toLocaleString() || 'N/A'}`;
        });
        (aircraft.propellerDetails || []).forEach((prop, index) => {
            const propName = `Propeller ${index + 1}`;
            subHeaderTimes += ` | <strong>${propName} TT:</strong> ${componentTimes?.[propName]?.time?.toFixed(1) || 'N/A'} | <strong>TC:</strong> ${componentTimes?.[propName]?.cycles?.toLocaleString() || 'N/A'}`;
        });

        const tasksHtml = selectedTasks.map((task, index) => {
            const intervalParts = [];
            if (task.isHoursDueEnabled && task.hoursDue) intervalParts.push(`${task.hoursDue}h`);
            if (task.isCyclesDueEnabled && task.cyclesDue) intervalParts.push(`${task.cyclesDue}c`);
            if (task.isDaysDueEnabled && task.daysDueValue && task.trackType === 'Interval') {
                const intervalType = task.daysIntervalType?.charAt(0) || 'd';
                intervalParts.push(`${task.daysDueValue}${intervalType}`);
            }
            const interval = intervalParts.length > 0 ? intervalParts.join(' / ') : 'One-Time';

            let dueDateStr = 'N/A';
            if (task.isDaysDueEnabled && task.daysDueValue && task.trackType === 'One Time' && isValid(parseISO(task.daysDueValue))) {
               dueDateStr = format(parseISO(task.daysDueValue), 'yyyy-MM-dd');
            } else if (task.isDaysDueEnabled && task.daysDueValue && task.trackType === 'Interval' && task.lastCompletedDate) {
                const lastDate = parseISO(task.lastCompletedDate);
                const intervalValue = Number(task.daysDueValue);
                if (isValid(lastDate) && !isNaN(intervalValue)) {
                    let nextDueDate;
                    switch(task.daysIntervalType) {
                        case 'days': nextDueDate = addDays(lastDate, intervalValue); break;
                        case 'months_eom': nextDueDate = endOfMonth(addMonths(lastDate, intervalValue)); break;
                        case 'months_specific_day': nextDueDate = addMonths(lastDate, intervalValue); break;
                        case 'years_specific_day': nextDueDate = addYears(lastDate, intervalValue); break;
                        default: nextDueDate = new Date();
                    }
                    dueDateStr = format(nextDueDate, 'yyyy-MM-dd');
                }
            } else if (task.isHoursDueEnabled && task.hoursDue) {
                const lastHours = task.lastCompletedHours || 0;
                dueDateStr = `${(lastHours + task.hoursDue).toLocaleString()}h`;
            } else if (task.isCyclesDueEnabled && task.cyclesDue) {
                const lastCycles = task.lastCompletedCycles || 0;
                 dueDateStr = `${(lastCycles + task.cyclesDue).toLocaleString()}c`;
            }

            const isOverdue = task.isDaysDueEnabled && dueDateStr !== 'N/A' && isValid(parseISO(dueDateStr)) && differenceInCalendarDays(parseISO(dueDateStr), new Date()) < 0;

            return `
            <tr>
              <td>${task.referenceNumber || '-'}</td>
              <td>${task.partNumber || '-'}<br/>${task.serialNumber || '-'}</td>
              <td class="task-desc"><strong>${task.itemTitle}</strong><br/><small>${task.details || ''}</small></td>
              <td>${interval}</td>
              <td class="${isOverdue ? 'overdue' : ''}">${dueDateStr} ${isOverdue ? 'OVD' : ''}</td>
              <td class="tech-initials"></td>
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
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 15mm; }
                    body { font-family: 'Inter', 'Roboto', sans-serif; color: #333; font-size: 9px; line-height: 1.4; }
                    .page { width: 100%; }
                    .pdf-header { display: flex; background-color: #0A2540; color: white; padding: 12px; align-items: center; border-radius: 6px 6px 0 0; }
                    .pdf-header .logo img { height: 40px; width: auto; max-width: 180px; }
                    .pdf-header .title { flex: 1; text-align: center; }
                    .pdf-header .title h1 { margin: 0; font-size: 20px; font-weight: 600; }
                    .pdf-header .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; background-color: ${statusColor}; margin-top: 4px; }
                    .pdf-header .dates { text-align: right; font-size: 11px; line-height: 1.4; min-width: 100px; }
                    .sub-header { display: flex; justify-content: space-between; padding: 6px 12px; border: 1px solid #e5e7eb; border-top: none; font-size: 9px; background: #f9fafb; flex-wrap: wrap; gap: 8px; }
                    .info-section { display: flex; gap: 16px; margin: 12px 0; }
                    .info-box { flex: 1; border: 1px solid #0A2540; padding: 10px; border-radius: 4px; }
                    .info-box h2 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #0A2540; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                    .info-box p { margin: 0; font-size: 10px; color: #333; white-space: pre-wrap; }
                    .tasks-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9px; page-break-inside: auto; }
                    .tasks-table th, .tasks-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
                    .tasks-table th { font-weight: 600; font-size: 10px; background-color: #E5E7EB; text-transform: uppercase; }
                    .tasks-table tr { page-break-inside: avoid; page-break-after: auto; }
                    .tasks-table tbody tr:nth-child(even) { background-color: #F7F9FB; }
                    .tasks-table tbody tr:nth-child(odd) { background-color: #FFFFFF; }
                    .task-desc { white-space: pre-wrap; word-break: break-word; }
                    .task-desc small { color: #555; }
                    .overdue { color: #D0021B; font-weight: 600; }
                    .tech-initials { width: 80px; }
                    .footer-container { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; }
                    .signoff-footer { display: flex; justify-content: space-between; font-size: 10px; gap: 20px; }
                    .sig-line { flex-basis: 30%; padding-top: 30px; border-top: 1px solid #333; text-align: center; }
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
                       <div><strong>A/C:</strong> ${aircraft.tailNumber} / ${aircraft.model} | <strong>S/N:</strong> ${aircraft.serialNumber || 'N/A'}</div>
                       <div>${subHeaderTimes}</div>
                    </section>
                    <section class="info-section">
                        <div class="info-box">
                          <h2>Company</h2>
                          <p>${(companyProfile?.companyName || 'N/A').replace(/\\n/g, '<br/>')}<br/>${(companyProfile?.companyAddress || '').replace(/\\n/g, '<br/>')}</p>
                        </div>
                        <div class="info-box">
                           <h2>Service Center</h2>
                           <p><strong>${shopName}</strong><br/>${(notes || '').replace(/\\n/g, '<br/>')}</p>
                        </div>
                    </section>
                    <section>
                      <table class="tasks-table">
                          <thead>
                            <tr><th>REF #</th><th>PN/SN</th><th style="width: 45%;">Description</th><th>Interval</th><th>Due</th><th class="tech-initials">Tech Initials</th></tr>
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

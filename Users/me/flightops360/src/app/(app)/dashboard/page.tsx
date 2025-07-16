


import React from 'react';
import { fetchBulletins, type Bulletin } from '@/ai/flows/manage-bulletins-flow';
import { fetchTrips, type Trip, updateTripStatus } from '@/ai/flows/manage-trips-flow';
import { fetchFleetAircraft, type FleetAircraft } from '@/ai/flows/manage-fleet-flow';
import { fetchAllAircraftDiscrepancies } from '@/ai/flows/manage-aircraft-discrepancies-flow';
import { fetchAllMaintenanceTasks } from '@/ai/flows/manage-maintenance-tasks-flow';
import { fetchNotifications } from '@/ai/flows/manage-notifications-flow';
import { fetchQuotes } from '@/ai/flows/manage-quotes-flow';
import { fetchAircraftBlockOuts } from '@/ai/flows/manage-aircraft-block-outs-flow'; // Import block-outs
import { DashboardClientContent } from './components/dashboard-client-content';
import { parseISO, addDays, isValid, addMonths, addYears, isWithinInterval, startOfDay, endOfDay, addHours, isAfter } from 'date-fns';

// Define serializable types that can be passed from Server to Client Components
interface AircraftStatusDetail {
    label: "Active" | "Maintenance" | "Info" | "Blocked Out";
    variant: "default" | "secondary" | "destructive" | "outline";
    details?: string;
}

// Pass a string key for the icon instead of the component itself
export interface SystemAlert {
  id: string;
  type: 'aircraft' | 'system' | 'maintenance' | 'training' | 'compliance';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link?: string;
  iconName?: 'AlertTriangle' | 'Info'; 
}

export default async function DashboardPage() {
    
    const [
        bulletins,
        trips,
        fleet,
        quotes,
        notifications,
        discrepancies,
        maintenanceTasks,
        blockOuts, // Fetch block-outs
    ] = await Promise.all([
        fetchBulletins().catch(e => { console.error("Error fetching bulletins on server:", e); return []; }),
        fetchTrips().catch(e => { console.error("Error fetching trips on server:", e); return []; }),
        fetchFleetAircraft().catch(e => { console.error("Error fetching fleet on server:", e); return []; }),
        fetchQuotes().catch(e => { console.error("Error fetching quotes on server:", e); return []; }),
        fetchNotifications().catch(e => { console.error("Error fetching notifications on server:", e); return []; }),
        fetchAllAircraftDiscrepancies().catch(e => { console.error("Error fetching discrepancies on server:", e); return []; }),
        fetchAllMaintenanceTasks().catch(e => { console.error("Error fetching maintenance tasks on server:", e); return []; }),
        fetchAircraftBlockOuts().catch(e => { console.error("Error fetching block-outs on server:", e); return []; }), // Add block-outs fetch
    ]);

    console.log(`[Dashboard Server Component] Fetched ${bulletins.length} bulletins.`);
    console.log(`[Dashboard Server Component] Fetched ${trips.length} trips.`);
    console.log(`[Dashboard Server Component] Fetched ${fleet.length} fleet aircraft.`);

    const now = new Date();
    
    const updatedTrips = await Promise.all(trips.map(async (trip) => {
        if (trip.status === 'Released') {
            const lastLeg = trip.legs?.[trip.legs.length - 1];
            if (lastLeg?.arrivalDateTime) {
                try {
                    const scheduledArrivalTime = parseISO(lastLeg.arrivalDateTime);
                    // Check if scheduled arrival is more than 2 hours in the past
                    if (isValid(scheduledArrivalTime) && isAfter(now, addHours(scheduledArrivalTime, 2))) {
                        console.log(`[Dashboard Logic] Trip ${trip.tripId} is overdue. Updating status to 'Awaiting Closeout'.`);
                        // Update status in the backend
                        const updatedTrip = await updateTripStatus(trip.id, 'Awaiting Closeout');
                        // Return trip object with updated status for display
                        return updatedTrip;
                    }
                } catch (e) {
                    console.error(`Error processing trip ${trip.id} for auto-closeout:`, e);
                }
            }
        }
        return trip; // Return trip as is if no status change is needed
    }));


    const currentTrips = updatedTrips.filter(trip => trip.status === 'Released' || trip.status === 'Awaiting Closeout');
    const upcomingTrips = trips.filter(trip => {
        const departureTime = trip.legs?.[0]?.departureDateTime ? parseISO(trip.legs[0].departureDateTime) : null;
        return departureTime && departureTime > now && trip.status !== 'Completed' && trip.status !== 'Cancelled';
    }).map(trip => ({...trip, aircraftLabel: fleet.find(ac => ac.id === trip.aircraftId)?.tailNumber || trip.aircraftId }));

    const pendingQuotesList = quotes.filter(q => ["Draft", "Sent"].includes(q.status));
    
    const aircraftWithDueTask = new Set<string>();
    maintenanceTasks.forEach(task => {
        if (!task.isActive || aircraftWithDueTask.has(task.aircraftId)) return;
        if (task.isDaysDueEnabled && task.daysDueValue) {
             let isDueSoon = false;
             if (task.trackType === 'One Time' && isValid(parseISO(task.daysDueValue)) && parseISO(task.daysDueValue) < addDays(now, 30)) {
                 isDueSoon = true;
             } else if (task.trackType === 'Interval' && task.lastCompletedDate && isValid(parseISO(task.lastCompletedDate))) {
                 const lastCompleted = parseISO(task.lastCompletedDate);
                 const interval = parseInt(task.daysDueValue, 10);
                 if (!isNaN(interval)) {
                     let dueDate;
                     switch (task.daysIntervalType) {
                         case 'days': dueDate = addDays(lastCompleted, interval); break;
                         case 'months_specific_day': case 'months_eom': dueDate = addMonths(lastCompleted, interval); break;
                         case 'years_specific_day': dueDate = addYears(lastCompleted, interval); break;
                     }
                     if (dueDate && isValid(dueDate) && dueDate < addDays(now, 30)) {
                         isDueSoon = true;
                     }
                 }
             }
             if (isDueSoon) aircraftWithDueTask.add(task.aircraftId);
        }
    });

    const statusMap = new Map<string, AircraftStatusDetail>();
    const alerts: SystemAlert[] = [];
    for (const ac of fleet) {
        if (!ac.isMaintenanceTracked) {
            statusMap.set(ac.id, { label: "Info", variant: "outline", details: "Not Tracked" });
            continue;
        }

        const hasOpenDiscrepancy = discrepancies.some(d => d.aircraftId === ac.id && d.status === 'Open');
        const activeBlockOut = blockOuts.find(bo => 
            bo.aircraftId === ac.id && 
            isWithinInterval(now, { start: startOfDay(parseISO(bo.startDate)), end: endOfDay(parseISO(bo.endDate)) })
        );

        if (hasOpenDiscrepancy) {
             statusMap.set(ac.id, { label: "Maintenance", variant: "destructive", details: "Grounded (Open Write-up)" });
             alerts.push({ id: `alert-disc-${ac.id}`, type: 'aircraft', severity: 'critical', title: `Grounded: ${ac.tailNumber}`, message: 'Aircraft has an open discrepancy.', link: `/aircraft/currency/${ac.tailNumber}`, iconName: 'AlertTriangle' });
        } else if (activeBlockOut) {
            statusMap.set(ac.id, { label: "Blocked Out", variant: "secondary", details: activeBlockOut.title });
        } else {
             statusMap.set(ac.id, { label: "Active", variant: "default", details: "All Clear" });
        }
    }
    
    const unreadNotifications = notifications
        .filter(n => !n.isRead)
        .map(n => ({
            id: n.id,
            type: n.type as SystemAlert['type'] || 'system',
            severity: n.type === 'alert' ? 'warning' : 'info',
            title: n.title,
            message: n.message,
            link: n.link,
            iconName: 'Info' as const,
        }));

    const finalAlerts = [...alerts, ...unreadNotifications];

    const kpiStats = {
        activeTrips: currentTrips.length,
        pendingQuotes: pendingQuotesList.length,
        pendingQuotesValue: pendingQuotesList.reduce((acc, q) => acc + (q.totalSellPrice || 0), 0),
        aircraftDue: aircraftWithDueTask.size,
        alertNotices: finalAlerts.length,
    };

    return (
        <DashboardClientContent
            initialKpiStats={kpiStats}
            initialBulletins={bulletins.filter(b => b.isActive).sort((a, b) => parseISO(b.publishedAt).getTime() - parseISO(a.publishedAt).getTime())}
            initialCurrentTrips={currentTrips.map(trip => ({...trip, aircraftLabel: fleet.find(ac => ac.id === trip.aircraftId)?.tailNumber || trip.aircraftId }))}
            initialUpcomingTrips={upcomingTrips}
            initialFleetList={fleet}
            initialAircraftStatusDetails={Array.from(statusMap.entries())}
            initialActiveSystemAlerts={finalAlerts}
        />
    );
}

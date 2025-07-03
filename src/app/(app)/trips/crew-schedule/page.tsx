
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { CalendarCheck2, Loader2, Filter } from 'lucide-react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchCrewMembers, type CrewMember } from '@/ai/flows/manage-crew-flow';
import { fetchTrips, type Trip } from '@/ai/flows/manage-trips-flow';
import { fetchCrewBlockOuts, type CrewBlockOut } from '@/ai/flows/manage-crew-block-outs-flow';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO, addDays, isValid } from 'date-fns';

interface FullCalendarResource {
  id: string;
  title: string;
}

interface FullCalendarEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps?: Record<string, any>;
}

export default function CrewSchedulePage() {
  const [resources, setResources] = useState<FullCalendarResource[]>([]);
  const [events, setEvents] = useState<FullCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [crewData, tripsData, blockOutsData] = await Promise.all([
        fetchCrewMembers(),
        fetchTrips(),
        fetchCrewBlockOuts()
      ]);

      // 1. Create Resources from Crew Members
      const calendarResources: FullCalendarResource[] = crewData
        .filter(c => c.isActive)
        .map(crew => ({
          id: crew.id,
          title: `${crew.firstName} ${crew.lastName}`,
        }));
      setResources(calendarResources);

      // 2. Create Events from Trips
      const tripEvents: FullCalendarEvent[] = [];
      tripsData.forEach(trip => {
        if (!trip.legs || trip.legs.length === 0) return;
        const start = trip.legs[0].departureDateTime;
        const lastLeg = trip.legs[trip.legs.length - 1];
        let end = lastLeg.arrivalDateTime || lastLeg.departureDateTime;
        if (!end && lastLeg.departureDateTime && lastLeg.blockTimeHours) {
            const departure = parseISO(lastLeg.departureDateTime);
            const arrival = new Date(departure.getTime() + lastLeg.blockTimeHours * 60 * 60 * 1000);
            end = arrival.toISOString();
        }

        if (start && end && isValid(parseISO(start)) && isValid(parseISO(end))) {
            const assignedCrewIds = [
                trip.assignedPilotId,
                trip.assignedCoPilotId,
                ...(trip.assignedFlightAttendantIds || [])
            ].filter((id): id is string => !!id);

            assignedCrewIds.forEach(crewId => {
                tripEvents.push({
                    id: `${trip.id}-${crewId}`,
                    resourceId: crewId,
                    title: `Trip: ${trip.tripId} (${trip.clientName})`,
                    start,
                    end,
                    allDay: false, // Trips are time-specific
                    backgroundColor: 'hsl(var(--primary))',
                    borderColor: 'hsl(var(--primary))',
                    textColor: 'hsl(var(--primary-foreground))',
                    extendedProps: { type: 'trip', tripId: trip.id }
                });
            });
        }
      });
      
      // 3. Create Events from Block-Outs
      const blockOutEvents: FullCalendarEvent[] = blockOutsData.map(bo => ({
        id: bo.id,
        resourceId: bo.crewMemberId,
        title: bo.reason,
        start: bo.startDate, // Already in YYYY-MM-DD
        end: format(addDays(parseISO(bo.endDate), 1), 'yyyy-MM-dd'), // End date is exclusive for all-day
        allDay: true,
        backgroundColor: 'hsl(var(--muted-foreground))',
        borderColor: 'hsl(var(--muted-foreground))',
        textColor: 'hsl(var(--muted))',
        extendedProps: { type: 'block_out' }
      }));
      
      setEvents([...tripEvents, ...blockOutEvents]);

    } catch (error) {
      console.error("Failed to load schedule data:", error);
      toast({
        title: "Error Loading Schedule",
        description: error instanceof Error ? error.message : "Could not fetch data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <PageHeader
        title="Crew Schedule & Duty Times"
        description="Visualize crew schedules, duty periods, flight times, and rest on a Gantt-style calendar."
        icon={CalendarCheck2}
      />
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Crew Activity Gantt Chart</CardTitle>
              <CardDescription>
                Overview of all crew activities. Use the filter to narrow down the view.
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" disabled>
              <Filter className="h-4 w-4" />
              <span className="sr-only">Filter Crew Schedule</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading schedule data...</p>
            </div>
          ) : (
             <div className="fc-wrapper">
                 <FullCalendar
                    plugins={[resourceTimelinePlugin, interactionPlugin]}
                    schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
                    initialView="resourceTimelineWeek"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'
                    }}
                    resources={resources}
                    events={events}
                    resourceAreaHeaderContent="Crew Members"
                    resourceAreaWidth="20%"
                    height="auto"
                    contentHeight="auto"
                    slotMinWidth={80}
                    editable={false}
                    droppable={false}
                />
             </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Add some basic styling to make the calendar responsive
const style = document.createElement('style');
style.innerHTML = `
.fc-wrapper {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.fc .fc-datagrid-cell-cushion {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
`;
document.head.appendChild(style);



import { z } from 'zod';

export const MaintenanceTaskSchema = z.object({
  id: z.string(),
  aircraftId: z.string(),
  itemTitle: z.string(),
  isDaysDueEnabled: z.boolean(),
  daysDueValue: z.string().nullable(),
  isTachTimeDueEnabled: z.boolean(),
  tachTimeDueValue: z.number().nullable(),
  isHobsTimeDueEnabled: z.boolean(),
  hobsTimeDueValue: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FetchMaintenanceTasksForAircraftInputSchema = z.object({
  aircraftId: z.string(),
});

export const FetchMaintenanceTasksForAircraftOutputSchema = z.array(MaintenanceTaskSchema);

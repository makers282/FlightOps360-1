
import { PageHeader } from '@/components/page-header';
import { CalendarCheck2, Filter } from 'lucide-react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function CrewSchedulePage() {
  return (
    <>
      <PageHeader
        title="Crew Schedule & Duty Times"
        description="Visualize crew schedules, duty periods, flight times, and rest on an hourly Gantt-style calendar."
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
            <Button variant="outline" size="icon" disabled> {/* Disabled for now */}
              <Filter className="h-4 w-4" />
              <span className="sr-only">Filter Crew Schedule</span>
            </Button>
          </div>
           <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="font-semibold">Legend:</span>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-black rounded-sm"></div>Duty</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div>Part 91 Leg</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>Revenue Leg</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-400 rounded-sm"></div>Rest</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm"></div>Day Off</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p className="mb-2">Below is a static image representation of the desired Gantt chart for an overview of crew activities.</p>
            <p className="mb-4">Actual interactive Gantt chart implementation is a complex task and will be addressed in a future update.</p>
            <div className="border rounded-md p-2 inline-block bg-gray-50">
                <Image 
                    src="/gantt-placeholder.png" // Assuming the image is placed in the public folder
                    alt="Crew Gantt Chart Placeholder" 
                    width={1000} 
                    height={600} 
                    className="object-contain rounded"
                    data-ai-hint="gantt chart schedule"
                />
            </div>
            <p className="mt-4 text-sm">This view will show an hourly grid with days as rows, allowing for precise visualization of crew activities like duty periods, specific flight legs (Part 91, Revenue), rest times, and days off.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

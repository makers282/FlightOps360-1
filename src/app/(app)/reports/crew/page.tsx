
import { PageHeader } from '@/components/page-header';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CrewReportsPage() {
  return (
    <>
      <PageHeader 
        title="Crew Activity Reports" 
        description="This section will display reports related to crew duty times, flight hours, training, and availability."
        icon={Users}
      />
      <Card>
        <CardHeader>
          <CardTitle>Crew Report Content Area</CardTitle>
          <CardDescription>
            Detailed crew utilization, qualification tracking, and duty/rest compliance reports will be available here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Crew report generation and display functionality is pending implementation.
          </p>
        </CardContent>
      </Card>
    </>
  );
}


// This file is no longer needed as "Checking Currency" is part of Crew Documents page.
// It can be safely deleted.

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClipboardCheck } from 'lucide-react';

export default function CheckingCurrencyPage() {
  return (
    <>
      <PageHeader 
        title="Checking Currency" 
        description="This section is for checking various operational currency items."
        icon={ClipboardCheck}
      />
      <Card>
        <CardHeader>
          <CardTitle>Currency Check Dashboard</CardTitle>
          <CardDescription>
            Overview of aircraft and crew currency status will be displayed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Content for checking various currency items (e.g., aircraft maintenance, crew qualifications, document validity) will be implemented here.
            This page is now deprecated. Please use the "Checking Currency" section within Crew Documents.
          </p>
        </CardContent>
      </Card>
    </>
  );
}


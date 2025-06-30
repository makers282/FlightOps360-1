
"use client";

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function Step4Training() {
  const { control } = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Requirements</CardTitle>
        <CardDescription>Assign required training programs to the crew member.</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Under Construction</AlertTitle>
            <AlertDescription>
              The training management functionality will be integrated here. For now, please proceed to the next step.
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}


"use client";

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function Step3Documents() {
  const { control } = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Uploads</CardTitle>
        <CardDescription>Upload required and optional documents for the crew member.</CardDescription>
      </CardHeader>
      <CardContent>
         <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Under Construction</AlertTitle>
            <AlertDescription>
              The document upload and management functionality will be integrated here. For now, please proceed to the next step. Document uploads are not mandatory to complete onboarding at this time.
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

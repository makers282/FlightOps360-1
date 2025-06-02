
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plane, Edit3 } from 'lucide-react';

interface TripFormProps {
  initialTripData?: any | null; // This was simplified for testing, will be properly typed later
  isEditMode: boolean;
}

export function TripForm({ isEditMode, initialTripData }: TripFormProps) { // Added initialTripData here
  console.log("Rendering slightly less minimal TripForm. isEditMode:", isEditMode, "initialTripData:", initialTripData);

  return (
    <Card className="shadow-lg max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <Plane className="h-6 w-6 text-primary" />}
          {isEditMode ? `Edit Trip (ID: ${initialTripData?.tripId || 'N/A'})` : 'Create New Trip'}
        </CardTitle>
        <CardDescription>
          {isEditMode ? 'Modify the details for this trip.' : 'Enter the details below to schedule a new trip.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Basic card content area. If this renders, the Card structure is fine.
        </p>
        <p className="mt-4">
          Next steps would be to add back form elements and actual trip editing logic.
        </p>
      </CardContent>
      <CardFooter>
        <Button disabled>
          {isEditMode ? 'Save Changes (Disabled)' : 'Create Trip (Disabled)'}
        </Button>
      </CardFooter>
    </Card>
  );
}

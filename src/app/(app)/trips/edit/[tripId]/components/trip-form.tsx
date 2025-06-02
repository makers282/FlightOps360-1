'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Plane, Edit3 } from 'lucide-react';

interface TripFormProps {
  initialTripData?: any | null; 
  isEditMode: boolean;
}

export function TripForm({ isEditMode }: TripFormProps) {
  console.log("Rendering slightly less minimal TripForm. isEditMode:", isEditMode);

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
        <p>Basic card content area. If this renders, the Card structure is fine.</p>
        <p>Next steps would be to add back form elements and logic.</p>
      </CardContent>
    </Card>
  );
}

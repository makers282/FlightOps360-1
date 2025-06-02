'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card'; // Import only Card

interface TripFormProps {
  initialTripData?: any | null; // Kept for consistent interface with the parent page
  isEditMode: boolean;          // Kept for consistent interface
}

export function TripForm({ isEditMode }: TripFormProps) {
  console.log("Rendering ultra-minimal TripForm. isEditMode:", isEditMode);

  return (
    <Card className="shadow-lg max-w-4xl mx-auto p-6">
      Test Content for Trip Form. If you see this, the Card component itself is being parsed.
    </Card>
  );
}

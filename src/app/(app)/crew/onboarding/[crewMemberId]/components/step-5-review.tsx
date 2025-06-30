
"use client";

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OnboardingFormData } from './onboarding-wizard';

export function Step5Review() {
  const { getValues } = useFormContext<OnboardingFormData>();
  const data = getValues();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Complete</CardTitle>
        <CardDescription>Please review all the information before completing the onboarding process.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">Personal Information</h3>
          <p>Name: {data.firstName} {data.lastName}</p>
          <p>Email: {data.email}</p>
          <p>Phone: {data.phone}</p>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold">Employment Details</h3>
          <p>Primary Role: {data.role}</p>
          <p>Employment Type: {data.onboardingData?.employmentType}</p>
          <p>Home Base: {data.homeBase}</p>
        </div>
        <Separator />
         <div>
          <h3 className="font-semibold">Aircraft Qualifications</h3>
          <p>{data.onboardingData?.aircraftQualifications?.join(', ') || 'None specified'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

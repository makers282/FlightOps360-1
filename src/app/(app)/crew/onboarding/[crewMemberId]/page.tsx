
"use client";

import React, { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { OnboardingWizard } from './components/onboarding-wizard';
import { UserCheck } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function CrewOnboardingPage() {
  const params = useParams();
  const crewMemberId = Array.isArray(params.crewMemberId) ? params.crewMemberId[0] : params.crewMemberId;

  return (
    <Suspense fallback={<div>Loading...</div>}>
        <PageHeader 
            title="Crew Member Onboarding"
            description="Complete the following steps to finalize the crew member's profile."
            icon={UserCheck}
        />
        <OnboardingWizard crewMemberId={crewMemberId} />
    </Suspense>
  );
}

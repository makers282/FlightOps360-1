
"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { OnboardingWizard } from './components/onboarding-wizard';
import { UserCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCrewMembers } from '@/ai/flows/manage-crew-flow';

export default function CrewOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const [crewMemberName, setCrewMemberName] = useState("New Crew Member");
  const crewMemberId = Array.isArray(params.crewMemberId) ? params.crewMemberId[0] : params.crewMemberId;

  useEffect(() => {
    if (crewMemberId) {
      // Fetch the crew member's name to display in the header
      const loadName = async () => {
        try {
          // This is a bit inefficient if the wizard also fetches, but good for the header
          const allCrew = await fetchCrewMembers();
          const member = allCrew.find(c => c.id === crewMemberId);
          if (member && (member.firstName !== "New" || member.lastName !== "Crew Member")) {
            setCrewMemberName(`${member.firstName} ${member.lastName}`);
          }
        } catch (error) {
          console.error("Could not fetch crew member name for header:", error);
        }
      };
      loadName();
    }
  }, [crewMemberId]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
        <PageHeader 
            title={`Crew Onboarding: ${crewMemberName}`}
            description="Complete the following steps to finalize the crew member's profile."
            icon={UserCheck}
        />
        <OnboardingWizard crewMemberId={crewMemberId} />
    </Suspense>
  );
}

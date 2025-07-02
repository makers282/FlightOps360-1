
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveCrewMember, fetchCrewMembers } from '@/ai/flows/manage-crew-flow';
import type { CrewMember, SaveCrewMemberInput } from '@/ai/schemas/crew-member-schemas';
import { CrewMemberSchema } from '@/ai/schemas/crew-member-schemas';

import { OnboardingSidebar } from './onboarding-sidebar';
import { Step1PersonalInfo } from './step-1-personal-info';
import { Step2EmploymentRole } from './step-2-employment-role';
import { Step3Documents } from './step-3-documents';
import { Step4Training } from './step-4-training';
import { Step5Review } from './step-5-review';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowLeft, ArrowRight, Save } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Personal Info', component: Step1PersonalInfo },
  { id: 2, name: 'Employment & Role', component: Step2EmploymentRole },
  { id: 3, name: 'Documents', component: Step3Documents },
  { id: 4, name: 'Training', component: Step4Training },
  { id: 5, name: 'Review & Complete', component: Step5Review },
];

export type OnboardingFormData = z.infer<typeof CrewMemberSchema>;

export function OnboardingWizard({ crewMemberId }: { crewMemberId: string }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialData, setInitialData] = useState<Partial<OnboardingFormData>>({});
  const [canComplete, setCanComplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const { toast } = useToast();
  const router = useRouter();

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(CrewMemberSchema),
    defaultValues: initialData,
    mode: 'onChange',
  });

  const watchedFields = methods.watch([
    "firstName",
    "lastName",
    "email",
    "phone",
    "onboardingData.roles",
    "onboardingData.aircraftQualifications",
    "onboardingData.employmentType",
    "homeBase"
  ]);

  useEffect(() => {
    const [
      firstName, lastName, email, phone,
      roles, qualifications, employmentType, homeBase
    ] = watchedFields;
    
    const newMissingFields = [];
    if (!firstName) newMissingFields.push('First Name');
    if (!lastName) newMissingFields.push('Last Name');
    if (!email) newMissingFields.push('Email');
    if (!phone) newMissingFields.push('Phone');
    if (!roles || roles.length === 0) newMissingFields.push('At least one Role');
    if (!qualifications || qualifications.length === 0) newMissingFields.push('At least one Aircraft Qualification');
    if (!employmentType) newMissingFields.push('Employment Type');
    if (!homeBase) newMissingFields.push('Home Base');
    
    setMissingFields(newMissingFields);
    setCanComplete(newMissingFields.length === 0);
  }, [watchedFields]);

  const loadCrewMemberData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCrew = await fetchCrewMembers();
      const member = allCrew.find(c => c.id === crewMemberId);
      if (member) {
        setInitialData(member);
        methods.reset(member);
      } else {
        toast({ title: "Error", description: "Crew member not found.", variant: "destructive" });
        router.push('/crew/roster');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load crew member data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [crewMemberId, methods, router, toast]);

  useEffect(() => {
    loadCrewMemberData();
  }, [loadCrewMemberData]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step: number) => setCurrentStep(step);

  const handleSave = async (status: 'Completed' | 'Pending') => {
    setIsSaving(true);
    const data = methods.getValues();
    try {
      const finalData: SaveCrewMemberInput = {
        ...data,
        id: crewMemberId,
        onboardingStatus: status,
      };
      await saveCrewMember(finalData);
      toast({ 
        title: status === 'Completed' ? "Onboarding Complete!" : "Progress Saved",
        description: `${data.firstName} ${data.lastName}'s profile has been ${status === 'Completed' ? 'updated' : 'saved'}.`
      });
      router.push('/crew/roster');
    } catch (error) {
      toast({ title: "Error", description: "Failed to save onboarding data.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = () => handleSave('Completed');
  const handleSaveAndExit = () => handleSave('Pending');

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  if (isLoading) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col md:flex-row gap-8">
        <OnboardingSidebar currentStep={currentStep} steps={STEPS} goToStep={goToStep} />
        <div className="flex-1">
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <CurrentStepComponent />

            <div className="mt-8 pt-5 border-t flex justify-between items-center">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1 || isSaving}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex gap-2 items-center">
                <Button type="button" variant="secondary" onClick={handleSaveAndExit} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save and Exit
                </Button>
                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={nextStep} disabled={isSaving}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button type="submit" disabled={isSaving || !canComplete}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Complete Onboarding
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canComplete && (
                        <TooltipContent>
                          <p className="font-medium">Please fill all required fields:</p>
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {missingFields.map(field => <li key={field}>{field}</li>)}
                          </ul>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}


"use client";

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingSidebarProps {
  currentStep: number;
  steps: { id: number; name: string }[];
  goToStep: (step: number) => void;
}

export function OnboardingSidebar({ currentStep, steps, goToStep }: OnboardingSidebarProps) {
  return (
    <nav aria-label="Progress" className="w-full md:w-64">
      <ol role="list" className="space-y-4 md:flex md:space-x-0 md:space-y-4 md:flex-col">
        {steps.map((step) => (
          <li key={step.name} className="md:flex-shrink-0">
            <button
              onClick={() => goToStep(step.id)}
              className={cn(
                'group flex w-full flex-col border-l-4 py-2 pl-4 transition-colors md:border-l-4 md:border-t-0 md:pl-4',
                step.id < currentStep
                  ? 'border-primary hover:border-primary'
                  : step.id === currentStep
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground'
              )}
              aria-current={step.id === currentStep ? 'step' : undefined}
            >
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  step.id < currentStep
                    ? 'text-primary group-hover:text-primary'
                    : step.id === currentStep
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                Step {step.id}
              </span>
              <span className="text-sm font-medium">{step.name}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

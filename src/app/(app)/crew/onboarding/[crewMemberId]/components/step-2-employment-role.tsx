
"use client";

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { OnboardingFormData } from './onboarding-wizard';
import { crewRoles, employmentTypes } from '@/ai/schemas/crew-member-schemas';
import { getOnboardingActions } from './actions';
import { Skeleton } from '@/components/ui/skeleton';

export function Step2EmploymentRole() {
  const { control } = useFormContext<OnboardingFormData>();
  const [aircraftOptions, setAircraftOptions] = useState<{ id: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const { fleet } = await getOnboardingActions();
      const options = fleet.map(ac => ({ id: ac.id, label: `${ac.tailNumber} - ${ac.model}` }));
      setAircraftOptions(options);
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment & Role Details</CardTitle>
        <CardDescription>Specify the crew member's role, qualifications, and employment status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {crewRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="employmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employment Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {employmentTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={control}
            name="homeBase"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Home Base Airport (ICAO)</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., KTEB" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={control}
            name="aircraftQualifications"
            render={() => (
                <FormItem>
                    <FormLabel>Aircraft Qualifications</FormLabel>
                    <div className="space-y-2">
                    {isLoading ? <Skeleton className="h-20 w-full" /> : aircraftOptions.map(option => (
                        <FormField
                            key={option.id}
                            control={control}
                            name="aircraftQualifications"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(option.id)}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                ? field.onChange([...(field.value || []), option.id])
                                                : field.onChange(field.value?.filter(id => id !== option.id))
                                            }}
                                        />
                                    </FormControl>
                                    <FormLabel className="font-normal">{option.label}</FormLabel>
                                </FormItem>
                            )}
                        />
                    ))}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
      </CardContent>
    </Card>
  );
}

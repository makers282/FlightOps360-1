
"use client";

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
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
        <CardDescription>Define your role, qualifications, and employment details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="onboardingData.roles"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Roles & Qualifications</FormLabel>
                <FormDescription>Select all applicable roles.</FormDescription>
              </div>
              <div className="p-4 border rounded-lg space-y-4">
                <FormLabel className="font-semibold">Select Role(s) *</FormLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {crewRoles.map((role) => (
                    <FormField
                      key={role}
                      control={control}
                      name="onboardingData.roles"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={role}
                            className="flex flex-row items-center space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(role)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), role])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== role
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{role}</FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="onboardingData.aircraftQualifications"
          render={() => (
            <FormItem className="p-4 border rounded-lg">
              <FormLabel className="font-semibold">Qualifying Aircraft *</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {isLoading ? <Skeleton className="h-20 w-full" /> : aircraftOptions.map(option => (
                  <FormField
                    key={option.id}
                    control={control}
                    name="onboardingData.aircraftQualifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(option.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), option.id])
                                : field.onChange((field.value || []).filter(id => id !== option.id));
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
        <FormField
          control={control}
          name="onboardingData.employmentType"
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
                <Input placeholder="e.g., KTEB" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

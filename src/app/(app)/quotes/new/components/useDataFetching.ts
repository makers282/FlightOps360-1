
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchFleetAircraft,
  type FleetAircraft,
} from '@/ai/flows/manage-fleet-flow';
import {
  fetchAircraftRates,
  type AircraftRate,
} from '@/ai/flows/manage-aircraft-rates-flow';
import {
  fetchCompanyProfile,
  type CompanyProfile,
} from '@/ai/flows/manage-company-profile-flow';
import {
  fetchCustomers,
  type Customer,
} from '@/ai/flows/manage-customers-flow';
import {
  fetchAircraftPerformance,
  type AircraftPerformanceData,
} from '@/ai/flows/manage-aircraft-performance-flow';

export interface AircraftSelectOption {
  value: string;
  label: string;
  model: string;
}

export function useDataFetching() {
  const { toast } = useToast();
  const [aircraftSelectOptions, setAircraftSelectOptions] = useState<
    AircraftSelectOption[]
  >([]);
  const [isLoadingAircraftList, setIsLoadingAircraftList] = useState(true);
  const [fetchedAircraftRates, setFetchedAircraftRates] = useState<
    AircraftRate[]
  >([]);
  const [fetchedCompanyProfile, setFetchedCompanyProfile] =
    useState<CompanyProfile | null>(null);
  const [isLoadingDynamicRates, setIsLoadingDynamicRates] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [
    selectedAircraftPerformance,
    setSelectedAircraftPerformance,
  ] = useState<(AircraftPerformanceData & { aircraftId: string }) | null>(
    null,
  );
  const [isLoadingSelectedAcPerf, setIsLoadingSelectedAcPerf] =
    useState(false);

  const loadInitialDropdownData = useCallback(async () => {
    setIsLoadingAircraftList(true);
    setIsLoadingDynamicRates(true);
    setIsLoadingCustomers(true);
    try {
      const [fleetData, ratesData, profileData, customersData] =
        await Promise.all([
          fetchFleetAircraft(),
          fetchAircraftRates(),
          fetchCompanyProfile(),
          fetchCustomers(),
        ]);

      const options = fleetData.map((ac) => ({
        value: ac.id,
        label: `${ac.tailNumber} - ${ac.model}`,
        model: ac.model,
      }));
      setAircraftSelectOptions(options);
      setFetchedAircraftRates(ratesData);
      setFetchedCompanyProfile(profileData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Failed to load initial data for quote form:', error);
      toast({
        title: 'Error Loading Configuration',
        description:
          'Could not load aircraft, pricing, or customer data. Using defaults where possible.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAircraftList(false);
      setIsLoadingDynamicRates(false);
      setIsLoadingCustomers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialDropdownData();
  }, [loadInitialDropdownData]);

  const fetchPerformanceForAircraft = useCallback(
    async (aircraftId: string | undefined) => {
      if (aircraftId) {
        setIsLoadingSelectedAcPerf(true);
        try {
          const perfData = await fetchAircraftPerformance({ aircraftId });
          if (perfData) {
            setSelectedAircraftPerformance({ ...perfData, aircraftId });
          } else {
            setSelectedAircraftPerformance(null);
          }
        } catch (error) {
          console.warn(
            `Could not fetch performance data for aircraft ${aircraftId}:`,
            error,
          );
          setSelectedAircraftPerformance(null);
        } finally {
          setIsLoadingSelectedAcPerf(false);
        }
      } else {
        setSelectedAircraftPerformance(null);
      }
    },
    [],
  );

  return {
    aircraftSelectOptions,
    isLoadingAircraftList,
    fetchedAircraftRates,
    fetchedCompanyProfile,
    isLoadingDynamicRates,
    customers,
    isLoadingCustomers,
    selectedAircraftPerformance,
    isLoadingSelectedAcPerf,
    fetchPerformanceForAircraft,
  };
}

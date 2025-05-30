
import { PageHeader } from '@/components/page-header';
import { PlaneTakeoff } from 'lucide-react';
import { AircraftPerformanceForm } from './components/aircraft-performance-form';

export default function AircraftPerformancePage() {
  return (
    <>
      <PageHeader 
        title="Aircraft Performance Settings" 
        description="Manage and configure performance parameters for your aircraft fleet."
        icon={PlaneTakeoff}
      />
      <AircraftPerformanceForm />
    </>
  );
}

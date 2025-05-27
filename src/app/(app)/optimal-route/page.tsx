import { PageHeader } from '@/components/page-header';
import { OptimalRouteForm } from './components/optimal-route-form';
import { Route } from 'lucide-react';

export default function OptimalRoutePage() {
  return (
    <>
      <PageHeader 
        title="Optimal Route Suggestion" 
        description="AI-powered tool to help flight dispatchers find the best route considering weather, air traffic, and aircraft performance."
        icon={Route}
      />
      <OptimalRouteForm />
    </>
  );
}

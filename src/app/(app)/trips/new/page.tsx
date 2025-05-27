
import { PageHeader } from '@/components/page-header';
import { CreateTripForm } from './components/create-trip-form';
import { CalendarPlus } from 'lucide-react';

export default function NewTripPage() {
  return (
    <>
      <PageHeader 
        title="Create New Trip" 
        description="Enter the details below to schedule a new trip."
        icon={CalendarPlus}
      />
      <CreateTripForm />
    </>
  );
}

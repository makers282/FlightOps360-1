
import { PageHeader } from '@/components/page-header';
import { CreateQuoteForm } from './components/create-quote-form';
import { FilePlus2 } from 'lucide-react';

export default function NewQuotePage() {
  return (
    <>
      <PageHeader 
        title="Create New Quote" 
        description="Enter the details below to generate a new flight quote."
        icon={FilePlus2}
      />
      <CreateQuoteForm />
    </>
  );
}


"use client";

import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { MaintenanceCostEntryForm } from './components/maintenance-cost-entry-form';
import { DollarSign } from 'lucide-react';
import { Loader2 } from 'lucide-react';

function MaintenanceCostEntryPageContent() {
    return (
        <>
            <MaintenanceCostEntryForm />
        </>
    );
}


export default function NewMaintenanceCostPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading form...</p></div>}>
      <MaintenanceCostEntryPageContent />
    </Suspense>
  );
}


"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { MaintenanceCostEntryForm } from './components/maintenance-cost-entry-form';
import { DollarSign, Edit3, Loader2 } from 'lucide-react';
import { fetchMaintenanceCosts } from '@/ai/flows/manage-maintenance-costs-flow';
import type { MaintenanceCost } from '@/ai/schemas/maintenance-cost-schemas';

function MaintenanceCostEntryPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [initialData, setInitialData] = useState<MaintenanceCost | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      fetchMaintenanceCosts()
        .then(allCosts => {
          const costToEdit = allCosts.find(c => c.id === id);
          setInitialData(costToEdit || null);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Loading cost data...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={id ? "Edit Maintenance Cost" : "New Maintenance Cost"}
        icon={id ? Edit3 : DollarSign}
      />
      <MaintenanceCostEntryForm initialData={initialData} isEditing={!!id} />
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

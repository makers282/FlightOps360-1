
"use client"; // Required for useSearchParams

import React, { Suspense } from 'react'; // Import Suspense
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { CreateQuoteForm } from './components/create-quote-form';
import { FilePlus2, Edit3, Loader2 } from 'lucide-react'; // Added Edit3 and Loader2

function QuotePageContent() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('editMode') === 'true';
  const quoteIdToEdit = searchParams.get('quoteId') || undefined;

  const pageTitle = isEditMode ? "Edit Quote" : "Create New Quote";
  const pageDescription = isEditMode 
    ? `Modify the details for quote ID: ${quoteIdToEdit || 'N/A'}.`
    : "Enter the details below to generate a new flight quote.";
  const pageIcon = isEditMode ? Edit3 : FilePlus2;

  return (
    <>
      <PageHeader 
        title={pageTitle} 
        description={pageDescription}
        icon={pageIcon}
      />
      <CreateQuoteForm isEditMode={isEditMode} quoteIdToEdit={quoteIdToEdit} />
    </>
  );
}

// Wrap QuotePageContent with Suspense
export default function NewOrEditQuotePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading quote form...</p></div>}>
      <QuotePageContent />
    </Suspense>
  );
}

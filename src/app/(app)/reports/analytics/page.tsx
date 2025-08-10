
"use client";

import React, { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { TrendingUp, Loader2 } from 'lucide-react';
import { AnalyticsClient } from './components/analytics-client';

export default function OperationalAnalyticsPage() {
  return (
    <>
      <PageHeader 
        title="Operational Analytics" 
        description="Insights and analytics on various operational aspects."
        icon={TrendingUp}
      />
      <Suspense fallback={
        <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading analytics dashboard...</p>
        </div>
      }>
        <AnalyticsClient />
      </Suspense>
    </>
  );
}

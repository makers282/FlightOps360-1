
'use client';
// This component can be a server component if needed, but client for hooks
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { MaintenanceJobsClient } from './components/maintenance-jobs-client';
import { Hammer, Loader2 } from 'lucide-react';

export default function MaintenanceJobsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Loading Jobs...</p></div>}>
            <MaintenanceJobsClient />
        </Suspense>
    );
}

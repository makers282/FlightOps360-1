import React, { Suspense } from 'react';
import DiscrepanciesClient from '../DiscrepanciesClient';

export default function DiscrepanciesPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <DiscrepanciesClient />
    </Suspense>
  );
}
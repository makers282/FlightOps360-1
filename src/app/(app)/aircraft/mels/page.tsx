import React, { Suspense } from 'react';
import MelsClient from './MelsClient';

export default function MelsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <MelsClient />
    </Suspense>
  );
}
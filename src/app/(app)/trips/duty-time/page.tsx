
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DutyTimePageRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new crew schedule page
    router.replace('/trips/crew-schedule');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-muted-foreground">Redirecting to the new Crew Duty Log page...</p>
    </div>
  );
}


"use client";

import React, { useState, useEffect, type PropsWithChildren } from 'react';

export function ClientOnly({ children }: PropsWithChildren) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Or a loading skeleton/placeholder
  }

  return <>{children}</>;
}

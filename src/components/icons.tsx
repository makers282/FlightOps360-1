import React from 'react';
import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
// Removed unused Image import from 'next/image';

interface LogoProps {
  className?: string;
}

export const Icons = {
  Logo: ({ className }: LogoProps) => (
    <Plane className={cn("h-7 w-7", className)} />
  ),
};

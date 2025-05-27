import React from 'react';
import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  // width and height are removed as they are specific to next/image
}

export const Icons = {
  Logo: ({ className }: LogoProps) => (
    <Plane className={cn("h-7 w-7", className)} />
  ),
};

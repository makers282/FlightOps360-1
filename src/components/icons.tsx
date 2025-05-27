import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const Icons = {
  Logo: ({ className, width = 115, height = 28 }: LogoProps) => (
    <Image
      // IMPORTANT: Replace this src with the actual URL of your hosted logo image.
      src="https://placehold.co/115x28.png" 
      alt="FlightOps360 Logo"
      width={width}
      height={height}
      className={className}
      data-ai-hint="company logo flightops360"
    />
  ),
};

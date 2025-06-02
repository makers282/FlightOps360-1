
"use client"

import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobileActual, setIsMobileActual] = React.useState(false);
  const [isClientMounted, setIsClientMounted] = React.useState(false);

  React.useEffect(() => {
    setIsClientMounted(true);
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobileActual(mql.matches);
    };
    
    setIsMobileActual(mql.matches);
    mql.addEventListener("change", onChange);
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return { 
    isMobile: isClientMounted ? isMobileActual : false, 
    isClientMounted 
  };
}

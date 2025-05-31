
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Default to false (desktop) to ensure consistency between server and initial client render.
  const [isMobile, setIsMobile] = React.useState(false);
  // This state tracks if the component has mounted on the client.
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    // Set hasMounted to true once the component mounts on the client.
    setHasMounted(true);
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    
    // Set the actual isMobile state based on the media query after mounting.
    setIsMobile(mql.matches);
    // Add event listener for changes.
    mql.addEventListener("change", onChange);
    
    // Cleanup listener on component unmount.
    return () => mql.removeEventListener("change", onChange);
  }, []); // Empty dependency array ensures this effect runs only once on mount.

  // Crucially, return the default value (false) if not yet mounted (e.g., on server or initial client render).
  // Otherwise, return the dynamically determined 'isMobile' state.
  return hasMounted ? isMobile : false; 
}

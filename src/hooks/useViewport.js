import { useState, useEffect } from 'react';

/**
 * Responsive breakpoints configuration
 * Following mobile-first approach as specified in the design document
 */
const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  large: 1440
};

/**
 * Custom hook for viewport management and responsive state detection
 * Provides real-time viewport dimensions and breakpoint detection
 * 
 * @returns {Object} Viewport state and utility functions
 */
export const useViewport = () => {
  const [viewport, setViewport] = useState(() => {
    // Initialize with current window dimensions if available
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < BREAKPOINTS.tablet,
        isTablet: window.innerWidth >= BREAKPOINTS.tablet && window.innerWidth < BREAKPOINTS.desktop,
        isDesktop: window.innerWidth >= BREAKPOINTS.desktop,
        isLarge: window.innerWidth >= BREAKPOINTS.large,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      };
    }
    
    // Server-side rendering fallback
    return {
      width: 0,
      height: 0,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLarge: false,
      orientation: 'landscape'
    };
  });

  useEffect(() => {
    let timeoutId = null;

    /**
     * Handle viewport resize with debouncing for performance
     * Updates viewport state when window dimensions change
     */
    const handleResize = () => {
      // Clear existing timeout to debounce rapid resize events
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce resize events by 150ms for optimal performance
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        setViewport({
          width,
          height,
          isMobile: width < BREAKPOINTS.tablet,
          isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
          isDesktop: width >= BREAKPOINTS.desktop,
          isLarge: width >= BREAKPOINTS.large,
          orientation: width > height ? 'landscape' : 'portrait'
        });
      }, 150);
    };

    // Add resize event listener
    window.addEventListener('resize', handleResize);
    
    // Initial call to set correct state
    handleResize();

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  /**
   * Check if current viewport matches specific breakpoint
   * @param {string} breakpoint - Breakpoint name (mobile, tablet, desktop, large)
   * @returns {boolean} Whether current viewport matches the breakpoint
   */
  const isBreakpoint = (breakpoint) => {
    switch (breakpoint) {
      case 'mobile':
        return viewport.isMobile;
      case 'tablet':
        return viewport.isTablet;
      case 'desktop':
        return viewport.isDesktop;
      case 'large':
        return viewport.isLarge;
      default:
        return false;
    }
  };

  /**
   * Check if current viewport is at or above specific breakpoint
   * @param {string} breakpoint - Minimum breakpoint name
   * @returns {boolean} Whether current viewport is at or above the breakpoint
   */
  const isAtLeast = (breakpoint) => {
    const currentWidth = viewport.width;
    return currentWidth >= BREAKPOINTS[breakpoint];
  };

  /**
   * Check if current viewport is below specific breakpoint
   * @param {string} breakpoint - Maximum breakpoint name
   * @returns {boolean} Whether current viewport is below the breakpoint
   */
  const isBelow = (breakpoint) => {
    const currentWidth = viewport.width;
    return currentWidth < BREAKPOINTS[breakpoint];
  };

  /**
   * Get appropriate value based on current breakpoint
   * @param {Object} values - Object with breakpoint keys and corresponding values
   * @returns {*} Value for current breakpoint
   */
  const getResponsiveValue = (values) => {
    if (viewport.isLarge && values.large !== undefined) {
      return values.large;
    }
    if (viewport.isDesktop && values.desktop !== undefined) {
      return values.desktop;
    }
    if (viewport.isTablet && values.tablet !== undefined) {
      return values.tablet;
    }
    if (viewport.isMobile && values.mobile !== undefined) {
      return values.mobile;
    }
    
    // Fallback to default or first available value
    return values.default || values.mobile || values.tablet || values.desktop || values.large;
  };

  return {
    ...viewport,
    breakpoints: BREAKPOINTS,
    isBreakpoint,
    isAtLeast,
    isBelow,
    getResponsiveValue
  };
};

/**
 * Export breakpoints for use in other components
 */
export { BREAKPOINTS };
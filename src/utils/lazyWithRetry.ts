import { lazy } from 'react';

// Helper for retrying dynamic imports with retry resilience
export const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    let attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await componentImport();
        // If successful, reset force refresh flag on next idle
        if (typeof window !== 'undefined') {
          setTimeout(() => window.sessionStorage.removeItem('page-has-been-force-refreshed'), 100);
        }
        return result;
      } catch (error) {
        console.warn(`Dynamic lazy-load attempt ${i + 1} of ${attempts} failed:`, error);
        if (i < attempts - 1) {
          // Wait longer on each successive attempt (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
        } else {
          console.error('Lazy loading failed for a dynamic module after maximum attempts:', error);
          if (!pageHasBeenForceRefreshed) {
            window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
            window.location.reload();
            // Return dummy component to prevent layout crash before reload
            return { default: () => null };
          }
          throw error;
        }
      }
    }
    return { default: () => null };
  });

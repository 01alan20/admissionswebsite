import posthog from 'posthog-js';

export const GA_MEASUREMENT_ID = 'G-E3NM4BX10Q';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    umami?: { track?: (eventName: string, eventData?: Record<string, unknown>) => void };
  }
}

export const trackPageView = (path: string): void => {
  posthog.capture('$pageview', { $current_url: window.location.href });

  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !GA_MEASUREMENT_ID) {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: GA_MEASUREMENT_ID,
    debug_mode: import.meta.env.DEV,
  });
};

export const trackEvent = (
  name: string,
  params?: Record<string, string | number | boolean | null | undefined>
): void => {
  if (typeof window === 'undefined') return;

  posthog.capture(name, params ?? {});

  if (typeof window.gtag === 'function' && GA_MEASUREMENT_ID) {
    window.gtag('event', name, { ...(params ?? {}), send_to: GA_MEASUREMENT_ID });
  }

  if (typeof window.umami?.track === 'function') {
    const cleanParams: Record<string, unknown> | undefined = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
      : undefined;
    window.umami.track(name, cleanParams);
  }
};

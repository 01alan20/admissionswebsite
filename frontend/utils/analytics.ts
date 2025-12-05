export const GA_MEASUREMENT_ID = 'G-E3NM4BX10Q';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const trackPageView = (path: string): void => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !GA_MEASUREMENT_ID) {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: GA_MEASUREMENT_ID,
    debug_mode: true,
  });
};

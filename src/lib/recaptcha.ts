/**
 * reCAPTCHA v3 helper.
 *
 * v3 is invisible: it runs silently in the background and returns a score
 * (0.0 to 1.0). The Django backend verifies this score server-side.
 * No "I am not a robot" checkbox appears to the user.
 *
 * The site key is public (NEXT_PUBLIC_) and safe to include in client JS.
 * The secret key lives only on the Django server.
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

/** Injects the reCAPTCHA v3 script once per page load. */
export function loadRecaptchaScript(): void {
  if (!SITE_KEY) return;
  if (document.querySelector(`script[src*="recaptcha"]`)) return;
  const script = document.createElement('script');
  script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  script.async = true;
  document.head.appendChild(script);
}

/** Returns a reCAPTCHA v3 token for the given action. */
export function getRecaptchaToken(action: string): Promise<string> {
  if (!SITE_KEY) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(SITE_KEY, { action })
        .then(resolve)
        .catch(reject);
    });
  });
}

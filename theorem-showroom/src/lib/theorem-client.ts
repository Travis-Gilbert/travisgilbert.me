import "server-only";

import { TheoremContextClient } from "@context/theorem";

const DEFAULT_BASE_URL = "https://index-api-production-a5f7.up.railway.app/api/v2/theseus";

export const publicTenantSlug = process.env.THEOREM_PUBLIC_TENANT_SLUG ?? "public";

export function createTheoremClient() {
  return new TheoremContextClient({
    baseUrl: process.env.THEOREM_CONTEXT_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey: process.env.THEOREM_CONTEXT_API_KEY || undefined,
  });
}

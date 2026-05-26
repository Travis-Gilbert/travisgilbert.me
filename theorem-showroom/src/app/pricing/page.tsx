import type { Metadata } from "next";
import { PricingPage } from "@/components/showroom/PricingPage";
import { loadPricingSnapshot } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const snapshot = await loadPricingSnapshot();
  return <PricingPage snapshot={snapshot} />;
}

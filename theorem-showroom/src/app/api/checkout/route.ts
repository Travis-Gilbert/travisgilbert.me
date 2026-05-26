import { NextRequest, NextResponse } from "next/server";

const checkoutUrls = {
  power: process.env.STRIPE_POWER_CHECKOUT_URL,
  team: process.env.STRIPE_TEAM_CHECKOUT_URL,
};

export function GET(request: NextRequest) {
  const plan = request.nextUrl.searchParams.get("plan");
  if (plan !== "power" && plan !== "team") {
    return NextResponse.json({ error: "Unknown paid plan." }, { status: 400 });
  }

  const checkoutUrl = checkoutUrls[plan];
  if (!checkoutUrl) {
    return NextResponse.json(
      {
        error: "Stripe checkout URL is not configured for this plan.",
        plan,
      },
      { status: 503 },
    );
  }

  return NextResponse.redirect(checkoutUrl, 303);
}

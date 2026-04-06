const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export type PublicPricingPackage = {
  id: number;
  name: string;
  durationDays: number;
  creditPoints: number;
  price: number;
  isBestValue: boolean;
};

export type PublicPricingData = {
  memberLevelPackages: PublicPricingPackage[];
  topupPackages: PublicPricingPackage[];
};

/**
 * Server-friendly fetch for GET /api/v1/public/pricing (no auth).
 */
export async function getPublicPricing(): Promise<PublicPricingData | null> {
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl}/api/v1/public/pricing`, {
      next: { revalidate: 120 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      success?: boolean;
      data?: PublicPricingData;
    };
    if (!body?.success || !body.data) return null;
    return {
      memberLevelPackages: body.data.memberLevelPackages ?? [],
      topupPackages: body.data.topupPackages ?? [],
    };
  } catch {
    return null;
  }
}

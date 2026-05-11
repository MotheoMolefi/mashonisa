import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { Tier } from "@/types/database";

export default async function TiersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*")
    .order("min_successful_repayments", { ascending: true });

  const { data: currentTier } = await supabase
    .from("user_tier_history")
    .select("*, tiers(*)")
    .eq("user_id", user.id)
    .is("effective_to", null)
    .single();

  const currentTierId = currentTier?.tier_id ?? null;

  const tierList = (tiers as Tier[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan Tiers</h1>
        <p className="text-muted-foreground">
          Repay on time to move up a tier and qualify for higher loan amounts.
        </p>
      </div>

      {/* Plan-style horizontal cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tierList.map((tier, index) => {
          const isCurrent = currentTierId === tier.id;
          const isHighest = index === tierList.length - 1;
          const description =
            (tier.rules as { description?: string } | null)?.description ?? "";
          const requirement =
            tier.min_successful_repayments === 0
              ? "New borrowers"
              : `${tier.min_successful_repayments} successful repayment${tier.min_successful_repayments === 1 ? "" : "s"}`;

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                isCurrent ? "ring-2 ring-primary shadow-lg" : ""
              } ${isHighest ? "border-primary/40 lg:scale-[1.02]" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  {isCurrent && (
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      Your tier
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold tracking-tight">
                    R{Number(tier.max_loan).toLocaleString()}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">max loan</span>
                </div>
                {description && (
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                )}
              </CardHeader>
              <CardContent className="mt-auto space-y-3 pt-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    <span>Up to R{Number(tier.max_loan).toLocaleString()} per loan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    <span>{requirement}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    <span>35% total cost (admin fee + interest)</span>
                  </li>
                </ul>
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Your current tier
                  </Button>
                ) : (
                  <Button asChild variant={isHighest ? "default" : "outline"} className="w-full">
                    <Link href="/user/apply">{isHighest ? "Apply for more" : "View limits"}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tierList.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tiers configured.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

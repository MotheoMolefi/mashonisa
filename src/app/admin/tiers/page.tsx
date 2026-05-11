import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import type { Tier } from "@/types/database";

export default async function AdminTiersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tiers } = await supabase
    .from("tiers")
    .select("*")
    .order("min_successful_repayments", { ascending: true });

  const tierList = (tiers as Tier[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tiers</h1>
        <p className="text-muted-foreground">
          Loan limits and requirements by tier. Users progress by completing successful repayments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tierList.map((tier, index) => {
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
              className={`relative flex flex-col ${isHighest ? "border-primary/40 lg:scale-[1.02]" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {tier.name}
                  {isHighest && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (Highest)
                    </span>
                  )}
                </CardTitle>
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
                    <span>{Number(tier.interest_rate)}% interest (35% total)</span>
                  </li>
                </ul>
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

"use client";

/**
 * Admin dashboard pies (client): interest card + loan status + repayment status.
 * Theme colours use CSS variables (--chart-1 …) from globals.css.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type LoansPieData = { name: string; value: number }[];
type RepaymentsPieData = { name: string; value: number }[];

export function DashboardCharts({
  loansPieData,
  repaymentsPieData,
  interestEarned,
}: {
  loansPieData: LoansPieData;
  repaymentsPieData: RepaymentsPieData;
  interestEarned: number;
}) {
  const hasLoansData = loansPieData.some((d) => d.value > 0);
  const hasRepaymentsData = repaymentsPieData.some((d) => d.value > 0);
  const isDemoData =
    interestEarned === 12_500 &&
    loansPieData.length === 4 &&
    repaymentsPieData.length === 4;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {isDemoData && (
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          Demo data shown — charts will use real data once you have loans and repayments.
        </p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Interest earned (settled loans)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">R{interestEarned.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Loans by status
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px]">
          {hasLoansData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loansPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {loansPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? value : Number(value ?? 0),
                    "",
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No loan data yet
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Repayments by status
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[220px]">
          {hasRepaymentsData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={repaymentsPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {repaymentsPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? value : Number(value ?? 0),
                    "",
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No repayment data yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

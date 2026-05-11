/**
 * Internal notification API: email/SMS to a user after admin-triggered events.
 * Called from admin client (fetch) with cookies — must be admin.
 * Not related to PayFast; see /api/payfast/notify for payment webhooks.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyUser, type NotifyEvent, type NotifyPayload } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { event, userId, ...payload } = body as {
      event: NotifyEvent;
      userId: string;
      applicationId?: string;
      loanId?: string;
      amount?: number;
      totalPayable?: number;
      principal?: number;
    };
    if (!event || !userId) {
      return NextResponse.json({ error: "Missing event or userId" }, { status: 400 });
    }
    const allowed: NotifyEvent[] = [
      "application_approved",
      "application_rejected",
      "loan_disbursed",
      "loan_settled",
    ];
    if (!allowed.includes(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    // Admin can read any profile; service role only needed for auth email
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .single();
    const phone = (profileRow?.phone as string) ?? null;

    let email: string | null = null;
    const service = createServiceRoleClient();
    if (service) {
      const { data: authUser } = await service.auth.admin.getUserById(userId);
      email = authUser?.user?.email ?? null;
    }
    const notifyPayload: NotifyPayload = { userId, ...payload };

    await notifyUser(email, phone, event, notifyPayload);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/notify]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notification failed" },
      { status: 500 }
    );
  }
}

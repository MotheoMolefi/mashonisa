"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"signup" | "verify">("signup");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", "", "", ""]);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("full_name") as string;
    const emailValue = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();

    // Step 1: Create the account (no confirmation email since it's disabled)
    const { error: signUpError } = await supabase.auth.signUp({
      email: emailValue,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (signUpError) {
      toast.error(signUpError.message);
      setLoading(false);
      return;
    }

    // While we still have a session from signUp, update the profile directly
    // (the DB trigger may not capture metadata reliably)
    const {
      data: { user: newUser },
    } = await supabase.auth.getUser();

    if (newUser) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone })
        .eq("id", newUser.id);
    }

    // Sign out immediately so user isn't auto-logged in before OTP verification
    await supabase.auth.signOut();

    // Step 2: Send OTP via the /auth/v1/otp endpoint (30/hr rate limit)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      toast.error(otpError.message);
      setLoading(false);
      return;
    }

    setEmail(emailValue);
    setFullName(fullName);
    setPhone(phone);
    setStep("verify");
    toast.success("Check your email for the verification code!");
    setLoading(false);
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste of full code
      const digits = value.replace(/\D/g, "").slice(0, 8).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 8) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      // Focus last filled input or the next empty one
      const nextIndex = Math.min(index + digits.length, 7);
      const nextInput = document.getElementById(`otp-${nextIndex}`);
      nextInput?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 7) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length !== 8) {
      toast.error("Please enter the full 8-digit code.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      toast.error(error.message);
      setOtp(["", "", "", "", "", "", "", ""]);
      setLoading(false);
      return;
    }

    // Ensure profile has the correct name and phone
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone })
        .eq("id", user.id);
    }

    toast.success("Account verified! Redirecting...");
    router.push("/employee");
    router.refresh();
  }

  async function handleResend() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("New code sent! Check your email.");
    }
    setOtp(["", "", "", "", "", "", "", ""]);
    setLoading(false);
  }

  // Step 1: Signup form
  if (step === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight mb-2 block"
            >
              Mashonisa
            </Link>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Sign up to apply for a loan</CardDescription>
          </CardHeader>
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="0812345678"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // Step 2: OTP verification
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight mb-2 block"
          >
            Mashonisa
          </Link>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We sent an 8-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {otp.map((digit, i) => (
              <Input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={i === 0 ? 8 : 1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="h-14 w-11 text-center text-xl font-bold"
                autoFocus={i === 0}
              />
            ))}
          </div>
          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={loading || otp.join("").length !== 8}
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the code?
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={loading}
          >
            Resend code
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

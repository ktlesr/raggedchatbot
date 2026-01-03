"use client";

import React, { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { Bot, ArrowRight, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { cn } from "@/lib/utils/cn";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleGoogleLogin = useCallback(async () => {
    if (!executeRecaptcha) {
      console.log("Execute recaptcha not yet available");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await executeRecaptcha("login");

      // Verify reCAPTCHA token
      const verifyRes = await fetch("/api/auth/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        setError("Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      // If reCAPTCHA fine, proceed to signIn
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("Login error:", err);
      setError("Giriş yapılırken bir hata oluştu.");
      setLoading(false);
    }
  }, [executeRecaptcha]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-20">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-blue-500/20 blur-[100px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl shadow-black/10 backdrop-blur-sm relative overflow-hidden">
          {/* Top Banner */}
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-blue-400" />

          <div className="flex flex-col items-center text-center space-y-8">
            <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 rotate-3">
              <Bot size={40} />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Sisteme Giriş Yapın
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Yatırım Teşvik Asistanı&apos;nı kullanmak ve seanslarınızı
                kaydetmek için lütfen Google hesabınızla devam edin.
              </p>
            </div>

            <div className="w-full space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-16 bg-white dark:bg-slate-900 border-2 border-border hover:border-primary/50 text-foreground font-bold rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-black/5"
              >
                {loading ? (
                  <Loader2 size={24} className="animate-spin text-primary" />
                ) : (
                  <>
                    <img
                      src="https://www.google.com/favicon.ico"
                      className="w-5 h-5"
                      alt="Google"
                    />
                    GOOGLE İLE DEVAM ET
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-2">
                  GÜVENLİ GİRİŞ
                </span>
                <div className="h-px bg-border flex-1" />
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                <ShieldCheck size={14} className="text-emerald-500" />
                RECAPTCHA V3 VE SSL İLE KORUNMAKTADIR
              </div>
            </div>

            {error && (
              <div className="w-full p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="pt-4 border-t border-border w-full">
              <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase opacity-50">
                TESVİKSOR AI AUTHENTICATION
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

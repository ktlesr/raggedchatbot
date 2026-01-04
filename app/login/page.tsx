"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Bot,
  ArrowRight,
  ShieldCheck,
  Mail,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useRecaptchaReady } from "@/components/CaptchaProvider";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { executeRecaptcha } = useGoogleReCaptcha();
  const recaptchaReady = useRecaptchaReady();

  const handleCaptchaAndAction = async (
    actionName: string,
    callback: (token: string) => Promise<void>,
  ) => {
    if (!recaptchaReady) {
      setError(
        "reCAPTCHA anahtarı yükleniyor. Lütfen birkaç saniye sonra tekrar deneyin.",
      );
      return;
    }
    if (!executeRecaptcha) {
      setError("reCAPTCHA henüz hazır değil. Lütfen sayfayı yenileyin.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      console.log("Executing reCAPTCHA for action:", actionName);
      const token = await executeRecaptcha(actionName);
      console.log("reCAPTCHA token received:", token ? "YES" : "NO");

      const verifyRes = await fetch("/api/auth/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const verifyData = await verifyRes.json();
      console.log("Verification response:", verifyData);

      if (!verifyRes.ok || !verifyData.success) {
        setError("Güvenlik doğrulaması başarısız oldu.");
        setLoading(false);
        return;
      }

      await callback(token);
    } catch (err: unknown) {
      console.error("reCAPTCHA Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Bir hata oluştu.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    handleCaptchaAndAction("google_login", async () => {
      await signIn("google", { callbackUrl: "/" });
    });
  };

  const handleCredentialsAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      handleCaptchaAndAction("register", async (token) => {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, captchaToken: token }),
        });
        const data = await res.json();
        if (res.ok) {
          // Auto login after register
          await signIn("credentials", { email, password, callbackUrl: "/" });
        } else {
          setError(data.error || "Kayıt başarısız.");
          setLoading(false);
        }
      });
    } else {
      handleCaptchaAndAction("login", async () => {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Email veya şifre hatalı.");
          setLoading(false);
        } else {
          router.push("/");
        }
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden px-4 py-12">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-20 transition-colors duration-500">
        <div
          className={cn(
            "absolute top-[10%] left-[10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse transition-all duration-1000",
            isRegistering ? "bg-purple-500/20" : "bg-primary/20",
          )}
        />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-blue-500/20 blur-[100px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-md z-10 transition-all duration-500">
        <div className="bg-card border border-border rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-black/10 backdrop-blur-sm relative overflow-hidden">
          {/* Top Banner */}
          <div
            className={cn(
              "absolute top-0 left-0 w-full h-1.5 transition-all duration-500",
              isRegistering
                ? "bg-linear-to-r from-purple-500 to-blue-400"
                : "bg-linear-to-r from-primary to-blue-400",
            )}
          />

          <div className="flex flex-col items-center text-center space-y-6">
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-500 rotate-3 group-hover:rotate-0",
                isRegistering
                  ? "bg-purple-600 shadow-purple-500/30"
                  : "bg-primary shadow-primary/30",
              )}
            >
              <Bot size={32} />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground transition-all duration-300">
                {isRegistering ? "Yeni Hesap Oluştur" : "Hoş Geldiniz"}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isRegistering
                  ? "Mevzuatı saniyeler içinde analiz edin."
                  : "Yatırım Teşvik Asistanı'na giriş yapın."}
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleCredentialsAuth}
              className="w-full space-y-4 pt-4"
            >
              {isRegistering && (
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-secondary/30 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all outline-hidden text-sm"
                  />
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  placeholder="E-posta Adresi"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 bg-secondary/30 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all outline-hidden text-sm"
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  placeholder="Şifre"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 bg-secondary/30 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all outline-hidden text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !recaptchaReady}
                className={cn(
                  "w-full h-12 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg",
                  isRegistering
                    ? "bg-purple-600 shadow-purple-500/20 hover:bg-purple-500"
                    : "bg-primary shadow-primary/20 hover:opacity-90",
                )}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    {isRegistering ? "ŞİMDİ ÜYE OL" : "GİRİŞ YAP"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="w-full space-y-4">
              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-2">
                  VEYA
                </span>
                <div className="h-px bg-border flex-1" />
              </div>

              <button
                onClick={handleGoogleLogin}
                type="button"
                disabled={loading || !recaptchaReady}
                className="w-full h-12 bg-white dark:bg-slate-800 border border-border hover:border-primary/50 text-slate-900 dark:text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm text-sm"
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  className="w-4 h-4"
                  alt="Google"
                />
                GOOGLE İLE DEVAM ET
              </button>
            </div>

            {error && (
              <div className="w-full p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="pt-4 flex flex-col items-center gap-4 w-full">
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                type="button"
                className="text-primary hover:underline font-bold text-xs transition-all"
              >
                {isRegistering
                  ? "Zaten hesabınız var mı? Giriş yapın"
                  : "Hesabınız yok mu? Hemen üye olun"}
              </button>

              <button
                onClick={() => router.push("/")}
                type="button"
                className="text-muted-foreground hover:text-primary text-xs transition-all"
              >
                Üye olmadan devam etmek istiyorum
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter opacity-70">
                <ShieldCheck size={12} className="text-emerald-500" />
                RECAPTCHA V3 VE SSL KORUMALI
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

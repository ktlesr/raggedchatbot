"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Shield,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CustomUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setSending(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback }),
      });

      if (res.ok) {
        setStatus("success");
        setFeedback("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSending(false);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
          <User size={32} />
        </div>
        <h1 className="text-xl font-bold">Lütfen Giriş Yapın</h1>
        <p className="text-muted-foreground">
          Profil sayfanızı görüntülemek için Google hesabınızla giriş
          yapmalısınız.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background p-6 md:p-12 space-y-10 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 bg-card border border-border p-8 rounded-[2.5rem] shadow-xl shadow-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-blue-500" />

          <div className="relative group">
            <img
              src={session.user?.image || ""}
              alt={session.user?.name || ""}
              className="w-24 h-24 rounded-full border-4 border-background shadow-lg group-hover:scale-105 transition-transform"
            />
            <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1.5 rounded-full border-2 border-background shadow-md">
              <Shield size={14} />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {session.user?.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {session.user?.email}
              </span>
              <span className="flex items-center gap-1.5 uppercase font-bold tracking-widest text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">
                {(session.user as CustomUser)?.role || "USER"}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="bg-card border border-border rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-black/5 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              Admin&apos;e Geri Bildirim Gönder
            </h2>
            <p className="text-sm text-muted-foreground">
              Sistem hakkında önerilerinizi, şikayetlerinizi veya yeni mevzuat
              taleplerinizi buradan iletebilirsiniz.
            </p>
          </div>

          <form onSubmit={handleSubmitFeedback} className="space-y-6">
            <div className="relative">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Mesajınızı buraya yazın..."
                className="w-full bg-secondary/30 border-2 border-border focus:border-primary/50 rounded-3xl p-6 min-h-[150px] outline-none transition-all placeholder:text-muted-foreground/30 ring-0 focus:ring-4 focus:ring-primary/5 resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {status === "success" && (
                  <div className="flex items-center gap-2 text-emerald-500 font-medium animate-in fade-in slide-in-from-left-2">
                    <CheckCircle2 size={18} />
                    Mesajınız başarıyla iletildi!
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-center gap-2 text-destructive font-medium animate-in fade-in slide-in-from-left-2">
                    <AlertCircle size={18} />
                    Bir hata oluştu.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={sending || !feedback.trim()}
                className={cn(
                  "h-14 px-8 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg",
                  feedback.trim() && !sending
                    ? "bg-primary text-white shadow-primary/20 hover:opacity-90"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed",
                )}
              >
                {sending ? "GÖNDERİLİYOR..." : "GÖNDER"}
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-8 space-y-4">
            <h3 className="font-bold text-blue-500">Hesap Güvenliği</h3>
            <p className="text-sm text-blue-500/70 leading-relaxed">
              Hesabınız Google OAuth 2.0 ile korunmaktadır. Şifreleriniz
              tarafımızca saklanmaz ve sadece yetkili profilinize erişim sağlar.
            </p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-8 space-y-4">
            <h3 className="font-bold text-emerald-500">
              Kullanım İstatistikleri
            </h3>
            <p className="text-sm text-emerald-500/70 leading-relaxed">
              Yaptığınız tüm sorgular ve AI yanıtları gizli tutulur. Verileriniz
              sadece hizmet kalitesini artırmak için anonimleştirilerek analiz
              edilebilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

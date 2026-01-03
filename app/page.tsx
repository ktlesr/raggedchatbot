"use client";

import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  Package,
  ArrowRight,
  Bot,
  Zap,
  Shield,
  Database,
} from "lucide-react";
import { useSessions } from "@/lib/context/SessionContext";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useSession } from "next-auth/react";

export default function Home() {
  const { createSession } = useSessions();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const startNewChat = () => {
    createSession();
    router.push("/chat");
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background p-6 md:p-12 space-y-12 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative rounded-4xl bg-linear-to-br from-primary to-blue-600 p-8 md:p-16 text-white overflow-hidden shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 p-8 opacity-10 animate-pulse">
          <Bot size={240} />
        </div>
        <div className="relative z-10 space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold tracking-widest uppercase">
            <Zap size={12} className="text-yellow-300" />
            AI DESTEKLİ MEVZUAT ANALİZİ
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Yatırım Teşvik Asistanı&apos;na Hoş Geldiniz
          </h1>
          <p className="text-lg text-white/80 leading-relaxed">
            Yatırımlarda Devlet Yardımları Hakkında Karar ve ilgili tüm mevzuatı
            yapay zeka ile anında analiz edin. Karmaşık sorularınıza saniyeler
            içinde yanıt bulun.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={startNewChat}
              className="h-14 px-8 rounded-2xl bg-white text-primary font-bold flex items-center gap-2 hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-black/10"
            >
              Hemen Başla
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: <MessageSquare size={32} />,
            title: "Doğal Dil Sorgulama",
            desc: "Karmaşık mevzuat dilini günlük konuşma dilinde sorarak anlayın.",
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            icon: <Shield size={32} />,
            title: "Güvenilir Kaynaklar",
            desc: "Sadece yüklenen resmi dökümanlar üzerinden, referanslı bilgi üretimi.",
            color: "text-purple-500",
            bg: "bg-purple-500/10",
          },
          {
            icon: <Database size={32} />,
            title: "Otomatik İndeksleme",
            desc: "Yeni bir PDF yüklediğinizde sistem saniyeler içinde metni parçalar ve öğrenir.",
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
        ].map((feat, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-3xl p-8 space-y-6 hover:shadow-xl transition-all group"
          >
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                feat.bg,
                feat.color,
              )}
            >
              {feat.icon}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{feat.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Access Area */}
      <div className="bg-secondary/30 rounded-4xl p-8 border border-border flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 bg-card border border-border rounded-2xl flex items-center justify-center text-primary shadow-sm leading-none">
            <Package size={32} />
          </div>
          <div>
            <h4 className="text-lg font-bold">Veri Envanteri</h4>
            <p className="text-sm text-muted-foreground">
              Şu an sistemde 12 aktif mevzuat belgesi bulunuyor.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/admin"
            className="h-12 px-6 rounded-xl bg-card border border-border text-foreground text-sm font-bold flex items-center gap-2 hover:bg-secondary transition-all"
          >
            Yönetim Paneli
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

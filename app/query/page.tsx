"use client";

import React from "react";
import { Search, Construction, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function QueryPage() {
  const router = useRouter();

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-6 md:p-12 bg-background space-y-10 transition-colors duration-300">
      <div className="flex flex-col items-center max-w-lg text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 bg-primary/10 text-primary rounded-3xl flex items-center justify-center animate-pulse">
            <Search size={48} />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-slate-900 rounded-full p-1.5 border-4 border-background shadow-lg">
            <Construction size={18} />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Yapısal Sorgu</h1>
          <p className="text-muted-foreground leading-relaxed">
            Bu modül; Ek-1, Ek-2 ve Ek-3 tabloları gibi yapılandırılmış veriler
            üzerinde gelişmiş filtreleme ve filtreleme yapmanıza olanak tanır.
          </p>
        </div>

        <div className="w-full p-8 bg-card border border-border rounded-4xl space-y-4 shadow-xl shadow-black/5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-[10px] font-bold tracking-widest uppercase">
            🚧 Geliştirme Aşamasında
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Şu anda vektör tabanlı sohbet altyapımızı optimize ediyoruz.
            Tablosal veri sorgulama özelliği bir sonraki günceleme ile yayında
            olacak.
          </p>
          <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden">
            <div className="bg-yellow-500 h-full w-[65%] rounded-full animate-progress transition-all shadow-sm" />
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors pr-2"
        >
          <ArrowLeft size={16} />
          Geri Dön
        </button>
      </div>
    </div>
  );
}

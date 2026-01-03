"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  History,
  ShieldCheck,
  Users,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Globe,
  MousePointer2,
  Clock,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Stats {
  pages: number;
  maddeler: number;
  ekler: number;
  chunks: number;
}

interface IngestResult {
  message?: string;
  error?: string;
  stats?: Stats;
}

type Tab = "inventory" | "users" | "feedback" | "stats";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("inventory");
  const [adminData, setAdminData] = useState<any>(null);

  // Inventory state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (
      status === "authenticated" &&
      (session?.user as any)?.role !== "admin"
    ) {
      router.push("/profile");
    }
  }, [status, session, router]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      if (res.ok) {
        setAdminData(data);
      }
    } catch (err) {
      console.error("Fetch admin data error:", err);
    }
  };

  useEffect(() => {
    if (
      status === "authenticated" &&
      (session?.user as any)?.role === "admin"
    ) {
      fetchData();
    }
  }, [status, session]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || "Upload failed" });
      } else {
        setResult(data);
        fetchData(); // Refresh stats
      }
    } catch (e: any) {
      setResult({ error: e.message || "Connection error" });
    } finally {
      setUploading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Update role error:", err);
    }
  };

  if (status === "loading" || !session) return null;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background p-4 md:p-12 space-y-10 transition-colors duration-300">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-[10px] uppercase">
            <ShieldCheck size={14} />
            Secure Admin Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Yönetim Paneli
          </h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Sistem ayarlarını yapılandırın ve mevzuat envanterini takip edin.
          </p>
        </div>

        <div className="flex items-center gap-1 md:gap-2 bg-secondary/30 p-1 rounded-2xl border border-border overflow-x-auto">
          {[
            { id: "inventory", icon: Package, label: "Envanter" },
            { id: "users", icon: Users, label: "Kullanıcılar" },
            { id: "feedback", icon: MessageSquare, label: "Geri Bildirim" },
            { id: "stats", icon: BarChart3, label: "Analiz" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full">
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-card border border-border rounded-[2.5rem] p-6 md:p-12 shadow-xl shadow-black/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="flex flex-col items-center text-center space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Mevzuat Verisi Yükle</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      PDF dökümanlarını saniyeler içinde vektör veritabanına
                      aktarın.
                    </p>
                  </div>

                  <div className="w-full relative">
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      accept=".pdf"
                    />
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center justify-center transition-all",
                        file
                          ? "bg-primary/5 border-primary/30"
                          : "bg-secondary/30 border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center mb-6",
                          file
                            ? "bg-primary text-white"
                            : "bg-card text-primary",
                        )}
                      >
                        {uploading ? (
                          <Loader2 size={36} className="animate-spin" />
                        ) : (
                          <Upload size={36} />
                        )}
                      </div>
                      <h3 className="font-bold truncate max-w-full px-4">
                        {file ? file.name : "Dosya Seçin"}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-bold mt-2 uppercase tracking-widest">
                        PDF • MAKS 20MB
                      </p>
                    </div>
                  </div>

                  {file && !uploading && !result && (
                    <button
                      onClick={handleUpload}
                      className="w-full h-16 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
                    >
                      <FileText size={20} /> ANALİZ ET VE KAYDET
                    </button>
                  )}
                </div>

                {result && (
                  <div
                    className={cn(
                      "mt-10 p-8 rounded-3xl border animate-in fade-in",
                      result.error
                        ? "bg-destructive/5 border-destructive/10 text-destructive"
                        : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {result.error ? (
                        <AlertCircle size={32} />
                      ) : (
                        <CheckCircle size={32} />
                      )}
                      <div>
                        <p className="font-bold">
                          {result.error ? "Hata Oluştu" : "İşlem Başarılı"}
                        </p>
                        <p className="text-sm opacity-80">
                          {result.error || result.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-card border border-border rounded-[2rem] p-6 shadow-xl shadow-black/5 space-y-6">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider opacity-60">
                  <History size={16} /> Sistem Özeti
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      label: "Döküman Sayısı",
                      val: adminData?.stats?.totalDocs || 0,
                      icon: FileText,
                      color: "text-blue-500",
                    },
                    {
                      label: "Vektör Parçası",
                      val: (
                        adminData?.stats?.totalChunks || 0
                      ).toLocaleString(),
                      icon: Package,
                      color: "text-purple-500",
                    },
                    {
                      label: "Kayıtlı Kullanıcı",
                      val: adminData?.stats?.totalUsers || 0,
                      icon: Users,
                      color: "text-emerald-500",
                    },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/40"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg bg-background shadow-sm",
                            s.color,
                          )}
                        >
                          <s.icon size={16} />
                        </div>
                        <span className="text-xs font-semibold text-foreground/80">
                          {s.label}
                        </span>
                      </div>
                      <span className="font-bold text-base tracking-tight">
                        {s.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border border-border rounded-[2.5rem] overflow-x-auto shadow-xl shadow-black/5">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Kullanıcı
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Email
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Rol
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Katılım
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {adminData?.users?.map((u: any) => (
                    <tr
                      key={u.id}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img
                              src={u.image}
                              alt=""
                              className="w-8 h-8 rounded-full border border-border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {u.name?.[0] || "U"}
                            </div>
                          )}
                          <span className="font-bold text-sm truncate max-w-[150px]">
                            {u.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter",
                            u.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-8 py-5">
                        <select
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          className="bg-secondary border border-border rounded-lg text-xs p-1 outline-none"
                          value={u.role}
                        >
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {adminData?.feedbacks?.map((f: any) => (
              <div
                key={f.id}
                className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded font-bold uppercase">
                    {f.status}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed italic">
                  &quot;{f.message}&quot;
                </p>
                <div className="pt-2 flex justify-end">
                  <button className="text-xs font-bold text-primary hover:underline">
                    Yanıtla
                  </button>
                </div>
              </div>
            ))}
            {(!adminData?.feedbacks || adminData.feedbacks.length === 0) && (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-secondary/20 rounded-[2rem] border border-dashed border-border">
                Henüz geri bildirim bulunmuyor.
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Real Stats Mockup Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              {[
                {
                  label: "Aktif Kullanıcı (Anlık)",
                  val: "14",
                  icon: TrendingUp,
                  color: "text-emerald-500",
                  sub: "+3 son 1 saat",
                },
                {
                  label: "Oturum Süresi",
                  val: "4:24",
                  icon: Clock,
                  color: "text-blue-500",
                  sub: "Ortalama",
                },
                {
                  label: "Tıklama Oranı",
                  val: "%12.4",
                  icon: MousePointer2,
                  color: "text-purple-500",
                  sub: "Genel Ort.",
                },
                {
                  label: "Yeni Kullanıcı",
                  val: "128",
                  icon: Globe,
                  color: "text-orange-500",
                  sub: "Bu hafta",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-card border border-border p-6 rounded-[2rem] shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={cn("p-2 rounded-xl bg-secondary/50", s.color)}
                    >
                      <s.icon size={18} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <ArrowUpRight size={12} /> {s.sub}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {s.label}
                    </span>
                    <p className="text-3xl font-bold tracking-tight">{s.val}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Traffic Chart Mockup */}
              <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" /> Kullanım
                    Trendi
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Son 7 Gün
                  </span>
                </div>
                <div className="h-48 flex items-end justify-between gap-2 px-2">
                  {[40, 60, 45, 90, 65, 80, 55].map((h, i) => (
                    <div key={i} className="flex-1 group relative">
                      <div
                        className="bg-primary/20 hover:bg-primary/40 transition-all rounded-t-lg w-full cursor-pointer"
                        style={{ height: `${h}%` }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {h * 10} sorgu
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground overflow-x-auto">
                  <span>PZT</span>
                  <span>SAL</span>
                  <span>ÇAR</span>
                  <span>PER</span>
                  <span>CUM</span>
                  <span>CMT</span>
                  <span>PAZ</span>
                </div>
              </div>

              {/* Integration Status Overlay */}
              <div className="bg-card border border-border rounded-[2.5rem] p-8 flex flex-col justify-between">
                <div className="space-y-4 text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 mx-auto">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">
                      GA4 Entegrasyonu Aktif
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Tüm kullanıcı hareketleri G-RXBH1RY6H1 mülkü üzerinden
                      izlenmektedir.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border mt-auto">
                  <a
                    href="https://analytics.google.com/analytics/web/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-14 rounded-2xl bg-secondary hover:bg-secondary/70 text-foreground font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} /> GOOGLE ANALYTICS KONSOLU
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

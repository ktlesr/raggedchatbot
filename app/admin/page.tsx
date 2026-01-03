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
  ArrowRight,
  Bot,
  Users,
  MessageSquare,
  BarChart3,
  Trash2,
  ShieldAlert,
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
  const [loadingData, setLoadingData] = useState(false);

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
      // If logged in but not admin, redirect to profile or home
      router.push("/profile");
    }
  }, [status, session, router]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/data");
      const data = await res.json();
      if (res.ok) {
        setAdminData(data);
      }
    } catch (err) {
      console.error("Fetch admin data error:", err);
    } finally {
      setLoadingData(false);
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
    <div className="flex-1 h-full overflow-y-auto bg-background p-6 md:p-12 space-y-10 transition-colors duration-300">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-[10px] uppercase">
            <ShieldCheck size={14} />
            Secure Admin Dashboard
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Yönetim Paneli</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Sistem ayarlarını yapılandırın, kullanıcıları yönetin ve mevzuat
            envanterini takip edin.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-2xl border border-border">
          {[
            { id: "inventory", icon: Package, label: "Envanter" },
            { id: "users", icon: Users, label: "Kullanıcılar" },
            { id: "feedback", icon: MessageSquare, label: "Geri Bildirim" },
            { id: "stats", icon: BarChart3, label: "İstatistikler" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
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
              <div className="bg-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-black/5 relative overflow-hidden group">
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
                        "border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center transition-all",
                        file
                          ? "bg-primary/5 border-primary/30"
                          : "bg-secondary/30 border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "w-20 h-20 rounded-3xl flex items-center justify-center mb-6",
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
                      <h3 className="font-bold">
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
              <div className="bg-card border border-border rounded-[2rem] p-8 shadow-xl shadow-black/5 space-y-6">
                <h3 className="font-bold flex items-center gap-2">
                  <History size={18} /> Sistem Özeti
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      label: "Döküman Sayısı",
                      val: adminData?.stats?.totalDocs || 0,
                    },
                    {
                      label: "Vektör Parçası",
                      val: adminData?.stats?.totalChunks || 0,
                    },
                    {
                      label: "Aktif Kullanıcı",
                      val: adminData?.stats?.totalUsers || 0,
                    },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border/50"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {s.label}
                      </span>
                      <span className="font-bold text-sm">{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5">
              <table className="w-full text-left">
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
                          <img
                            src={u.image}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                          <span className="font-bold text-sm">{u.name}</span>
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
                className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-4"
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
                  "{f.message}"
                </p>
                <div className="pt-2 flex justify-end">
                  <button className="text-xs font-bold text-primary hover:underline">
                    Yanıtla
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  label: "TOPLAM SORGULAMA",
                  val: "4.2K",
                  color: "text-blue-500",
                },
                {
                  label: "ORTALAMA HIZ",
                  val: "1.2s",
                  color: "text-emerald-500",
                },
                {
                  label: "RETRIEVAL BAŞARI",
                  val: "%94",
                  color: "text-purple-500",
                },
                {
                  label: "SİSTEM UPTIME",
                  val: "%99.9",
                  color: "text-orange-500",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-card border border-border p-6 rounded-[2rem] shadow-sm text-center space-y-1"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {s.label}
                  </span>
                  <p className={cn("text-3xl font-bold", s.color)}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldAlert size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">
                  Google Analytics Entegrasyonu
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Canlı kullanıcı hareketlerini ve detaylı sorgu
                  istatistiklerini izlemek için Google Analytics mülkünüzü
                  bağlayın.
                </p>
              </div>
              <button className="h-12 px-8 rounded-xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all">
                GA4 DASHBOARD'U BAĞLA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

interface DeliveryHour {
  dayOfWeek: string;
  openingTime: string;
  closingTime: string;
  deliveryType: string;
}

interface StoreItem {
  id: number;
  status: "ACTIVE" | "PASSIVE" | string;
  name: string;
  shortName?: string;
  workingStatus: "OPEN" | "CLOSED" | string;
  sellerWorkingStatus?: "OPEN" | "CLOSED" | string;
  deliveryHours?: DeliveryHour[];
  averageDeliveryInterval?: string;
  minDeliveryTimeInMin?: number;
  maxDeliveryTimeInMin?: number;
  sellerId?: number;
  sellerName?: string;
  sellerType?: string;
  sellerSubType?: string;
  deliveryType?: string;
  scheduleType?: string;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Pazartesi",
  TUESDAY: "Salı",
  WEDNESDAY: "Çarşamba",
  THURSDAY: "Perşembe",
  FRIDAY: "Cuma",
  SATURDAY: "Cumartesi",
  SUNDAY: "Pazar",
};

export default function SubeYonetimiPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modallar
  const [selectedHoursStore, setSelectedHoursStore] = useState<StoreItem | null>(null);
  const [toggleConfirmStore, setToggleConfirmStore] = useState<{
    store: StoreItem;
    targetStatus: "OPEN" | "CLOSED";
  } | null>(null);
  const [updatingStoreId, setUpdatingStoreId] = useState<number | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Verileri API'den çek
  const fetchStores = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const url = isManualRefresh ? "/api/subeler?refresh=true" : "/api/subeler";
      const res = await axios.get(url);
      if (res.data?.stores) {
        setStores(res.data.stores);
      }
    } catch (err: any) {
      console.error("Şubeler çekilemedi:", err);
      showToast("Şube bilgileri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Otomatik yenileme (her 30 saniyede bir)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStores(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStores]);

  // Çalışma durumunu güncelle (Aç / Kapat)
  const handleToggleWorkingStatus = async (store: StoreItem, targetStatus: "OPEN" | "CLOSED") => {
    setUpdatingStoreId(store.id);
    try {
      const res = await axios.put("/api/subeler", {
        storeId: store.id,
        workingStatus: targetStatus,
      });

      if (res.data?.success) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, workingStatus: targetStatus } : s))
        );
        showToast(
          `${store.shortName || store.name} durumu ${
            targetStatus === "OPEN" ? "AÇIK" : "KAPALI"
          } yapıldı.`
        );
      } else {
        showToast("Durum güncellenemedi: " + (res.data?.error || "Bilinmeyen hata"));
      }
    } catch (err: any) {
      console.error("Durum güncelleme hatası:", err);
      showToast(
        "Trendyol Go API hatası: " + (err.response?.data?.details || err.message || "İşlem başarısız.")
      );
    } finally {
      setUpdatingStoreId(null);
      setToggleConfirmStore(null);
    }
  };

  // Gece yarısını devreden saatleri (Örn: 08:00 - 23:59 ve 00:00 - 02:00) birleştirip 08:00 - 02:00 yapan fonksiyon
  const getMergedDayHours = (dayHours: DeliveryHour[]): string => {
    if (!dayHours || dayHours.length === 0) return "Kapalı";

    if (dayHours.length === 1) {
      const open = dayHours[0].openingTime ? dayHours[0].openingTime.slice(0, 5) : "--:--";
      const close = dayHours[0].closingTime ? dayHours[0].closingTime.slice(0, 5) : "--:--";
      return `${open} - ${close}`;
    }

    // Gece devri kontrolü (23:59 kapanış ve 00:00 açılış aynı mesaiye aittir)
    const midnightEnd = dayHours.find(
      (h) => h.closingTime && (h.closingTime.startsWith("23:59") || h.closingTime.startsWith("23:58") || h.closingTime.startsWith("24:00"))
    );
    const midnightStart = dayHours.find(
      (h) => h.openingTime && (h.openingTime.startsWith("00:00") || h.openingTime.startsWith("00:01"))
    );

    if (midnightEnd && midnightStart) {
      const open = midnightEnd.openingTime ? midnightEnd.openingTime.slice(0, 5) : "--:--";
      const close = midnightStart.closingTime ? midnightStart.closingTime.slice(0, 5) : "--:--";
      const mergedShift = `${open} - ${close}`;

      const otherShifts = dayHours
        .filter((h) => h !== midnightEnd && h !== midnightStart)
        .map((h) => `${h.openingTime?.slice(0, 5) || "--:--"} - ${h.closingTime?.slice(0, 5) || "--:--"}`);

      return [mergedShift, ...otherShifts].join(", ");
    }

    return dayHours
      .map((h) => `${h.openingTime?.slice(0, 5) || "--:--"} - ${h.closingTime?.slice(0, 5) || "--:--"}`)
      .join(", ");
  };

  // Bugünkü günü bul
  const currentDayKey = useMemo(() => {
    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    return days[new Date().getDay()];
  }, []);

  // Şube bugünkü çalışma saatini al
  const getTodayHours = (store: StoreItem) => {
    if (!store.deliveryHours || store.deliveryHours.length === 0) return "Belirtilmemiş";
    const todayHours = store.deliveryHours.filter((h) => h.dayOfWeek === currentDayKey);
    return getMergedDayHours(todayHours);
  };

  // İstatistikler
  const stats = useMemo(() => {
    const total = stores.length;
    const open = stores.filter((s) => s.workingStatus === "OPEN").length;
    const closed = stores.filter((s) => s.workingStatus !== "OPEN").length;

    return { total, open, closed };
  }, [stores]);

  // Filtreleme ve Arama
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      if (statusFilter === "OPEN" && store.workingStatus !== "OPEN") return false;
      if (statusFilter === "CLOSED" && store.workingStatus === "OPEN") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = store.name.toLowerCase().includes(q);
      const shortNameMatch = store.shortName?.toLowerCase().includes(q);
      const idMatch = String(store.id).includes(q);

      return nameMatch || shortNameMatch || idMatch;
    });
  }, [stores, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      {/* Toast Bildirimi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 shadow-2xl flex items-center gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-bold text-xs uppercase tracking-wider">{toastMessage}</span>
        </div>
      )}

      {/* ── Top Bar (app/page.tsx ile Birebir Aynı Kurumsal Başlık Barı) ── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-widest uppercase text-white">Şube Yönetimi</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Trendyol Go Canlı
                </span>
              </div>
              <p className="text-[13px] text-gray-400 mt-0.5">Şube Açık / Kapalı Durumları, Çalışma Saatleri ve Teslimat Süreleri</p>
            </div>

            {/* Quick Stat Pill */}
            <div className="hidden lg:flex items-center gap-0 divide-x divide-gray-700 border-l border-gray-700 ml-2 pl-4">
              <div className="px-4 text-center">
                <p className="text-[18px] font-bold text-white leading-none">{stats.total}</p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">Toplam Şube</p>
              </div>
              <div className="px-4 text-center">
                <p className="text-[18px] font-bold text-emerald-400 leading-none">{stats.open}</p>
                <p className="text-[11px] text-emerald-500/80 uppercase tracking-wider mt-0.5">Açık</p>
              </div>
              <div className="px-4 text-center">
                <p className={`text-[18px] font-bold leading-none ${stats.closed > 0 ? "text-red-400" : "text-gray-400"}`}>
                  {stats.closed}
                </p>
                <p className={`text-[11px] uppercase tracking-wider mt-0.5 ${stats.closed > 0 ? "text-red-400 font-bold" : "text-gray-500"}`}>
                  Kapalı
                </p>
              </div>
            </div>
          </div>

          {/* Sağ Aksiyonlar */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded cursor-pointer hover:bg-gray-700/80 transition">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-emerald-500 rounded cursor-pointer w-3.5 h-3.5"
              />
              <span>Otomatik (30s)</span>
            </label>

            <button
              onClick={() => fetchStores(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-white font-bold text-xs rounded transition-all shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{refreshing ? "Yenileniyor..." : "Yenile"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Container (app/page.tsx ve app/iadeler ile aynı kurumsal yapı) ── */}
      <div className="p-6 space-y-4">
        {/* Row 1: KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Toplam Şube */}
          <div className="bg-white border border-gray-200 p-4 shadow-xs">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Toplam Şube</h3>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-gray-900">{loading ? "--" : stats.total}</span>
              <span className="text-[11px] font-bold text-gray-500 mb-1">Limon Süpermarket</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Sistem Durumu:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 text-[10px] uppercase">
                Aktif Entegrasyon
              </span>
            </div>
          </div>

          {/* Açık Şubeler */}
          <div className="bg-white border border-gray-200 p-4 shadow-xs">
            <h3 className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Açık Şubeler</h3>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-emerald-600">{loading ? "--" : stats.open}</span>
              <span className="text-[11px] font-bold text-emerald-600 mb-1">Sipariş Alımı Aktif</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Müşteri Erişimi:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sipariş Kabul Ediliyor
              </span>
            </div>
          </div>

          {/* Kapalı Şubeler (Çok Belirgin ve Vurgulu) */}
          <div
            className={`p-4 shadow-xs transition-all ${
              stats.closed > 0
                ? "bg-red-50/70 border-2 border-red-500 ring-2 ring-red-500/20"
                : "bg-white border border-gray-200"
            }`}
          >
            <h3
              className={`text-[11px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                stats.closed > 0 ? "text-red-700" : "text-gray-400"
              }`}
            >
              {stats.closed > 0 && <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>}
              <span>Kapalı Şubeler</span>
            </h3>
            <div className="flex items-end justify-between mt-2">
              <span className={`text-3xl font-black ${stats.closed > 0 ? "text-red-600" : "text-gray-900"}`}>
                {loading ? "--" : stats.closed}
              </span>
              <span
                className={`text-[11px] font-bold mb-1 ${
                  stats.closed > 0 ? "text-red-700 uppercase tracking-wider" : "text-gray-500"
                }`}
              >
                {stats.closed > 0 ? "Sipariş Alınmıyor!" : "Tümü Açık"}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200/60 flex justify-between items-center text-xs">
              <span className={stats.closed > 0 ? "text-red-800 font-bold" : "text-gray-500"}>
                {stats.closed > 0 ? "⚠️ Dikkat Ediniz:" : "Şube Takibi:"}
              </span>
              <span
                className={`font-black text-[11px] px-2 py-0.5 rounded ${
                  stats.closed > 0
                    ? "bg-red-600 text-white animate-pulse uppercase"
                    : "text-gray-600 font-medium"
                }`}
              >
                {stats.closed > 0 ? "Şube Kapalı Durumda" : "Eksik Şube Yok"}
              </span>
            </div>
          </div>

          {/* Ortalama Teslimat Süresi */}
          <div className="bg-white border border-gray-200 p-4 shadow-xs">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Ort. Teslimat Süresi
            </h3>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-gray-900">15 - 25</span>
              <span className="text-[11px] font-bold text-gray-500 mb-1">Dakika</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Kurye Modeli:</span>
              <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 border border-gray-200 text-[10px] uppercase">
                Trendyol GO Kurye
              </span>
            </div>
          </div>
        </div>

        {/* ── Filters & View Row ── */}
        <div className="bg-white border border-gray-200 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          {/* Arama Input */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Şube adı veya ID ara (örn: Atakum, 157108)..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sekmeler & Görünüm */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center border border-gray-300 bg-gray-50 rounded overflow-hidden p-0.5">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "ALL" ? "bg-white text-gray-900 shadow-xs rounded" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Tümü ({stores.length})
              </button>
              <button
                onClick={() => setStatusFilter("OPEN")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "OPEN"
                    ? "bg-white text-emerald-700 shadow-xs rounded"
                    : "text-gray-600 hover:text-emerald-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Açık ({stats.open})
              </button>
              <button
                onClick={() => setStatusFilter("CLOSED")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition ${
                  statusFilter === "CLOSED"
                    ? "bg-red-600 text-white shadow-xs rounded font-black"
                    : "text-red-700 hover:text-red-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Kapalı ({stats.closed})
              </button>
            </div>

            {/* Grid / Table Toggle */}
            <div className="flex items-center border border-gray-300 bg-gray-50 rounded overflow-hidden p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition ${viewMode === "grid" ? "bg-white text-gray-900 shadow-xs rounded" : "text-gray-500 hover:text-gray-800"}`}
                title="Kart Görünümü"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 transition ${viewMode === "table" ? "bg-white text-gray-900 shadow-xs rounded" : "text-gray-500 hover:text-gray-800"}`}
                title="Tablo Görünümü"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Yükleniyor Göstergesi */}
        {loading && (
          <div className="bg-white border border-gray-200 py-20 flex flex-col items-center justify-center text-gray-500">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Şube verileri yükleniyor...</span>
          </div>
        )}

        {/* Şube Bulunamadı */}
        {!loading && filteredStores.length === 0 && (
          <div className="bg-white border border-gray-200 py-16 text-center">
            <p className="text-sm font-bold text-gray-700">Aramanıza uygun şube bulunamadı.</p>
            <p className="text-xs text-gray-400 mt-1">Filtreleri veya arama kelimesini kontrol ediniz.</p>
          </div>
        )}

        {/* ── KART GÖRÜNÜMÜ (GRID VIEW) ── */}
        {!loading && viewMode === "grid" && filteredStores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStores.map((store) => {
              const isOpen = store.workingStatus === "OPEN";
              const todayHours = getTodayHours(store);
              const isUpdating = updatingStoreId === store.id;

              return (
                <div
                  key={store.id}
                  className={`bg-white border transition-all flex flex-col justify-between p-4 ${
                    isOpen
                      ? "border-gray-200 hover:border-gray-300 shadow-xs"
                      : "border-2 border-red-500 bg-red-50/30 shadow-md ring-1 ring-red-400/30"
                  }`}
                >
                  <div>
                    {/* KAPALI ŞUBE ÜST BANNERI (Çok Belirgin) */}
                    {!isOpen && (
                      <div className="-mx-4 -mt-4 mb-3.5 bg-red-600 text-white px-3 py-1.5 flex items-center justify-between text-xs font-black tracking-wide">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                          <span>BU ŞUBE ŞU ANDA KAPALIDIR</span>
                        </div>
                        <span className="text-[10px] bg-red-800 px-1.5 py-0.5 rounded font-bold uppercase">
                          Sipariş Alınmıyor
                        </span>
                      </div>
                    )}

                    {/* Başlık, ID ve Birebir Trendyol Go Switch */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 border border-gray-200">
                            #{store.id}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 ${
                              store.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-500 border border-gray-200"
                            }`}
                          >
                            {store.status === "ACTIVE" ? "Aktif" : store.status}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-gray-900 truncate" title={store.name}>
                          {store.name}
                        </h2>
                      </div>

                      {/* Trendyol Go Portalındaki Yeşil/Gri Switch Butonu */}
                      <div
                        className={`shrink-0 flex items-center gap-2 px-2.5 py-1 rounded border ${
                          isOpen
                            ? "bg-gray-50 border-gray-200"
                            : "bg-red-100 border-red-300"
                        }`}
                      >
                        <span
                          className={`text-xs font-black select-none ${
                            isOpen ? "text-emerald-700" : "text-red-700 font-extrabold"
                          }`}
                        >
                          {isOpen ? "Açık" : "Kapalı"}
                        </span>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            setToggleConfirmStore({
                              store,
                              targetStatus: isOpen ? "CLOSED" : "OPEN",
                            })
                          }
                          title={isOpen ? "Şubeyi kapatmak için tıklayın" : "Şubeyi açmak için tıklayın"}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                            isOpen ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isOpen ? "translate-x-5" : "translate-x-0"
                            } ${isUpdating ? "animate-pulse" : ""}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Çalışma Saati Barı (Görseldeki Format) */}
                    <div className="bg-gray-50 border border-gray-200 p-2.5 mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                        <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Çalışma Saati ( <strong className="text-gray-900 font-bold">{todayHours}</strong> )
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedHoursStore(store)}
                        className="text-[11px] font-bold text-gray-600 hover:text-gray-900 underline cursor-pointer"
                      >
                        Haftalık ↗
                      </button>
                    </div>

                    {/* Metrik: Teslimat Süresi */}
                    <div className="bg-gray-50 border border-gray-200 p-2.5 mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        ⚡ Teslimat Süresi
                      </span>
                      <span className="text-xs font-black text-gray-900">
                        {store.averageDeliveryInterval || "20 - 30 dk"}
                      </span>
                    </div>
                  </div>

                  {/* Alt Kısım: Aksiyonlar */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(String(store.id));
                        showToast(`Şube ID (#${store.id}) kopyalandı!`);
                      }}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-900"
                    >
                      ID Kopyala
                    </button>

                    <button
                      onClick={() => setSelectedHoursStore(store)}
                      className="text-[11px] font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1 border border-gray-300 rounded transition"
                    >
                      Haftalık Saatler ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TABLO GÖRÜNÜMÜ (TABLE VIEW) ── */}
        {!loading && viewMode === "table" && filteredStores.length > 0 && (
          <div className="bg-white border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-800">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Şube & Kod</th>
                    <th className="py-3 px-4 text-center">Çalışma Durumu</th>
                    <th className="py-3 px-4">Çalışma Saati (Bugün)</th>
                    <th className="py-3 px-4 text-center">Teslimat Süresi</th>
                    <th className="py-3 px-4 text-center">Sistem Durumu</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStores.map((store) => {
                    const isOpen = store.workingStatus === "OPEN";
                    const todayHours = getTodayHours(store);
                    const isUpdating = updatingStoreId === store.id;

                    return (
                      <tr
                        key={store.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          !isOpen ? "bg-red-50/70 border-l-4 border-l-red-600" : ""
                        }`}
                      >
                        {/* Şube Adı & ID */}
                        <td className="py-3 px-4">
                          <div className={`font-bold ${isOpen ? "text-gray-900" : "text-red-900"}`}>
                            {store.name}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                            ID: #{store.id}
                          </div>
                        </td>

                        {/* Açık / Kapalı Toggle & Yazı */}
                        <td className="py-3 px-4 text-center">
                          <div
                            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${
                              isOpen
                                ? "bg-gray-50 border-gray-200"
                                : "bg-red-100 border-red-300"
                            }`}
                          >
                            <span
                              className={`text-xs font-black ${
                                isOpen ? "text-emerald-700" : "text-red-700 font-extrabold"
                              }`}
                            >
                              {isOpen ? "Açık" : "Kapalı"}
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                setToggleConfirmStore({
                                  store,
                                  targetStatus: isOpen ? "CLOSED" : "OPEN",
                                })
                              }
                              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                isOpen ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isOpen ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </td>

                        {/* Çalışma Saati */}
                        <td className="py-3 px-4 font-medium text-gray-700">
                          {todayHours}
                        </td>

                        {/* Teslimat Süresi */}
                        <td className="py-3 px-4 text-center font-bold text-gray-700">
                          {store.averageDeliveryInterval || "20 - 30 dk"}
                        </td>

                        {/* Sistem Durumu */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                              store.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}
                          >
                            {store.status === "ACTIVE" ? "Aktif" : store.status}
                          </span>
                        </td>

                        {/* İşlemler */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedHoursStore(store)}
                            className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 border border-gray-300 rounded transition"
                          >
                            Haftalık Saatler
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── HAFTALIK ÇALIŞMA SAATLERİ MODALI ── */}
      {selectedHoursStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-300 max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-start justify-between mb-4 border-b border-gray-200 pb-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 border border-gray-200">
                  #{selectedHoursStore.id}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-1">{selectedHoursStore.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Haftalık Teslimat & Çalışma Saatleri</p>
              </div>
              <button
                onClick={() => setSelectedHoursStore(null)}
                className="text-gray-400 hover:text-gray-700 p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 mb-5">
              {[
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
                "SUNDAY",
              ].map((dayKey) => {
                const dayHours = (selectedHoursStore.deliveryHours || []).filter(
                  (h) => h.dayOfWeek === dayKey
                );
                const isToday = dayKey === currentDayKey;
                const label = DAY_LABELS[dayKey] || dayKey;
                const hoursText = getMergedDayHours(dayHours);

                return (
                  <div
                    key={dayKey}
                    className={`flex items-center justify-between p-2 text-xs border ${
                      isToday
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{label}</span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white uppercase">
                          Bugün
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs font-bold text-gray-900">
                      {hoursText}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedHoursStore(null)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ŞUBE AÇMA / KAPATMA GÜVENLİK ONAY MODALI ── */}
      {toggleConfirmStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-300 max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  toggleConfirmStore.targetStatus === "CLOSED"
                    ? "bg-red-100 text-red-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {toggleConfirmStore.targetStatus === "CLOSED" ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {toggleConfirmStore.targetStatus === "CLOSED"
                    ? "Şubeyi Kapatmak İstiyor Musunuz?"
                    : "Şubeyi Açmak İstiyor Musunuz?"}
                </h3>
                <p className="text-xs text-gray-500">Trendyol Go Canlı Durum Bildirimi</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-3 mb-4 text-xs text-gray-700 leading-relaxed">
              <strong className="text-gray-900 block mb-1">
                {toggleConfirmStore.store.name} (#{toggleConfirmStore.store.id})
              </strong>
              {toggleConfirmStore.targetStatus === "CLOSED" ? (
                <span className="text-red-700 font-medium">
                  ⚠️ Bu işlem mağazayı Trendyol Go üzerinde <strong>KAPALI</strong> yapacaktır. Müşteriler mağazayı kapalı görecek ve yeni sipariş veremeyecektir.
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">
                  ✅ Bu işlem mağazayı Trendyol Go üzerinde <strong>AÇIK</strong> yapacak ve şube anında sipariş almaya başlayacaktır.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setToggleConfirmStore(null)}
                className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={() =>
                  handleToggleWorkingStatus(
                    toggleConfirmStore.store,
                    toggleConfirmStore.targetStatus
                  )
                }
                className={`px-4 py-1.5 text-xs font-bold text-white rounded transition cursor-pointer ${
                  toggleConfirmStore.targetStatus === "CLOSED"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {toggleConfirmStore.targetStatus === "CLOSED" ? "Evet, Kapat" : "Evet, Aç"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

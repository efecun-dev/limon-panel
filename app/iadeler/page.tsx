"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import axios from "axios";

// ─── Şube Listesi ──────────────────────────────────────────────────────────────
const BRANCHES = [
  { id: "479045", name: "Atakum Gross" },
  { id: "479052", name: "Barış" },
  { id: "479048", name: "Denizevleri" },
  { id: "479063", name: "Duruşehir" },
  { id: "479042", name: "Kanije" },
  { id: "479054", name: "Körfez 2" },
  { id: "479061", name: "Liman" },
  { id: "479064", name: "Nikah" },
  { id: "157108", name: "Limon 1" },
  { id: "156829", name: "Limon 2" },
  { id: "157111", name: "Limon 3" },
  { id: "157109", name: "Limon 5" },
];

const getBranchName = (storeId: number | string | undefined) => {
  if (!storeId) return null;
  const branch = BRANCHES.find((b) => b.id === storeId?.toString());
  return branch ? branch.name : String(storeId);
};

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  Created: { label: "Oluşturuldu", dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  WaitingInAction: { label: "Bekliyor", dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  Accepted: { label: "Kabul Edildi", dot: "bg-green-600", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  Rejected: { label: "Reddedildi", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  Unresolved: { label: "İhtilaflı", dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  Cancelled: { label: "İptal Edildi", dot: "bg-gray-500", text: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] || { label: status, dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border ${cfg.border} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}

function CustomSelect({ label, value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o: any) => o.value === value);
  const isActive = value !== "all";
  return (
    <div className="relative">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div
        className={`w-full border bg-white px-3 py-2 text-sm flex justify-between items-center cursor-pointer h-[38px] gap-2 transition-colors ${isOpen ? "border-gray-500 ring-1 ring-gray-400" : isActive ? "border-gray-500 bg-gray-50" : "border-gray-300 hover:border-gray-400"
          }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`font-medium truncate text-[13px] ${isActive ? "text-gray-900 font-semibold" : "text-gray-700"}`}>
          {selected?.label || "Seçiniz"}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-xl max-h-60 overflow-auto py-1">
            {options.map((option: any) => (
              <li
                key={option.value}
                className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${value === option.value ? "bg-gray-900 text-white font-semibold" : "text-gray-700 hover:bg-gray-100"}`}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function IadelerPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [orderMap, setOrderMap] = useState<Record<string, any>>({});
  const [loadingOrders, setLoadingOrders] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchClaims = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await axios.get(`/api/iadeler?t=${Date.now()}`);
      if (response.data?.content) {
        const claimsData = response.data.content;
        setClaims(claimsData);
        setLastUpdated(new Date());

        // API'den gelen hazır sipariş / paket detaylarını doğrudan orderMap'e aktar
        const newMap: Record<string, any> = {};
        for (const c of claimsData) {
          if (c.orderNumber && c.orderDetails) {
            newMap[c.orderNumber] = c.orderDetails;
          }
        }
        if (Object.keys(newMap).length > 0) {
          setOrderMap(prev => ({ ...prev, ...newMap }));
        }
      }
    } catch (error) {
      console.error("İadeler çekilirken hata:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    const interval = setInterval(() => fetchClaims(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrderForClaim = async (orderNumber: string, orderDate?: number) => {
    if (!orderNumber || orderMap[orderNumber] || loadingOrders[orderNumber]) return;
    setLoadingOrders(prev => ({ ...prev, [orderNumber]: true }));
    try {
      let url = `/api/siparisler?orderNumber=${orderNumber}`;
      if (orderDate) url += `&orderDate=${orderDate}`;
      const response = await axios.get(url);
      if (response.data?.content?.length > 0) {
        setOrderMap(prev => ({ ...prev, [orderNumber]: response.data.content[0] }));
      }
    } catch (error) {
      console.error("İade için sipariş detayı çekilemedi:", error);
    } finally {
      setLoadingOrders(prev => ({ ...prev, [orderNumber]: false }));
    }
  };

  const toggleClaim = (claimId: string, orderNumber: string, orderDate?: number) => {
    const isExpanding = expandedClaim !== claimId;
    setExpandedClaim(isExpanding ? claimId : null);
    if (isExpanding && !orderMap[orderNumber]) {
      fetchOrderForClaim(orderNumber, orderDate);
    }
  };

  const processedClaims = useMemo(() => {
    return claims.filter((c: any) => {
      const mainStatus = c.claimItems?.[0]?.claimItemStatus?.name || "Unknown";
      if (statusFilter !== "all" && mainStatus !== statusFilter) return false;
      const sId = (c.storeId || orderMap[c.orderNumber]?.storeId)?.toString();
      if (branchFilter !== "all" && sId !== branchFilter) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const num = (c.orderNumber || "").toLowerCase();
        const name = `${c.customerFirstName || ""} ${c.customerLastName || ""}`.toLowerCase();
        const bName = (getBranchName(sId) || "").toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !bName.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.claimDate - a.claimDate);
  }, [claims, statusFilter, branchFilter, searchQuery, orderMap]);

  const stats = useMemo(() => {
    if (!claims.length) return null;
    let active = 0, resolved = 0, today = 0;
    const todayStr = new Date().toDateString();
    claims.forEach((c: any) => {
      const s = c.claimItems?.[0]?.claimItemStatus?.name;
      if (["Created", "WaitingInAction", "Unresolved"].includes(s)) active++;
      else resolved++;
      if (new Date(c.claimDate).toDateString() === todayStr) today++;
    });
    return { total: claims.length, active, resolved, today };
  }, [claims]);

  const hasActiveFilters = statusFilter !== "all" || branchFilter !== "all" || !!searchQuery;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-10">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-widest uppercase text-white">İade Yönetimi</h1>
              <p className="text-[14px] text-gray-400 mt-0.5">
                Toplam <span className="text-white font-semibold">{claims.length}</span> iade ·{" "}
                <span className="text-white font-semibold">{processedClaims.length}</span> filtreli
              </p>
            </div>
            {stats && (
              <div className="hidden lg:flex items-center gap-0 divide-x divide-gray-700 border-l border-gray-700 ml-2 pl-4">
                {[
                  { label: "Bugün", value: stats.today },
                  { label: "Aktif", value: stats.active },
                  { label: "Çözülen", value: stats.resolved },
                ].map((s) => (
                  <div key={s.label} className="px-4 text-center">
                    <p className="text-[18px] font-bold text-white leading-none">{s.value}</p>
                    <p className="text-[12px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-[14px] text-gray-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                Canlı · {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
            <button
              onClick={() => fetchClaims(true)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-200 text-gray-900 px-4 py-2 font-bold text-sm tracking-wide uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="px-6 mt-4">
        <div className="bg-white border border-gray-200 p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-52">
            <CustomSelect
              label="İade Durumu"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Tüm Durumlar", value: "all" },
                { label: "Oluşturuldu", value: "Created" },
                { label: "Bekleyen", value: "WaitingInAction" },
                { label: "Kabul Edildi", value: "Accepted" },
                { label: "Reddedildi", value: "Rejected" },
                { label: "İhtilaflı", value: "Unresolved" },
                { label: "İptal Edildi", value: "Cancelled" },
              ]}
            />
          </div>
          <div className="w-full md:w-48">
            <CustomSelect
              label="Şube"
              value={branchFilter}
              onChange={setBranchFilter}
              options={[
                { label: "Tüm Şubeler", value: "all" },
                ...BRANCHES.map(b => ({ label: b.name, value: b.id })),
              ]}
            />
          </div>
          <div className="flex-1 max-w-sm">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Müşteri / Sipariş No</label>
            <input
              type="text"
              placeholder="Sipariş no veya müşteri adı ara..."
              className="w-full h-[38px] border border-gray-300 bg-white px-3 text-[13px] focus:border-gray-500 focus:ring-1 focus:ring-gray-400 outline-none transition-all placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); setBranchFilter("all"); }}
              className="h-[38px] px-4 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 border border-gray-300 hover:border-gray-500 transition-colors whitespace-nowrap"
            >
              Filtreleri Temizle
            </button>
          )}
          <div className="ml-auto text-[12px] text-gray-500 font-semibold self-end pb-1 whitespace-nowrap">
            {processedClaims.length} kayıt
          </div>
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className="px-6 mt-4">
        {loading && !claims.length ? (
          <div className="bg-white border border-gray-200 h-64 flex flex-col items-center justify-center gap-4 text-gray-400">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-gray-700 animate-spin" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest animate-pulse">İadeler Yükleniyor...</p>
          </div>
        ) : processedClaims.length === 0 ? (
          <div className="bg-white border border-gray-200 h-64 flex items-center justify-center">
            <p className="text-[14px] font-semibold text-gray-400">Filtrelere uygun iade bulunamadı.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200">

            {/* Table Header */}
            <div className="bg-gray-900 text-white px-6 py-3 hidden lg:grid grid-cols-[160px_220px_1fr_170px_140px_36px] gap-4 items-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Durum</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Sipariş No</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Müşteri</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Şube</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Tarih</span>
              <span />
            </div>

            {processedClaims.map((claim: any, idx: number) => {
              const isExpanded = expandedClaim === claim.id;
              const mainStatus = claim.claimItems?.[0]?.claimItemStatus?.name || "Unknown";
              const dateObj = new Date(claim.claimDate);
              const orderDetail = orderMap[claim.orderNumber] || claim.orderDetails;
              const branchName = getBranchName(claim.storeId || orderDetail?.storeId);
              const isLoadingOrder = loadingOrders[claim.orderNumber];
              const isBranchLoading = !branchName && isLoadingOrder;
              const isActive = ["Created", "WaitingInAction", "Unresolved"].includes(mainStatus);

              return (
                <div
                  key={`${claim.id}-${idx}`}
                  className={`group border-b border-gray-100 transition-colors ${isExpanded ? "bg-blue-50/30" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
                >
                  {/* Row */}
                  <div
                    className="px-6 py-3.5 grid grid-cols-1 lg:grid-cols-[160px_220px_1fr_170px_140px_36px] gap-4 items-center cursor-pointer hover:bg-gray-100/60 transition-colors select-none"
                    onClick={() => toggleClaim(claim.id, claim.orderNumber, claim.orderDate)}
                  >
                    {/* Durum */}
                    <div>
                      <StatusBadge status={mainStatus} />
                      {isActive && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                          <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wide">Aksiyon Bekliyor</span>
                        </div>
                      )}
                    </div>

                    {/* Sipariş No */}
                    <div>
                      <div className="font-mono font-bold text-[15px] text-gray-900">#{claim.orderNumber}</div>
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">
                        {claim.claimItems?.length || 0} iade kalemi
                      </div>
                    </div>

                    {/* Müşteri */}
                    <div>
                      <div className="text-[14px] font-semibold text-gray-900">
                        {claim.customerFirstName} {claim.customerLastName}
                      </div>
                      {claim.claimItems?.[0]?.trendyolClaimItemReason?.name && (
                        <div className="text-[12px] text-gray-500 mt-0.5 truncate max-w-xs">
                          {claim.claimItems[0].trendyolClaimItemReason.name}
                        </div>
                      )}
                    </div>

                    {/* Şube */}
                    <div className="hidden lg:block">
                      {branchName ? (
                        <div className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 px-2.5 py-1">
                          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{branchName}</span>
                        </div>
                      ) : isBranchLoading ? (
                        <div className="w-20 h-5 bg-gray-200 animate-pulse" />
                      ) : (
                        <span className="text-[12px] text-gray-400">—</span>
                      )}
                    </div>

                    {/* Tarih */}
                    <div className="hidden lg:block">
                      <div className="text-[14px] font-bold text-gray-900">
                        {dateObj.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        {dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className="flex justify-end">
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-white px-6 py-5">
                      <div className="flex justify-between items-center mb-5">
                        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">İade Detayları</h3>
                        <Link
                          href={`/siparisler?orderId=${claim.orderNumber}`}
                          className="text-[11px] font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 transition-colors uppercase tracking-wide"
                        >
                          Siparişi Görüntüle →
                        </Link>
                      </div>

                      {orderDetail && ["Cancelled", "UnSupplied"].includes(orderDetail.packageStatus) && (
                        <div className="bg-red-50 border border-red-300 p-3 mb-4 text-xs flex items-center justify-between text-red-800">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="font-bold text-red-900 uppercase tracking-wide">⚠️ Sipariş İptal Edildi:</span>
                            <span>{orderDetail.cancelInfo?.reason || "İptal Sebebi Belirtilmemiş"}</span>
                          </div>
                          {orderDetail.cancelInfo?.agentName && (
                            <span className="text-[11px] text-red-600 font-semibold">
                              ({orderDetail.cancelInfo.agentName === "Customer" ? "Müşteri" : orderDetail.cancelInfo.agentName})
                            </span>
                          )}
                        </div>
                      )}
                      <div className="space-y-4">
                        {claim.claimItems?.map((item: any, i: number) => {
                          let productInfo = null;
                          if (orderDetail) {
                            const allProducts = (orderDetail.lines || []).map((l: any) => l.product).filter(Boolean);
                            for (const line of orderDetail.lines || []) {
                              for (const oItem of line.items || []) {
                                if (oItem.id === item.orderLineItemId?.toString() || oItem.packageItemId === item.orderLineItemId?.toString()) {
                                  productInfo = line.product;
                                  break;
                                }
                              }
                              if (productInfo) break;
                            }
                            if (!productInfo && allProducts.length > 0) {
                              productInfo = {
                                ...allProducts[0],
                                name: allProducts.length > 1 ? `${allProducts[0].name} (+ ${allProducts.length - 1} ürün)` : allProducts[0].name,
                              };
                            }
                          }
                          return (
                            <div key={`${item.id}-${i}`} className="border border-gray-200 grid grid-cols-1 md:grid-cols-[300px_1fr]">
                              {/* Sol: Ürün */}
                              <div className="p-4 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50">
                                {isLoadingOrder ? (
                                  <div className="animate-pulse flex items-start gap-3">
                                    <div className="w-16 h-16 bg-gray-200 shrink-0" />
                                    <div className="flex-1 space-y-2 pt-1">
                                      <div className="h-3 bg-gray-200 w-3/4" />
                                      <div className="h-3 bg-gray-200 w-1/2" />
                                    </div>
                                  </div>
                                ) : productInfo ? (
                                  <div className="flex items-start gap-3">
                                    {productInfo.imageUrls?.[0] ? (
                                      <div className="w-16 h-16 border border-gray-200 shrink-0 bg-white">
                                        <img src={productInfo.imageUrls[0]} alt={productInfo.name} className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-bold text-gray-900 text-[13px] leading-snug">{productInfo.name}</div>
                                      <div className="text-[11px] font-mono text-gray-400 mt-1">ID: {item.orderLineItemId}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[12px] text-gray-400 italic">Ürün bilgisi bekleniyor...</div>
                                )}
                              </div>

                              {/* Sağ: Neden & Not */}
                              <div className="p-4 flex flex-col justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                                    <StatusBadge status={item.claimItemStatus?.name} />
                                    <span className="font-bold text-[13px] text-gray-900">
                                      {item.trendyolClaimItemReason?.name || "Neden Belirtilmedi"}
                                    </span>
                                  </div>
                                  <div className="bg-gray-50 border border-gray-200 p-3">
                                    <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest block mb-1">Müşteri Notu</span>
                                    <p className="text-[13px] text-gray-700 italic">
                                      {item.customerNote ? `"${item.customerNote}"` : "Not yok"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                                  {item.imageUrls?.length > 0 ? (
                                    <div className="flex gap-2 flex-wrap">
                                      {item.imageUrls.map((img: string, imgIdx: number) => (
                                        <div
                                          key={imgIdx}
                                          className="w-14 h-14 border border-gray-300 cursor-zoom-in hover:border-gray-600 transition-colors overflow-hidden"
                                          onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                                        >
                                          <img src={img} className="w-full h-full object-cover" alt="" />
                                        </div>
                                      ))}
                                    </div>
                                  ) : <div />}
                                  {item.objections?.length > 0 && (
                                    <div className="bg-orange-50 border border-orange-200 px-3 py-2 max-w-sm w-full md:w-auto">
                                      <span className="font-bold text-[10px] text-orange-600 uppercase tracking-widest block mb-1">Satıcı İtirazı</span>
                                      <div className="text-[12px] text-orange-900 font-medium">{item.objections[0]?.sellerDescription}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-gray-900/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt="İade Görseli"
              className="max-w-full max-h-[90vh] object-contain shadow-2xl border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-2 right-2 bg-gray-800 text-white w-8 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

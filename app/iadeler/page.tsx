"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import axios from "axios";

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  'Created':          { label: 'Oluşturuldu', dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50/50', border: 'border-yellow-200' },
  'WaitingInAction':  { label: 'Bekliyor',    dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50/50',   border: 'border-blue-200' },
  'Accepted':         { label: 'Kabul Edildi',dot: 'bg-green-600',  text: 'text-green-700',  bg: 'bg-green-50/50',  border: 'border-green-200' },
  'Rejected':         { label: 'Reddedildi',  dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50/50',    border: 'border-red-200' },
  'Unresolved':       { label: 'İhtilaflı',   dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50/50', border: 'border-orange-200' },
  'Cancelled':        { label: 'İptal Edildi',dot: 'bg-gray-500',   text: 'text-gray-700',   bg: 'bg-gray-50/50',   border: 'border-gray-200' }
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] || { label: status, dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${config.border} ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${config.text}`}>{config.label}</span>
    </div>
  );
}

// Custom Select Component
function CustomSelect({ label, value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o: any) => o.value === value);
  const isActive = value !== "all";
  return (
    <div className="relative min-w-[200px]">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div
        className={`w-full border bg-white px-3 py-2 text-sm flex justify-between items-center cursor-pointer h-[38px] gap-2 transition-colors ${isOpen
          ? "border-gray-500 ring-1 ring-gray-400"
          : isActive
            ? "border-gray-500 bg-gray-50"
            : "border-gray-300 hover:border-gray-400"
          }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`font-medium truncate text-[15px] ${isActive ? "text-gray-900 font-semibold" : "text-gray-700"}`}>
          {selected?.label || "Seçiniz"}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className={`px-3 py-2 text-[15px] cursor-pointer transition-colors ${value === option.value ? "bg-gray-900 text-white font-semibold" : "text-gray-700 hover:bg-gray-100"}`}
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
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [orderMap, setOrderMap] = useState<Record<string, any>>({});
  const [loadingOrders, setLoadingOrders] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchClaims = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await axios.get(`/api/iadeler?t=${Date.now()}`);
      if (response.data && response.data.content) {
        setClaims(response.data.content);
        setLastUpdated(new Date());
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

  const toggleClaim = async (claimId: string, orderNumber: string) => {
    const isExpanding = expandedClaim !== claimId;
    setExpandedClaim(isExpanding ? claimId : null);

    if (isExpanding && orderNumber && !orderMap[orderNumber] && !loadingOrders[orderNumber]) {
      setLoadingOrders(prev => ({ ...prev, [orderNumber]: true }));
      try {
        const response = await axios.get(`/api/siparisler?orderNumber=${orderNumber}&size=1`);
        if (response.data?.content?.length > 0) {
          setOrderMap(prev => ({ ...prev, [orderNumber]: response.data.content[0] }));
        }
      } catch (error) {
        console.error("İade için sipariş detayı çekilemedi:", error);
      } finally {
        setLoadingOrders(prev => ({ ...prev, [orderNumber]: false }));
      }
    }
  };

  const processedClaims = useMemo(() => {
    return claims.filter((c: any) => {
      const mainStatus = c.claimItems?.[0]?.claimItemStatus?.name || 'Unknown';
      if (statusFilter !== "all" && mainStatus !== statusFilter) return false;
      
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const num = (c.orderNumber || "").toLowerCase();
        const name = `${c.customerFirstName || ""} ${c.customerLastName || ""}`.toLowerCase();
        if (!num.includes(q) && !name.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.claimDate - a.claimDate);
  }, [claims, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!claims.length) return null;
    let active = 0, resolved = 0, today = 0;
    const todayStr = new Date().toDateString();
    
    claims.forEach((c: any) => {
      const s = c.claimItems?.[0]?.claimItemStatus?.name;
      if (['Created', 'WaitingInAction', 'Unresolved'].includes(s)) active++;
      else resolved++;
      
      if (new Date(c.claimDate).toDateString() === todayStr) today++;
    });
    
    return { total: claims.length, active, resolved, today };
  }, [claims]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-10">
      
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
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
                  { label: "Aktif / Bekleyen", value: stats.active },
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
                Senkronize
              </div>
            )}
            <button
              onClick={() => fetchClaims(true)}
              className="text-[12px] font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 transition-colors border border-gray-700 cursor-pointer"
            >
              Yenile
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-6">
        
        {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 p-4 mb-4 flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-64">
            <CustomSelect 
              label="İade Durumu" 
              value={statusFilter} 
              onChange={setStatusFilter} 
              options={[
                {label: "Tümü", value: "all"},
                {label: "Oluşturuldu", value: "Created"},
                {label: "Bekleyen", value: "WaitingInAction"},
                {label: "Kabul Edildi", value: "Accepted"},
                {label: "Reddedildi", value: "Rejected"},
                {label: "İhtilaflı", value: "Unresolved"},
                {label: "İptal Edildi", value: "Cancelled"}
              ]}
            />
          </div>
          
          <div className="flex-1 max-w-md">
             <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Müşteri / Sipariş No</label>
              {(searchQuery || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                  className="text-[10px] text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wider transition-colors"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Sipariş no veya müşteri adı ara..."
              className="w-full h-[38px] border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-gray-500 focus:ring-1 focus:ring-gray-400 outline-none transition-all placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── List ────────────────────────────────────────────────────────────── */}
        {loading && !claims.length ? (
          <div className="bg-white border border-gray-200 h-64 flex flex-col items-center justify-center text-gray-500">
             <div className="relative w-8 h-8 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-2 border-t-gray-600 animate-spin" />
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest animate-pulse">İadeler Yükleniyor...</p>
          </div>
        ) : processedClaims.length === 0 ? (
           <div className="bg-white border border-gray-200 h-64 flex items-center justify-center text-gray-500">
            <p className="text-[14px] font-medium">Filtrelere uygun iade bulunamadı.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 border-b-0">
            
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[160px_1fr_200px_180px_36px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 select-none">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Durum</div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sipariş No & Müşteri</div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">İade Kalemi</div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tarih</div>
              <div />
            </div>

            {processedClaims.map((claim: any, idx: number) => {
              const isExpanded = expandedClaim === claim.id;
              const mainStatus = claim.claimItems?.[0]?.claimItemStatus?.name || 'Unknown';
              const dateObj = new Date(claim.claimDate);

              return (
                <div 
                  key={`${claim.id}-${idx}`}
                  className={`group transition-colors border-b border-gray-200 ${isExpanded ? "bg-gray-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                >
                  {/* Row Summary */}
                  <div 
                    className="px-6 py-3.5 grid grid-cols-1 lg:grid-cols-[160px_1fr_200px_180px_36px] gap-4 items-center cursor-pointer hover:bg-gray-100/60 transition-colors select-none"
                    onClick={() => toggleClaim(claim.id, claim.orderNumber)}
                  >
                    <div>
                       <StatusBadge status={mainStatus} />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-[15px] text-gray-900">#{claim.orderNumber}</div>
                      <div className="text-[13px] text-gray-500 font-medium mt-0.5">
                        {claim.customerFirstName} {claim.customerLastName}
                      </div>
                    </div>
                    <div className="hidden lg:block text-right text-[13px] font-bold text-gray-700">
                       {claim.claimItems?.length || 0} Ürün
                    </div>
                    <div className="hidden lg:block">
                      <div className="text-[14px] font-bold text-gray-900">
                        {dateObj.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        {dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 px-6 py-5 bg-white">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">İade Detayları</h3>
                         <Link href={`/siparisler?orderId=${claim.orderNumber}`} className="text-[11px] font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 transition-colors uppercase tracking-wide">
                           Siparişi Görüntüle
                         </Link>
                      </div>

                      <div className="space-y-4">
                        {claim.claimItems?.map((item: any, i: number) => {
                          const orderDetail = orderMap[claim.orderNumber];
                          let productInfo = null;
                          let allProducts: any[] = [];
                          
                          if (orderDetail) {
                            allProducts = (orderDetail.lines || []).map((l: any) => l.product).filter(Boolean);
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
                                name: allProducts.length > 1 ? `${allProducts[0].name} (+ ${allProducts.length - 1} ürün)` : allProducts[0].name
                              };
                            }
                          }

                          return (
                            <div key={`${item.id}-${i}`} className="border border-gray-200 grid grid-cols-1 md:grid-cols-[280px_1fr] bg-gray-50/30">
                              
                              {/* Sol: Ürün Bilgisi */}
                              <div className="p-4 border-b md:border-b-0 md:border-r border-gray-200">
                                {loadingOrders[claim.orderNumber] ? (
                                  <div className="animate-pulse flex items-start gap-3">
                                    <div className="w-14 h-14 bg-gray-200" />
                                    <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 w-3/4" /><div className="h-3 bg-gray-200 w-1/2" /></div>
                                  </div>
                                ) : productInfo ? (
                                  <div className="flex items-start gap-3">
                                    {productInfo.imageUrls?.[0] ? (
                                      <div className="w-14 h-14 border border-gray-200 shrink-0 bg-white">
                                        <img src={productInfo.imageUrls[0]} alt={productInfo.name} className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-14 h-14 bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-bold text-gray-900 text-[13px] leading-tight">{productInfo.name}</div>
                                      <div className="text-[11px] font-mono text-gray-500 mt-1 uppercase tracking-wide">ID: {item.orderLineItemId}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[12px] font-bold text-gray-500 italic">Ürün bilgisi bekleniyor...</div>
                                )}
                              </div>

                              {/* Sağ: İade Notu ve Durumu */}
                              <div className="p-4 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center gap-3 mb-3">
                                    <StatusBadge status={item.claimItemStatus?.name} />
                                    <span className="font-bold text-[14px] text-gray-900">{item.trendyolClaimItemReason?.name || 'Neden Belirtilmedi'}</span>
                                  </div>
                                  <div className="bg-white border border-gray-200 p-3 text-[13px] text-gray-700">
                                    <span className="font-bold text-[11px] text-gray-400 uppercase tracking-widest block mb-1">Müşteri Notu</span>
                                    {item.customerNote ? `"${item.customerNote}"` : 'Not yok'}
                                  </div>
                                </div>
                                
                                {/* Resimler ve İtirazlar */}
                                <div className="mt-4 flex flex-col md:flex-row gap-4 items-end justify-between">
                                  {item.imageUrls?.length > 0 ? (
                                    <div className="flex gap-2">
                                      {item.imageUrls.map((img: string, idx: number) => (
                                        <div 
                                          key={idx} 
                                          className="w-12 h-12 border border-gray-300 cursor-zoom-in hover:border-gray-500 transition-colors"
                                          onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                                        >
                                          <img src={img} className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  ) : <div/>}
                                  
                                  {item.objections?.length > 0 && (
                                    <div className="bg-orange-50 border border-orange-200 px-3 py-2 max-w-sm w-full md:w-auto">
                                      <span className="font-bold text-[10px] text-orange-600 uppercase tracking-widest block mb-1">Satıcı İtirazı</span>
                                      <div className="text-[12px] text-orange-900 font-medium">
                                        {item.objections[0]?.sellerDescription}
                                      </div>
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

      {/* Lightbox Modal */}
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
          </div>
        </div>
      )}
    </div>
  );
}

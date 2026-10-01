"use client";
// React.memo + useTransition → accordion opens without freezing the list

import { useState, useEffect, useMemo, useRef, Suspense, useTransition, memo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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

const getBranchName = (storeId: number | string) => {
  const branch = BRANCHES.find((b) => b.id === storeId?.toString());
  return branch ? branch.name : `Şube ${storeId}`;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });


// ─── Status config (text-only, monochromatic dots) ─────────────────────────
const STATUS_MAP: Record<string, { label: string; dot: string; text: string }> = {
  Created: { label: "Yeni Sipariş", dot: "bg-blue-500", text: "text-blue-700" },
  Picking: { label: "Toplanıyor", dot: "bg-amber-500", text: "text-amber-700" },
  Invoiced: { label: "Faturalandı", dot: "bg-purple-500", text: "text-purple-700" },
  Shipped: { label: "Yolda", dot: "bg-orange-500", text: "text-orange-700" },
  Delivered: { label: "Teslim Edildi", dot: "bg-green-600", text: "text-green-700" },
  Cancelled: { label: "İptal Edildi", dot: "bg-red-500", text: "text-red-700" },
  UnSupplied: { label: "Tedarik Edilemedi", dot: "bg-red-700", text: "text-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, dot: "bg-gray-400", text: "text-gray-600" };
  return (
    <div className={`flex items-center gap-1.5 ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span className="text-[14px] font-bold uppercase tracking-wide whitespace-nowrap">{cfg.label}</span>
    </div>
  );
}

// ─── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const isActive = value !== "all" && value !== "";

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[13px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
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
          {selectedOption?.label || "Seçiniz"}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-0.5 w-full bg-white border border-gray-300 shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <li
                key={option.value}
                className={`px-3 py-2 text-[15px] cursor-pointer transition-colors ${value === option.value ? "bg-gray-900 text-white font-semibold" : "text-gray-700 hover:bg-gray-100"
                  }`}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Timeline step ─────────────────────────────────────────────────────────────
function TimelineStep({ label, time, done }: { label: string; time: string; done: boolean }) {
  return (
    <div className="relative pl-5">
      <div className={`absolute w-2.5 h-2.5 rounded-full -left-[5px] top-1 ring-2 ring-white ${done ? "bg-gray-800" : "bg-gray-200"}`} />
      <div className={`text-[14px] font-bold ${done ? "text-gray-900" : "text-gray-400"}`}>{label}</div>
      <div className={`text-[13px] mt-0.5 ${done ? "text-gray-500" : "text-gray-300"}`}>{done ? time : "—"}</div>
    </div>
  );
}

// ─── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-sm">↕</span>;
  return <span className="ml-1 text-gray-600 text-sm">{dir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Main Content ──────────────────────────────────────────────────────────────

const OrderRow = memo(({ order, idx, isExpanded, toggleOrder, handleCopy, setSelectedImage }: any) => {
  const totalItems = order.lines?.reduce((acc: number, line: any) => acc + (line.items?.length || 1), 0) || 0;
  const isToday = new Date(order.orderDate).toDateString() === new Date().toDateString();
  const isCancelled = ["Cancelled", "UnSupplied"].includes(order.packageStatus);

  // 1. Kabul süresi
  const acceptanceSec = order.sellerAcceptedDate && order.orderDate
    ? Math.round((order.sellerAcceptedDate - order.orderDate) / 1000)
    : null;
  const acceptanceLate = acceptanceSec !== null && acceptanceSec > 120; // >2 dk uyarı

  // 2. Alternatif / iptal kalem sayısı
  const altCount = order.lines?.reduce((acc: number, l: any) =>
    acc + (l.items?.filter((it: any) => it.isAlternative).length || 0), 0) ?? 0;
  const cancelledItemCount = order.lines?.reduce((acc: number, l: any) =>
    acc + (l.items?.filter((it: any) => it.isCancelled).length || 0), 0) ?? 0;

  // 3. Satıcı promo maliyeti
  const sellerPromoCost = order.lines?.reduce((acc: number, l: any) =>
    acc + (l.items?.reduce((s: number, it: any) =>
      s + (it.promotions?.filter((p: any) =>
        (p.sellerPaid || p.sellerCoverageRatio > 0) && (p.type === "Seller" || p.type === "SELLER")
      ).reduce((ps: number, p: any) => ps + (p.amount?.seller || 0), 0) || 0)
      , 0) || 0)
    , 0) ?? 0;

  // 4. Gramaj sapması
  const weightMismatchLines = order.lines?.filter((l: any) =>
    l.product?.saleUnitValue &&
    l.product?.weight?.defaultSaleUnitValue &&
    l.product.saleUnitValue !== l.product.weight.defaultSaleUnitValue
  ) ?? [];

  const tStart = order.orderDate || Date.now();
  const tEnd = order.packageStatus === "Delivered" && order.lastModifiedDate ? order.lastModifiedDate : Date.now();
  const steps = [
    { label: "Sipariş Geldi", done: true, time: formatTime(tStart) },
    { label: "Kabul Edildi", done: !!(order.sellerAcceptedDate || order.packageStatus !== "Created"), time: order.sellerAcceptedDate ? formatTime(order.sellerAcceptedDate) : formatTime(tStart + 45000) },
    { label: "Hazırlandı", done: ["Picking", "Invoiced", "Shipped", "Delivered"].includes(order.packageStatus), time: formatTime(tStart + 180000) },
    { label: "Faturalandı", done: ["Invoiced", "Shipped", "Delivered"].includes(order.packageStatus), time: formatTime(tStart + 420000) },
    { label: "Yolda", done: ["Shipped", "Delivered"].includes(order.packageStatus), time: formatTime(tStart + 900000) },
    { label: "Teslim Edildi", done: order.packageStatus === "Delivered", time: order.lastModifiedDate ? formatTime(tEnd) : "—" },
  ];

  return (
    <div
      className={`group transition-colors ${isCancelled
        ? "bg-red-50/40"
        : isToday
          ? "bg-blue-50/30"
          : idx % 2 === 0
            ? "bg-white"
            : "bg-gray-50/50"
        }`}
    >
      {/* Row summary */}
      <div
        className="px-6 py-3.5 grid grid-cols-1 lg:grid-cols-[180px_140px_1fr_160px_160px_36px] gap-4 items-center cursor-pointer hover:bg-gray-100/60 transition-colors select-none"
        onClick={() => toggleOrder(order.id)}
      >
        {/* Order number */}
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isToday && <span className="text-[11px] font-bold text-white bg-gray-800 px-1.5 py-0.5 uppercase tracking-widest">BUGÜN</span>}
            {isCancelled && <span className="text-[11px] font-bold text-white bg-red-600 px-1.5 py-0.5 uppercase tracking-widest">İPTAL</span>}
            {altCount > 0 && <span className="text-[11px] font-bold text-amber-700 border border-amber-400 px-1.5 py-0.5 uppercase">{altCount} ALT</span>}
            {cancelledItemCount > 0 && !isCancelled && <span className="text-[11px] font-bold text-red-600 border border-red-300 px-1.5 py-0.5 uppercase">{cancelledItemCount} K.İPT</span>}
            {weightMismatchLines.length > 0 && <span className="text-[11px] font-bold text-gray-500 border border-gray-300 px-1.5 py-0.5 uppercase" title="Gramaj sapması var">GR⚠</span>}
          </div>
          <div className="font-mono font-bold text-[15px] text-gray-900 mt-0.5">#{order.orderNumber}</div>
          {/* Kabul süresi */}
          {acceptanceSec !== null && (
            <div className={`text-[11px] font-bold mt-0.5 ${acceptanceLate ? "text-red-600" : "text-gray-400"}`}>
              Kabul: {acceptanceSec < 60 ? `${acceptanceSec}sn` : `${Math.floor(acceptanceSec / 60)}dk ${acceptanceSec % 60}sn`}
              {acceptanceLate && " ⚠"}
            </div>
          )}
          {order.isCourierNearby && !["Shipped", "Delivered"].includes(order.packageStatus) && (
            <span className="text-[11px] font-bold text-orange-600 animate-pulse flex items-center gap-1 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
              </span>
              Kurye Yaklaştı!
            </span>
          )}
        </div>

        {/* Status */}
        <StatusBadge status={order.packageStatus} />

        {/* Customer / summary */}
        <div>
          <div className="text-[15px] font-semibold text-gray-900">
            {order.customer?.firstName} {order.customer?.lastName}
          </div>
          <div className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{totalItems} ürün</span>
            <span className="text-gray-300">·</span>
            <span className="font-bold text-gray-700">{order.totalPrice?.toFixed(2)} ₺</span>
            {order.grossAmount && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-bold text-green-700">Kazanç: {order.grossAmount?.toFixed(2)} ₺</span>
              </>
            )}
            {order.customer?.note && (
              <>
                <span className="text-gray-300">·</span>
                <span className="italic text-gray-500 truncate max-w-[200px]">"{order.customer.note}"</span>
              </>
            )}
          </div>
        </div>

        {/* Branch */}
        <div className="text-[15px] font-semibold text-gray-800 hidden lg:block">
          {getBranchName(order.storeId)}
        </div>

        {/* Date */}
        <div className="hidden lg:block">
          <div className="text-[15px] font-bold text-gray-900">
            {order.orderDate ? new Date(order.orderDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) : "—"}
          </div>
          <div className="text-[13px] text-gray-500">
            {order.orderDate ? new Date(order.orderDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        </div>

        {/* Chevron */}
        <div className="flex justify-end">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-white px-6 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6">

            {/* Left: Timeline + courier */}
            <div className="border-r-0 xl:border-r border-gray-100 pr-0 xl:pr-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Zaman Çizelgesi</h3>
                <button
                  onClick={(e) => handleCopy(order.orderNumber, e)}
                  className="text-[11px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2 py-0.5 transition-colors"
                >
                  No Kopyala
                </button>
              </div>

              {/* Customer note */}
              {order.customer?.note && (
                <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Müşteri Notu</div>
                  <div className="text-[12px] text-gray-700 italic">"{order.customer.note}"</div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative border-l-2 border-gray-200 ml-2 space-y-4 pb-2">
                {steps.map((step) => (
                  <TimelineStep key={step.label} label={step.label} time={step.time} done={step.done} />
                ))}
              </div>

              {/* Courier */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Kurye Durumu</h4>
                {["Shipped", "Delivered"].includes(order.packageStatus) ? (
                  <p className="text-[12px] font-semibold text-gray-700">✓ Kurye paketi teslim aldı.</p>
                ) : order.isCourierNearby ? (
                  <p className="text-[12px] font-bold text-orange-600 animate-pulse">⚡ Kurye Şubeye Yaklaştı — Hazırlayın!</p>
                ) : (
                  <p className="text-[12px] text-gray-400 italic">Kurye bekleniyor…</p>
                )}
                {order.courier?.name && (
                  <div className="mt-2">
                    <div className="text-[12px] font-bold text-gray-800">{order.courier.name}</div>
                    {order.courier.phone && <div className="text-[11px] text-gray-500">{order.courier.phone}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Products + price */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Sipariş Kalemleri</h3>

              {/* Products table */}
              <div className="overflow-x-auto border border-gray-100">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      {["Adet", "Görsel", "Ürün Adı", "Barkod", "Birim", "Toplam"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-gray-300 border-r border-gray-700 last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines?.map((line: any, idx: number) => {
                      const quantity = line.items?.length || 1;
                      const unitPrice = line.price || 0;
                      const totalPrice = unitPrice * quantity;
                      const imageUrl = line.product?.imageUrls?.[0];
                      const isSellerPromo = line.items?.[0]?.promotions?.some(
                        (p: any) => (p.sellerPaid || p.sellerCoverageRatio > 0) && (p.type === "Seller" || p.type === "SELLER")
                      );
                      const hasCoupon = line.items?.[0]?.coupons?.length > 0;

                      const lineAltCount = line.items?.filter((it: any) => it.isAlternative).length || 0;
                      const lineCancelledCount = line.items?.filter((it: any) => it.isCancelled).length || 0;

                      return (
                        <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-gray-100 transition-colors`}>
                          <td className="px-3 py-2.5 font-bold text-[13px] text-gray-900 border-r border-gray-100">
                            {quantity}×
                          </td>
                          <td className="px-3 py-2.5 border-r border-gray-100">
                            {imageUrl ? (
                              <div
                                className="w-9 h-9 border border-gray-200 overflow-hidden cursor-zoom-in"
                                onClick={() => setSelectedImage(imageUrl)}
                              >
                                <img src={imageUrl} alt={line.product?.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 bg-gray-100 border border-gray-200 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 border-r border-gray-100">
                            <div className="text-[13px] text-gray-800 font-medium">
                              {line.product?.name || "Bilinmeyen Ürün"}
                              {line.product?.saleUnitValue && (
                                <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 font-semibold">
                                  {line.product.saleUnitValue} {line.product.saleUnitType}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {lineAltCount > 0 && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 uppercase tracking-wide">
                                  {lineAltCount} Alternatif
                                </span>
                              )}
                              {lineCancelledCount > 0 && (
                                <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 uppercase tracking-wide">
                                  {lineCancelledCount} İptal
                                </span>
                              )}
                              {isSellerPromo && (
                                <span className="text-[9px] font-bold border border-gray-300 px-1.5 py-0.5 text-gray-600 uppercase tracking-wide">Satıcı Promo</span>
                              )}
                              {hasCoupon && (
                                <span className="text-[9px] font-bold border border-gray-300 px-1.5 py-0.5 text-gray-600 uppercase tracking-wide">Kupon</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r border-gray-100">
                            <div className="flex items-center gap-1.5 group/barkod">
                              <span className="font-mono text-[11px] text-gray-500">{line.barcode || "—"}</span>
                              {line.barcode && (
                                <button
                                  onClick={(e) => handleCopy(line.barcode, e)}
                                  className="opacity-0 group-hover/barkod:opacity-100 text-gray-300 hover:text-gray-600 transition-all"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-600 text-right border-r border-gray-100 whitespace-nowrap">
                            {unitPrice.toFixed(2)} ₺
                          </td>
                          <td className="px-3 py-2.5 text-[13px] font-bold text-gray-900 text-right whitespace-nowrap">
                            {totalPrice.toFixed(2)} ₺
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Price breakdown + audit */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-[14px] text-gray-600">
                    <span>Müşteri Ödedi:</span>
                    <span>{order.totalPrice?.toFixed(2) || "0.00"} ₺</span>
                  </div>
                  <div className="flex justify-between text-[14px] text-gray-500">
                    <span>Trendyol İndirimi:</span>
                    <span>+ {order.totalDiscount?.toFixed(2) || "0.00"} ₺</span>
                  </div>
                  {order.totalCargo > 0 && (
                    <div className="flex justify-between text-[14px] text-gray-500">
                      <span>Teslimat:</span>
                      <span>{order.totalCargo?.toFixed(2)} ₺</span>
                    </div>
                  )}
                  {sellerPromoCost > 0 && (
                    <div className="flex justify-between text-[14px] text-red-600 border-t border-gray-200 pt-1.5">
                      <span className="font-semibold">Satıcı Promo Maliyeti:</span>
                      <span className="font-bold">– {sellerPromoCost.toFixed(2)} ₺</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                    <span className="text-[14px] font-bold text-gray-800 uppercase tracking-wide">Marketin Kazancı</span>
                    <span className="text-[18px] font-black text-green-700">{order.grossAmount?.toFixed(2) || "0.00"} ₺</span>
                  </div>
                </div>
              </div>

              {/* Gramaj sapması uyarısı */}
              {weightMismatchLines.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 px-4 py-3">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">⚠ Gramaj Sapması</div>
                  {weightMismatchLines.map((l: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[13px] py-0.5">
                      <span className="text-gray-700 font-medium">{l.product?.name}</span>
                      <span className="text-gray-500">
                        Katalog: <b>{l.product.weight.defaultSaleUnitValue} {l.product.weight.typeName}</b>
                        {" → "}
                        Satılan: <b className="text-red-600">{l.product.saleUnitValue} {l.product.saleUnitType}</b>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function SiparislerContent() {

  const searchParams = useSearchParams();
  const orderIdFromUrl = searchParams.get("orderId");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const toggleOrder = useCallback((id: string) => {
    startTransition(() => {
      setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
    });
  }, []);

  const handleCopy = useCallback((text: string, e?: any) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setToastMessage(`Kopyalandı: ${text}`);
    setTimeout(() => setToastMessage(""), 3000);
  }, []);

  const fetchOrders = (isBackground = false, pageToFetch = currentPage, orderNoToSearch?: string) => {
    if (!isBackground) setLoading(true);
    const ts = Date.now();
    let url = `/api/siparisler?t=${ts}&page=${pageToFetch}&size=100`;
    
    // API araması için orderNoToSearch veya urlden gelen id
    const searchNo = orderNoToSearch !== undefined ? orderNoToSearch : (orderIdFromUrl || "");
    if (searchNo && !isNaN(Number(searchNo)) && searchNo.trim().length > 5) {
      url += `&orderNumber=${searchNo}`;
    }

    axios.get(url)
      .then((res) => {
        setData(res.data);
        setCurrentPage(res.data.page || 0);
        setTotalPages(res.data.totalPages || 1);
        setLastUpdated(new Date());
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tgo:ordersFetched", { detail: res.data }));
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!isBackground) setLoading(false); });
  };

  useEffect(() => {
    fetchOrders(false, currentPage);
    const interval = setInterval(() => fetchOrders(true, currentPage), 5000);
    
    if (orderIdFromUrl && currentPage === 0) {
      setExpandedOrders((prev) => ({ ...prev, [orderIdFromUrl]: true }));
      setSearchQuery(orderIdFromUrl);
    }
    return () => clearInterval(interval);
  }, [orderIdFromUrl, currentPage]);

  const processedOrders = useMemo(() => {
    if (!data?.content) return [];
    return data.content.filter((order: any) => {
      if (branchFilter !== "all" && order.storeId?.toString() !== branchFilter) return false;
      if (statusFilter !== "all" && order.packageStatus !== statusFilter) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const num = (order.orderNumber || "").toLowerCase();
        const name = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.toLowerCase();
        if (!num.includes(q) && !name.includes(q)) return false;
      }
      return true;
    }).sort((a: any, b: any) => sortDir === "desc" ? b.orderDate - a.orderDate : a.orderDate - b.orderDate);
  }, [data, branchFilter, statusFilter, searchQuery, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const allOrders = data?.content || [];
    if (!allOrders.length) return null;
    const total = allOrders.length;
    const delivered = allOrders.filter((o: any) => o.packageStatus === "Delivered").length;
    const active = allOrders.filter((o: any) => ["Created", "Picking", "Invoiced", "Shipped"].includes(o.packageStatus)).length;
    const cancelled = allOrders.filter((o: any) => ["Cancelled", "UnSupplied"].includes(o.packageStatus)).length;
    const revenue = allOrders.reduce((s: number, o: any) => s + (o.grossAmount || 0), 0);
    const todayCount = allOrders.filter((o: any) => new Date(o.orderDate).toDateString() === new Date().toDateString()).length;
    return { total, delivered, active, cancelled, revenue, todayCount };
  }, [data]);

  const hasActiveFilters = branchFilter !== "all" || statusFilter !== "all" || !!searchQuery;



  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-widest uppercase text-white">Sipariş Yönetimi</h1>
              {data && (
                <p className="text-[14px] text-gray-400 mt-0.5">
                  Toplam <span className="text-white font-semibold">{data.content?.length ?? 0}</span> sipariş ·{" "}
                  <span className="text-white font-semibold">{processedOrders.length}</span> filtreli
                </p>
              )}
            </div>
            {/* Inline stats */}
            {stats && (
              <div className="hidden lg:flex items-center gap-0 divide-x divide-gray-700 border-l border-gray-700 ml-2 pl-4">
                {[
                  { label: "Bugün", value: stats.todayCount },
                  { label: "Aktif", value: stats.active },
                  { label: "Teslim", value: stats.delivered },
                  { label: "İptal", value: stats.cancelled },
                  { label: "Kazanç", value: `${stats.revenue.toLocaleString("tr-TR")} ₺` },
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
              onClick={() => fetchOrders(false)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-200 text-gray-900 px-4 py-2 font-bold text-sm tracking-wide uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "Yenileniyor" : "Yenile"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3">
          <div className="w-full sm:w-40">
            <CustomSelect label="Şube" value={branchFilter} onChange={setBranchFilter}
              options={[{ label: "Tüm Şubeler", value: "all" }, ...BRANCHES.map((b) => ({ label: b.name, value: b.id }))]}
            />
          </div>
          <div className="w-full sm:w-44">
            <CustomSelect label="Sipariş Durumu" value={statusFilter} onChange={setStatusFilter}
              options={[
                { label: "Tüm Durumlar", value: "all" },
                { label: "Yeni Sipariş", value: "Created" },
                { label: "Toplanıyor", value: "Picking" },
                { label: "Faturalandı", value: "Invoiced" },
                { label: "Yolda", value: "Shipped" },
                { label: "Teslim Edildi", value: "Delivered" },
                { label: "İptal Edildi", value: "Cancelled" },
                { label: "Tedarik Edilemedi", value: "UnSupplied" },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[200px] max-w-sm">
            <label className="block text-[13px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Sipariş No / Müşteri</label>
            <div className="flex">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Örn: 2048400330 veya Ali…"
                  className="w-full h-[38px] border border-gray-300 bg-white pl-3 pr-8 text-[15px] text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-400 outline-none transition-colors border-r-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       setCurrentPage(0);
                       fetchOrders(false, 0, searchQuery);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    onClick={() => setSearchQuery("")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button 
                onClick={() => {
                   setCurrentPage(0);
                   fetchOrders(false, 0, searchQuery);
                }}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 h-[38px] font-bold text-[13px] uppercase tracking-wide transition-colors"
              >
                Bul
              </button>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { 
                setBranchFilter("all"); 
                setStatusFilter("all"); 
                setSearchQuery(""); 
                setCurrentPage(0);
                fetchOrders(false, 0, "");
                if (typeof window !== "undefined") window.history.replaceState({}, "", "/siparisler"); 
              }}
              className="text-[13px] font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wide border border-gray-300 px-3 h-[38px] hover:border-gray-500 transition-colors mt-[20px]"
            >
              Temizle ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Order List ───────────────────────────────────────────────────────── */}
      <div className="px-0 pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-gray-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest animate-pulse">
              Trendyol'dan Çekiliyor
            </p>
          </div>
        ) : processedOrders.length === 0 ? (
          <div className="bg-white py-16 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-[15px] font-semibold text-gray-400">Filtre kriterlerine uygun sipariş bulunamadı.</p>
          </div>
        ) : (
          <div className="bg-white divide-y divide-gray-100">
            {/* Table header */}
            <div className="bg-gray-900 text-white px-6 py-3 hidden lg:grid grid-cols-[180px_140px_1fr_160px_160px_36px] gap-4 items-center">
              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-300">Sipariş No</span>
              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-300">Durum</span>
              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-300">Müşteri / Özet</span>
              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-300">Şube</span>
              <button
                className="text-[13px] font-bold uppercase tracking-widest text-gray-300 text-left flex items-center group"
                onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
              >
                Tarih <SortIcon active dir={sortDir} />
              </button>
              <span />
            </div>

            {processedOrders.map((order: any, idx: number) => (
              <OrderRow
                key={order.id}
                order={order}
                idx={idx}
                isExpanded={expandedOrders[order.id]}
                toggleOrder={toggleOrder}
                handleCopy={handleCopy}
                setSelectedImage={setSelectedImage}
              />
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="text-[13px] text-gray-500 font-semibold">
                  Sayfa {currentPage + 1} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 0}
                    onClick={() => {
                      const newPage = currentPage - 1;
                      setCurrentPage(newPage);
                      fetchOrders(false, newPage, searchQuery);
                    }}
                    className="px-4 py-2 border border-gray-300 text-[13px] font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Önceki
                  </button>
                  <button
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => {
                      const newPage = currentPage + 1;
                      setCurrentPage(newPage);
                      fetchOrders(false, newPage, searchQuery);
                    }}
                    className="px-4 py-2 border border-gray-300 text-[13px] font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-3 py-2 flex items-center gap-2 shadow-xl z-50 text-sm font-semibold">
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedImage}
            alt="Ürün Görseli"
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function SiparislerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-t-gray-600 animate-spin" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Yükleniyor</span>
        </div>
      </div>
    }>
      <SiparislerContent />
    </Suspense>
  );
}

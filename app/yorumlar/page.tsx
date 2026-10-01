"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import Link from "next/link";

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
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
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
                className={`px-3 py-2 text-[15px] cursor-pointer transition-colors flex items-center gap-2 ${value === option.value
                  ? "bg-gray-900 text-white font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
                  }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
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
  const branch = BRANCHES.find((b) => b.id === storeId.toString());
  return branch ? branch.name : `Şube ${storeId}`;
};

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface RestaurantAnswer {
  text: string;
  status: string;
  rejectedReason?: { reason: string; reasonId: number } | null;
}

interface Review {
  reviewId: string;
  storeId: number;
  createdDate: number;
  orderCreatedDate: number;
  orderParentId: number;
  rating: { qualityScore: number; deliveryScore: number; averageScore: number };
  comment: { text: string; sellerAnswer?: string | null; restaurantAnswer?: RestaurantAnswer | null } | null;
}

interface ApiResponse {
  content: Review[];
  totalElements: number;
}

type SortKey = "createdDate" | "rating" | "comment" | "storeId";

// ─── Score color (text only, monochrome) ──────────────────────────────────────
const getScoreStyle = (score: number): string => {
  if (score >= 4.5) return "text-green-700 font-bold";
  if (score >= 4) return "text-green-600 font-bold";
  if (score >= 3) return "text-amber-600 font-bold";
  if (score >= 2) return "text-orange-600 font-bold";
  return "text-red-600 font-bold";
};

// ─── Mini Stars ───────────────────────────────────────────────────────────────
function MiniStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-2.5 h-2.5 ${i < score ? "text-gray-700" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Seller Answer ─────────────────────────────────────────────────────────────
function SellerAnswer({ comment }: { comment: Review["comment"] }) {
  if (!comment) return <span className="text-gray-300 text-sm">—</span>;
  const answerObj = comment.restaurantAnswer || comment.sellerAnswer;

  if (answerObj && typeof answerObj === "object") {
    const { text, status, rejectedReason } = answerObj as RestaurantAnswer;
    if (status === "REJECTED") {
      return (
        <div>
          <p className="text-[13px] font-bold text-red-600 uppercase tracking-wide mb-0.5">✕ Reddedildi</p>
          {rejectedReason && <p className="text-[14px] text-gray-500">Neden: {rejectedReason.reason}</p>}
        </div>
      );
    }
    if (status === "WAITING_FOR_APPROVE") {
      return (
        <div>
          <p className="text-[13px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">◉ Onay Bekliyor</p>
          <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-3">{text}</p>
        </div>
      );
    }
    return (
      <div>
        <p className="text-[13px] font-bold text-green-700 uppercase tracking-wide mb-0.5">✓ Yanıtlandı</p>
        <p className="text-[18px] text-gray-600 leading-relaxed line-clamp-3">{text}</p>
      </div>
    );
  }

  if (typeof answerObj === "string") {
    return (
      <div>
        <p className="text-[13px] font-bold text-green-700 uppercase tracking-wide mb-0.5">✓ Yanıtlandı</p>
        <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-3">{answerObj}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wide">Yanıt Yok</p>
    </div>
  );
}

// ─── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-sm">↕</span>;
  return <span className="ml-1 text-gray-600 text-sm">{dir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function YorumlarPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [commentFilter, setCommentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "createdDate",
    direction: "desc",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleCopy = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setToastMessage("Kopyalandı!");
    setTimeout(() => setToastMessage(""), 2000);
  };

  const fetchReviews = (isBackground = false) => {
    const storeIdsStr = BRANCHES.map((b) => b.id).join(",");
    if (!isBackground) setLoading(true);
    axios
      .get(`/api/reviews?storeIds=${storeIdsStr}`)
      .then((response) => {
        setData(response.data);
        setLastUpdated(new Date());
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tgo:reviewsFetched", { detail: response.data }));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  };

  useEffect(() => {
    fetchReviews();
    const interval = setInterval(() => fetchReviews(true), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, ratingFilter, commentFilter, dateFilter, branchFilter, sortConfig]);

  const processedReviews = useMemo(() => {
    if (!data?.content) return [];
    let filtered = data.content.filter((review) => {
      if (branchFilter !== "all" && review.storeId.toString() !== branchFilter) return false;
      if (ratingFilter !== "all" && Math.floor(review.rating.averageScore).toString() !== ratingFilter) return false;
      if (commentFilter === "with-comment" && !review.comment) return false;
      if (commentFilter === "no-comment" && review.comment) return false;
      if (dateFilter !== "all") {
        const reviewDate = new Date(review.createdDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateFilter === "today" && reviewDate < today) return false;
        if (dateFilter === "last3days") {
          const d = new Date(today); d.setDate(d.getDate() - 3);
          if (reviewDate < d) return false;
        }
        if (dateFilter === "last7days") {
          const d = new Date(today); d.setDate(d.getDate() - 7);
          if (reviewDate < d) return false;
        }
      }
      if (searchQuery.trim() !== "") {
        const text = review.comment?.text?.toLowerCase() || "";
        if (!text.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let valA: number | string = 0, valB: number | string = 0;
      if (sortConfig.key === "createdDate") { valA = a.createdDate; valB = b.createdDate; }
      else if (sortConfig.key === "rating") { valA = a.rating.averageScore; valB = b.rating.averageScore; }
      else if (sortConfig.key === "comment") { valA = a.comment ? a.comment.text.length : -1; valB = b.comment ? b.comment.text.length : -1; }
      else if (sortConfig.key === "storeId") { valA = getBranchName(a.storeId); valB = getBranchName(b.storeId); }
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [data, searchQuery, ratingFilter, commentFilter, dateFilter, branchFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedReviews.length / itemsPerPage));
  const paginatedReviews = processedReviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Stats
  const stats = useMemo(() => {
    const allReviews = data?.content || [];
    if (!allReviews.length) return null;
    const avg = allReviews.reduce((s, r) => s + r.rating.averageScore, 0) / allReviews.length;
    const withComment = allReviews.filter((r) => r.comment).length;
    const answered = allReviews.filter((r) => {
      const a = r.comment?.restaurantAnswer || r.comment?.sellerAnswer;
      return !!a;
    }).length;
    const todayCount = allReviews.filter(
      (r) => new Date(r.createdDate).toDateString() === new Date().toDateString()
    ).length;
    const low = allReviews.filter((r) => r.rating.averageScore < 3).length;
    const star5 = allReviews.filter((r) => r.rating.averageScore >= 4.5).length;
    return { avg, withComment, answered, todayCount, low, star5, total: allReviews.length };
  }, [data]);

  const hasActiveFilters =
    branchFilter !== "all" || ratingFilter !== "all" || commentFilter !== "all" || dateFilter !== "all" || !!searchQuery;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-widest uppercase text-white">Yorum Yönetimi</h1>
              {data && (
                <p className="text-[14px] text-gray-400 mt-0.5">
                  Toplam <span className="text-white font-semibold">{data.totalElements}</span> yorum ·{" "}
                  <span className="text-white font-semibold">{processedReviews.length}</span> filtreli · Sayfa{" "}
                  <span className="text-white font-semibold">{currentPage}</span>/{totalPages}
                </p>
              )}
            </div>
            {/* Inline stats */}
            {stats && (
              <div className="hidden lg:flex items-center gap-0 divide-x divide-gray-700 border-l border-gray-700 ml-2 pl-4">
                {[
                  { label: "Ort. Puan", value: stats.avg.toFixed(2).replace(".", ",") },
                  { label: "Bugün", value: stats.todayCount },
                  { label: "Yorumlu", value: stats.withComment },
                  { label: "Yanıtlı", value: stats.answered },
                  { label: "5★ Puan", value: stats.star5 },
                  { label: "Düşük Puan", value: stats.low },
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
              onClick={() => fetchReviews(false)}
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
          <div className="w-full sm:w-36">
            <CustomSelect label="Şube" value={branchFilter} onChange={setBranchFilter}
              options={[{ label: "Tüm Şubeler", value: "all" }, ...BRANCHES.map((b) => ({ label: b.name, value: b.id }))]}
            />
          </div>
          <div className="w-full sm:w-36">
            <CustomSelect label="Tarih" value={dateFilter} onChange={setDateFilter}
              options={[
                { label: "Tüm Zamanlar", value: "all" },
                { label: "Bugün", value: "today" },
                { label: "Son 3 Gün", value: "last3days" },
                { label: "Son 7 Gün", value: "last7days" },
              ]}
            />
          </div>
          <div className="w-full sm:w-32">
            <CustomSelect label="Puan" value={ratingFilter} onChange={setRatingFilter}
              options={[
                { label: "Tüm Puanlar", value: "all" },
                { label: "5 Yıldız", value: "5" },
                { label: "4 Yıldız", value: "4" },
                { label: "3 Yıldız", value: "3" },
                { label: "2 Yıldız", value: "2" },
                { label: "1 Yıldız", value: "1" },
              ]}
            />
          </div>
          <div className="w-full sm:w-40">
            <CustomSelect label="Yorum" value={commentFilter} onChange={setCommentFilter}
              options={[
                { label: "Tümü", value: "all" },
                { label: "Yorum Yazılmış", value: "with-comment" },
                { label: "Sadece Puan", value: "no-comment" },
              ]}
            />
          </div>
          <div className="w-full sm:flex-1 min-w-0 sm:min-w-[180px] max-w-none sm:max-w-xs">
            <label className="block text-[13px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Arama</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Yorum metni ara…"
                className="w-full h-[38px] border border-gray-300 bg-white pl-3 pr-8 text-[15px] text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-400 outline-none transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setBranchFilter("all"); setRatingFilter("all"); setCommentFilter("all"); setDateFilter("all"); setSearchQuery(""); }}
              className="text-[13px] font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wide border border-gray-300 px-3 h-[38px] hover:border-gray-500 transition-colors mt-[20px]"
            >
              Temizle ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="px-0 pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-gray-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest animate-pulse">
              12 Şube · Veriler Yükleniyor
            </p>
          </div>
        ) : (
          <div className="bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    {(
                      [
                        { key: "createdDate" as SortKey, label: "Tarih / Sipariş", cls: "w-48" },
                        { key: "storeId" as SortKey, label: "Şube", cls: "w-28" },
                        { key: "rating" as SortKey, label: "Puan Detayı", cls: "w-44" },
                        { key: "comment" as SortKey, label: "Müşteri Yorumu", cls: "" },
                        { key: null, label: "Satıcı Yanıtı", cls: "w-64" },
                      ] as const
                    ).map((col) => (
                      <th
                        key={col.label}
                        scope="col"
                        className={`px-4 py-3 text-left text-[13px] font-bold uppercase tracking-widest text-gray-300 border-r border-gray-700 last:border-r-0 ${col.key ? "cursor-pointer hover:text-white hover:bg-gray-800 select-none group" : ""} ${col.cls}`}
                        onClick={() => col.key && handleSort(col.key)}
                      >
                        <div className="flex items-center">
                          {col.label}
                          {col.key && <SortIcon active={sortConfig.key === col.key} dir={sortConfig.direction} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedReviews.length > 0 ? (
                    paginatedReviews.map((review, idx) => {
                      const isToday = new Date(review.createdDate).toDateString() === new Date().toDateString();
                      const isLow = review.rating.averageScore < 3;
                      const score = review.rating.averageScore;

                      return (
                        <tr
                          key={review.reviewId}
                          className={`group border-b transition-colors ${isLow
                            ? "border-red-200 bg-red-50 hover:bg-red-100"
                            : isToday
                              ? "border-blue-100 bg-blue-50 hover:bg-blue-100"
                              : idx % 2 === 0
                                ? "border-gray-100 bg-white hover:bg-gray-50"
                                : "border-gray-100 bg-gray-50/50 hover:bg-gray-100"
                            }`}
                        >
                          {/* Date & Order */}
                          <td className="px-4 py-3 align-top border-r border-gray-100 w-52">
                            <div className="space-y-1.5">
                              <div>
                                {isToday && (
                                  <span className="text-[12px] font-bold text-white bg-gray-800 px-1.5 py-0.5 uppercase tracking-widest mr-1">BUGÜN</span>
                                )}
                                {isLow && (
                                  <span className="text-[12px] font-bold text-white bg-red-600 px-1.5 py-0.5 uppercase tracking-widest">DÜŞÜK</span>
                                )}
                                <p className="text-[15px] font-bold text-gray-900 mt-1">
                                  {new Date(review.createdDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
                                </p>
                                <p className="text-[14px] text-gray-500">
                                  {new Date(review.createdDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              {review.orderCreatedDate && (
                                <div>
                                  <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider block">Sipariş Tar.</span>
                                  <span className="text-[14px] text-gray-600">
                                    {new Date(review.orderCreatedDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}{" "}
                                    {new Date(review.orderCreatedDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              )}
                              {review.orderParentId && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">No:</span>
                                  <span className="text-[14px] font-mono font-bold text-gray-700">
                                    {review.orderParentId}
                                  </span>
                                  <button
                                    onClick={(e) => handleCopy(review.orderParentId.toString(), e)}
                                    className="text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Kopyala"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <Link
                                    href={`/siparisler?orderId=${review.orderParentId}`}
                                    className="text-gray-300 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Siparişe Git"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3 align-top border-r border-gray-100 w-32">
                            <span className="text-[15px] font-semibold text-gray-800">
                              {getBranchName(review.storeId)}
                            </span>
                          </td>

                          {/* Rating detail */}
                          <td className="px-4 py-3 align-top border-r border-gray-100 w-48">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-xl font-black leading-none ${getScoreStyle(score)}`}>
                                  {score.toFixed(1).replace(".", ",")}
                                </span>
                                <span className="text-[13px] text-gray-400 font-medium">/5,0</span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-400 w-14">Kalite</span>
                                  <MiniStars score={review.rating.qualityScore} />
                                  <span className="text-[13px] text-gray-500 font-bold">{review.rating.qualityScore},0</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-400 w-14">Teslimat</span>
                                  <MiniStars score={review.rating.deliveryScore} />
                                  <span className="text-[13px] text-gray-500 font-bold">{review.rating.deliveryScore},0</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Comment */}
                          <td className="px-4 py-3 align-top">
                            {review.comment ? (
                              <p className="text-[18px] text-gray-800 leading-relaxed">{review.comment.text}</p>
                            ) : (
                              <span className="text-[14px] text-gray-400 italic">— yorum girilmemiş</span>
                            )}
                          </td>

                          {/* Seller Answer */}
                          <td className="px-4 py-3 align-top border-l border-gray-100 w-150">
                            <SellerAnswer comment={review.comment} />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400 font-medium">
                        Filtre kriterlerine uygun kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {processedReviews.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[14px] text-gray-500">
                  Toplam <span className="font-bold text-gray-800">{processedReviews.length}</span> kayıt ·{" "}
                  <span className="font-bold text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</span>–
                  <span className="font-bold text-gray-800">{Math.min(currentPage * itemsPerPage, processedReviews.length)}</span> arası görüntüleniyor · Sayfa başına {itemsPerPage}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 text-[14px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-[14px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ‹ Önceki
                  </button>
                  <div className="flex items-center gap-1 text-[14px] text-gray-600 font-medium px-1">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (isNaN(val) || val < 1) setCurrentPage(1);
                        else if (val > totalPages) setCurrentPage(totalPages);
                      }}
                      className="w-12 px-1 py-1.5 border border-gray-300 text-center text-[14px] font-bold text-gray-900 focus:border-gray-500 outline-none bg-white"
                    />
                    <span>/ {totalPages}</span>
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-[14px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Sonraki ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 text-[14px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    »
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
    </div>
  );
}

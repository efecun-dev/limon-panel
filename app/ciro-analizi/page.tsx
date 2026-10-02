"use client";

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { BRANCHES } from "@/lib/branches";

export default function CiroAnaliziPage() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [allOrdersData, setAllOrdersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchBranch, setSearchBranch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: "branchName" | "totalCiro" | "totalOrders" | string;
    direction: "asc" | "desc";
  }>({
    key: "totalCiro",
    direction: "desc",
  });

  // Ay seçenekleri (Geçmiş 12 ay, min Ağustos 2026)
  const monthOptions = useMemo(() => {
    const options = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      if (m.getFullYear() < 2026 || (m.getFullYear() === 2026 && m.getMonth() < 7)) {
        break;
      }
      options.push({
        month: m.getMonth(),
        year: m.getFullYear(),
        label: m.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
      });
    }
    return options;
  }, []);

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Ay verilerini çek
  const fetchMonthData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get(
        `/api/siparisler/all?year=${selectedYear}&month=${selectedMonth + 1}&t=${Date.now()}`
      );
      setAllOrdersData(res?.data?.content || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Aylık ciro analizi veri hatası:", err);
      setAllOrdersData([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData(true);
  }, [selectedMonth, selectedYear]);

  // Şube bazlı ve gün bazlı ciro & sipariş hesaplaması
  const tableData = useMemo(() => {
    let prevMonth = selectedMonth - 1;
    let prevMonthYear = selectedYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevMonthYear--;
    }
    const prevMonthLastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    const branchMap: Record<
      string,
      {
        branchId: string;
        branchName: string;
        totalCiro: number;
        totalOrders: number;
        daysCiro: Record<number, number>;
        daysOrders: Record<number, number>;
        prevMonthLastDayCiro: number;
      }
    > = {};

    Object.entries(BRANCHES).forEach(([bId, bName]) => {
      branchMap[bId] = {
        branchId: bId,
        branchName: bName,
        totalCiro: 0,
        totalOrders: 0,
        daysCiro: {},
        daysOrders: {},
        prevMonthLastDayCiro: 0,
      };
      for (let i = 1; i <= 31; i++) {
        branchMap[bId].daysCiro[i] = 0;
        branchMap[bId].daysOrders[i] = 0;
      }
    });

    allOrdersData.forEach((o: any) => {
      if (["Cancelled", "UnSupplied"].includes(o.packageStatus)) return;
      if (!o.orderDate) return;

      const d = new Date(o.orderDate);
      const sid = o.storeId?.toString();
      if (!branchMap[sid]) return;

      const amount = o.grossAmount || 0;
      const orderMonth = d.getMonth();
      const orderYear = d.getFullYear();
      const orderDay = d.getDate();

      if (orderMonth === selectedMonth && orderYear === selectedYear) {
        branchMap[sid].totalCiro += amount;
        branchMap[sid].totalOrders += 1;
        branchMap[sid].daysCiro[orderDay] = (branchMap[sid].daysCiro[orderDay] || 0) + amount;
        branchMap[sid].daysOrders[orderDay] = (branchMap[sid].daysOrders[orderDay] || 0) + 1;
      } else if (
        orderMonth === prevMonth &&
        orderYear === prevMonthYear &&
        orderDay === prevMonthLastDay
      ) {
        branchMap[sid].prevMonthLastDayCiro += amount;
      }
    });

    return Object.values(branchMap);
  }, [allOrdersData, selectedMonth, selectedYear]);

  // Sıralanmış ve filtrelenmiş satırlar
  const filteredAndSortedData = useMemo(() => {
    let result = tableData.filter((row) =>
      row.branchName.toLowerCase().includes(searchBranch.trim().toLowerCase())
    );

    result.sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      if (sortConfig.key === "branchName") {
        return a.branchName.localeCompare(b.branchName, "tr") * dir;
      }
      if (sortConfig.key === "totalCiro") {
        return (a.totalCiro - b.totalCiro) * dir;
      }
      if (sortConfig.key === "totalOrders") {
        return (a.totalOrders - b.totalOrders) * dir;
      }
      if (sortConfig.key.startsWith("day_ciro_")) {
        const day = parseInt(sortConfig.key.replace("day_ciro_", ""), 10);
        return ((a.daysCiro[day] || 0) - (b.daysCiro[day] || 0)) * dir;
      }
      if (sortConfig.key.startsWith("day_orders_")) {
        const day = parseInt(sortConfig.key.replace("day_orders_", ""), 10);
        return ((a.daysOrders[day] || 0) - (b.daysOrders[day] || 0)) * dir;
      }
      return 0;
    });

    return result;
  }, [tableData, searchBranch, sortConfig]);

  // Genel Toplam Satırı
  const totalSummary = useMemo(() => {
    const summary = {
      totalCiro: 0,
      totalOrders: 0,
      daysCiro: {} as Record<number, number>,
      daysOrders: {} as Record<number, number>,
      prevMonthLastDayCiro: 0,
    };

    for (let i = 1; i <= daysInMonth; i++) {
      summary.daysCiro[i] = 0;
      summary.daysOrders[i] = 0;
    }

    tableData.forEach((row) => {
      summary.totalCiro += row.totalCiro;
      summary.totalOrders += row.totalOrders;
      summary.prevMonthLastDayCiro += row.prevMonthLastDayCiro;
      for (let i = 1; i <= daysInMonth; i++) {
        summary.daysCiro[i] += row.daysCiro[i] || 0;
        summary.daysOrders[i] += row.daysOrders[i] || 0;
      }
    });

    return summary;
  }, [tableData, daysInMonth]);

  // Sıralama fonksiyonu tetikleyici
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  // KPI hesaplamaları
  const topBranchByCiro = useMemo(() => {
    if (tableData.length === 0) return null;
    return [...tableData].sort((a, b) => b.totalCiro - a.totalCiro)[0];
  }, [tableData]);

  const topBranchByOrders = useMemo(() => {
    if (tableData.length === 0) return null;
    return [...tableData].sort((a, b) => b.totalOrders - a.totalOrders)[0];
  }, [tableData]);

  const activeDaysCount = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if ((totalSummary.daysOrders[d] || 0) > 0) count++;
    }
    return count || 1;
  }, [totalSummary, daysInMonth]);

  const avgDailyCiro = Math.round(totalSummary.totalCiro / activeDaysCount);
  const avgDailyOrders = Math.round(totalSummary.totalOrders / activeDaysCount);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-12">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-blue-600 rounded text-white shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <div>
                <h1 className="text-base font-bold tracking-widest uppercase text-white">
                  Aylık Şube Ciro & Sipariş Analizi
                </h1>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  Her gün için sol sütunda küsüratsız ciro tutarı, sağ sütunda sipariş adedi gösterilir
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Ay Seçici */}
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Dönem:
              </label>
              <select
                className="bg-gray-900 text-white font-bold text-[13px] border border-gray-600 px-2.5 py-1 outline-none focus:border-blue-400 cursor-pointer"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-");
                  setSelectedYear(parseInt(y, 10));
                  setSelectedMonth(parseInt(m, 10));
                }}
              >
                {monthOptions.map((opt) => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Canlı Göstergesi */}
            {lastUpdated && (
              <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Canlı · {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}

            {/* Yenile Butonu */}
            <button
              onClick={() => fetchMonthData(true)}
              disabled={loading}
              className="flex items-center gap-2 bg-white hover:bg-gray-200 text-gray-900 px-4 py-2 font-bold text-xs tracking-wider uppercase transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Kartları ────────────────────────────────────────────────────── */}
      <div className="px-6 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aylık Toplam Ciro</p>
          <p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">
            ₺{Math.floor(totalSummary.totalCiro).toLocaleString("tr-TR")}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Günlük Ort: <span className="font-bold text-gray-800">₺{avgDailyCiro.toLocaleString("tr-TR")}</span>
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aylık Toplam Sipariş</p>
          <p className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
            {totalSummary.totalOrders.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-gray-500">Adet</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Günlük Ort: <span className="font-bold text-gray-800">{avgDailyOrders} Sipariş</span>
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En Yüksek Cirolu Şube</p>
          <p className="text-lg font-bold text-gray-900 mt-1 truncate">
            {topBranchByCiro?.branchName || "—"}
          </p>
          <p className="text-[11px] text-emerald-700 font-bold mt-1">
            ₺{Math.floor(topBranchByCiro?.totalCiro || 0).toLocaleString("tr-TR")}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En Çok Sipariş Alan Şube</p>
          <p className="text-lg font-bold text-gray-900 mt-1 truncate">
            {topBranchByOrders?.branchName || "—"}
          </p>
          <p className="text-[11px] text-blue-700 font-bold mt-1">
            {(topBranchByOrders?.totalOrders || 0).toLocaleString("tr-TR")} Sipariş
          </p>
        </div>
      </div>

      {/* ── Filtre & Arama Çubuğu ─────────────────────────────────────────────── */}
      <div className="px-6 mt-4 flex items-center justify-between gap-3">
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Şube adı ile filtrele..."
            value={searchBranch}
            onChange={(e) => setSearchBranch(e.target.value)}
            className="w-full h-9 bg-white border border-gray-300 px-3 pl-8 text-xs font-medium focus:border-gray-600 outline-none"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchBranch && (
            <button
              onClick={() => setSearchBranch("")}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="text-[12px] text-gray-500 font-semibold">
          Gösterilen: <span className="text-gray-900 font-bold">{filteredAndSortedData.length}</span> şube ·{" "}
          <span className="text-gray-900 font-bold">{daysInMonth}</span> gün
        </div>
      </div>

      {/* ── Ana Tablo ───────────────────────────────────────────────────────── */}
      <div className="px-6 mt-3">
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <svg className="animate-spin w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm font-semibold text-gray-600">Ay verileri hesaplanıyor...</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[440px] relative">
              <table className="w-full border-collapse text-left whitespace-nowrap text-[12px]">
                {/* ── Table Header (2 Kademe - Fixed / Sticky Header) ──────────────── */}
                <thead className="sticky top-0 z-30 bg-gray-900 text-white uppercase tracking-wider select-none shadow-sm">
                  {/* Kademe 1: Şube Bilgisi, Toplamlar ve Gün Başlıkları */}
                  <tr className="border-b border-gray-700">
                    {/* 1. Şube Adı */}
                    <th
                      rowSpan={2}
                      className="px-4 py-3 sticky top-0 left-0 bg-gray-900 z-50 min-w-[140px] w-[140px] max-w-[140px] text-left font-bold text-white border-r border-b-2 border-gray-600 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("branchName")}
                    >
                      <div className="flex items-center justify-between">
                        <span>Şube Adı</span>
                        <span className="text-[10px] text-gray-400 font-normal">{getSortIcon("branchName")}</span>
                      </div>
                    </th>

                    {/* 2. Şube Toplam (Ciro & Sipariş) */}
                    <th
                      colSpan={2}
                      className="px-3 py-2 sticky top-0 left-[140px] bg-gray-900 z-50 text-center font-bold text-white border-r-2 border-b border-gray-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)]"
                    >
                      <span>Şube Toplamı</span>
                    </th>

                    {/* 3. Günler (1 .. daysInMonth) - Her biri 2 alt sütun kaplar */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                      <th
                        key={`day-header-${day}`}
                        colSpan={2}
                        className="py-1.5 px-1 sticky top-0 z-40 bg-gray-900 text-center font-extrabold text-[13px] text-white border-r-2 border-b border-gray-700 hover:bg-gray-800/80 transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-gray-800 text-gray-100 text-[11px] font-mono">
                            {day}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>

                  {/* Kademe 2: Alt Başlıklar (Ciro | Sipariş) */}
                  <tr className="border-b-2 border-gray-600 bg-gray-800/95 text-[10px] text-gray-300">
                    {/* Toplam Alt Başlıkları */}
                    <th
                      className="px-3 py-2 sticky top-[37px] left-[140px] bg-gray-800 z-50 text-right font-bold min-w-[95px] border-r border-b-2 border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort("totalCiro")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Ciro (₺)</span>
                        <span className="text-[9px] text-gray-400">{getSortIcon("totalCiro")}</span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 sticky top-[37px] left-[235px] bg-gray-800 z-50 text-right font-bold min-w-[65px] border-r-2 border-b-2 border-gray-600 shadow-[4px_2px_8px_-2px_rgba(0,0,0,0.4)] cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort("totalOrders")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Sipariş</span>
                        <span className="text-[9px] text-gray-400">{getSortIcon("totalOrders")}</span>
                      </div>
                    </th>

                    {/* Gün Alt Başlıkları: Sol = Ciro, Sağ = Sipariş */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                      <React.Fragment key={`sub-header-${day}`}>
                        <th
                          className="px-2 py-1.5 sticky top-[37px] z-40 bg-gray-800 text-right font-semibold min-w-[70px] border-r border-b-2 border-gray-600 text-gray-300 cursor-pointer hover:bg-gray-700/80 transition-colors"
                          onClick={() => handleSort(`day_ciro_${day}`)}
                          title={`${day}. gün cirosuna göre sırala`}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <span>Ciro</span>
                            <span className="text-[8px] text-gray-400">{getSortIcon(`day_ciro_${day}`)}</span>
                          </div>
                        </th>
                        <th
                          className="px-2 py-1.5 sticky top-[37px] z-40 bg-gray-800 text-right font-semibold min-w-[48px] border-r-2 border-b-2 border-gray-600 text-blue-300 cursor-pointer hover:bg-gray-700/80 transition-colors"
                          onClick={() => handleSort(`day_orders_${day}`)}
                          title={`${day}. gün sipariş adedine göre sırala`}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <span>Sip.</span>
                            <span className="text-[8px] text-gray-400">{getSortIcon(`day_orders_${day}`)}</span>
                          </div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                {/* ── Table Body ───────────────────────────────────────────── */}
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSortedData.map((row, idx) => {
                    const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/70";
                    return (
                      <tr
                        key={row.branchId}
                        className={`group transition-colors ${rowBg} hover:bg-blue-50/40`}
                      >
                        {/* Şube Adı */}
                        <td className={`px-4 py-2.5 font-bold text-[13px] text-gray-900 sticky left-0 ${rowBg} group-hover:bg-blue-50/80 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] w-[140px] max-w-[140px] truncate border-r border-gray-200`}>
                          {row.branchName}
                        </td>

                        {/* Şube Toplam Ciro */}
                        <td className={`px-3 py-2.5 font-black text-[13px] text-emerald-700 text-right sticky left-[140px] ${rowBg} group-hover:bg-blue-50/80 z-20 tabular-nums border-r border-gray-200`}>
                          {row.totalCiro > 0
                            ? `₺${Math.floor(row.totalCiro).toLocaleString("tr-TR")}`
                            : "—"}
                        </td>

                        {/* Şube Toplam Sipariş */}
                        <td className={`px-2 py-2.5 font-black text-[13px] text-blue-700 text-right sticky left-[235px] ${rowBg} group-hover:bg-blue-50/80 z-20 tabular-nums border-r-2 border-gray-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]`}>
                          {row.totalOrders > 0
                            ? row.totalOrders.toLocaleString("tr-TR")
                            : "—"}
                        </td>

                        {/* Günlük Değerler: Sol = Ciro (küsüratsız), Sağ = Sipariş Adedi */}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const dayCiro = row.daysCiro[day] || 0;
                          const dayOrders = row.daysOrders[day] || 0;
                          const prevDayCiro =
                            day === 1 ? row.prevMonthLastDayCiro : row.daysCiro[day - 1] || 0;

                          // Trend rengi (Önceki güne kıyasla ciro artışı/azalışı)
                          let ciroBg = "";
                          let ciroText = "text-gray-900";
                          if (dayCiro > 0) {
                            if (dayCiro > prevDayCiro) {
                              ciroBg = "bg-emerald-50/70";
                              ciroText = "text-emerald-900 font-bold";
                            } else if (dayCiro < prevDayCiro) {
                              ciroBg = "bg-rose-50/70";
                              ciroText = "text-rose-900 font-bold";
                            } else {
                              ciroText = "text-gray-900 font-bold";
                            }
                          } else if (prevDayCiro > 0) {
                            ciroBg = "bg-rose-50/40";
                            ciroText = "text-rose-400";
                          } else {
                            ciroText = "text-gray-300";
                          }

                          return (
                            <React.Fragment key={`row-${row.branchId}-day-${day}`}>
                              {/* Sol: Ciro Miktarı (küsüratsız) */}
                              <td
                                className={`px-2 py-2 text-right tabular-nums tracking-tight border-r border-gray-200 text-[12px] ${ciroBg} ${ciroText}`}
                                title={`${row.branchName} - ${day} ${monthOptions.find(m => m.month === selectedMonth)?.label || ""}: ₺${Math.floor(dayCiro).toLocaleString("tr-TR")}`}
                              >
                                {dayCiro > 0
                                  ? Math.floor(dayCiro).toLocaleString("tr-TR")
                                  : "—"}
                              </td>

                              {/* Sağ: Sipariş Adedi */}
                              <td
                                className={`px-2 py-2 text-right tabular-nums border-r-2 border-gray-300 text-[12px] font-semibold ${
                                  dayOrders > 0
                                    ? "text-blue-900 bg-blue-50/30"
                                    : "text-gray-300"
                                }`}
                                title={`${row.branchName} - ${day}. gün: ${dayOrders} sipariş`}
                              >
                                {dayOrders > 0 ? dayOrders : "—"}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* ── GENEL TOPLAM SATIRI ─────────────────────────────────── */}
                  {tableData.length > 0 && (
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-black text-gray-900">
                      {/* Şube Adı */}
                      <td className="px-4 py-3 sticky left-0 bg-gray-200 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] text-[12px] uppercase tracking-wider border-r border-gray-300">
                        GENEL TOPLAM
                      </td>

                      {/* Toplam Ciro */}
                      <td className="px-3 py-3 sticky left-[140px] bg-gray-200 z-20 text-right text-[13px] text-emerald-800 tabular-nums border-r border-gray-300">
                        ₺{Math.floor(totalSummary.totalCiro).toLocaleString("tr-TR")}
                      </td>

                      {/* Toplam Sipariş */}
                      <td className="px-2 py-3 sticky left-[235px] bg-gray-200 z-20 text-right text-[13px] text-blue-900 tabular-nums border-r-2 border-gray-400 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)]">
                        {totalSummary.totalOrders.toLocaleString("tr-TR")}
                      </td>

                      {/* Her Gün İçin Genel Toplam: Ciro | Sipariş */}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dayCiro = totalSummary.daysCiro[day] || 0;
                        const dayOrders = totalSummary.daysOrders[day] || 0;
                        const prevDayCiro =
                          day === 1
                            ? totalSummary.prevMonthLastDayCiro
                            : totalSummary.daysCiro[day - 1] || 0;

                        let totalCiroBg = "bg-gray-100";
                        let totalCiroText = "text-gray-900";
                        if (dayCiro > 0) {
                          if (dayCiro > prevDayCiro) {
                            totalCiroBg = "bg-emerald-100/80";
                            totalCiroText = "text-emerald-950 font-black";
                          } else if (dayCiro < prevDayCiro) {
                            totalCiroBg = "bg-rose-100/80";
                            totalCiroText = "text-rose-950 font-black";
                          }
                        } else if (prevDayCiro > 0) {
                          totalCiroBg = "bg-rose-100/40";
                          totalCiroText = "text-rose-400";
                        } else {
                          totalCiroText = "text-gray-400";
                        }

                        return (
                          <React.Fragment key={`total-day-${day}`}>
                            {/* Sol: Toplam Ciro */}
                            <td
                              className={`px-2 py-3 text-right tabular-nums border-r border-gray-300 text-[12px] font-black ${totalCiroBg} ${totalCiroText}`}
                              title={`${day}. gün genel toplam ciro: ₺${Math.floor(dayCiro).toLocaleString("tr-TR")}`}
                            >
                              {dayCiro > 0
                                ? Math.floor(dayCiro).toLocaleString("tr-TR")
                                : "—"}
                            </td>

                            {/* Sağ: Toplam Sipariş */}
                            <td
                              className={`px-2 py-3 text-right tabular-nums border-r-2 border-gray-400 text-[12px] font-black ${
                                dayOrders > 0
                                  ? "bg-blue-100/60 text-blue-950"
                                  : "text-gray-400"
                              }`}
                              title={`${day}. gün genel toplam sipariş: ${dayOrders}`}
                            >
                              {dayOrders > 0 ? dayOrders : "—"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bilgilendirme Notu */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-gray-500 px-1 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 inline-block" />
              <span>Önceki güne göre artış (Ciro)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-rose-100 border border-rose-300 inline-block" />
              <span>Önceki güne göre azalış (Ciro)</span>
            </span>
          </div>
          <div>
            * İptal edilen ve tedarik edilemeyen siparişler ciroya ve sipariş adedine dahil edilmemiştir.
          </div>
        </div>
      </div>
    </div>
  );
}

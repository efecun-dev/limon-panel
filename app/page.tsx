"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { BRANCHES } from "@/lib/branches";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, BarChart, Bar, Legend, ComposedChart, LineChart, Line
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  'Created': 'Yeni',
  'Picking': 'Toplanıyor',
  'Invoiced': 'Faturalandı',
  'Shipped': 'Yolda',
  'Delivered': 'Teslim Edildi',
  'Cancelled': 'İptal',
  'UnSupplied': 'Tedarik Edilemedi'
};

const STATUS_COLORS: Record<string, string> = {
  'Created': '#3b82f6',
  'Picking': '#f59e0b',
  'Invoiced': '#a855f7',
  'Shipped': '#f97316',
  'Delivered': '#10b981',
  'Cancelled': '#ef4444',
  'UnSupplied': '#b91c1c'
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    deliveredOrders: 0,
    totalOrders: 0,
    totalReviews: 0,
    avgRating: "0.0",
    todayReviews: 0,
    unansweredReviews: 0,
    activeReturns: 0,
    resolvedReturns: 0,
    totalReturns: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    qualityScore: 0,
    deliveryScore: 0,
    cancelledRevenue: 0,
    altRate: 0,
    cancelRate: 0,
    promoCost: 0,
    promoRate: 0,
  });

  const [reviewChartData, setReviewChartData] = useState<any[]>([]);
  const [orderChartData, setOrderChartData] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topReturned, setTopReturned] = useState<any[]>([]);
  const [monthlyTableData, setMonthlyTableData] = useState<any[]>([]);
  const [allOrdersData, setAllOrdersData] = useState<any[]>([]);
  const [monthDataLoading, setMonthDataLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [tableSortConfig, setTableSortConfig] = useState<{ key: 'branchName' | 'total' | number | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [loading, setLoading] = useState(true);
  const [selectedTrendBranch, setSelectedTrendBranch] = useState("all");

  // BRANCHES is now imported from @/lib/branches

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const storeIds = Object.keys(BRANCHES).join(",");
        const [ordersRes, reviewsRes, returnsRes, reviewStatsRes] = await Promise.all([
          axios.get(`/api/siparisler?fetchDays=130&t=${Date.now()}`).catch(() => null),
          axios.get(`/api/reviews?storeIds=${storeIds}&t=${Date.now()}`).catch(() => null),
          axios.get(`/api/iadeler?t=${Date.now()}`).catch(() => null),
          axios.get(`/api/review-stats?storeIds=${storeIds}&t=${Date.now()}`).catch(() => null),
        ]);

        // --- Sipariş Metrikleri ---
        let activeO = 0, deliveredO = 0, totalO = 0, todayRev = 0, todayOrderCount = 0, todayDelivered = 0, cancelledRev = 0;
        let totalItems = 0, altItems = 0, cancelledItems = 0;
        let totalPromoCost = 0, promoOrders = 0;

        const statusCounts: Record<string, number> = {};
        const todayStr = new Date().toLocaleDateString('tr-TR');
        const dailyMap: Record<string, { siparis: number; ciro: number; branches: Record<string, {siparis: number, ciro: number}> }> = {};
        
        const branchStats: Record<string, { ciro: number, alt: number, totalItems: number, siparis: number, iptal: number }> = {};
        const productSales: Record<string, { name: string, qty: number, rev: number }> = {};
        const itemNamesMap: Record<string, string> = {};

        if (ordersRes?.data?.content) {
          // allOrdersData, ay bazlı useEffect ile ayrıca yüklenir
          totalO = ordersRes.data.content.length;
          ordersRes.data.content.forEach((o: any) => {
            if (['Created', 'Picking', 'Invoiced', 'Shipped'].includes(o.packageStatus)) activeO++;
            if (o.packageStatus === 'Delivered') deliveredO++;
            statusCounts[o.packageStatus] = (statusCounts[o.packageStatus] || 0) + 1;

            let orderTotal = o.grossAmount || 0;
            let orderHasPromo = false;
            let orderHasAlt = false;
            
            const sid = o.storeId?.toString();
            if (!branchStats[sid]) branchStats[sid] = { ciro: 0, alt: 0, totalItems: 0, siparis: 0, iptal: 0 };
            branchStats[sid].siparis++;

            // Item level analytics
            if (o.lines) {
               o.lines.forEach((line: any) => {
                 const pName = line.product?.name || line.barcode || "Bilinmeyen Ürün";
                 if (!productSales[pName]) productSales[pName] = { name: pName, qty: 0, rev: 0 };
                 
                 if (line.items) {
                   line.items.forEach((item: any) => {
                     if (item.id) itemNamesMap[item.id] = pName;
                     
                     totalItems++;
                     branchStats[sid].totalItems++;

                     if (item.isAlternative) {
                       altItems++;
                       branchStats[sid].alt++;
                       orderHasAlt = true;
                     }
                     if (item.isCancelled) {
                       cancelledItems++;
                       branchStats[sid].iptal++;
                     } else {
                       productSales[pName].qty++;
                       productSales[pName].rev += item.price || 0;
                     }

                     if (item.promotions?.length > 0) {
                        item.promotions.forEach((p: any) => {
                          if (p.sellerPaid || p.sellerCoverageRatio > 0) {
                             totalPromoCost += (p.discountAmount || 0);
                             orderHasPromo = true;
                          }
                        });
                     }
                   });
                 }
               });
            }
            if (orderHasPromo) promoOrders++;

            const orderDateStr = o.orderDate ? new Date(o.orderDate).toLocaleDateString('tr-TR') : '';
            if (orderDateStr === todayStr) {
              if (!['Cancelled', 'UnSupplied'].includes(o.packageStatus)) {
                todayRev += orderTotal;
                todayOrderCount++;
              } else {
                cancelledRev += orderTotal;
              }
              if (o.packageStatus === 'Delivered') todayDelivered++;
            }

            if (o.orderDate) {
              const d = new Date(o.orderDate);
              const dayKey = `${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]}`;
              if (!dailyMap[dayKey]) dailyMap[dayKey] = { siparis: 0, ciro: 0, branches: {} };
              if (!dailyMap[dayKey].branches[sid]) dailyMap[dayKey].branches[sid] = { siparis: 0, ciro: 0 };
              
              if (!['Cancelled', 'UnSupplied'].includes(o.packageStatus)) {
                dailyMap[dayKey].siparis++;
                dailyMap[dayKey].ciro += orderTotal;
                dailyMap[dayKey].branches[sid].siparis++;
                dailyMap[dayKey].branches[sid].ciro += orderTotal;
              }
            }
            
            if (!['Cancelled', 'UnSupplied'].includes(o.packageStatus)) {
               branchStats[sid].ciro += orderTotal;
            }
          });

          const sorted = [...ordersRes.data.content].sort((a: any, b: any) => b.orderDate - a.orderDate);
          setRecentOrders(sorted.slice(0, 10));
        }
        
        const sortedProducts = Object.values(productSales).sort((a,b) => b.qty - a.qty).slice(0, 5);
        setTopProducts(sortedProducts);

        const statusData = Object.entries(statusCounts).map(([key, val]) => ({
          name: STATUS_LABELS[key] || key,
          value: val,
          key: key
        })).sort((a,b) => b.value - a.value);
        setStatusBreakdown(statusData);

        // --- Yorum ---
        let tReviews = 0, totalRating = 0, todayR = 0, unanswered = 0;
        const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const branchReviewCounts: Record<string, { count: number; total: number }> = {};

        if (reviewsRes?.data?.content) {
          tReviews = reviewsRes.data.content.length;
          const today = new Date().toLocaleDateString("tr-TR");

          reviewsRes.data.content.forEach((r: any) => {
            const rate = Math.round(r.rating?.averageScore || 0);
            totalRating += r.rating?.averageScore || 0;
            if (rate >= 1 && rate <= 5) ratingCounts[rate] = (ratingCounts[rate] || 0) + 1;

            if (r.createdDate && new Date(r.createdDate).toLocaleDateString("tr-TR") === today) todayR++;
            if (!(r.comment?.sellerAnswer || r.comment?.restaurantAnswer?.text)) unanswered++;

            const sid = r.storeId?.toString() || "?";
            if (!branchReviewCounts[sid]) branchReviewCounts[sid] = { count: 0, total: 0 };
            branchReviewCounts[sid].count++;
            branchReviewCounts[sid].total += (r.rating?.averageScore || 0);
          });
        }

        let avgR = tReviews > 0 ? (totalRating / tReviews).toFixed(1) : "0.0";
        let qualityScore = 0, deliveryScore = 0;
        if (reviewStatsRes?.data?.overall) {
          const ov = reviewStatsRes.data.overall;
          if (ov.averageOverall > 0) avgR = ov.averageOverall.toFixed(1);
          qualityScore = ov.averageQuality || 0;
          deliveryScore = ov.averageDelivery || 0;
        }

        const rData = Object.entries(ratingCounts)
          .map(([star, count]) => ({ name: `${star} Yıldız`, value: count }))
          .reverse();
        setReviewChartData(rData);

        const bPerf = Object.entries(BRANCHES).map(([sid, name]) => {
           const revData = branchReviewCounts[sid] || { count: 0, total: 0 };
           const st = branchStats[sid] || { ciro: 0, alt: 0, totalItems: 1, siparis: 0, iptal: 0 };
           
           return {
             name,
             yorum: revData.count,
             puan: revData.count > 0 ? parseFloat((revData.total / revData.count).toFixed(1)) : 0,
             ciro: Math.round(st.ciro),
             altRate: st.totalItems > 0 ? Math.round((st.alt / st.totalItems)*100) : 0,
             iptalRate: st.totalItems > 0 ? Math.round((st.iptal / st.totalItems)*100) : 0,
           };
        }).sort((a, b) => b.ciro - a.ciro);
        setBranchPerformance(bPerf);

        const todayDate = new Date();
        const oData: any[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(todayDate);
          d.setDate(d.getDate() - i);
          const dayKey = `${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]}`;
          const entry = dailyMap[dayKey] || { siparis: 0, ciro: 0, branches: {} };
          
          const prevD = new Date(todayDate);
          prevD.setDate(prevD.getDate() - (i + 1));
          const prevDayKey = `${prevD.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][prevD.getMonth()]}`;
          const prevEntry = dailyMap[prevDayKey] || { siparis: 0, ciro: 0, branches: {} };

          const row: any = { 
            date: dayKey, 
            siparis: entry.siparis, 
            ciro: Math.round(entry.ciro),
            trend: entry.ciro >= prevEntry.ciro ? 'up' : 'down' 
          };
          
          Object.keys(BRANCHES).forEach(bId => {
             row[`ciro_${bId}`] = Math.round(entry.branches?.[bId]?.ciro || 0);
             row[`siparis_${bId}`] = entry.branches?.[bId]?.siparis || 0;
             row[`trend_${bId}`] = (entry.branches?.[bId]?.ciro || 0) >= (prevEntry.branches?.[bId]?.ciro || 0) ? 'up' : 'down';
          });
          
          oData.push(row);
        }
        setOrderChartData(oData);

        // --- İade ---
        let activeRet = 0, resRet = 0, totalRet = 0;
        const returnReasons: Record<string, number> = {};
        if (returnsRes?.data?.content) {
          totalRet = returnsRes.data.content.length;
          returnsRes.data.content.forEach((r: any) => {
            const status = r.claimItems?.[0]?.claimItemStatus?.name;
            if (['Created', 'WaitingInAction', 'Unresolved'].includes(status)) activeRet++;
            else resRet++;
            
            if (r.claimItems) {
               r.claimItems.forEach((ci: any) => {
                 const pName = ci.product?.name || itemNamesMap[ci.orderLineItemId?.toString()] || `İsimsiz İade (ID: ${ci.orderLineItemId || '?'})`;
                 returnReasons[pName] = (returnReasons[pName] || 0) + 1;
               });
            }
          });
        }
        
        const topRetList = Object.entries(returnReasons).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);
        setTopReturned(topRetList);

        setStats({
          activeOrders: activeO,
          deliveredOrders: todayDelivered,
          totalOrders: totalO,
          totalReviews: tReviews,
          avgRating: avgR,
          todayReviews: todayR,
          unansweredReviews: unanswered,
          activeReturns: activeRet,
          resolvedReturns: resRet,
          totalReturns: totalRet,
          totalRevenue: todayRev,
          avgOrderValue: todayOrderCount > 0 ? Math.round(todayRev / todayOrderCount) : 0,
          qualityScore,
          deliveryScore,
          cancelledRevenue: cancelledRev,
          altRate: totalItems > 0 ? (altItems / totalItems) * 100 : 0,
          cancelRate: totalItems > 0 ? (cancelledItems / totalItems) * 100 : 0,
          promoCost: totalPromoCost,
          promoRate: totalO > 0 ? (promoOrders / totalO) * 100 : 0
        });
      } catch (err) {
        console.error("Dashboard data fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Ay değişince o aya ait siparişleri çek (startDate/endDate pencere yöntemi)
  useEffect(() => {
    const fetchMonthData = async () => {
      setMonthDataLoading(true);
      try {
        const res = await axios
          .get(`/api/siparisler/all?year=${selectedYear}&month=${selectedMonth + 1}`)
          .catch(() => null);
        setAllOrdersData(res?.data?.content || []);
      } catch (err) {
        console.error('Aylık veri hatası:', err);
        setAllOrdersData([]);
      } finally {
        setMonthDataLoading(false);
      }
    };
    fetchMonthData();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (allOrdersData.length === 0) return;

    let prevMonth = selectedMonth - 1;
    let prevMonthYear = selectedYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevMonthYear--;
    }
    const prevMonthLastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    const monthlyMap: Record<string, { total: number; days: Record<number, number>; orderCounts: Record<number, number>; prevMonthLastDayTotal: number }> = {};
    Object.keys(BRANCHES).forEach(sid => {
      monthlyMap[sid] = { total: 0, days: {}, orderCounts: {}, prevMonthLastDayTotal: 0 };
      for (let i = 1; i <= 31; i++) {
        monthlyMap[sid].days[i] = 0;
        monthlyMap[sid].orderCounts[i] = 0;
      }
    });

    allOrdersData.forEach((o: any) => {
      if (['Cancelled', 'UnSupplied'].includes(o.packageStatus)) return;
      if (!o.orderDate) return;

      const d = new Date(o.orderDate);
      const sid = o.storeId?.toString();
      
      if (monthlyMap[sid]) {
        if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
          monthlyMap[sid].total += (o.grossAmount || 0);
          monthlyMap[sid].days[d.getDate()] += (o.grossAmount || 0);
          monthlyMap[sid].orderCounts[d.getDate()] += 1;
        } else if (d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear && d.getDate() === prevMonthLastDay) {
          monthlyMap[sid].prevMonthLastDayTotal += (o.grossAmount || 0);
        }
      }
    });

    const mData = Object.entries(BRANCHES).map(([sid, bName]) => {
      const rowData = monthlyMap[sid];
      return {
        branchName: bName,
        total: rowData.total,
        days: rowData.days,
        orderCounts: rowData.orderCounts,
        prevMonthLastDayTotal: rowData.prevMonthLastDayTotal
      };
    }).sort((a, b) => b.total - a.total);
    
    setMonthlyTableData(mData);
  }, [allOrdersData, selectedMonth, selectedYear]);

  const monthOptions = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    // Trendyol API sadece son 1-1.5 ayı verdiği için, Ağustos 2026 öncesini göstermiyoruz.
    if (m.getFullYear() < 2026 || (m.getFullYear() === 2026 && m.getMonth() < 7)) {
      break; 
    }
    monthOptions.push({
      month: m.getMonth(),
      year: m.getFullYear(),
      label: m.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    });
  }

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const totalRow = {
     total: monthlyTableData.reduce((acc, row) => acc + (row.total || 0), 0),
     days: {} as Record<number, number>,
     orderCounts: {} as Record<number, number>,
     prevMonthLastDayTotal: monthlyTableData.reduce((acc, row) => acc + (row.prevMonthLastDayTotal || 0), 0)
  };
  for (let i = 1; i <= daysInMonth; i++) {
     totalRow.days[i] = monthlyTableData.reduce((acc, row) => acc + (row.days[i] || 0), 0);
     totalRow.orderCounts[i] = monthlyTableData.reduce((acc, row) => acc + (row.orderCounts[i] || 0), 0);
  }

  let sortedTableData = [...monthlyTableData];
  if (tableSortConfig.key) {
    sortedTableData.sort((a, b) => {
      if (tableSortConfig.key === 'branchName') {
        return tableSortConfig.direction === 'asc' 
          ? a.branchName.localeCompare(b.branchName) 
          : b.branchName.localeCompare(a.branchName);
      } else if (tableSortConfig.key === 'total') {
        return tableSortConfig.direction === 'asc' 
          ? a.total - b.total 
          : b.total - a.total;
      } else if (typeof tableSortConfig.key === 'number') {
        const day = tableSortConfig.key;
        const valA = a.days[day] || 0;
        const valB = b.days[day] || 0;
        return tableSortConfig.direction === 'asc'
          ? valA - valB
          : valB - valA;
      }
      return 0;
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-t-gray-600 animate-spin" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Veriler Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-10">
      
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-widest uppercase text-white">Kontrol Paneli</h1>
              <p className="text-[14px] text-gray-400 mt-0.5">Sipariş, İade ve Performans Analitikleri</p>
            </div>
            
            <div className="hidden lg:flex items-center gap-0 divide-x divide-gray-700 border-l border-gray-700 ml-2 pl-4">
              {[
                { label: "Sipariş (Aktif)", value: stats.activeOrders },
                { label: "Bugün Ciro", value: `${stats.totalRevenue.toLocaleString('tr-TR')} ₺` },
                { label: "Alternatif %", value: `%${stats.altRate.toFixed(1)}` },
                { label: "İptal %", value: `%${stats.cancelRate.toFixed(1)}` },
                { label: "Yorum (Yanıtsız)", value: stats.unansweredReviews },
                { label: "Ortalama Puan", value: `${stats.avgRating} / 5` },
              ].map((s) => (
                <div key={s.label} className="px-4 text-center">
                  <p className="text-[18px] font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[12px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-gray-400 font-mono">
            Son Güncelleme: {new Date().toLocaleTimeString('tr-TR')}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        
        {/* Row 1: KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 p-4">
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bugünkü Ciro</h3>
             <div className="flex items-end justify-between mt-2">
               <span className="text-3xl font-black text-gray-900">{stats.totalRevenue.toLocaleString('tr-TR')} ₺</span>
               <span className="text-[10px] font-bold text-gray-500 mb-1">Ort: {stats.avgOrderValue}₺</span>
             </div>
             <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-[11px] font-semibold text-gray-500">İptal Edilen:</span>
               <span className="text-[12px] font-bold text-red-600">{stats.cancelledRevenue.toLocaleString('tr-TR')} ₺</span>
             </div>
          </div>

          <div className="bg-white border border-gray-200 p-4">
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Alternatif Gönderim</h3>
             <div className="flex items-end justify-between mt-2">
               <span className="text-3xl font-black text-amber-500">%{stats.altRate.toFixed(1)}</span>
               <span className="text-[10px] font-bold text-gray-500 mb-1">Tüm ürünlerde</span>
             </div>
             <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-[11px] font-semibold text-gray-500">İptal Oranı (Adet):</span>
               <span className="text-[12px] font-bold text-red-600">%{stats.cancelRate.toFixed(1)}</span>
             </div>
          </div>

          <div className="bg-white border border-gray-200 p-4">
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Satıcı Promosyonları</h3>
             <div className="flex items-end justify-between mt-2">
               <span className="text-3xl font-black text-blue-600">{stats.promoCost.toLocaleString('tr-TR')} ₺</span>
               <span className="text-[10px] font-bold text-gray-500 mb-1">Harcanan</span>
             </div>
             <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-[11px] font-semibold text-gray-500">Kullanılan Siparişler:</span>
               <span className="text-[12px] font-bold text-gray-800">%{stats.promoRate.toFixed(1)}</span>
             </div>
          </div>

          <div className="bg-white border border-gray-200 p-4">
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Müşteri Memnuniyeti</h3>
             <div className="flex items-end justify-between mt-2">
               <span className="text-3xl font-black text-gray-900">{stats.avgRating}</span>
               <span className="text-[10px] font-bold text-gray-500 mb-1">/ 5.0</span>
             </div>
             <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-[11px] font-semibold text-gray-500">Kalite: <strong className="text-gray-800">{stats.qualityScore || '-'}</strong></span>
               <span className="text-[11px] font-semibold text-gray-500">Teslimat: <strong className="text-gray-800">{stats.deliveryScore || '-'}</strong></span>
             </div>
          </div>

          <div className="bg-white border border-gray-200 p-4">
             <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sipariş Süreci</h3>
             <div className="flex items-end justify-between mt-2">
               <span className="text-3xl font-black text-gray-900">{stats.activeOrders}</span>
               <span className="text-[10px] font-bold text-gray-500 mb-1">Aktif</span>
             </div>
             <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-[11px] font-semibold text-gray-500">Yanıtsız Yorum:</span>
               <span className="text-[12px] font-bold text-orange-600">{stats.unansweredReviews} Adet</span>
             </div>
          </div>
        </div>

        {/* 30 Günlük Şube Analiz Tablosu */}
        <div className="bg-white border border-gray-200 mt-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Aylık Şube Ciro Analizi</h3>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ay Seçimi:</label>
              <select 
                className="text-[12px] font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500 cursor-pointer"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-');
                  setSelectedYear(parseInt(y));
                  setSelectedMonth(parseInt(m));
                }}
              >
                {monthOptions.map(opt => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {monthDataLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
              </svg>
              <span className="text-sm font-semibold">Ay verisi yükleniyor...</span>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="text-[10px] text-gray-300 uppercase tracking-widest bg-gray-900 border-b border-gray-700">
                <tr>
                  <th 
                    className="px-4 py-3 sticky left-0 bg-gray-900 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] min-w-[130px] w-[131px] max-w-[131px] text-white cursor-pointer hover:bg-gray-800 group select-none"
                    onClick={() => {
                      if (tableSortConfig.key === 'branchName') {
                        if (tableSortConfig.direction === 'asc') setTableSortConfig({ key: 'branchName', direction: 'desc' });
                        else setTableSortConfig({ key: null, direction: null });
                      } else {
                        setTableSortConfig({ key: 'branchName', direction: 'asc' });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Şube Adı</span>
                      <span className="text-[9px] text-gray-500 group-hover:text-gray-300">
                        {tableSortConfig.key === 'branchName' ? (tableSortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 sticky left-[129px] bg-gray-900 z-20 border-l border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] text-right min-w-[140px] text-white cursor-pointer hover:bg-gray-800 group select-none"
                    onClick={() => {
                      if (tableSortConfig.key === 'total') {
                        if (tableSortConfig.direction === 'desc') setTableSortConfig({ key: 'total', direction: 'asc' });
                        else setTableSortConfig({ key: null, direction: null });
                      } else {
                        setTableSortConfig({ key: 'total', direction: 'desc' });
                      }
                    }}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span>Şube Toplam Ciro</span>
                      <span className="text-[9px] text-gray-500 group-hover:text-gray-300">
                        {tableSortConfig.key === 'total' ? (tableSortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <th 
                      key={day} 
                      className="px-1 py-3 text-right border-r border-gray-700 min-w-[50px] cursor-pointer hover:bg-gray-800 group select-none"
                      onClick={() => {
                        if (tableSortConfig.key === day) {
                          if (tableSortConfig.direction === 'desc') setTableSortConfig({ key: day, direction: 'asc' });
                          else setTableSortConfig({ key: null, direction: null });
                        } else {
                          setTableSortConfig({ key: day, direction: 'desc' });
                        }
                      }}
                    >
                      <div className="flex items-center justify-end gap-1 pr-1">
                        <span>{day}</span>
                        <span className="text-[9px] text-gray-500 group-hover:text-gray-300">
                          {tableSortConfig.key === day ? (tableSortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((row, idx) => (
                  <tr key={idx} className="group border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-bold text-[12px] text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[130px] w-[131px] max-w-[131px]">{row.branchName}</td>
                    <td className="px-4 py-2.5 font-black text-[14px] text-emerald-700 sticky left-[129px] bg-white group-hover:bg-gray-50 z-10 border-l border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-right tabular-nums tracking-tight">
                      {row.total > 0 ? row.total.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '-'}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const currentDayVal = row.days[day];
                      const prevDayVal = day === 1 ? row.prevMonthLastDayTotal : row.days[day - 1];
                      let bgClass = '';
                      if (currentDayVal > 0) {
                         if (currentDayVal > prevDayVal) bgClass = 'bg-green-100/70 text-green-900';
                         else if (currentDayVal < prevDayVal) bgClass = 'bg-red-100/70 text-red-900';
                         else bgClass = 'text-gray-900';
                      } else {
                         bgClass = 'text-gray-300';
                      }

                      const orderCount = row.orderCounts[day];

                      return (
                        <td 
                          key={day} 
                          className={`px-1 py-2.5 text-right border-r border-gray-100 text-[12px] font-bold tabular-nums tracking-tight pr-2 ${bgClass}`}
                          title={orderCount > 0 ? `${orderCount} sipariş` : ''}
                        >
                          {currentDayVal > 0 ? currentDayVal.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* Genel Toplam Satırı */}
                {monthlyTableData.length > 0 && (
                  <tr className="bg-gray-100 border-t-2 border-gray-300 group hover:bg-gray-200">
                    <td className="px-4 py-3 font-black text-[12px] text-gray-900 sticky left-0 bg-gray-100 group-hover:bg-gray-200 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase tracking-wider min-w-[130px] w-[131px] max-w-[131px]">GENEL TOPLAM</td>
                    <td className="px-4 py-3 font-black text-[14px] text-gray-900 sticky left-[129px] bg-gray-100 group-hover:bg-gray-200 z-10 border-l border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-right tabular-nums tracking-tight">
                      {totalRow.total > 0 ? Math.floor(totalRow.total).toLocaleString('tr-TR') : '-'}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const currentDayVal = totalRow.days[day];
                        const prevDayVal = day === 1 ? totalRow.prevMonthLastDayTotal : totalRow.days[day - 1];
                        let bgClass = '';
                        if (currentDayVal > 0) { 
                          if (currentDayVal > prevDayVal) bgClass = 'bg-green-200 text-green-900';
                          else if (currentDayVal < prevDayVal) bgClass = 'bg-red-200 text-red-900';
                          else bgClass = 'text-gray-900';
                        } else {
                          bgClass = 'text-gray-400';
                        }

                        const orderCount = totalRow.orderCounts[day];

                        return (
                          <td 
                            key={`total-${day}`} 
                            className={`px-2 py-3 text-center border-r border-gray-300 text-[12px] font-black tabular-nums tracking-tight ${bgClass}`}
                            title={orderCount > 0 ? `${orderCount} sipariş` : ''}
                          >
                            {currentDayVal > 0 ? Math.floor(currentDayVal).toLocaleString('tr-TR') : '-'}
                          </td>
                        );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Row 2: Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm lg:col-span-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-2">
              <div>
                <h3 className="text-[16px] font-extrabold text-gray-900 tracking-tight">Ciro ve Sipariş Eğilimi</h3>
                <p className="text-[13px] text-gray-500 mt-1 font-medium">Son 7 günlük performans karşılaştırması</p>
              </div>
              <select
                className="text-[13px] font-bold text-gray-700 border border-gray-200 rounded-xl py-2 px-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white hover:bg-gray-50 transition-all cursor-pointer appearance-none shadow-sm"
                value={selectedTrendBranch}
                onChange={(e) => setSelectedTrendBranch(e.target.value)}
              >
                <option value="all">Tüm Şubeler</option>
                {Object.entries(BRANCHES).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={orderChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                    dy={12} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                    tickFormatter={(val) => `₺${val.toLocaleString('tr-TR')}`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      fontSize: '13px', 
                      color: '#0f172a',
                      padding: '12px 16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                    }} 
                    itemStyle={{
                      fontWeight: 700,
                    }}
                    cursor={{stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4'}}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}
                  />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey={(selectedTrendBranch === "all" ? "ciro" : `ciro_${selectedTrendBranch}`) as any} 
                    name="Toplam Ciro (₺)" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#ffffff', stroke: '#6366f1', strokeWidth: 2 }} 
                    activeDot={{ r: 7, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 3 }} 
                    animationDuration={1500}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey={(selectedTrendBranch === "all" ? "siparis" : `siparis_${selectedTrendBranch}`) as any} 
                    name="Sipariş Adedi" 
                    stroke="#f43f5e" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#ffffff', stroke: '#f43f5e', strokeWidth: 2 }} 
                    activeDot={{ r: 7, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 3 }} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 p-4 flex flex-col">
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest mb-4">Sipariş Durum Dağılımı</h3>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                    {statusBreakdown.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.key] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '0px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {statusBreakdown.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s.key] || '#94a3b8' }}></div>
                    <span className="font-bold text-gray-600 uppercase tracking-wide">{s.name}</span>
                  </div>
                  <span className="font-black text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Product Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className="bg-white border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">En Çok Satan Ürünler</h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">Satış adetine göre</p>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100">
                {topProducts.length > 0 ? topProducts.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-[12px] font-bold text-gray-900 line-clamp-1">{p.name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="text-[13px] font-black text-gray-900">{p.qty} <span className="text-[10px] font-normal text-gray-500 uppercase">Adet</span></div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-4 text-[11px] text-gray-400 text-center italic">Yeterli veri yok</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">En Çok İade Edilenler</h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">Müşteri iade taleplerine göre</p>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100">
                {topReturned.length > 0 ? topReturned.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-[12px] font-bold text-gray-900 line-clamp-1">{p.name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="text-[13px] font-black text-red-600">{p.count} <span className="text-[10px] font-normal text-gray-500 uppercase">İade</span></div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-4 text-[11px] text-gray-400 text-center italic">İade verisi bulunamadı</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Şube Performans Tablosu Detaylı */}
          <div className="bg-white border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Şube Operasyon Skoru</h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">Alternatif & İptal Oranları</p>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Şube</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Alt %</th>
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-right">İptal %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branchPerformance.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="text-[11px] font-bold text-gray-900 truncate max-w-[90px]">{b.name}</div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[11px] font-bold ${b.altRate > 10 ? 'text-orange-600' : 'text-gray-900'}`}>%{b.altRate}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                       <span className={`text-[11px] font-bold ${b.iptalRate > 5 ? 'text-red-600' : 'text-gray-900'}`}>%{b.iptalRate}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* Row 4: Recent Orders Data Table */}
        <div className="bg-white border border-gray-200 mt-6">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Son Siparişler ve Alarmlar</h3>
            <Link href="/siparisler" className="text-[11px] font-bold text-blue-600 hover:underline uppercase tracking-wide">Tüm Siparişleri Yönet</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sipariş / Zaman</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Şube</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Durum</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Uyarılar (Alt/İptal)</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((o, i) => {
                  let altC = 0, cancC = 0, isPromo = false;
                  o.lines?.forEach((l: any) => {
                     l.items?.forEach((it: any) => {
                       if (it.isAlternative) altC++;
                       if (it.isCancelled) cancC++;
                       if (it.promotions?.length > 0) isPromo = true;
                     })
                  });

                  return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/siparisler?orderNumber=${o.orderNumber}`} className="text-[13px] font-bold text-blue-600 hover:underline">#{o.orderNumber}</Link>
                      <div className="text-[10px] text-gray-500 mt-0.5">{new Date(o.orderDate).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-bold text-gray-700">{BRANCHES[o.storeId?.toString()] || 'Bilinmeyen'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border" style={{ 
                        color: STATUS_COLORS[o.packageStatus] || '#64748b', 
                        borderColor: STATUS_COLORS[o.packageStatus] || '#cbd5e1',
                        backgroundColor: (STATUS_COLORS[o.packageStatus] || '#f8fafc') + '15'
                      }}>
                        {STATUS_LABELS[o.packageStatus] || o.packageStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {altC > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 uppercase">{altC} Alternatif</span>}
                      {cancC > 0 && <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 uppercase">{cancC} İptal</span>}
                      {isPromo && <span className="text-[9px] font-bold border border-gray-300 text-gray-600 px-1.5 py-0.5 uppercase">Promo</span>}
                      {altC === 0 && cancC === 0 && !isPromo && <span className="text-[10px] text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-bold text-gray-900">
                      {o.grossAmount?.toFixed(2)} ₺
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

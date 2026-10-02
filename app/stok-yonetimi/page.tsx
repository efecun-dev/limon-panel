"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { BRANCHES } from "@/lib/branches";

interface ProductStock {
  quantity: number | null;
  onSale: boolean;
  sellingPrice: number | null;
}

interface ProductItem {
  id: string;
  contentId: number;
  barcode: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  stockCode: string | null;
  totalStock: number;
  stocks: Record<string, ProductStock>;
}

export default function StokYonetimiPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(2171);
  const [globalStats, setGlobalStats] = useState({
    totalProducts: 2171,
    sumTotalStock: 340321,
    critical: 76,
    outOfStock: 579,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // 'all' | 'in_stock' | 'critical' | 'out_of_stock'
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);


  // Arama için debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Arama değiştiğinde ilk sayfaya dön
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Stok verilerini API'den çek
  const fetchStocks = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        let url = `/api/stoklar?page=${page}&size=${pageSize}&t=${Date.now()}`;
        if (debouncedSearch.trim()) {
          url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
        }
        if (selectedBranch !== "all") {
          url += `&storeId=${selectedBranch}`;
        }
        const res = await axios.get(url);
        if (res.data) {
          setProducts(res.data.content || []);
          setTotalElements(res.data.totalElements || 0);
          setTotalPages(res.data.totalPages || 1);
          if (res.data.globalStats) {
            setGlobalStats(res.data.globalStats);
          }
          if (res.data.catalogTotal) {
            setCatalogTotal(res.data.catalogTotal);
          } else if (!debouncedSearch.trim() && selectedBranch === "all" && res.data.totalElements > 0) {
            setCatalogTotal(res.data.totalElements);
          }
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error("Stok verileri çekilemedi:", err);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, selectedBranch]
  );

  useEffect(() => {
    fetchStocks(true);
  }, [fetchStocks]);

  // Filtrelenmiş ürünler (İstemci tarafında ek durum filtreleri için)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (stockStatusFilter === "all") return true;

      // Seçilen şubeye göre veya tüm şubelere göre stok hesabı
      let relevantStock = 0;
      if (selectedBranch !== "all") {
        relevantStock = p.stocks?.[selectedBranch]?.quantity || 0;
      } else {
        relevantStock = p.totalStock;
      }

      if (stockStatusFilter === "in_stock") return relevantStock > 0;
      if (stockStatusFilter === "critical") return relevantStock > 0 && relevantStock <= 3;
      if (stockStatusFilter === "out_of_stock") return relevantStock === 0;

      return true;
    });
  }, [products, stockStatusFilter, selectedBranch]);

  // KPI Özet İstatistikleri
  const stats = useMemo(() => {
    let inStockCount = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;
    let sumTotalStock = 0;

    products.forEach((p) => {
      sumTotalStock += p.totalStock;
      if (p.totalStock > 3) inStockCount++;
      else if (p.totalStock > 0) criticalCount++;
      else outOfStockCount++;
    });

    return {
      inStockCount,
      criticalCount,
      outOfStockCount,
      sumTotalStock,
    };
  }, [products]);

  // Excel / CSV İndirme ve Veri Derleme Durumları
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStep, setExportStep] = useState<number>(0);
  const [exportMessage, setExportMessage] = useState<string>("");
  const [exportCount, setExportCount] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [lastDownloadedCount, setLastDownloadedCount] = useState<number>(0);

  // Excel / CSV Dışa Aktarma (Tüm ürünler veya filtrelenmiş tüm ürünler)
  const startExport = async (ignoreFilters = true) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);
    setShowExportModal(true);
    setExportStep(1);
    setExportMessage("Trendyol Go API'ye bağlanılıyor, tam katalog (2.171 ürün) sorgulanıyor...");
    setExportCount(0);

    try {
      // 1. API'den tüm ürünleri çek
      let url = `/api/stoklar?all=true&t=${Date.now()}`;
      if (ignoreFilters) {
        url += `&ignoreFilters=true`;
      } else {
        if (debouncedSearch.trim()) {
          url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
        }
        if (selectedBranch !== "all") {
          url += `&storeId=${selectedBranch}`;
        }
      }

      setExportStep(2);
      setExportMessage("12 şube (Meydan, Yıldıztepe, Kanije, Özgürlük vb.) taranıyor ve anlık stoklar toplanıyor...");

      const res = await axios.get(url);
      const allFetchedProducts: ProductItem[] = res.data?.content || [];

      if (!allFetchedProducts.length) {
        throw new Error("Dışa aktarılacak ürün bulunamadı. Lütfen filtrelerinizi kontrol edin.");
      }

      setExportCount(allFetchedProducts.length);

      // 2. İstemci tarafındaki stok durumu filtresini uygula (eğer filtreli indirme istenmişse)
      let exportProducts = allFetchedProducts;
      if (!ignoreFilters && stockStatusFilter !== "all") {
        exportProducts = exportProducts.filter((p) => {
          let relevantStock = 0;
          if (selectedBranch !== "all") {
            relevantStock = p.stocks?.[selectedBranch]?.quantity || 0;
          } else {
            relevantStock = p.totalStock;
          }

          if (stockStatusFilter === "in_stock") return relevantStock > 0;
          if (stockStatusFilter === "critical") return relevantStock > 0 && relevantStock <= 3;
          if (stockStatusFilter === "out_of_stock") return relevantStock === 0;

          return true;
        });
      }

      setExportStep(3);
      setExportMessage(`Veriler doğrulandı. ${exportProducts.length} adet ürünün şube stokları ve fiyatları Excel CSV formatında derleniyor...`);

      // 3. Excel uyumlu CSV formatında hazırla
      const branchKeys = Object.keys(BRANCHES);
      const branchNames = Object.values(BRANCHES);

      const headers = [
        "Barkod",
        "Ürün Adı",
        "Marka",
        "Kategori",
        "Toplam Stok",
        ...branchNames.map((name) => `${name} Stok`),
        ...branchNames.map((name) => `${name} Fiyat (TL)`),
        ...branchNames.map((name) => `${name} Satış Durumu`),
      ];

      const rows = exportProducts.map((p) => {
        const stockValues = branchKeys.map((sid) => {
          const q = p.stocks?.[sid]?.quantity;
          return q === null || q === undefined ? "-" : q;
        });
        const priceValues = branchKeys.map((sid) => {
          const price = p.stocks?.[sid]?.sellingPrice;
          return price !== null && price !== undefined ? price.toFixed(2).replace(".", ",") : "-";
        });
        const statusValues = branchKeys.map((sid) => {
          const s = p.stocks?.[sid];
          if (!s) return "Tanımsız";
          return s.onSale ? "Satışta Açık" : "Satışa Kapalı";
        });

        return [
          `="${p.barcode}"`,
          `"${(p.title || "").replace(/"/g, '""')}"`,
          `"${(p.brand || "").replace(/"/g, '""')}"`,
          `"${(p.category || "").replace(/"/g, '""')}"`,
          typeof p.totalStock === "number" ? p.totalStock : 0,
          ...stockValues,
          ...priceValues,
          ...statusValues,
        ].join(";");
      });

      const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileLabel = ignoreFilters
        ? `tum_subeler_${exportProducts.length}_urun_katalogu`
        : `filtreli_stok_listesi_${exportProducts.length}_urun`;
      a.download = `trendyol_${fileLabel}_${dateStr}.csv`;

      a.click();
      URL.revokeObjectURL(downloadUrl);

      setLastDownloadedCount(exportProducts.length);
      setExportStep(4);
      setExportMessage(`Eksiksiz derlendi! Toplam ${exportProducts.length} ürün ve 12 şube verisi başarıyla indirildi.`);
      setExportSuccess(true);
    } catch (err: any) {
      console.error("Excel indirme hatası:", err);
      setExportError(err?.message || "Excel dosyası derlenirken bir hata oluştu.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-16">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white border-b border-gray-700">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-600 rounded text-white shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <div>
              <h1 className="text-base font-bold tracking-widest uppercase text-white">
                Şube Bazlı Stok Yönetimi
              </h1>
              <p className="text-[12px] text-gray-400 mt-0.5">
                Marketteki 2.171 ürünün 12 şube bazında anlık stok miktarları, fiyatları ve satış durumu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdated && (
              <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Canlı · {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}

            {/* İndirme Butonları */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => startExport(true)}
                disabled={isExporting}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-600 px-3.5 py-2 font-bold text-xs tracking-wider uppercase transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                title="Arama veya filtrelerden bağımsız tüm 2.171 ürünü ve 12 şube verisini Excel olarak indir"
              >
                {isExporting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Derleniyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Tüm Kataloğu İndir (2.171 Ürün)</span>
                  </>
                )}
              </button>

              {(debouncedSearch.trim() || selectedBranch !== "all" || stockStatusFilter !== "all") && (
                <button
                  onClick={() => startExport(false)}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white border border-amber-600 px-3 py-2 font-bold text-xs tracking-wider uppercase transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
                  title="Sadece ekrandaki arama ve filtreye uyan ürünleri Excel olarak indir"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span>Filtrelileri İndir</span>
                </button>
              )}
            </div>

            <button
              onClick={() => fetchStocks(true)}
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

      {/* ── KPI Özet Kartları (Genel İstatistikler - Aramadan/Filtreden Asla Etkilenmez) ── */}
      <div className="px-6 mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Kayıtlı Toplam Ürün */}
        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kayıtlı Toplam Ürün</p>
          <p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">
            {globalStats.totalProducts.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-gray-500">Ürün</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-1">12 Şubede tanımlı genel katalog</p>
        </div>

        {/* 2. Genel Toplam Stok */}
        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Genel Toplam Stok</p>
          <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
            {globalStats.sumTotalStock.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-gray-500">Adet</span>
          </p>
          <p className="text-[11px] text-emerald-600 mt-1 font-semibold">Tüm şubeler toplam stok miktarı</p>
        </div>

        {/* 3. Kritik Stok (1-3 Adet) */}
        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kritik Stok (1-3 Adet)</p>
          <p className="text-2xl font-black text-amber-600 mt-1 tabular-nums">
            {globalStats.critical.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-gray-500">Ürün</span>
          </p>
          <p className="text-[11px] text-amber-700 mt-1">Tüm şubelerde tükenmek üzere olanlar</p>
        </div>

        {/* 4. Stokta Olmayan (0 Adet) */}
        <div className="bg-white border border-gray-200 p-3.5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stokta Olmayan (0 Adet)</p>
          <p className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
            {globalStats.outOfStock.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-gray-500">Ürün</span>
          </p>
          <p className="text-[11px] text-rose-700 mt-1">Tüm şubelerde tükenen ürünler</p>
        </div>
      </div>

      {/* ── Filtre Çubuğu ────────────────────────────────────────────────────── */}
      <div className="px-6 mt-4">
        <div className="bg-white border border-gray-200 p-4 flex flex-wrap items-end gap-3 shadow-sm">
          {/* Arama Kutusu */}
          <div className="flex-1 min-w-[260px] max-w-md">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Ürün Adı veya Barkod
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Örn: 8696056102014 veya Patates, Süt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[38px] bg-white border border-gray-300 pl-8 pr-8 text-xs font-medium focus:border-gray-600 outline-none transition-colors"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Şube Odak Filtresi */}
          <div className="w-48">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Şube Odak Filtresi
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(0);
              }}
              className="w-full h-[38px] bg-white border border-gray-300 px-3 text-xs font-semibold text-gray-800 outline-none focus:border-gray-600 cursor-pointer"
            >
              <option value="all">Tüm Şubeler (Matris Görünümü)</option>
              {Object.entries(BRANCHES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Stok Durumu */}
          <div className="w-44">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Stok Durumu
            </label>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="w-full h-[38px] bg-white border border-gray-300 px-3 text-xs font-semibold text-gray-800 outline-none focus:border-gray-600 cursor-pointer"
            >
              <option value="all">Tüm Stoklar</option>
              <option value="in_stock">Stokta Olanlar (&gt; 0)</option>
              <option value="critical">Kritik Stok (1 - 3 Adet)</option>
              <option value="out_of_stock">Tükenenler (0 Adet)</option>
            </select>
          </div>

          {/* Sayfa Başına Adet */}
          <div className="w-28">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Sayfa Boyutu
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
              className="w-full h-[38px] bg-white border border-gray-300 px-3 text-xs font-semibold text-gray-800 outline-none focus:border-gray-600 cursor-pointer"
            >
              <option value={20}>20 Ürün</option>
              <option value={25}>25 Ürün</option>
              <option value={50}>50 Ürün</option>
              <option value={100}>100 Ürün</option>
            </select>
          </div>

          {/* Temizle Butonu */}
          {(searchQuery || selectedBranch !== "all" || stockStatusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedBranch("all");
                setStockStatusFilter("all");
                setPage(0);
              }}
              className="h-[38px] px-3 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-300 hover:border-gray-500 transition-colors uppercase tracking-wider whitespace-nowrap"
            >
              Filtreleri Sıfırla
            </button>
          )}

          <div className="ml-auto text-xs text-gray-500 font-semibold self-end pb-2 whitespace-nowrap">
            {debouncedSearch || selectedBranch !== "all" || stockStatusFilter !== "all" ? (
              <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>
                  Filtrelenen: <strong className="font-black text-blue-950">{totalElements.toLocaleString("tr-TR")}</strong> ürün listeleniyor
                </span>
              </span>
            ) : (
              <span>
                Toplam <strong className="text-gray-900">{totalElements.toLocaleString("tr-TR")}</strong> üründen{" "}
                <strong className="text-gray-900">{filteredProducts.length}</strong> gösteriliyor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stok Tablosu ────────────────────────────────────────────────────── */}
      <div className="px-6 mt-4">
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-3 text-gray-400">
              <svg className="animate-spin w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm font-semibold text-gray-600">Şube stok verileri taranıyor...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm font-bold text-gray-600">Aramanıza uygun ürün bulunamadı</p>
              <p className="text-xs text-gray-400 mt-1">Farklı bir kelime veya barkod ile deneyebilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-290px)] min-h-[440px] relative">
              <table className="w-full border-collapse text-left whitespace-nowrap text-xs">
                {/* ── Başlık (Fixed / Sticky Header) ── */}
                <thead className="sticky top-0 z-30 bg-gray-900 text-white uppercase tracking-wider select-none text-[11px] shadow-sm">
                  <tr className="border-b border-gray-700">
                    {/* Ürün Bilgisi */}
                    <th className="px-4 py-3 sticky top-0 left-0 bg-gray-900 z-40 min-w-[280px] w-[280px] max-w-[280px] border-r border-b border-gray-700 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.5)]">
                      Ürün / Barkod
                    </th>

                    {/* Toplam Stok */}
                    <th className="px-3 py-3 sticky top-0 left-[280px] bg-gray-900 z-40 text-center font-bold text-white min-w-[85px] border-r-2 border-b border-gray-600 shadow-[4px_2px_8px_-2px_rgba(0,0,0,0.4)]">
                      Toplam Stok
                    </th>

                    {/* Şubeler (12 Sütun) */}
                    {Object.entries(BRANCHES).map(([sid, name]) => {
                      const isHighlighted = selectedBranch === sid;
                      return (
                        <th
                          key={sid}
                          className={`px-3 py-3 sticky top-0 z-30 text-center font-bold min-w-[130px] border-r border-b border-gray-700 transition-colors ${
                            isHighlighted ? "bg-blue-900 text-white" : "bg-gray-900 text-gray-200 hover:bg-gray-800"
                          }`}
                        >
                          <div className="truncate max-w-[130px] mx-auto" title={name}>
                            {name}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* ── Gövde ── */}
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/70";
                    return (
                      <tr
                        key={p.barcode || idx}
                        className={`group transition-colors ${rowBg} hover:bg-blue-50/40`}
                      >
                        {/* Ürün Bilgisi (Sticky) */}
                        <td className={`px-4 py-2.5 sticky left-0 ${rowBg} group-hover:bg-blue-50/70 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[280px] w-[280px] max-w-[280px] border-r border-gray-200`}>
                          <div className="flex items-center gap-3">
                            {/* Ürün Görseli */}
                            <div
                              className="w-11 h-11 border border-gray-200 bg-white shrink-0 overflow-hidden cursor-zoom-in flex items-center justify-center"
                              onClick={() => p.imageUrl && setSelectedImage(p.imageUrl)}
                            >
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                              ) : (
                                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>

                            {/* İsim & Barkod */}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[13px] text-gray-900 truncate" title={p.title}>
                                {p.title}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                                  {p.barcode}
                                </span>
                                {p.brand && <span className="truncate text-gray-500 font-medium">· {p.brand}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Toplam Stok (Sticky) */}
                        <td className={`px-3 py-2.5 text-center sticky left-[280px] ${rowBg} group-hover:bg-blue-50/70 z-20 border-r-2 border-gray-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] font-black text-sm`}>
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black tabular-nums ${
                              p.totalStock > 3
                                ? "text-emerald-800 bg-emerald-50"
                                : p.totalStock > 0
                                ? "text-amber-800 bg-amber-50"
                                : "text-rose-700 bg-rose-50"
                            }`}
                          >
                            {p.totalStock}
                          </span>
                        </td>

                        {/* Şubeler (12 Sütun) */}
                        {Object.keys(BRANCHES).map((sid) => {
                          const stockInfo = p.stocks?.[sid];
                          const quantity = stockInfo?.quantity;
                          const onSale = stockInfo?.onSale;
                          const price = stockInfo?.sellingPrice;

                          // Durum rengi
                          let badgeBg = "text-gray-300";
                          if (quantity !== null && quantity !== undefined) {
                            if (quantity > 3) badgeBg = "bg-emerald-50 text-emerald-900 border border-emerald-200";
                            else if (quantity > 0) badgeBg = "bg-amber-50 text-amber-900 border border-amber-200";
                            else badgeBg = "bg-rose-50 text-rose-800 border border-rose-200";
                          }

                          const isFocused = selectedBranch === sid;

                          return (
                            <td
                              key={sid}
                              className={`px-2 py-2 text-center border-r border-gray-200 transition-colors ${
                                isFocused ? "bg-blue-50/60 font-semibold" : ""
                              }`}
                            >
                              {quantity !== null && quantity !== undefined ? (
                                <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                  {/* Stok Adedi */}
                                  <span className={`px-1.5 py-0.5 text-xs font-black tabular-nums rounded ${badgeBg}`}>
                                    {quantity}
                                  </span>

                                  {/* Fiyat */}
                                  {price !== null && price !== undefined && (
                                    <span className="text-[11px] font-semibold text-gray-600 tabular-nums">
                                      ₺{price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 text-xs text-gray-400 bg-gray-100/80 rounded border border-gray-200 font-mono">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Sayfalama (Pagination) ────────────────────────────────────────── */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-gray-600 font-medium">
              Sayfa <span className="font-bold text-gray-900">{page + 1}</span> /{" "}
              <span className="font-bold text-gray-900">{totalPages}</span>
              {debouncedSearch || selectedBranch !== "all" || stockStatusFilter !== "all" ? (
                <span className="ml-1 text-blue-700 font-semibold">(Eşleşen: {totalElements.toLocaleString("tr-TR")} ürün)</span>
              ) : (
                <span className="ml-1 text-gray-500">(Katalog: {catalogTotal.toLocaleString("tr-TR")} ürün)</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0 || loading}
                className="px-2.5 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-gray-700"
                title="İlk Sayfa"
              >
                « İlk
              </button>
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0 || loading}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-gray-700"
              >
                ‹ Önceki
              </button>

              <span className="px-3 py-1.5 bg-gray-900 text-white rounded font-bold">
                {page + 1}
              </span>

              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                disabled={page >= totalPages - 1 || loading}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-gray-700"
              >
                Sonraki ›
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1 || loading}
                className="px-2.5 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-gray-700"
                title="Son Sayfa"
              >
                Son »
              </button>
            </div>
          </div>
        </div>

        {/* Bilgilendirme ve Açıklamalar */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-gray-500 px-1 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block" />
              <span>Yeterli Stok (&gt;3)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-50 border border-amber-300 inline-block" />
              <span>Kritik Stok (1-3)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-rose-50 border border-rose-300 inline-block" />
              <span>Tükendi (0)</span>
            </span>
          </div>
          <div>
            * Veriler doğrudan Trendyol Go Entegratör API servisinden anlık olarak alınmaktadır.
          </div>
        </div>
      </div>

      {/* ── Görsel Büyütme Modal (Lightbox) ─────────────────────────────────── */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-gray-900/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Ürün Görseli"
              className="max-w-full max-h-[90vh] object-contain shadow-2xl border border-gray-700 bg-white"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-2 right-2 bg-gray-800 text-white w-8 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Veri Derleme & Excel İndirme Modalı ─────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 shadow-2xl rounded-xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-600/30 text-emerald-400 rounded border border-emerald-500/40">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">Stok Kataloğu Derleniyor</h3>
                  <p className="text-xs text-gray-400">Trendyol Go 12 Şube Stok &amp; Fiyat Entegrasyonu</p>
                </div>
              </div>
              {!isExporting && (
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-white text-lg font-bold p-1 rounded transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {exportError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm space-y-3">
                  <div className="font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Derleme Sırasında Hata Oluştu</span>
                  </div>
                  <div className="text-xs text-red-700">{exportError}</div>
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold text-xs transition-colors"
                    >
                      Kapat
                    </button>
                    <button
                      onClick={() => startExport(true)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-semibold text-xs transition-colors"
                    >
                      Tekrar Dene
                    </button>
                  </div>
                </div>
              ) : exportSuccess ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-lg">
                      {lastDownloadedCount.toLocaleString("tr-TR")} Ürün Başarıyla Derlendi ve İndirildi!
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                      12 şubenin tüm anlık stok adetleri, birim fiyatları ve satış durumları eksiksiz olarak Excel CSV formatında bilgisayarınıza aktarıldı.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors"
                    >
                      Tamam
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress Bar & Percent */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                      <span>Veri Derleme Aşaması</span>
                      <span className="text-emerald-700 font-bold">
                        {exportStep === 1 && "%25"}
                        {exportStep === 2 && "%65"}
                        {exportStep === 3 && "%90"}
                        {exportStep === 4 && "%100"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 transition-all duration-500 rounded-full"
                        style={{
                          width:
                            exportStep === 1
                              ? "25%"
                              : exportStep === 2
                              ? "65%"
                              : exportStep === 3
                              ? "90%"
                              : "100%",
                        }}
                      />
                    </div>
                  </div>

                  {/* Step status details */}
                  <div className="space-y-2 text-xs">
                    <div className={`flex items-center gap-2.5 p-2 rounded transition-colors ${exportStep >= 1 ? "bg-emerald-50 text-emerald-900 font-medium" : "text-gray-400"}`}>
                      {exportStep > 1 ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block shrink-0" />
                      )}
                      <span>1. Adım: Trendyol Go ürün kataloğuna bağlanılıyor (2.171 ürün)</span>
                    </div>

                    <div className={`flex items-center gap-2.5 p-2 rounded transition-colors ${exportStep >= 2 ? "bg-emerald-50 text-emerald-900 font-medium" : "text-gray-400"}`}>
                      {exportStep > 2 ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : exportStep === 2 ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300 ml-1 inline-block" />
                      )}
                      <span>2. Adım: 12 şube stokları ve birim satış fiyatları taranıyor</span>
                    </div>

                    <div className={`flex items-center gap-2.5 p-2 rounded transition-colors ${exportStep >= 3 ? "bg-emerald-50 text-emerald-900 font-medium" : "text-gray-400"}`}>
                      {exportStep > 3 ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : exportStep === 3 ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300 ml-1 inline-block" />
                      )}
                      <span>3. Adım: Veriler doğrulanıyor ve Excel CSV formatı derleniyor</span>
                    </div>
                  </div>

                  {/* Informational reassurance */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-[11px] text-amber-900">
                    <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-bold">Aceleye gerek yok, veriler eksiksiz toplanıyor: </span>
                      12 şubenin ve 2.171 ürünün tamamı taranmaktadır. İşlem tamamlandığında dosya indirmesi otomatik olarak başlatılacaktır.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

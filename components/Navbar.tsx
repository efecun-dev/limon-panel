"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Ana Sayfa",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    statsKey: null as null | "reviews" | "orders" | "returns",
  },
  {
    href: "/yorumlar",
    label: "Yorum Yönetimi",
    icon: <img src="/trendyol.png" alt="Trendyol" className="w-4 h-4 rounded-sm" />,
    statsKey: "reviews" as const,
  },
  {
    href: "/siparisler",
    label: "Sipariş Yönetimi",
    icon: <img src="/trendyol.png" alt="Trendyol" className="w-4 h-4 rounded-sm" />,
    statsKey: "orders" as const,
  },
  {
    href: "/iadeler",
    label: "İade Yönetimi",
    icon: <img src="/trendyol.png" alt="Trendyol" className="w-4 h-4 rounded-sm" />,
    statsKey: "returns" as const,
  },
];

const INSTAGRAM_ITEM = {
  href: "/instagram-yorumlari",
  label: "Instagram",
  icon: <img src="/instagram.png" alt="Instagram" className="w-4 h-4 rounded-sm object-cover" />,
};

export default function Navbar() {
  const pathname = usePathname();
  const [stats, setStats] = useState({ reviews: 0, orders: 0, returns: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // Don't fetch if we are on the login page
      if (pathname === "/login") return;

      try {
        const [reviewsRes, ordersRes, claimsRes] = await Promise.all([
          fetch("/api/reviews").then((r) => r.json()).catch(() => null),
          fetch("/api/siparisler").then((r) => r.json()).catch(() => null),
          fetch("/api/iadeler").then((r) => r.json()).catch(() => null),
        ]);

        let reviewsToday = 0;
        if (reviewsRes?.content) {
          const today = new Date().toLocaleDateString("tr-TR");
          reviewsToday = reviewsRes.content.filter(
            (r: any) => new Date(r.creationDate).toLocaleDateString("tr-TR") === today
          ).length;
        }

        let activeOrders = 0;
        if (ordersRes?.content) {
          activeOrders = ordersRes.content.filter((o: any) =>
            ["Created", "Picking", "Invoiced", "Shipped"].includes(o.packageStatus)
          ).length;
        }

        let activeReturns = 0;
        if (claimsRes?.content) {
          activeReturns = claimsRes.content.filter((c: any) => {
            const status = c.claimItems?.[0]?.claimItemStatus?.name;
            return ["Created", "WaitingInAction", "Unresolved"].includes(status);
          }).length;
        }

        setStats({ reviews: reviewsToday, orders: activeOrders, returns: activeReturns });
      } catch (err) {
        console.error("Stats fetching error", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    const handleReviews = (e: any) => {
      const res = e.detail;
      if (!res?.content) return;
      const today = new Date().toLocaleDateString("tr-TR");
      const count = res.content.filter(
        (r: any) => new Date(r.creationDate).toLocaleDateString("tr-TR") === today
      ).length;
      setStats((prev) => ({ ...prev, reviews: count }));
    };

    const handleOrders = (e: any) => {
      const res = e.detail;
      if (!res?.content) return;
      const count = res.content.filter((o: any) =>
        ["Created", "Picking", "Invoiced", "Shipped"].includes(o.packageStatus)
      ).length;
      setStats((prev) => ({ ...prev, orders: count }));
    };

    const handleReturns = (e: any) => {
      const res = e.detail;
      if (!res?.content) return;
      const count = res.content.filter((c: any) => {
        const status = c.claimItems?.[0]?.claimItemStatus?.name;
        return ["Created", "WaitingInAction", "Unresolved"].includes(status);
      }).length;
      setStats((prev) => ({ ...prev, returns: count }));
    };

    window.addEventListener("tgo:reviewsFetched", handleReviews);
    window.addEventListener("tgo:ordersFetched", handleOrders);
    window.addEventListener("tgo:returnsFetched", handleReturns);

    return () => {
      clearInterval(interval);
      window.removeEventListener("tgo:reviewsFetched", handleReviews);
      window.removeEventListener("tgo:ordersFetched", handleOrders);
      window.removeEventListener("tgo:returnsFetched", handleReturns);
    };
  }, [pathname]);

  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 z-50 bg-red-900 border-b border-gray-700">
      <div className="w-full px-4 md:px-6 flex items-center h-12 overflow-x-auto no-scrollbar gap-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 pr-4 md:pr-6 border-r border-gray-700 mr-2 shrink-0">
          <img
            src="/limon.jpg"
            alt="Limon Logo"
            className="w-6 h-6 rounded-full object-cover border border-gray-600"
          />
          <span className="font-extrabold text-[13px] text-white tracking-widest uppercase">
            Limon Panel
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center h-full">
          {NAV_ITEMS.map((item, i) => {
            const isActive = pathname === item.href;
            const badge = item.statsKey ? stats[item.statsKey] : 0;

            return (
              <div key={item.href} className="flex items-center">
                {/* Separator before Instagram group */}
                {i > 0 && i === 1 && (
                  <div className="w-px h-4 bg-gray-700 mx-2" />
                )}
                <Link
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 h-12 text-[13px] font-semibold tracking-wide transition-colors select-none ${isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-200"
                    }`}
                >
                  {/* Active bottom line */}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
                  )}
                  {item.icon}
                  {item.label}
                  {badge > 0 && (
                    <span className="bg-white text-gray-900 text-[10px] font-black px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                      {badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}

          {/* Divider before Instagram */}
          <div className="w-px h-4 bg-gray-700 mx-2" />

          <Link
            href={INSTAGRAM_ITEM.href}
            className={`relative flex items-center gap-1.5 px-3 h-12 text-[13px] font-semibold tracking-wide transition-colors select-none ${pathname === INSTAGRAM_ITEM.href
                ? "text-white"
                : "text-gray-400 hover:text-gray-200"
              }`}
          >
            {pathname === INSTAGRAM_ITEM.href && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
            )}
            {INSTAGRAM_ITEM.icon}
            {INSTAGRAM_ITEM.label}
          </Link>
        </div>

        {/* Logout */}
        <div className="ml-auto flex items-center">
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-md transition-colors text-[12px] font-bold tracking-wide"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ÇIKIŞ
          </button>
        </div>
      </div>
    </nav>
  );
}

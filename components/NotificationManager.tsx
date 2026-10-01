"use client";

import { useEffect, useRef } from "react";
import axios from "axios";

import { BRANCHES } from "@/lib/branches";

import { usePathname } from "next/navigation";

export function NotificationManager() {
  const pathname = usePathname();
  const lastKnownOrderIds = useRef<Set<string>>(new Set());
  const lastKnownReviewIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    // Bildirim izni iste
    if (!isLoginPage && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const fetchUpdates = async () => {
      // Don't fetch if we are on the login page to prevent 401 errors
      if (isLoginPage) return;

      try {
        const [ordersRes, reviewsRes] = await Promise.all([
          axios.get(`/api/siparisler?t=${Date.now()}`),
          axios.get(`/api/reviews?storeIds=${Object.keys(BRANCHES).join(",")}&t=${Date.now()}`)
        ]);

        const currentOrders = ordersRes.data?.content || [];
        const currentReviews = reviewsRes.data?.content || [];

        const newOrderIds = new Set<string>();
        const newReviewIds = new Set<string>();

        let hasNewOrder = false;
        let hasNewReview = false;

        currentOrders.forEach((order: any) => {
          if (order.id) newOrderIds.add(order.id.toString());
        });

        currentReviews.forEach((review: any) => {
          if (review.id) newReviewIds.add(review.id.toString());
        });

        // İlk yüklemede bildirim atma, sadece listeyi doldur
        if (isFirstLoad.current) {
          lastKnownOrderIds.current = newOrderIds;
          lastKnownReviewIds.current = newReviewIds;
          isFirstLoad.current = false;
          return;
        }

        // Yeni siparişleri kontrol et
        const newOrders = currentOrders.filter((order: any) => order.id && !lastKnownOrderIds.current.has(order.id.toString()));
        if (newOrders.length > 0) {
          hasNewOrder = true;
          newOrders.forEach((order: any) => {
            axios.post('/api/telegram', {
              type: 'order',
              orderNumber: order.orderNumber,
              totalPrice: order.totalPrice,
              currencyCode: order.currencyCode,
              customer: order.customer,
              storeId: order.storeId,
              lines: order.lines,
              note: order.customer?.note
            }).catch(err => console.error("Telegram bildirim hatası:", err));
          });
        }

        // Yeni yorumları kontrol et
        newReviewIds.forEach(id => {
          if (!lastKnownReviewIds.current.has(id)) {
            hasNewReview = true;
          }
        });

        if (hasNewOrder && Notification.permission === "granted") {
          new Notification("Yeni Sipariş Geldi!", {
            body: "Sisteme yeni bir sipariş düştü. Detaylar için Siparişler sekmesini kontrol edin.",
            icon: "/limonlogo.png"
          });
        }

        if (hasNewReview && Notification.permission === "granted") {
          new Notification("Yeni Yorum Geldi!", {
            body: "Yeni bir değerlendirme/yorum aldınız. Yorumlar panelini kontrol edin.",
            icon: "/limonlogo.png"
          });
        }

        lastKnownOrderIds.current = newOrderIds;
        lastKnownReviewIds.current = newReviewIds;
      } catch (err: any) {
        // 401 Hatalarını konsola basıp kirletmemek için sessizce geçiştir
        if (err?.response?.status === 401) {
          return;
        }
        console.error("Bildirim servisi hata aldı:", err);
      }
    };

    if (!isLoginPage) {
      fetchUpdates();
      const interval = setInterval(fetchUpdates, 5000);
      return () => clearInterval(interval);
    }
  }, [pathname, isLoginPage]);

  return null;
}

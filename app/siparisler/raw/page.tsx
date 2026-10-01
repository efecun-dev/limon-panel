"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function RawSiparislerPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    setLoading(true);
    setError(null);
    axios.get("/api/siparisler")
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err?.response?.data || err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-8 font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Ham API Verisi Görüntüleyici</h1>
          <button 
            onClick={fetchOrders}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {loading ? "Yükleniyor..." : "Tekrar İstek At"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-500 text-white p-4 rounded mb-6 overflow-auto">
            <h2 className="font-bold text-red-300 mb-2">API Hatası:</h2>
            <pre>{JSON.stringify(error, null, 2)}</pre>
          </div>
        )}

        <div className="bg-black border border-gray-700 rounded-lg p-6 overflow-auto shadow-2xl h-[75vh]">
          {loading ? (
            <div className="animate-pulse text-gray-500">Trendyol'dan veriler çekiliyor...</div>
          ) : data ? (
            <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

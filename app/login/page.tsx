"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.message || "Giriş başarısız.");
      }
    } catch (err) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: "Aktif Şube", value: "12" },
    { label: "Anlık Takip", value: "7/24" },
    { label: "Sipariş Analizi", value: "∞" },
  ];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }

        .fade-in       { animation: fadeIn 0.6s ease forwards; }
        .fade-in-delay { animation: fadeIn 0.6s ease 0.2s forwards; opacity: 0; }
        .float-anim    { animation: float 4s ease-in-out infinite; }
        .shimmer-btn {
          background: linear-gradient(90deg, #f97316 0%, #fb923c 40%, #fdba74 50%, #fb923c 60%, #f97316 100%);
          background-size: 200% 100%;
          animation: shimmer 2.5s linear infinite;
        }

        .glass-card {
          background: rgba(255,255,255,0.07);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .input-field {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .input-field::placeholder { color: rgba(255,255,255,0.35); }
        .input-field:focus {
          outline: none;
          border-color: #f97316;
          background: rgba(255,255,255,0.10);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.20);
        }
        .input-field:autofill,
        .input-field:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(30,30,50,0.9) inset;
          -webkit-text-fill-color: #fff;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .orb {
          border-radius: 50%;
          filter: blur(80px);
          position: absolute;
          pointer-events: none;
        }
      `}</style>

      {/* ── Sol Panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #24243e 100%)" }}
      >
        {/* Decorative orbs */}
        <div className="orb w-[500px] h-[500px] top-[-120px] left-[-100px]"
          style={{ background: "rgba(249,115,22,0.18)" }} />
        <div className="orb w-[350px] h-[350px] bottom-[-80px] right-[-60px]"
          style={{ background: "rgba(168,85,247,0.14)" }} />
        <div className="orb w-[250px] h-[250px] top-[40%] left-[30%]"
          style={{ background: "rgba(59,130,246,0.10)" }} />

        {/* Top bar */}
        <div className="relative z-10 flex items-center gap-3 p-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Limon Panel</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-12 pb-8">
          {/* Floating icon */}
          <div className="float-anim mb-8 inline-flex">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", boxShadow: "0 20px 60px rgba(249,115,22,0.35)" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
            </div>
          </div>

          <h2 className="text-4xl font-black text-white mb-4 leading-tight">
            Sipariş & Ciro<br />
            <span style={{ background: "linear-gradient(90deg, #f97316, #fb923c, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Merkezi Yönetim
            </span>
          </h2>
          <p className="text-base mb-10" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            Tüm şubelerinizin anlık siparişlerini, cirolarını ve müşteri yorumlarını tek bir ekranda takip edin.
          </p>

          {/* Stats row */}
          <div className="flex gap-4 mb-10">
            {stats.map((s) => (
              <div key={s.label} className="stat-card rounded-xl px-5 py-4 flex-1 text-center">
                <div className="text-2xl font-black text-white mb-1">{s.value}</div>
                <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature list */}
          {[
            "Anlık sipariş bildirimleri",
            "Şube bazlı ciro analizi",
            "Müşteri yorum takibi",
            "30 günlük trend grafikleri",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.4)" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3"/>
                </svg>
              </div>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Bottom footer */}
        <div className="relative z-10 px-12 py-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            © 2024 Limon Panel — Tüm şube verileri güvende
          </p>
        </div>
      </div>

      {/* ── Sağ Panel – Login Form ── */}
      <div
        className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a1040 0%, #0f0c29 100%)" }}
      >
        {/* Subtle orb behind form */}
        <div className="orb w-[400px] h-[400px]"
          style={{ background: "rgba(249,115,22,0.08)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />

        <div className="relative z-10 w-full max-w-sm fade-in">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg">Limon Panel</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Hoş Geldiniz</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Devam etmek için giriş yapın
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="fade-in mb-6 flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5 fade-in-delay">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                Kullanıcı Adı
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin(e as any)}
                  required
                  placeholder="Kullanıcı adı"
                  className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                Şifre
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin(e as any)}
                  required
                  placeholder="••••••••"
                  className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white text-sm font-bold tracking-wide mt-2"
              style={
                loading
                  ? { background: "rgba(249,115,22,0.4)", cursor: "not-allowed" }
                  : { background: "linear-gradient(90deg, #ea580c, #f97316)", boxShadow: "0 8px 32px rgba(249,115,22,0.35)" }
              }
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                  </svg>
                  Giriş Yapılıyor...
                </span>
              ) : (
                "Giriş Yap →"
              )}
            </button>
          </form>

          {/* Divider info */}
          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Sistem aktif — Veriler anlık güncelleniyor
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

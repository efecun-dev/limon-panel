"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function InstagramYorumlariPage() {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Yanıt (Reply) state'leri
  const [activeTab, setActiveTab] = useState<"unanswered" | "all">("unanswered");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});

  const fetchComments = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch("/api/instagram");
      const data = await response.json();
      
      if (data && data.content) {
        setComments(data.content);
        setIsConnected(data.connected);
      }
    } catch (error) {
      console.error("Instagram yorumları çekilirken hata:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(() => {
      fetchComments(false);
    }, 15000); 
    return () => clearInterval(interval);
  }, []);

  const handleReplySubmit = async (commentId: string) => {
    const text = replyTexts[commentId] || "";
    if (!text.trim()) return;
    
    setSubmittingIds(prev => ({...prev, [commentId]: true}));

    try {
      const res = await fetch("/api/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, message: text })
      });

      if (res.ok) {
        // Başarılıysa geçici olarak (optimistic) UI'ı güncelle
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: {
                data: [
                  ...(c.replies?.data || []),
                  { id: "temp_" + Date.now(), text: text, username: "Siz (Gönderiliyor...)", timestamp: new Date().toISOString() }
                ]
              }
            };
          }
          return c;
        }));
        setReplyTexts(prev => ({...prev, [commentId]: ""}));
        // Kısa süre sonra gerçek veriyi çek
        setTimeout(() => fetchComments(false), 2000);
      } else {
        alert("Yanıtlama başarısız. Lütfen API ayarlarınızı kontrol edin.");
      }
    } catch (error) {
      console.error(error);
      alert("Bir hata oluştu.");
    } finally {
      setSubmittingIds(prev => ({...prev, [commentId]: false}));
    }
  };

  const filteredComments = comments.filter(c => {
    const searchMatch = c.text?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       c.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const hasReplies = c.replies && c.replies.data && c.replies.data.length > 0;
    const tabMatch = activeTab === "all" ? true : !hasReplies;
    
    return searchMatch && tabMatch;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        
        {/* Başlık ve Butonlar */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
              <img src="/instagram.png" alt="Instagram" className="w-8 h-8 rounded-md object-cover" />
              Instagram Yorumları
            </h1>
            <p className="text-gray-500 mt-2 font-medium">Gönderilerinize gelen yorumları tek ekrandan takip edin.</p>
          </div>
          <div className="flex items-center gap-4">
            {!isConnected && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-md border border-red-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                API Bilgileri Eksik (Örnek Veri Gösteriliyor)
              </span>
            )}
            <button 
              onClick={() => fetchComments(true)}
              className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer"
            >
              Yenile
            </button>
          </div>
        </div>

        {/* Bilgilendirme Kartı */}
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-6">
            <h3 className="text-sm font-bold text-blue-800 mb-1">Kurulum Gerekli</h3>
            <p className="text-sm text-blue-600">
              Gerçek Instagram yorumlarınızı görebilmek için <code>.env.local</code> dosyanıza <strong>INSTAGRAM_ACCOUNT_ID</strong> ve <strong>INSTAGRAM_ACCESS_TOKEN</strong> bilgilerinizi girmelisiniz.
            </p>
          </div>
        )}

        {/* Sekmeler */}
        <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab("unanswered")}
            className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === "unanswered" ? "border-slate-600 text-slate-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Yanıt Bekleyenler
            {comments.filter(c => !(c.replies && c.replies.data && c.replies.data.length > 0)).length > 0 && (
               <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                 {comments.filter(c => !(c.replies && c.replies.data && c.replies.data.length > 0)).length}
               </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("all")}
            className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === "all" ? "border-slate-600 text-slate-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Tüm Yorumlar
          </button>
        </div>

        {/* Filtreler */}
        <div className="bg-white border border-gray-200 p-4 rounded-md mb-6">
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Yorum İçinde veya Kullanıcı Adında Ara</label>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="text-xs text-slate-600 hover:text-slate-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                Temizle
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Örn: çok güzel, elif, kargo..."
            className="w-full border border-gray-300 rounded-md bg-gray-50 p-2.5 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-600"></div>
             <p className="text-gray-500 text-sm font-medium animate-pulse">Instagram yorumları çekiliyor...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Yorum Bulunamadı</h3>
            <p className="text-gray-500">Mevcut filtrelere uygun veya son gönderilerinizde herhangi bir yorum bulunmuyor.</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {filteredComments.map((comment) => {
              const dateObj = new Date(comment.timestamp);
              
              return (
                <div key={comment.id} className="bg-white border border-gray-200 rounded-md hover:border-slate-300 transition-colors flex flex-col md:flex-row">
                  
                  {/* Sol: Gönderi Görseli */}
                  <div className="bg-gray-50 p-4 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col justify-center items-center md:w-32 shrink-0">
                    <div 
                      className="w-16 h-16 rounded-sm overflow-hidden cursor-zoom-in ring-1 ring-gray-200 relative group"
                      onClick={() => setSelectedImage(comment.media?.media_url)}
                    >
                      <img src={comment.media?.media_url} alt="Gönderi" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                    </div>
                    <a href={comment.media?.permalink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-600 hover:text-slate-700 mt-2 flex items-center gap-1 text-center">
                      Gönderiye Git
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </div>

                  {/* Orta: Yorum Detayı */}
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">@{comment.username}</span>
                        {comment.like_count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded-sm border border-gray-200">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L12 8.343l3.172-3.171a4 4 0 115.656 5.656L12 21.414l-8.828-8.828a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                            {comment.like_count}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
                        {dateObj.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">{comment.text}</p>
                    
                    {/* Yanıtlar */}
                    {comment.replies && comment.replies.data && comment.replies.data.length > 0 && (
                      <div className="bg-gray-50 border-l-2 border-slate-500 pl-3 py-2 my-2 rounded-r-md">
                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Yanıtlarınız</div>
                        <div className="space-y-1.5">
                          {comment.replies.data.map((reply: any) => (
                            <div key={reply.id} className="text-xs">
                              <span className="font-bold text-gray-900">@{reply.username}: </span>
                              <span className="text-gray-700">{reply.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Yanıtlama Alanı */}
                    {(activeTab === "unanswered" || replyTexts[comment.id] !== undefined) && !(comment.replies && comment.replies.data && comment.replies.data.length > 0) && (
                      <div className="bg-gray-50 border border-gray-200 p-3 rounded-md mt-3">
                        <textarea 
                          className="w-full text-sm p-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white"
                          rows={2}
                          placeholder={`@${comment.username} kullanıcısına yanıt ver...`}
                          value={replyTexts[comment.id] || ""}
                          onChange={(e) => setReplyTexts(prev => ({...prev, [comment.id]: e.target.value}))}
                        />
                        <div className="flex justify-end mt-2 gap-2">
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            disabled={submittingIds[comment.id] || !(replyTexts[comment.id] || "").trim()}
                            className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold px-4 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {submittingIds[comment.id] ? 'Gönderiliyor...' : 'Yanıtı Gönder'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sağ: Durum ve Hızlı Aksiyon */}
                  <div className="p-4 md:w-32 shrink-0 flex items-start justify-end md:justify-center border-t md:border-t-0 md:border-l border-gray-100 bg-gray-50/50">
                    {comment.replies && comment.replies.data && comment.replies.data.length > 0 ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Yanıtlandı
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Bekliyor
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Lightbox Modal (Gönderi Görseli için) */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
            <button
              className="absolute top-0 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img
              src={selectedImage}
              alt="Gönderi Büyük Boy"
              className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

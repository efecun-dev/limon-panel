import { NextResponse } from "next/server";
import axios from "axios";
import { redis } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(request: Request) {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    // API anahtarları yoksa mock (örnek) veri dönelim, tasarım görülebilsin
    return NextResponse.json(getMockData());
  }

  try {
    const cacheKey = `instagram_comments_${accountId}`;
    const cachedData = await redis.get(cacheKey).catch(() => null);
    
    if (cachedData) {
      return NextResponse.json(JSON.parse(cachedData));
    }

    // 1. Son 20 gönderiyi (media) çekelim
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${accountId}/media`, {
        params: {
          fields: 'id,caption,media_url,media_type,thumbnail_url,permalink,timestamp,comments_count',
          access_token: accessToken,
          limit: 20
        }
      }
    );

    const mediaList = mediaRes.data.data || [];
    let allComments: any[] = [];

    // 2. Sadece yorumu olan gönderiler için yorumları çekelim
    const fetchCommentsPromises = mediaList
      .filter((media: any) => media.comments_count > 0)
      .map(async (media: any) => {
        try {
          const commentsRes = await axios.get(
            `https://graph.facebook.com/v19.0/${media.id}/comments`, {
              params: {
                fields: 'id,text,timestamp,username,like_count,replies{id,text,username,timestamp}',
                access_token: accessToken,
                limit: 50 // Her gönderinin son 50 yorumu
              }
            }
          );
          
          const comments = commentsRes.data.data || [];
          // Yorumlara ait olduğu medya bilgisini de ekleyelim
          const commentsWithMedia = comments.map((comment: any) => ({
            ...comment,
            media: {
              id: media.id,
              caption: media.caption,
              media_url: media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url,
              permalink: media.permalink
            }
          }));
          
          allComments = [...allComments, ...commentsWithMedia];
        } catch (err) {
          console.error(`Medya ${media.id} yorumları çekilemedi:`, err);
        }
      });

    // Tüm yorum isteklerinin bitmesini bekle
    await Promise.all(fetchCommentsPromises);
    
    // Yorumları tarihe göre yeniden eskiye sıralayalım
    allComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // --- TELEGRAM BİLDİRİM MANTIĞI ---
    try {
      const lastSeenTimestampStr = await redis.get(`instagram_last_seen_${accountId}`);
      // İlk defa çalışıyorsa (veri yoksa) bildirim bombardımanı olmaması için mevcut en yeni yorumun tarihini baz alalım
      let lastSeenTimestamp = lastSeenTimestampStr ? parseInt(lastSeenTimestampStr) : (allComments.length > 0 ? new Date(allComments[0].timestamp).getTime() : 0);
      let newestTimestamp = lastSeenTimestamp;

      // Eskiden yeniye sıralayıp bildirim atalım ki sırayla düşsün
      const reversedComments = [...allComments].reverse();

      for (const comment of reversedComments) {
        const commentTime = new Date(comment.timestamp).getTime();
        
        // Sadece daha önce görmediğimiz yeni yorumları gönder
        if (commentTime > lastSeenTimestamp) {
          const message = `💬 <b>Yeni Instagram Yorumu!</b>\n\n` +
                          `👤 <b>@${comment.username || 'Kullanıcı'}</b> dedi ki:\n` +
                          `<i>"${comment.text}"</i>\n\n` +
                          `📸 <a href="${comment.media?.permalink || ''}">Gönderiye Git</a>`;
                          
          await sendTelegramMessage(message);
          
          if (commentTime > newestTimestamp) {
            newestTimestamp = commentTime;
          }
        }
      }

      // En yeni yorumun tarihini Redis'e kaydedelim
      if (newestTimestamp > lastSeenTimestamp) {
        await redis.set(`instagram_last_seen_${accountId}`, newestTimestamp.toString());
      }
    } catch (telegramErr) {
      console.error("Telegram bildirimleri gönderilirken hata:", telegramErr);
    }
    // ---------------------------------

    const result = {
      content: allComments,
      total: allComments.length,
      connected: true
    };

    // 2 dakika önbellekte (cache) tut (Meta API limitlerine takılmamak için)
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 120).catch(() => null);

    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error("Instagram verisi çekilirken hata:", error?.response?.data || error.message);
    return NextResponse.json(
      { error: "Instagram verileri çekilirken bir hata oluştu.", connected: true }, 
      { status: 500 }
    );
  }
}

// Token girilmediğinde sayfanın tasarımını görebilmek için örnek (mock) veri
function getMockData() {
  return {
    connected: false,
    content: [
      {
        id: "mock_comment_1",
        text: "Ürünler harika, çok taze geldi! Ellerinize sağlık 😍",
        timestamp: new Date().toISOString(),
        username: "ahmet_yilmaz",
        like_count: 5,
        media: {
          id: "mock_media_1",
          caption: "Bugün taptaze meyvelerimiz raflarda yerini aldı! #taze #meyve",
          media_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80",
          permalink: "https://instagram.com"
        },
        replies: {
          data: [
            { id: "mock_reply_1", text: "Afiyet olsun Ahmet Bey, her zaman bekleriz!", username: "limon_market", timestamp: new Date().toISOString() }
          ]
        }
      },
      {
        id: "mock_comment_2",
        text: "Fiyatlar diğer yerlere göre biraz yüksek ama kalite tartışılmaz.",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        username: "elif.karaca",
        like_count: 2,
        media: {
          id: "mock_media_2",
          caption: "Günün fırsatı! Peynir çeşitlerinde %20 indirim.",
          media_url: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=400&q=80",
          permalink: "https://instagram.com"
        }
      },
      {
        id: "mock_comment_3",
        text: "Siparişim ne zaman gelir acaba? Dün akşam vermiştim.",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        username: "caner_01",
        like_count: 0,
        media: {
          id: "mock_media_3",
          caption: "Hızlı teslimat için kuryelerimiz hazır!",
          media_url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=400&q=80",
          permalink: "https://instagram.com"
        }
      }
    ],
    total: 3
  };
}

export async function POST(request: Request) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "API anahtarı eksik." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { commentId, message } = body;

    if (!commentId || !message) {
      return NextResponse.json({ error: "Yorum ID ve mesaj gerekli." }, { status: 400 });
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}/replies`,
      {
        message: message
      },
      {
        params: {
          access_token: accessToken
        }
      }
    );

    return NextResponse.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("Yorum yanıtlama hatası:", error?.response?.data || error.message);
    return NextResponse.json(
      { error: "Yorum yanıtlanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}

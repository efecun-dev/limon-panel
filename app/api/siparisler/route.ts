import { NextResponse } from "next/server";
import axios from "axios";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get("orderNumber");

  // .env.local dosyasından gerçek bilgileri okuyoruz
  const supplierId = process.env.TRENDYOL_GO_SUPPLIER_ID;
  const agentName = process.env.TRENDYOL_GO_AGENTNAME;
  const executorUser = process.env.TRENDYOL_GO_EXECUTOR_USER;

  // Eğer bu bilgiler .env.local dosyasında doldurulmuşsa gerçek API'ye istek at
  if (supplierId && agentName && executorUser) {
    try {
      const pageParam = parseInt(searchParams.get("page") || "0", 10);
      const sizeParam = parseInt(searchParams.get("size") || "200", 10);
      const fetchDays = parseInt(searchParams.get("fetchDays") || "0", 10);

      // Cache key includes fetchDays so different date ranges don't collide
      const cacheKey = orderNumber
        ? `orders:${supplierId}:${orderNumber}`
        : fetchDays > 0
          ? `orders:${supplierId}:days:${fetchDays}`
          : `orders:${supplierId}`;
      const cachedData = await redis.get(cacheKey).catch(() => null);
      
      if (cachedData) {
        return NextResponse.json(JSON.parse(cachedData));
      }

      let filteredContent: any[] = [];
      let totalPages = 1;
      let totalElements = 0;

      if (fetchDays > 0) {
        const cutoffDate = Date.now() - (fetchDays * 24 * 60 * 60 * 1000);
        let keepFetching = true;
        let page = 0;
        
        while (keepFetching && page < totalPages) {
          const response = await axios.get(
            `https://api.tgoapis.com/integrator/order/grocery/suppliers/${supplierId}/packages`,
            {
              headers: {
                "Authorization": `Basic ${process.env.TRENDYOL_TOKEN}`,
                "x-agentname": agentName,
                "x-executor-user": executorUser,
              },
              params: { size: 200, page: page }
            }
          );
          
          if (response.data?.content && response.data.content.length > 0) {
            filteredContent = filteredContent.concat(response.data.content);
            const lastItem = response.data.content[response.data.content.length - 1];
            if (lastItem && lastItem.orderDate < cutoffDate) {
              keepFetching = false;
            }
          } else {
            keepFetching = false;
          }
          
          totalPages = response.data?.totalPages || 1;
          totalElements = response.data?.totalElements || filteredContent.length;
          page++;
        }
        
        // Sadece istenen süre içindeki siparişleri tut
        filteredContent = filteredContent.filter((pkg: any) => pkg.orderDate >= cutoffDate);
      } else {
        const response = await axios.get(
          `https://api.tgoapis.com/integrator/order/grocery/suppliers/${supplierId}/packages`,
          {
            headers: {
              "Authorization": `Basic ${process.env.TRENDYOL_TOKEN}`,
              "x-agentname": agentName,
              "x-executor-user": executorUser,
            },
            params: {
              orderNumber: orderNumber || undefined,
              size: sizeParam,
              page: pageParam,
            }
          }
        );
        
        filteredContent = response.data?.content || [];
        totalPages = response.data?.totalPages || 1;
        totalElements = response.data?.totalElements || filteredContent.length;
      }
      
      if (orderNumber && fetchDays === 0) {
        filteredContent = filteredContent.filter((pkg: any) => pkg.orderNumber === orderNumber);
      }

      const responseData = {
        content: filteredContent,
        totalElements: totalElements,
        totalPages: totalPages,
        page: pageParam,
        executorUser: executorUser
      };

      // Güncel ay: 5 saniyelik kısa cache. Eski aylar: 1 saatlik uzun cache (veri değişmez)
      const now = new Date();
      const cutoffCheck = Date.now() - (fetchDays * 24 * 60 * 60 * 1000);
      const isCurrentMonth = new Date(cutoffCheck).getMonth() === now.getMonth() &&
                             new Date(cutoffCheck).getFullYear() === now.getFullYear();
      const cacheTTL = fetchDays <= 35 || isCurrentMonth ? 5 : 3600;
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', cacheTTL).catch(() => null);

      
      return NextResponse.json(responseData);
    } catch (error: any) {
      console.error("Trendyol Sipariş Çekme Hatası:", error?.response?.data || error.message);
      return NextResponse.json(
        { error: "Gerçek siparişler çekilirken bir hata oluştu." }, 
        { status: 500 }
      );
    }
  }

  // BİLGİLER DOLDURULMAMIŞSA MOCK (SAHTE) VERİ DÖN
  const mockData = {
    "totalElements": 32677,
    "totalPages": 32677,
    "page": 0,
    "size": 1,
    "content": [
        {
            "id": "1000000216178",
            "orderId": "1002048400330",
            "orderNumber": "2048400330",
            "sellerId": 107386,
            "storeId": 116,
            "customer": {
                "id": 710790400,
                "firstName": "OMS",
                "lastName": "GROCERY",
                "note": "Gelirken bir paket süt alır mısınız",
                "email": "pftest+6xjqppkakj1a@trendyolmail.com"
            },
            "packageStatus": "Created",
            "deliveryModel": "STORE",
            "zoneId": "vkhcspvzzlur",
            "scheduleType": "INSTANT",
            "timeSlotId": "stzogjwugfup",
            "eta": "20 dk",
            "estimatedDeliveryStartDate": 1678257496438,
            "estimatedDeliveryEndDate": 1678264696438,
            "shipmentAddress": {
                "firstName": "OMS",
                "lastName": "GROCERY",
                "address1": "1234 sokak no 1", 
                "address2": "", 
                "city": " İstanbul ",
                "cityCode": 34,
                "cityId": 133,
                "district": "Küçük Çekmece",  
                "districtId": 54,
                "neighborhoodId": 32,
                "neighborhood": "Cennet mh.",  
                "apartmentNumber": "TGO Market",   
                "floor": "TGO Market",  
                "doorNumber": "TGO Market",  
                "addressDescription": "Okulun yanı", 
                "postalCode": "34343",  
                "countryCode": "TR",  
                "latitude": "40.979224",  
                "longitude": "29.066674",  
                "phone": "0212 365 34 03",
                "identityNumber": "32323232322"  
            },
            "invoiceAddress": {
                "firstName": "OMS",
                "lastName": "GROCERY",
                "address1": "1234 sokak no 1",  
                "address2": "",  
                "city": " İstanbul ",  
                "cityCode": 34,
                "cityId": 133,
                "district": "Küçük Çekmece",  
                "districtId": 54,
                "neighborhoodId": 32,
                "neighborhood": "Cennet mh.",  
                "apartmentNumber": "TGO Market",   
                "floor": "TGO Market",  
                "doorNumber": "TGO Market",  
                "addressDescription": "Okulun yanı",  
                "postalCode": "34343",  
                "countryCode": "TR",  
                "latitude": "40.979224",  
                "longitude": "29.066674",  
                "phone": "0212 365 34 03",
                "identityNumber": "32323232322"  
            },
            "currencyCode": "TRY",
            "grossAmount": 313.81,
            "totalDiscount": 8,
            "totalPrice": 305.81,
            "sellerInvoiceAmount": 760.4,
            "invoiceTaxAmount": 0,
            "lines": [
                {
                    "amount": 20.48,
                    "price": 20.48,
                    "barcode": "496616523",
                    "vatBaseAmount": 20,
                    "product": {
                        "name": "Diş Macunu 500 Gr",
                        "productSaleName": "Diş Macunu 500 Gr",
                        "brandName": "İpana",
                        "imageUrls": ["https://images.unsplash.com/photo-1551636898-47668aa61de2?auto=format&fit=crop&w=400&q=80"],
                        "weight": null
                    },
                    "items": [
                        {
                            "id": "1000000495105",
                            "packageItemId": "1000000534941",
                            "isCancelled": false,
                            "price": 20.48,
                            "discount": 0.4,
                            "isAlternative": false,
                            "isCollected": false,
                            "coupons": [],
                            "promotions": []
                        },
                        {
                            "id": "1000000495106",
                            "packageItemId": "1000000534942",
                            "isCancelled": false,
                            "price": 20.48,
                            "discount": 0.4,
                            "isAlternative": false,
                            "isCollected": false,
                            "coupons": [],
                            "promotions": []
                        }
                    ]
                },
                {
                    "amount": 44.97,
                    "price": 44.97,
                    "barcode": "837599517",
                    "vatBaseAmount": 44,
                    "product": {
                        "name": "Zencefil 500 Gr",
                        "productSaleName": "Zencefil 500 Gr",
                        "brandName": "Yerli Sebze",
                        "imageUrls": ["https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?auto=format&fit=crop&w=400&q=80"],
                        "weight": {
                            "typeName": "Gr",
                            "defaultSaleUnitValue": "500"
                        },
                        "saleUnitValue": "250",
                        "saleUnitType": "Gr"
                    },
                    "items": [
                        {
                            "id": "1000000495110",
                            "packageItemId": "1000000534946",
                            "isCancelled": false,
                            "price": 44.97,
                            "discount": 0.68,
                            "isAlternative": false,
                            "isCollected": false,
                            "coupons": [],
                            "promotions": []
                        }
                    ]
                }
            ],
            "orderDate": 1678257496405,
            "lastModifiedDate": 1678257497502,
            "receiptLink": "",
            "sellerAccepted": false,
            "sellerAcceptedDate": 0,
            "prevStatus": "",
            "similarProduct": null,
            "isCourierNearby": false,
            "totalCargo": 9.99
        },
        {
          "id": "1000000216179",
          "orderId": "1002048400331",
          "orderNumber": "2048400331",
          "sellerId": 107386,
          "storeId": 116,
          "customer": {
              "id": 710790401,
              "firstName": "Ali",
              "lastName": "Veli",
              "note": "Zile basmayın bebek uyuyor",
              "email": "aliveli@example.com"
          },
          "packageStatus": "Shipped",
          "deliveryModel": "STORE",
          "zoneId": "vkhcspvzzlur",
          "scheduleType": "INSTANT",
          "timeSlotId": "stzogjwugfup",
          "eta": "10 dk",
          "estimatedDeliveryStartDate": 1678257496438,
          "estimatedDeliveryEndDate": 1678264696438,
          "shipmentAddress": {
              "firstName": "Ali",
              "lastName": "Veli",
              "address1": "Atatürk Mah. Lale Sokak No 5 D:2", 
              "address2": "", 
              "city": " İstanbul ",
              "cityCode": 34,
              "district": "Kadıköy",  
              "neighborhood": "Atatürk mh.",  
              "phone": "0532 123 45 67"
          },
          "currencyCode": "TRY",
          "grossAmount": 150.00,
          "totalDiscount": 0,
          "totalPrice": 150.00,
          "sellerInvoiceAmount": 150.00,
          "invoiceTaxAmount": 0,
          "lines": [
              {
                  "amount": 75.00,
                  "price": 75.00,
                  "barcode": "496616525",
                  "vatBaseAmount": 75,
                  "product": {
                      "name": "Süt 1L",
                      "productSaleName": "Süt 1L",
                      "brandName": "İçim",
                      "imageUrls": ["https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80"],
                      "weight": null
                  },
                  "items": [
                      {
                          "id": "1000000495120",
                          "packageItemId": "1000000534950",
                          "isCancelled": false,
                          "price": 75.00,
                          "discount": 0,
                          "isAlternative": false,
                          "isCollected": false,
                          "coupons": [],
                          "promotions": []
                      },
                      {
                        "id": "1000000495121",
                        "packageItemId": "1000000534951",
                        "isCancelled": false,
                        "price": 75.00,
                        "discount": 0,
                        "isAlternative": false,
                        "isCollected": false,
                        "coupons": [],
                        "promotions": []
                    }
                  ]
              }
          ],
          "orderDate": 1678255496405,
          "lastModifiedDate": 1678256497502,
          "receiptLink": "",
          "sellerAccepted": true,
          "sellerAcceptedDate": 1678255596405,
          "prevStatus": "Created",
          "similarProduct": null,
          "isCourierNearby": true,
          "totalCargo": 15.99
      }
    ]
  };

  // Basit filtreleme mock veride de çalışsın
  if (orderNumber) {
    mockData.content = mockData.content.filter(order => order.orderNumber === orderNumber);
  }

  return NextResponse.json(mockData);
}

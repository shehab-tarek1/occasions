import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const p = req.query.p;

    // 1. قراءة ملف المتجر (store.html)
    const htmlPath = path.join(process.cwd(), 'store.html');
    let storeHtml = '';
    try {
        storeHtml = fs.readFileSync(htmlPath, 'utf8');
    } catch (e) {
        storeHtml = '<!DOCTYPE html><html><body><script>window.location.replace("/");</script></body></html>';
    }

    if (!p) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(storeHtml);
    }

    // 2. فحص هل الزائر روبوت (واتساب/فيسبوك)
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /whatsapp|facebook|twitter|telegram|linkedin|bot|crawler|spider|discord/i.test(userAgent);

    if (!isBot) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(storeHtml);
    }

    // 3. جلب بيانات المنتج من Firebase
    const projectId = 'marketing-e9fdf';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const response = await fetch(firestoreUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'products' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'shortCode' },
                            op: 'EQUAL',
                            value: { stringValue: p }
                        }
                    },
                    limit: 1
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error('Document not found');
        const data = await response.json();

        if (!data || !data[0] || !data[0].document) {
            throw new Error('Product not found');
        }

        const fields = data[0].document.fields || {};
        const title = fields.name?.stringValue || 'A&M Store';
        const price = fields.price?.integerValue || fields.price?.doubleValue || '';
        const desc = fields.description?.stringValue || 'تسوق أحدث الملابس بأفضل الأسعار.';

        const formattedPrice = price ? `${price} ج.م` : '';
        const titleWithPrice = `${title}${formattedPrice ? ' | ' + formattedPrice : ''}`;
        const finalDesc = `🔖 كود المنتج: ${p}\n${desc}`;

        let imageUrl = 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg'; 
        if (fields.images?.arrayValue?.values?.length > 0) {
            imageUrl = fields.images.arrayValue.values[0].stringValue;
        } else if (fields.img?.stringValue) {
            imageUrl = fields.img.stringValue;
        }

        // 🔴 الحل السحري: قص الصورة بذكاء لمقاس 400x400 وتقليل حجمها للواتساب
        if (imageUrl.includes('cloudinary.com')) {
            const parts = imageUrl.split('/upload/');
            if (parts.length === 2) {
                let cleanUrl = parts[1];
                
                // إزالة أي إعدادات قص قديمة من الرابط (إن وجدت)
                cleanUrl = cleanUrl.replace(/^[a-z_0-9,:]+\//i, '');
                
                // c_fill: قص لملء المربع
                // g_auto: التركيز التلقائي على المنتج
                // w_400,h_400: مقاس مثالي للواتساب
                // q_70: ضغط الحجم
                // f_jpg: إجبار صيغة JPG
                imageUrl = `${parts[0]}/upload/c_fill,g_auto,w_400,h_400,q_70,f_jpg/${cleanUrl}`;
            }
        }

        // 4. إرسال كود HTML مخصص للواتساب
        const botHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${titleWithPrice}</title>
                <meta name="robots" content="index, follow" />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="${titleWithPrice}" />
                <meta property="og:description" content="${finalDesc}" />
                <meta property="og:image" content="${imageUrl}" />
                <meta property="og:image:secure_url" content="${imageUrl}" />
                <meta property="og:image:type" content="image/jpeg" />
                <meta property="og:image:width" content="400" />
                <meta property="og:image:height" content="400" />
                <meta property="og:site_name" content="A&M Store" />
                <meta property="og:url" content="https://${req.headers.host}/?p=${p}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="${titleWithPrice}" />
                <meta name="twitter:description" content="${finalDesc}" />
                <meta name="twitter:image" content="${imageUrl}" />
            </head>
            <body>
                <script>window.location.replace("/?p=${p}");</script>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).send(botHtml);

    } catch (error) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(storeHtml);
    }
}
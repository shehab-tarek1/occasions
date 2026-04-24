module.exports = async (req, res) => {
    const p = req.query.p;

    // إذا لم يكن هناك كود، وجهه للرئيسية
    if (!p) {
        res.writeHead(302, { Location: '/' });
        return res.end();
    }

    // فحص هل الزائر روبوت (واتساب/فيسبوك/إلخ) أم مستخدم عادي
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /whatsapp|facebook|twitter|telegram|linkedin|bot|crawler|spider|discord|viber|skype/i.test(userAgent);

    // 🔴 إذا كان مستخدم حقيقي، نقوم بتوجيهه للمتجر فوراً ليفتح المنتج
    if (!isBot) {
        res.writeHead(302, { Location: `/?p=${p}` });
        return res.end();
    }

    // 🟢 إذا كان روبوت، نجلب بيانات المنتج من Firebase
    const projectId = 'marketing-e9fdf';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    try {
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
            })
        });

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

        // صورة افتراضية في حال عدم وجود صورة للمنتج
        let imageUrl = 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg'; 
        
        if (fields.images?.arrayValue?.values?.length > 0) {
            imageUrl = fields.images.arrayValue.values[0].stringValue;
        } else if (fields.img?.stringValue) {
            imageUrl = fields.img.stringValue;
        }

        // التعديل الجديد: إجبار الصورة لتكون JPG ومربعة 600x600 للواتساب بشكل آمن (Regex)
        if (imageUrl.includes('cloudinary.com')) {
            imageUrl = imageUrl.replace(
                /\/upload\/(?:[a-zA-Z0-9_,-]+\/)?/, 
                '/upload/w_600,h_600,c_fill,q_80,f_jpg/'
            );
        }

        // إرسال صفحة مخصصة للروبوتات تحتوي على بيانات الـ Meta tags فقط
        const botHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${titleWithPrice}</title>
                <meta property="og:type" content="website" />
                <meta property="og:title" content="${titleWithPrice}" />
                <meta property="og:description" content="${finalDesc}" />
                <meta property="og:image" content="${imageUrl}" />
                <meta property="og:image:secure_url" content="${imageUrl}" />
                <meta property="og:image:type" content="image/jpeg" />
                <meta property="og:image:width" content="600" />
                <meta property="og:image:height" content="600" />
                <meta property="og:site_name" content="A&M Store" />
                <meta property="og:url" content="https://${req.headers.host}/p/${p}" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="${titleWithPrice}" />
                <meta name="twitter:description" content="${finalDesc}" />
                <meta name="twitter:image" content="${imageUrl}" />
            </head>
            <body></body>
            </html>
        `;

        // إعداد الهيدر مع الكاش لتحسين الأداء (SEO & Performance)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
        
        return res.status(200).send(botHtml);

    } catch (error) {
        console.error("Error generating share preview:", error);
        res.writeHead(302, { Location: '/' });
        return res.end();
    }
};

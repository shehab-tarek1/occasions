const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    const p = req.query.p;

    // 1. قراءة ملف المتجر (سواء كان اسمه index.html أو store.html)
    let htmlPath = path.join(process.cwd(), 'index.html');
    if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(process.cwd(), 'store.html');
    }
    
    let html = '';
    try {
        html = fs.readFileSync(htmlPath, 'utf8');
    } catch (e) {
        return res.status(500).send('HTML file not found');
    }

    // إذا لم يكن هناك كود منتج، اعرض الموقع العادي
    if (!p) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }

    // 2. فحص هل الزائر روبوت (واتساب/فيسبوك)
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /whatsapp|facebook|twitter|telegram|linkedin|bot|crawler|spider|discord/i.test(userAgent);

    if (!isBot) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }

    // 3. جلب بيانات المنتج من Firebase
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

        let imageUrl = ''; 
        if (fields.images?.arrayValue?.values?.length > 0) {
            imageUrl = fields.images.arrayValue.values[0].stringValue;
        } else if (fields.img?.stringValue) {
            imageUrl = fields.img.stringValue;
        }

        // إجبار الصورة لتكون JPG ومربعة 600x600 ليقبلها الواتساب
        if (imageUrl.includes('cloudinary.com')) {
            const urlParts = imageUrl.split('/');
            const fileId = urlParts.pop(); 
            const version = urlParts.pop(); 
            imageUrl = `https://res.cloudinary.com/dsxrjmcxs/image/upload/w_600,h_600,c_fill,q_80,f_jpg/${version}/${fileId}`;
        }

        // 🔴 الحل السحري (Regex): استبدال الميتا تاج مهما كان الرابط القديم الموجود فيها
        html = html.replace(/<title>.*?<\/title>/i, `<title>${titleWithPrice}</title>`);
        html = html.replace(/<meta property="og:title" content=".*?">/i, `<meta property="og:title" content="${titleWithPrice}">`);
        html = html.replace(/<meta property="og:description" content=".*?">/i, `<meta property="og:description" content="${finalDesc}">`);
        html = html.replace(/<meta property="og:image" content=".*?">/i, `<meta property="og:image" content="${imageUrl}">`);

        // إضافة أكواد الواتساب الإجبارية
        const whatsappMetaTags = `
            <meta property="og:image:secure_url" content="${imageUrl}">
            <meta property="og:image:type" content="image/jpeg">
            <meta property="og:image:width" content="600">
            <meta property="og:image:height" content="600">
        `;
        html = html.replace('</head>', `${whatsappMetaTags}</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).send(html);

    } catch (error) {
        console.error("Error:", error);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }
};
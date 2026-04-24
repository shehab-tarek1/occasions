const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
    // 1. جلب كود المنتج من الرابط
    const { p } = req.query;
    
    // 2. قراءة ملف index.html الأصلي
    let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

    if (!p) {
        return res.status(200).setHeader('Content-Type', 'text/html').send(html);
    }

    try {
        // 3. الاتصال بقاعدة بيانات Firebase الخاصة بك لجلب بيانات المنتج بسرعة
        const response = await fetch('https://firestore.googleapis.com/v1/projects/marketing-e9fdf/databases/(default)/documents:runQuery', {
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

        const data = await response.json();

        // 4. إذا وجدنا المنتج، نقوم بتغيير الصورة والاسم في الـ HTML
        if (data && data.length > 0 && data[0].document) {
            const doc = data[0].document.fields;
            const title = doc.name?.stringValue || 'A&M Store';
            const desc = doc.description?.stringValue || 'تسوق أحدث الملابس بأفضل الأسعار.';
            
            // جلب أول صورة للمنتج
            let imageUrl = 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg';
            if (doc.images && doc.images.arrayValue && doc.images.arrayValue.values && doc.images.arrayValue.values.length > 0) {
                imageUrl = doc.images.arrayValue.values[0].stringValue;
            } else if (doc.img && doc.img.stringValue) {
                imageUrl = doc.img.stringValue;
            }

            // استبدال بيانات الموقع الافتراضية ببيانات وصورة المنتج
            html = html.replace('<title>A&M Store</title>', `<title>${title} | A&M Store</title>`);
            html = html.replace('content="A&M Store | متجر الأزياء الأول"', `content="${title}"`);
            html = html.replace('content="تشكيلة رائعة من أحدث الموديلات، اطلب الآن بأفضل الأسعار."', `content="${desc}"`);
            html = html.replace('content="https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg"', `content="${imageUrl}"`);
        }
    } catch (error) {
        console.error('Error fetching product:', error);
    }

    // 5. إرسال الصفحة للواتساب أو للزبون
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
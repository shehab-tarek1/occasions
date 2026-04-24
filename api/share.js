const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
    const { p } = req.query;
    let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

    if (!p) {
        return res.status(200).setHeader('Content-Type', 'text/html').send(html);
    }

    try {
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

        if (data && data.length > 0 && data[0].document) {
            const doc = data[0].document.fields;
            const title = doc.name?.stringValue || 'A&M Store';
            const desc = doc.description?.stringValue || 'تسوق أحدث الملابس بأفضل الأسعار.';
            
            // جلب السعر
            const price = doc.price?.integerValue || doc.price?.doubleValue || '';
            const finalDesc = price ? `السعر: ${price} ج.م | ${desc}` : desc;
            
            let imageUrl = 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg';
            if (doc.images && doc.images.arrayValue && doc.images.arrayValue.values && doc.images.arrayValue.values.length > 0) {
                imageUrl = doc.images.arrayValue.values[0].stringValue;
            } else if (doc.img && doc.img.stringValue) {
                imageUrl = doc.img.stringValue;
            }

            html = html.replace('<title>A&M Store</title>', `<title>${title} | A&M Store</title>`);
            html = html.replace('content="A&M Store | متجر الأزياء الأول"', `content="${title}"`);
            html = html.replace('content="تشكيلة رائعة من أحدث الموديلات، اطلب الآن بأفضل الأسعار."', `content="${finalDesc}"`);
            html = html.replace('content="https://res.cloudinary.com/dsxrjmcxs/image/upload/c_fill,g_auto,w_512,h_512/v1776992294/lsxv7x8xmgbrq0ht4yy7.jpg"', `content="${imageUrl}"`);
        }
    } catch (error) {
        console.error('Error fetching product:', error);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
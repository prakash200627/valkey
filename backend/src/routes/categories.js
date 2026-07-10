const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');

router.get('/', async (req, res, next) => {
    try {
        const keys = await client.keys('category:*');
        const categoryKeys = keys.filter(k => !k.includes('_products'));
        const categories = [];
        for (const key of categoryKeys) {
            const cat = await client.json.get(key);
            if (cat) categories.push(cat);
        }
        const categoryMap = {};
        categories.forEach(cat => { categoryMap[cat.id] = { ...cat, childrenDetails: [] }; });
        const tree = [];
        categories.forEach(cat => {
            const mapped = categoryMap[cat.id];
            if (cat.parentId && categoryMap[cat.parentId]) {
                categoryMap[cat.parentId].childrenDetails.push(mapped);
            } else if (!cat.parentId) {
                tree.push(mapped);
            }
        });
        res.json(tree);
    } catch (err) { next(err); }
});

router.get('/:id/products', async (req, res, next) => {
    try {
        const productIds = await client.zRange(`category_products:${req.params.id}`, 0, -1, { REV: true });
        const products = [];
        for (const id of productIds) {
            const prod = await client.json.get(id);
            if (prod) products.push(prod);
        }
        res.json(products);
    } catch (err) { next(err); }
});

router.get('/:id/breadcrumbs', async (req, res, next) => {
    try {
        const trail = [];
        let currentId = req.params.id;
        while (currentId) {
            const cat = await client.json.get(currentId);
            if (cat) {
                const catNode = { ...cat };
                delete catNode.children;
                trail.unshift(catNode);
                currentId = cat.parentId;
            } else break;
        }
        res.json(trail);
    } catch (err) { next(err); }
});

module.exports = router;

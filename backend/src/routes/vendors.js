const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');

router.get('/:id/products', async (req, res, next) => {
    try {
        const vendorId = req.params.id;
        const keys = await client.keys('product:*');
        const products = [];
        for (const key of keys) {
            const prod = await client.json.get(key);
            if (prod && prod.vendorId === vendorId) products.push(prod);
        }
        res.json(products);
    } catch (err) { next(err); }
});

module.exports = router;

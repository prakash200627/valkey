// backend/seed.js
require('dotenv').config();
const { client, connectDB } = require('./src/utils/db');

const categories = [
    {
        id: "category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b",
        name: "Electronics",
        slug: "electronics",
        icon: "desktop",
        parentId: null,
        children: ["category:0192d4e2-3a7b-7e1f-8c4d-2b6a9f0e5d7c"]
    },
    {
        id: "category:0192d4e2-3a7b-7e1f-8c4d-2b6a9f0e5d7c",
        name: "Smartphones",
        slug: "smartphones",
        icon: "device-mobile",
        parentId: "category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b",
        children: []
    },
    {
        id: "category:0192d4e3-7b1c-7d4e-8a2f-9c3b5d6e0f1a",
        name: "Fashion",
        slug: "fashion",
        icon: "t-shirt",
        parentId: null,
        children: []
    },
    {
        id: "category:0192d4e4-1a2b-7c3d-8e4f-5a6b7c8d9e0f",
        name: "Home & Kitchen",
        slug: "home-kitchen",
        icon: "house",
        parentId: null,
        children: []
    }
];

const vendors = [
    {
        id: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        name: "TechWorld Electronics",
        slug: "techworld-electronics",
        email: "support@techworld.in",
        phone: "+91-4012345678",
        logo: "/assets/vendors/techworld-logo.png",
        rating: 4.7,
        totalProducts: 342,
        totalSales: 15420,
        address: {
            street: "Plot 15, HITEC City",
            city: "Hyderabad",
            state: "Telangana",
            postalCode: "500081",
            country: "IN",
            lat: 17.4435,
            lng: 78.3772
        },
        verified: true,
        joinedAt: "2024-06-15T00:00:00Z"
    }
];

const products = [
    {
        id: "product:0192d4e6-2c4e-7a6b-8d8f-0a1b2c3d4e5f",
        sku: "ELEC-PHN-SAM-001",
        name: "Galaxy Ultra Pro 256GB",
        slug: "galaxy-ultra-pro-256gb",
        description: "Flagship smartphone with 200MP camera, 6.8\" AMOLED display, and 5000mAh battery.",
        shortDescription: "200MP camera, 6.8\" AMOLED, 5000mAh",
        categoryId: "category:0192d4e2-3a7b-7e1f-8c4d-2b6a9f0e5d7c",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Samsung",
        price: { amount: 89999, currency: "INR", compareAt: 99999 },
        images: [{ url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80", alt: "Galaxy Ultra Pro front view", isPrimary: true }],
        attributes: { color: "Phantom Black", storage: "256GB", ram: "12GB" },
        tags: ["smartphone", "5g", "flagship", "camera", "samsung"],
        inventory: { quantity: 150, reserved: 12, warehouse: "HYD-WH-01" },
        ratings: { average: 4.6, count: 2341 },
        embedding: [0.15, 0.22, 0.84, 0.45],
        status: "active",
        createdAt: "2025-03-01T08:00:00Z"
    },
    {
        id: "product:0192d4e6-3d5f-7b8c-9e0a-1b2c3d4e5f6a",
        sku: "ELEC-CAM-FUJ-112",
        name: "Instax Mini 12 Instant Film Camera - Green",
        slug: "instax-mini-12-green",
        description: "Super-fun instant film camera that captures memories instantly. Easy to use, high-quality prints.",
        shortDescription: "Instant print film camera, vintage green",
        categoryId: "category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Fujifilm",
        price: { amount: 7999, currency: "INR", compareAt: 8999 },
        images: [{ url: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80", alt: "Instax Mini 12", isPrimary: true }],
        attributes: { color: "Mint Green", filmSize: "Credit Card Size" },
        tags: ["camera", "instax", "photography", "fujifilm"],
        inventory: { quantity: 80, reserved: 2, warehouse: "HYD-WH-01" },
        ratings: { average: 4.8, count: 12000 },
        embedding: [0.08, -0.12, 0.91, 0.33],
        status: "active",
        createdAt: "2025-04-10T12:00:00Z"
    },
    {
        id: "product:0192d4e6-4e6a-7c9d-8f1b-2c3d4e5f6a7b",
        sku: "ELEC-AUD-SON-005",
        name: "Sony WH-1000XM5 Noise Cancelling Headphones",
        slug: "sony-wh-1000xm5",
        description: "Industry-leading active noise cancellation with premium audio fidelity and 30-hour battery life.",
        shortDescription: "Active noise cancelling, 30hr battery",
        categoryId: "category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Sony",
        price: { amount: 29999, currency: "INR", compareAt: 34999 },
        images: [{ url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80", alt: "Sony WH-1000XM5", isPrimary: true }],
        attributes: { color: "Silver", batteryLife: "30 hours" },
        tags: ["headphones", "audio", "noise-cancelling", "sony"],
        inventory: { quantity: 200, reserved: 5, warehouse: "HYD-WH-02" },
        ratings: { average: 4.7, count: 4890 },
        embedding: [0.23, 0.05, 0.77, 0.58],
        status: "active",
        createdAt: "2025-02-15T09:30:00Z"
    },
    {
        id: "product:0192d4e6-5f7b-7d0e-8a2c-3d4e5f6a7b8c",
        sku: "GROC-VEG-TAY-001",
        name: "Taylor Farms Broccoli Florets Vegetables",
        slug: "taylor-farms-broccoli-florets",
        description: "Freshly harvested organic broccoli florets, high in vitamins, fiber, and nutrients.",
        shortDescription: "Fresh organic broccoli florets 500g",
        categoryId: "category:0192d4e4-1a2b-7c3d-8e4f-5a6b7c8d9e0f",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Taylor Farms",
        price: { amount: 499, currency: "INR", compareAt: 599 },
        images: [{ url: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=600&q=80", alt: "Organic Broccoli Florets", isPrimary: true }],
        attributes: { weight: "500g", type: "Organic" },
        tags: ["groceries", "vegetables", "organic", "broccoli"],
        inventory: { quantity: 50, reserved: 0, warehouse: "HYD-WH-03" },
        ratings: { average: 4.8, count: 128 },
        embedding: [-0.45, 0.82, 0.12, -0.11],
        status: "active",
        createdAt: "2025-05-20T06:00:00Z"
    },
    {
        id: "product:0192d4e6-6a7b-7c8d-9e0f-1a2b3c4d5e6f",
        sku: "ELEC-LAP-APL-003",
        name: "MacBook Air M3 13-inch",
        slug: "macbook-air-m3-13-inch",
        description: "Strikingly thin design with the blazing-fast M3 chip. Built for work and play.",
        shortDescription: "Apple M3 Chip, 13.6-inch Liquid Retina Display",
        categoryId: "category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Apple",
        price: { amount: 114900, currency: "INR", compareAt: 124900 },
        images: [{ url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80", alt: "MacBook Air M3", isPrimary: true }],
        attributes: { color: "Space Grey", storage: "256GB", ram: "8GB" },
        tags: ["laptop", "apple", "macbook", "m3", "productivity"],
        inventory: { quantity: 45, reserved: 1, warehouse: "HYD-WH-01" },
        ratings: { average: 4.9, count: 852 },
        embedding: [0.11, 0.18, 0.79, 0.52],
        status: "active",
        createdAt: "2025-04-01T10:00:00Z"
    },
    {
        id: "product:0192d4e6-7b8c-7d9e-8a0f-1b2c3d4e5f6a",
        sku: "FASH-SHO-NIK-270",
        name: "Nike Air Max 270 Sneakers - Black",
        slug: "nike-air-max-270-black",
        description: "Nike's first lifestyle Air Max brings you style, comfort and big attitude in a clean black colorway.",
        shortDescription: "Lifestyle sneaker, Max Air cushioning",
        categoryId: "category:0192d4e3-7b1c-7d4e-8a2f-9c3b5d6e0f1a",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Nike",
        price: { amount: 13995, currency: "INR", compareAt: 14995 },
        images: [{ url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80", alt: "Nike Air Max 270", isPrimary: true }],
        attributes: { color: "Black/White", size: "UK 9" },
        tags: ["shoes", "sneakers", "nike", "fashion", "sportswear"],
        inventory: { quantity: 120, reserved: 3, warehouse: "HYD-WH-02" },
        ratings: { average: 4.5, count: 6420 },
        embedding: [-0.35, 0.62, 0.25, -0.42],
        status: "active",
        createdAt: "2025-03-12T11:15:00Z"
    },
    {
        id: "product:0192d4e6-8c9d-7e0f-9a1b-2c3d4e5f6a7b",
        sku: "FASH-AP-LEV-511",
        name: "Levis 511 Slim Fit Denim Jeans",
        slug: "levis-511-slim-fit-jeans",
        description: "A modern slim with room to move. The 511 Slim Fit Jeans are a classic since right now.",
        shortDescription: "Slim fit denim, stretch comfort",
        categoryId: "category:0192d4e3-7b1c-7d4e-8a2f-9c3b5d6e0f1a",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Levis",
        price: { amount: 3999, currency: "INR", compareAt: 4599 },
        images: [{ url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80", alt: "Levis 511 Slim", isPrimary: true }],
        attributes: { color: "Dark Indigo", waistSize: "32" },
        tags: ["clothing", "jeans", "levis", "denim", "fashion"],
        inventory: { quantity: 95, reserved: 0, warehouse: "HYD-WH-02" },
        ratings: { average: 4.4, count: 1890 },
        embedding: [-0.31, 0.58, 0.31, -0.38],
        status: "active",
        createdAt: "2025-04-18T14:40:00Z"
    },
    {
        id: "product:0192d4e6-9d0e-7f1a-8b2c-3d4e5f6a7b8c",
        sku: "HOME-KIT-INS-DUO",
        name: "Instant Pot Duo 7-in-1 Multi-Cooker",
        slug: "instant-pot-duo-7-in-1",
        description: "America's most loved multi-cooker combines 7 appliances in one: pressure cooker, slow cooker, rice cooker, yogurt maker, steamer, sauté pan and food warmer.",
        shortDescription: "7-in-1 multi-functional pressure cooker",
        categoryId: "category:0192d4e4-1a2b-7c3d-8e4f-5a6b7c8d9e0f",
        vendorId: "vendor:0192d4e7-4d5e-7b7c-9e9f-1a2b3c4d5e6f",
        brand: "Instant Pot",
        price: { amount: 9999, currency: "INR", compareAt: 11999 },
        images: [{ url: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80", alt: "Instant Pot Duo", isPrimary: true }],
        attributes: { capacity: "6 Quarts", material: "Stainless Steel" },
        tags: ["home", "kitchen", "cooker", "appliance", "instantpot"],
        inventory: { quantity: 70, reserved: 1, warehouse: "HYD-WH-03" },
        ratings: { average: 4.8, count: 28410 },
        embedding: [-0.25, 0.72, 0.18, -0.21],
        status: "active",
        createdAt: "2025-05-02T09:00:00Z"
    }
];

const coupons = [
    {
        code: "VALKEY10",
        type: "percentage",
        value: 10,
        minOrderAmount: 400, // Min subtotal to apply
        maxDiscount: 1000,
        validFrom: "2025-05-01T00:00:00Z",
        validUntil: "2026-12-30T23:59:59Z",
        usageLimit: 1000,
        usedCount: 0,
        applicableCategories: ["category:0192d4e2-1f5a-7c3d-9b2e-8a4f6d0c1e3b", "category:0192d4e4-1a2b-7c3d-8e4f-5a6b7c8d9e0f"],
        active: true
    }
];

const seed = async () => {
    try {
        console.log('Connecting to Valkey...');
        if (!client.isOpen) {
            const connectPromise = client.connect();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout: Valkey is not reachable on port 6379. Make sure your Docker container is running!')), 5000)
            );
            await Promise.race([connectPromise, timeoutPromise]);
        }
        
        // Wait until the client is fully ready
        if (!client.isReady) {
            await new Promise((resolve) => {
                client.once('ready', resolve);
            });
        }

        console.log('🧹 Cleaning old application data...');
        const prefixes = ['product:*', 'category:*', 'vendor:*', 'coupon:*', 'category_products:*', 'brand_products:*', 'price_index'];
        let deletedKeysCount = 0;
        for (const pattern of prefixes) {
            let cursor = 0;
            do {
                const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = reply.cursor;
                const keys = reply.keys;
                if (keys.length > 0) {
                    await client.del(keys);
                    deletedKeysCount += keys.length;
                }
            } while (cursor !== 0);
        }
        console.log(`Deleted ${deletedKeysCount} application-specific keys.`);

        console.log('📦 Seeding categories...');
        for (const cat of categories) {
            await client.json.set(cat.id, '$', cat);
        }

        console.log('🏪 Seeding vendors...');
        for (const ven of vendors) {
            await client.json.set(ven.id, '$', ven);
        }

        console.log('🛍️ Seeding products...');
        for (const prod of products) {
            await client.json.set(prod.id, '$', prod);
            
            // Add relation index for category products (Challenge 2)
            const timestamp = new Date(prod.createdAt).getTime();
            await client.zAdd(`category_products:${prod.categoryId}`, {
                score: timestamp,
                value: prod.id
            });
            
            // Add brand index Set (SADD brand_products:{brand} {productId})
            await client.sAdd(`brand_products:${prod.brand}`, prod.id);
            
            // Add price range index in paise (score = price * 100)
            await client.zAdd('price_index', {
                score: prod.price.amount * 100, // stored in paise
                value: prod.id
            });
        }

        console.log('🎫 Seeding coupons...');
        for (const coup of coupons) {
            await client.json.set(`coupon:${coup.code}`, '$', coup);
        }

        console.log('📍 Seeding warehouses geospatial locations...');
        await client.geoAdd('warehouses', { longitude: 78.4347, latitude: 17.4156, member: 'HYD-WH-01' });
        await client.geoAdd('warehouses', { longitude: 78.3772, latitude: 17.4435, member: 'HYD-WH-02' });
        await client.geoAdd('warehouses', { longitude: 78.4867, latitude: 17.3850, member: 'HYD-WH-03' });

        console.log('🛵 Seeding delivery agent locations...');
        await client.geoAdd('delivery_agents', { longitude: 78.4100, latitude: 17.4300, member: 'agent_raj_001' });
        await client.geoAdd('delivery_agents', { longitude: 78.4500, latitude: 17.4200, member: 'agent_kumar_002' });

        console.log('🔍 Setting up RediSearch Index for Products via sendCommand...');
        
        // Drop index directly
        try {
            await client.sendCommand(['FT.DROPINDEX', 'idx:products']);
            console.log('Dropped existing index: idx:products');
        } catch (e) {
            // Index doesn't exist, ignore
        }

        // Send raw FT.CREATE command
        await client.sendCommand([
            'FT.CREATE', 'idx:products',
            'ON', 'JSON',
            'PREFIX', '1', 'product:',
            'SCHEMA',
            '$.name', 'AS', 'name', 'TEXT',
            '$.description', 'AS', 'description', 'TEXT',
            '$.brand', 'AS', 'brand', 'TAG',
            '$.categoryId', 'AS', 'categoryId', 'TAG',
            '$.price.amount', 'AS', 'price', 'NUMERIC',
            '$.ratings.average', 'AS', 'rating', 'NUMERIC',
            '$.embedding', 'AS', 'vec', 'VECTOR', 'HNSW', '6',
                'TYPE', 'FLOAT32',
                'DIM', '4',
                'DISTANCE_METRIC', 'COSINE'
        ]);

        console.log('✨ Seeding complete and RediSearch index initialized!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
};

seed();

// backend/seed_demo_session.js
require('dotenv').config();
const { client, connectDB } = require('./src/utils/db');

const seedDemoSession = async () => {
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

        const userId = 'user:demo_test_user';
        const token = 'demo_token_123';
        const sessionKey = `session:${token}`;
        const userSessionsKey = `user_sessions:${userId}`;

        console.log('🧹 Cleaning existing demo session keys...');
        await client.del(userId);
        await client.del(sessionKey);
        await client.del(userSessionsKey);

        // 1. Create a dummy User JSON document in Valkey
        const demoUser = {
            id: userId,
            email: "demo@example.com",
            firstName: "Jane",
            lastName: "Doe",
            phone: "+91-99999-88888",
            avatar: "/assets/avatars/default.jpg",
            role: "customer",
            addresses: [],
            preferences: {
                currency: "INR",
                language: "en",
                notifications: true
            },
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        };
        await client.json.set(userId, '$', demoUser);
        console.log(`👤 Created Demo User Document in Valkey under key: "${userId}"`);

        // 2. Create a session key in Valkey mapping token to userId (expires in 24 hours)
        await client.set(sessionKey, userId, {
            EX: 86400
        });
        console.log(`🔑 Created Session in Valkey: "${sessionKey}" -> "${userId}" (24h TTL)`);

        // 3. Register the session in the concurrent sessions Sorted Set scored by expiry timestamp
        const expiry = Math.floor(Date.now() / 1000) + 86400;
        await client.zAdd(userSessionsKey, { score: expiry, value: token });
        await client.expire(userSessionsKey, 86400);
        console.log(`👥 Registered Session in Sorted Set: "${userSessionsKey}"`);

        console.log('\n✨ Demo session data created successfully!');
        console.log('You can now test the endpoints in Postman using the header:');
        console.log('   Authorization: Bearer demo_token_123');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed demo session:', err);
        process.exit(1);
    }
};

seedDemoSession();

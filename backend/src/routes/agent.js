const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');
const { v7: uuidv7 } = require('uuid');

// Deterministic vector generator for DIM 4
function generateVector(text) {
    const vec = [0.1, 0.2, 0.3, 0.4];
    if (!text) return vec;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    for (let j = 0; j < 4; j++) {
        vec[j] = Math.sin(hash + j) * 0.5 + 0.5;
    }
    return vec;
}

// Reusable Agent Tools
const tools = {
    search_products: async (filters) => {
        let queryParts = [];
        if (filters.query) {
            const clean = filters.query.replace(/[^a-zA-Z0-9 ]/g, '');
            if (clean) queryParts.push(`(@name:*${clean}* | @description:*${clean}* | @brand:{${clean}})`);
        }
        if (filters.categoryId) {
            const escaped = filters.categoryId.replace(/:/g, '\\:').replace(/-/g, '\\-');
            queryParts.push(`@categoryId:{${escaped}}`);
        }
        if (filters.minPrice || filters.maxPrice) {
            const min = filters.minPrice ? parseInt(filters.minPrice) : 0;
            const max = filters.maxPrice ? parseInt(filters.maxPrice) : '+inf';
            queryParts.push(`@price:[${min} ${max}]`);
        }
        const baseQuery = queryParts.length > 0 ? queryParts.join(' ') : '*';
        const res = await client.ft.search('idx:products', baseQuery, { DIALECT: 2, LIMIT: { from: 0, size: 5 } });
        return res.documents.map(d => d.value);
    },

    semantic_search: async (naturalQuery, limit = 5) => {
        const vec = generateVector(naturalQuery);
        const vecBuffer = Buffer.from(new Float32Array(vec).buffer);
        const searchResult = await client.ft.search('idx:products', `*=>[KNN ${limit} @vec $query_vec AS score]`, {
            PARAMS: { query_vec: vecBuffer },
            DIALECT: 2,
            SORTBY: { BY: 'score', DIRECTION: 'ASC' }
        });
        return searchResult.documents.map(doc => doc.value);
    },

    get_similar: async (productId) => {
        const product = await client.json.get(productId);
        if (!product) return [];
        const embedding = product.embedding || [0.1, 0.2, 0.3, 0.4];
        const vecBuffer = Buffer.from(new Float32Array(embedding).buffer);
        const searchResult = await client.ft.search('idx:products', `*=>[KNN 5 @vec $query_vec AS score]`, {
            PARAMS: { query_vec: vecBuffer },
            DIALECT: 2,
            SORTBY: { BY: 'score', DIRECTION: 'ASC' }
        });
        return searchResult.documents.map(d => d.value).filter(p => p.id !== productId).slice(0, 3);
    },

    check_availability: async (productId) => {
        const product = await client.json.get(productId);
        if (!product) return null;
        const available = (product.inventory?.quantity || 0) - (product.inventory?.reserved || 0);
        return {
            id: product.id,
            name: product.name,
            inStock: available > 0,
            quantityAvailable: Math.max(0, available),
            warehouse: product.inventory?.warehouse || 'Primary'
        };
    }
};

// 1. Post Natural Language Agent Search Query
router.post('/search', async (req, res, next) => {
    try {
        const { sessionId, message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'message is required', status: 400 });
        }

        const sessId = sessionId || `agent_sess_${Math.random().toString(36).substr(2, 9)}`;
        const conversationKey = `conversation:${sessId}`;

        // Get past conversation context
        let history = await client.json.get(conversationKey);
        if (!history) {
            history = { sessionId: sessId, turns: [], context: {} };
        }

        const queryLower = message.toLowerCase();
        let agentResponse = "";
        let results = [];
        let followUp = "";
        let intent = "general_search";

        // Step 1: Parse Context and Intent (Rule-based NLP engine)
        if (queryLower.includes('similar to') || queryLower.includes('like')) {
            intent = "similar_products";
            // Extract product ID or search by name first
            const matchedKey = await client.keys('product:*');
            let targetProduct = null;
            for (const key of matchedKey) {
                const prod = await client.json.get(key);
                if (prod && queryLower.includes(prod.name.toLowerCase().split(' ')[0])) {
                    targetProduct = prod;
                    break;
                }
            }
            if (!targetProduct && matchedKey.length > 0) {
                targetProduct = await client.json.get(matchedKey[0]); // default
            }

            if (targetProduct) {
                results = await tools.get_similar(targetProduct.id);
                agentResponse = `Here are some products similar to the "${targetProduct.name}":`;
                followUp = `Would you like me to find alternatives within a specific price range?`;
            } else {
                agentResponse = "I couldn't find a matching product to search similarities for.";
            }
        } else if (queryLower.includes('stock') || queryLower.includes('available') || queryLower.includes('warehouse')) {
            intent = "stock_check";
            const matchedKey = await client.keys('product:*');
            let targetProduct = null;
            for (const key of matchedKey) {
                const prod = await client.json.get(key);
                if (prod && queryLower.includes(prod.name.toLowerCase().split(' ')[0])) {
                    targetProduct = prod;
                    break;
                }
            }
            if (targetProduct) {
                const stock = await tools.check_availability(targetProduct.id);
                agentResponse = stock.inStock 
                    ? `Good news! The "${stock.name}" is in stock. There are ${stock.quantityAvailable} units available at warehouse ${stock.warehouse}.`
                    : `I'm sorry, the "${stock.name}" is currently out of stock.`;
                followUp = "Would you like me to recommend similar products that are currently in stock?";
            } else {
                agentResponse = "Which product's stock availability would you like me to check?";
            }
        } else if (queryLower.includes('cheaper') || queryLower.includes('less than') || queryLower.includes('under') || queryLower.includes('budget')) {
            intent = "price_filter";
            // Check past context search terms if any
            const lastSearchQuery = history.context?.lastQuery || "phone";
            
            // Extract numeric budget
            const numberMatch = queryLower.match(/\d+/);
            const budget = numberMatch ? parseInt(numberMatch[0]) : 10000;

            // Run search with price filter (to paise: budget * 100)
            results = await tools.search_products({
                query: lastSearchQuery,
                maxPrice: budget * 100
            });
            agentResponse = `I found these options for "${lastSearchQuery}" under INR ${budget}:`;
            followUp = "Would you like to sort these by rating or brand?";
            history.context.budget = budget;
        } else {
            // General semantic text search
            intent = "semantic_search";
            results = await tools.semantic_search(message);
            agentResponse = `Based on your request, I found these relevant products:`;
            followUp = "Would you like me to filter these by price or check their stock availability?";
            history.context.lastQuery = message;
        }

        history.context.intent = intent;

        // Step 2: Format result items with explanations
        const explainedResults = results.map(prod => {
            let reason = "Highly rated product matching your criteria.";
            if (intent === "similar_products") reason = `Matches visual and attribute profiles to your selected item.`;
            else if (intent === "price_filter") reason = `Fits directly within your budget of INR ${history.context.budget}.`;
            else if (intent === "semantic_search") reason = `Matches the semantic description of "${message}".`;
            return {
                productId: prod.id,
                name: prod.name,
                price: prod.price.amount,
                reason
            };
        });

        // Step 3: Update conversation turns
        history.turns.push({
            role: "user",
            content: message,
            timestamp: new Date().toISOString()
        });
        history.turns.push({
            role: "agent",
            content: agentResponse,
            results: explainedResults,
            followUp,
            timestamp: new Date().toISOString()
        });

        // Store back in Valkey JSON with 30 minutes expiry
        await client.json.set(conversationKey, '$', history);
        await client.expire(conversationKey, 1800);

        res.json({
            sessionId: sessId,
            response: agentResponse,
            results: explainedResults,
            followUp,
            context: history.context
        });
    } catch (err) {
        next(err);
    }
});

// 2. Get Conversation History
router.get('/conversation/:sessionId', async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const conversation = await client.json.get(`conversation:${sessionId}`);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation history not found', status: 404 });
        }
        res.json(conversation);
    } catch (err) {
        next(err);
    }
});

module.exports = router;

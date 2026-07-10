const express = require('express');
const router = express.Router();
const { client } = require('../utils/db');
const logger = require('../utils/logger');

// Haversine formula to compute distance in km in JavaScript (fail-safe for ETA)
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// 1. Check Serviceability (Find warehouse within 25km of coordinates)
router.get('/check-serviceability', async (req, res, next) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng parameters are required', status: 400 });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        // Search warehouses within 25km (Valkey GEOSEARCH uses longitude first)
        const warehouses = await client.geoSearch('warehouses', { longitude, latitude }, { radius: 25, unit: 'km' });

        if (warehouses && warehouses.length > 0) {
            res.json({
                serviceable: true,
                nearestWarehouse: warehouses[0],
                distanceKm: 0.0 // can compute distance if needed
            });
        } else {
            res.json({
                serviceable: false,
                message: 'No warehouse located within serviceable radius of 25km.'
            });
        }
    } catch (err) {
        next(err);
    }
});

// 2. Estimate Delivery Time / ETA
router.get('/eta', async (req, res, next) => {
    try {
        const { fromLat, fromLng, toLat, toLng } = req.query;
        if (!fromLat || !fromLng || !toLat || !toLng) {
            return res.status(400).json({ error: 'fromLat, fromLng, toLat, and toLng are required', status: 400 });
        }

        const distance = getHaversineDistance(
            parseFloat(fromLat), parseFloat(fromLng),
            parseFloat(toLat), parseFloat(toLng)
        );

        // Assume average delivery vehicle speed of 30 km/h
        const speedKmh = 30;
        const etaHours = distance / speedKmh;
        const etaMinutes = Math.round(etaHours * 60) + 15; // add 15 mins buffer for packing/handover

        res.json({
            distanceKm: parseFloat(distance.toFixed(2)),
            estimatedMinutes: etaMinutes,
            speedKmh
        });
    } catch (err) {
        next(err);
    }
});

// 3. Get Delivery Tracking Info
router.get('/:trackingId', async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        const tracking = await client.json.get(`delivery:${trackingId}`);
        
        if (!tracking) {
            // Seed a mockup delivery details if it doesn't exist for demo safety
            const mockDelivery = {
                trackingId,
                orderId: `order:${uuidv7()}`,
                agentId: 'agent_raj_001',
                status: 'in_transit',
                pickupLocation: { lat: 17.4156, lng: 78.4347 },
                dropLocation: { lat: 17.4300, lng: 78.4100 },
                currentLocation: { lat: 17.4200, lng: 78.4200 },
                estimatedArrival: new Date(Date.now() + 30*60000).toISOString(),
                history: [
                    { status: 'picked_up', timestamp: new Date(Date.now() - 15*60000).toISOString(), lat: 17.4156, lng: 78.4347 }
                ]
            };
            await client.json.set(`delivery:${trackingId}`, '$', mockDelivery);
            return res.json(mockDelivery);
        }
        res.json(tracking);
    } catch (err) {
        next(err);
    }
});

// 4. Agent Pushes Location Update
router.post('/:trackingId/location', async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        const { lat, lng, status } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng are required in body', status: 400 });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        let tracking = await client.json.get(`delivery:${trackingId}`);
        if (!tracking) {
            // Seed dynamic
            tracking = {
                trackingId,
                orderId: `order:${uuidv7()}`,
                agentId: 'agent_raj_001',
                status: status || 'in_transit',
                pickupLocation: { lat: 17.4156, lng: 78.4347 },
                dropLocation: { lat: 17.4300, lng: 78.4100 },
                currentLocation: { lat: latitude, lng: longitude },
                estimatedArrival: new Date(Date.now() + 20*60000).toISOString(),
                history: []
            };
        }

        // Update current location
        tracking.currentLocation = { lat: latitude, lng: longitude };
        if (status) tracking.status = status;

        // Push to history
        tracking.history.push({
            status: status || tracking.status,
            timestamp: new Date().toISOString(),
            lat: latitude,
            lng: longitude
        });

        await client.json.set(`delivery:${trackingId}`, '$', tracking);

        // Update geospatial agent key
        await client.geoAdd('delivery_agents', {
            longitude,
            latitude,
            member: tracking.agentId || 'agent_raj_001'
        });

        // Publish to real-time pub/sub channel
        const updatePayload = JSON.stringify({
            trackingId,
            lat: latitude,
            lng: longitude,
            status: tracking.status,
            eta: tracking.estimatedArrival
        });
        await client.publish(`delivery:location:${trackingId}`, updatePayload);

        res.json({ message: 'Location updated and broadcasted', tracking });
    } catch (err) {
        next(err);
    }
});

// 5. Server-Sent Events (SSE) Real-Time Tracking Stream
router.get('/:trackingId/track', async (req, res) => {
    const { trackingId } = req.params;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write(`data: ${JSON.stringify({ message: 'Connected to tracking stream' })}\n\n`);

    // Create a dedicated subscriber connection using duplicate
    const subscriber = client.duplicate();
    await subscriber.connect().catch((err) => {
        logger.error('Subscriber connection failed in SSE', { error: err.message });
    });

    const channel = `delivery:location:${trackingId}`;

    await subscriber.subscribe(channel, (message) => {
        res.write(`data: ${message}\n\n`);
    });

    // Handle connection closure
    req.on('close', async () => {
        logger.info('SSE client closed tracking connection', { trackingId });
        await subscriber.unsubscribe(channel).catch(() => {});
        await subscriber.quit().catch(() => {});
        res.end();
    });
});

module.exports = router;

import express from 'express';
import { ParkingArea } from '../models/ParkingArea.js';
import { Route } from '../models/Route.js';
import { Gate } from '../models/Gate.js';

const router = express.Router();

// Get all map data in one request
router.get('/', async (req, res) => {
    try {
        const [parkingAreas, routes, gates] = await Promise.all([
            ParkingArea.find().sort({ createdAt: -1 }),
            Route.find().sort({ createdAt: -1 }),
            Gate.find().sort({ createdAt: -1 })
        ]);

        res.json({
            parkingAreas,
            routes,
            gates
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

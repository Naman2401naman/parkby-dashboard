import express from 'express';
import { Route } from '../models/Route.js';

const router = express.Router();

// Get all routes
router.get('/', async (req, res) => {
    try {
        const routes = await Route.find().sort({ createdAt: -1 });
        res.json(routes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create new route
router.post('/', async (req, res) => {
    try {
        const route = new Route(req.body);
        await route.save();
        res.status(201).json(route);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Update route
router.put('/:id', async (req, res) => {
    try {
        const route = await Route.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json(route);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Delete route
router.delete('/:id', async (req, res) => {
    try {
        const route = await Route.findByIdAndDelete(req.params.id);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json({ message: 'Route deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

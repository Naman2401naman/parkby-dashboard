import express from 'express';
import { Gate } from '../models/Gate.js';

const router = express.Router();

// Get all gates
router.get('/', async (req, res) => {
    try {
        const gates = await Gate.find().sort({ createdAt: -1 });
        res.json(gates);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create new gate
router.post('/', async (req, res) => {
    try {
        const gate = new Gate(req.body);
        await gate.save();
        res.status(201).json(gate);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Update gate
router.put('/:id', async (req, res) => {
    try {
        const gate = await Gate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!gate) {
            return res.status(404).json({ error: 'Gate not found' });
        }
        res.json(gate);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Delete gate
router.delete('/:id', async (req, res) => {
    try {
        const gate = await Gate.findByIdAndDelete(req.params.id);
        if (!gate) {
            return res.status(404).json({ error: 'Gate not found' });
        }
        res.json({ message: 'Gate deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

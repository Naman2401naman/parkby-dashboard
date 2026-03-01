import express from 'express';
import { ParkingMetadata } from '../models/ParkingMetadata.js';

const router = express.Router();

// Get all parking metadata
router.get('/', async (req, res) => {
    try {
        const metadata = await ParkingMetadata.find().sort({ name: 1 });
        res.json(metadata);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get metadata by parking name
router.get('/by-name/:name', async (req, res) => {
    try {
        const metadata = await ParkingMetadata.findOne({ name: req.params.name });
        if (!metadata) {
            return res.status(404).json({ error: 'Parking metadata not found' });
        }
        res.json(metadata);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create parking metadata
router.post('/', async (req, res) => {
    try {
        const metadata = new ParkingMetadata(req.body);
        await metadata.save();
        res.status(201).json(metadata);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Update parking metadata
router.put('/:id', async (req, res) => {
    try {
        const metadata = await ParkingMetadata.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!metadata) {
            return res.status(404).json({ error: 'Parking metadata not found' });
        }
        res.json(metadata);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Delete parking metadata
router.delete('/:id', async (req, res) => {
    try {
        const metadata = await ParkingMetadata.findByIdAndDelete(req.params.id);
        if (!metadata) {
            return res.status(404).json({ error: 'Parking metadata not found' });
        }
        res.json({ message: 'Parking metadata deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

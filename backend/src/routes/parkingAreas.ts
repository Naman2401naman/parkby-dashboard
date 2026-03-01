import express from 'express';
import { ParkingArea } from '../models/ParkingArea.js';

const router = express.Router();

// Get all parking areas
router.get('/', async (req, res) => {
    try {
        const parkingAreas = await ParkingArea.find().sort({ createdAt: -1 });
        res.json(parkingAreas);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get single parking area
router.get('/:id', async (req, res) => {
    try {
        const parkingArea = await ParkingArea.findById(req.params.id);
        if (!parkingArea) {
            return res.status(404).json({ error: 'Parking area not found' });
        }
        res.json(parkingArea);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create new parking area
router.post('/', async (req, res) => {
    try {
        const parkingArea = new ParkingArea(req.body);
        await parkingArea.save();
        res.status(201).json(parkingArea);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Update parking area
router.put('/:id', async (req, res) => {
    try {
        const parkingArea = await ParkingArea.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!parkingArea) {
            return res.status(404).json({ error: 'Parking area not found' });
        }
        res.json(parkingArea);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Delete parking area
router.delete('/:id', async (req, res) => {
    try {
        const parkingArea = await ParkingArea.findByIdAndDelete(req.params.id);
        if (!parkingArea) {
            return res.status(404).json({ error: 'Parking area not found' });
        }
        res.json({ message: 'Parking area deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

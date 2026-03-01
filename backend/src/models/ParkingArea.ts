import mongoose from 'mongoose';

const parkingAreaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        default: 'parking'
    },
    geometry: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]], // Array of arrays of coordinate pairs
            required: true
        }
    },
    totalSlots: {
        type: Number,
        required: true,
        min: 0
    },
    occupiedSlots: {
        type: Number,
        default: 0,
        min: 0
    },
    availability: {
        type: Number,
        min: 0,
        max: 100
    },
    entryPoints: {
        type: [[Number]], // Array of [lng, lat] pairs
        default: []
    }
}, {
    timestamps: true
});

// Calculate availability before saving
parkingAreaSchema.pre('save', function (next) {
    if (this.totalSlots > 0) {
        this.availability = Math.round(((this.totalSlots - this.occupiedSlots) / this.totalSlots) * 100);
    }
    next();
});

export const ParkingArea = mongoose.model('ParkingArea', parkingAreaSchema);

import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        default: 'route'
    },
    geometry: {
        type: {
            type: String,
            enum: ['LineString'],
            required: true
        },
        coordinates: {
            type: [[Number]], // Array of [lng, lat] pairs
            required: true
        }
    }
}, {
    timestamps: true
});

export const Route = mongoose.model('Route', routeSchema);

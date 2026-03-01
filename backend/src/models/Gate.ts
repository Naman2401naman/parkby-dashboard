import mongoose from 'mongoose';

const gateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        default: 'gate'
    },
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number], // [lng, lat]
            required: true
        }
    }
}, {
    timestamps: true
});

export const Gate = mongoose.model('Gate', gateSchema);

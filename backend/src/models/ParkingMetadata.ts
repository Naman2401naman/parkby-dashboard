import mongoose from 'mongoose';

const parkingMetadataSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    totalSlots: {
        type: Number,
        required: true,
        min: 0
    },
    building: {
        type: String,
        trim: true
    },
    department: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

export const ParkingMetadata = mongoose.model('ParkingMetadata', parkingMetadataSchema);

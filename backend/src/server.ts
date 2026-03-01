import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import parkingAreasRouter from './routes/parkingAreas.js';
import parkingMetadataRouter from './routes/parkingMetadata.js';
import routesRouter from './routes/routes.js';
import gatesRouter from './routes/gates.js';
import mapDataRouter from './routes/mapData.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/parking-areas', parkingAreasRouter);
app.use('/api/parking-metadata', parkingMetadataRouter);
app.use('/api/routes', routesRouter);
app.use('/api/gates', gatesRouter);
app.use('/api/map-data', mapDataRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Parking Dashboard API is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📍 API endpoints available at http://localhost:${PORT}/api`);
});

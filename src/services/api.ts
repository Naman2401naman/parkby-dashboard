const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Types
export interface ParkingArea {
    _id?: string;
    name: string;
    type: string;
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
    totalSlots: number;
    occupiedSlots: number;
    availability: number;
    entryPoints: number[][];
}

export interface ParkingMetadata {
    _id?: string;
    name: string;
    totalSlots: number;
    building?: string;
    department?: string;
}

export interface Route {
    _id?: string;
    name: string;
    type: string;
    geometry: {
        type: 'LineString';
        coordinates: number[][];
    };
}

export interface Gate {
    _id?: string;
    name: string;
    type: string;
    geometry: {
        type: 'Point';
        coordinates: number[];
    };
}

export interface MapData {
    parkingAreas: ParkingArea[];
    routes: Route[];
    gates: Gate[];
}

// API Service
class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_URL;
    }

    // Generic fetch wrapper
    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Parking Areas
    async getParkingAreas(): Promise<ParkingArea[]> {
        return this.request<ParkingArea[]>('/parking-areas');
    }

    async createParkingArea(data: Partial<ParkingArea>): Promise<ParkingArea> {
        return this.request<ParkingArea>('/parking-areas', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateParkingArea(id: string, data: Partial<ParkingArea>): Promise<ParkingArea> {
        return this.request<ParkingArea>(`/parking-areas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteParkingArea(id: string): Promise<void> {
        return this.request<void>(`/parking-areas/${id}`, {
            method: 'DELETE',
        });
    }

    // Parking Metadata
    async getParkingMetadata(): Promise<ParkingMetadata[]> {
        return this.request<ParkingMetadata[]>('/parking-metadata');
    }

    async getParkingMetadataByName(name: string): Promise<ParkingMetadata | null> {
        try {
            return await this.request<ParkingMetadata>(`/parking-metadata/by-name/${encodeURIComponent(name)}`);
        } catch (error) {
            return null; // Return null if not found
        }
    }

    async createParkingMetadata(data: Partial<ParkingMetadata>): Promise<ParkingMetadata> {
        return this.request<ParkingMetadata>('/parking-metadata', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Routes
    async getRoutes(): Promise<Route[]> {
        return this.request<Route[]>('/routes');
    }

    async createRoute(data: Partial<Route>): Promise<Route> {
        return this.request<Route>('/routes', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateRoute(id: string, data: Partial<Route>): Promise<Route> {
        return this.request<Route>(`/routes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteRoute(id: string): Promise<void> {
        return this.request<void>(`/routes/${id}`, {
            method: 'DELETE',
        });
    }

    // Gates
    async getGates(): Promise<Gate[]> {
        return this.request<Gate[]>('/gates');
    }

    async createGate(data: Partial<Gate>): Promise<Gate> {
        return this.request<Gate>('/gates', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateGate(id: string, data: Partial<Gate>): Promise<Gate> {
        return this.request<Gate>(`/gates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteGate(id: string): Promise<void> {
        return this.request<void>(`/gates/${id}`, {
            method: 'DELETE',
        });
    }

    // Bulk operations
    async getAllMapData(): Promise<MapData> {
        return this.request<MapData>('/map-data');
    }
}

export const api = new ApiService();

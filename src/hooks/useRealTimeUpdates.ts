import { useState, useCallback } from 'react';

export interface RealTimeUpdate {
    parkingAreaId: string;
    occupiedSlots: number;
    timestamp: number;
}

export const useRealTimeUpdates = () => {
    const [updates, setUpdates] = useState<RealTimeUpdate[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);

    // Simulate real-time parking occupancy changes
    const simulateOccupancyChange = useCallback((parkingAreas: any[]) => {
        if (!isSimulating || parkingAreas.length === 0) return;

        const randomArea = parkingAreas[Math.floor(Math.random() * parkingAreas.length)];
        const totalSlots = randomArea.properties?.totalSlots || 0;
        const currentOccupied = randomArea.properties?.occupiedSlots || 0;

        // Random change: -2 to +2 slots
        const change = Math.floor(Math.random() * 5) - 2;
        const newOccupied = Math.max(0, Math.min(totalSlots, currentOccupied + change));

        if (newOccupied !== currentOccupied) {
            const update: RealTimeUpdate = {
                parkingAreaId: randomArea.id,
                occupiedSlots: newOccupied,
                timestamp: Date.now()
            };

            setUpdates(prev => [...prev, update]);
            return update;
        }
    }, [isSimulating]);

    const startSimulation = useCallback(() => {
        setIsSimulating(true);
    }, []);

    const stopSimulation = useCallback(() => {
        setIsSimulating(false);
    }, []);

    const clearUpdates = useCallback(() => {
        setUpdates([]);
    }, []);

    return {
        updates,
        isSimulating,
        startSimulation,
        stopSimulation,
        clearUpdates,
        simulateOccupancyChange
    };
};

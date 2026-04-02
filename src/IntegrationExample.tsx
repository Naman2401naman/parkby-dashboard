/**
 * INTEGRATION EXAMPLE
 * 
 * This file demonstrates how to integrate all the new components
 * into the existing App.tsx file.
 * 
 * Copy the relevant sections into your App.tsx
 */

import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, BarChart3 } from 'lucide-react';

// Import new components
import { ToastContainer } from './components/Toast';
import { StatsDashboard, type ParkingStats } from './components/StatsDashboard';
import { SearchBar, type ParkingAreaSearchResult } from './components/SearchBar';
import { HelpPanel } from './components/HelpPanel';

// Import new hooks
import { useToast } from './hooks/useToast';
import { useRealTimeUpdates } from './hooks/useRealTimeUpdates';
import { useKeyboardShortcuts, type KeyboardShortcut } from './utils/keyboardShortcuts';

// ============================================
// 1. ADD STATE MANAGEMENT (in your App component)
// ============================================

function EnhancedApp() {
    // Toast notifications
    const { toasts, showToast, removeToast } = useToast();

    // UI state
    const [showStats, setShowStats] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Real-time updates
    const {
        isSimulating,
        startSimulation,
        stopSimulation,
        simulateOccupancyChange
    } = useRealTimeUpdates();

    // ============================================
    // 2. CALCULATE STATISTICS
    // ============================================

    const calculateStats = useCallback((): ParkingStats => {
        // Get all parking areas from your draw instance
        const parkingAreas: any[] = []; // draw.current?.getAll().features.filter(...)

        const totalSpots = parkingAreas.reduce((sum, area) =>
            sum + (area.properties?.totalSlots || 0), 0);

        const occupiedSpots = parkingAreas.reduce((sum, area) =>
            sum + (area.properties?.occupiedSlots || 0), 0);

        const availableSpots = totalSpots - occupiedSpots;
        const occupancyRate = totalSpots > 0
            ? Math.round((occupiedSpots / totalSpots) * 100)
            : 0;

        return {
            totalSpots,
            occupiedSpots,
            availableSpots,
            occupancyRate,
            totalAreas: parkingAreas.length,
            peakHour: '2:00 PM - 3:00 PM',
            averageStayDuration: '2.5 hours'
        };
    }, []);

    // ============================================
    // 3. PREPARE SEARCH DATA
    // ============================================

    const getSearchableAreas = useCallback((): ParkingAreaSearchResult[] => {
        // Get all parking areas from your draw instance
        const parkingAreas: any[] = []; // draw.current?.getAll().features.filter(...)

        return parkingAreas.map(area => {
            const total = area.properties?.totalSlots || 0;
            const occupied = area.properties?.occupiedSlots || 0;
            const available = total - occupied;
            const availability = total > 0 ? Math.round((available / total) * 100) : 0;

            // Calculate center coordinates
            const coords = area.geometry.coordinates[0];
            let sumX = 0, sumY = 0;
            coords.forEach((coord: number[]) => {
                sumX += coord[0];
                sumY += coord[1];
            });
            const centerX = sumX / coords.length;
            const centerY = sumY / coords.length;

            return {
                id: area.id as string,
                name: area.properties?.name || 'Parking Area',
                availability,
                totalSlots: total,
                availableSlots: available,
                coordinates: [centerX, centerY] as [number, number]
            };
        });
    }, []);

    // ============================================
    // 4. DEFINE KEYBOARD SHORTCUTS
    // ============================================

    const shortcuts: KeyboardShortcut[] = [
        {
            key: '?',
            action: () => setShowHelp(!showHelp),
            description: 'Toggle help panel'
        },
        {
            key: 's',
            ctrl: true,
            action: () => {
                // saveDrawings();
                showToast('Drawings saved successfully!', 'success');
            },
            description: 'Save all drawings'
        },
        {
            key: 'p',
            ctrl: true,
            action: () => {
                // drawParkingArea();
                showToast('Draw mode activated', 'info');
            },
            description: 'Draw parking area'
        },
        {
            key: 'd',
            ctrl: true,
            action: () => {
                // deleteSelected();
                showToast('Selected items deleted', 'warning');
            },
            description: 'Delete selected'
        },
        {
            key: 'h',
            ctrl: true,
            action: () => setShowStats(!showStats),
            description: 'Toggle statistics'
        },
        {
            key: 'r',
            ctrl: true,
            action: () => {
                if (isSimulating) {
                    stopSimulation();
                    showToast('Real-time simulation stopped', 'info');
                } else {
                    startSimulation();
                    showToast('Real-time simulation started', 'success');
                }
            },
            description: 'Toggle real-time simulation'
        }
    ];

    useKeyboardShortcuts(shortcuts);

    // ============================================
    // 5. HANDLE SEARCH SELECTION
    // ============================================

    const handleSearchSelect = useCallback((area: ParkingAreaSearchResult) => {
        // Fly to the selected area
        // map.current?.flyTo({
        //   center: area.coordinates,
        //   zoom: 18,
        //   duration: 1500
        // });

        showToast(`Navigating to ${area.name}`, 'info');
    }, [showToast]);

    const handleSearchNavigate = useCallback((area: ParkingAreaSearchResult) => {
        // Navigate to the area and show details
        handleSearchSelect(area);
        showToast(`${area.name}: ${area.availability}% available`, 'info');
    }, [handleSearchSelect, showToast]);

    // ============================================
    // 6. REAL-TIME SIMULATION
    // ============================================

    useEffect(() => {
        if (!isSimulating) return;

        const interval = setInterval(() => {
            // Get parking areas and simulate change
            const parkingAreas: any[] = []; // draw.current?.getAll().features.filter(...)
            const update = simulateOccupancyChange(parkingAreas);

            if (update) {
                // Update the feature in draw
                // draw.current?.setFeatureProperty(
                //   update.parkingAreaId,
                //   'occupiedSlots',
                //   update.occupiedSlots
                // );

                // Optionally show toast for significant changes
                // showToast('Parking occupancy updated', 'info', 2000);
            }
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, [isSimulating, simulateOccupancyChange]);

    // ============================================
    // 7. REPLACE alert() WITH showToast()
    // ============================================

    // BEFORE:
    // alert('Parking area created!');

    // AFTER:
    // showToast('Parking area created successfully!', 'success');

    // BEFORE:
    // alert('Error: Failed to save');

    // AFTER:
    // showToast('Failed to save data. Please try again.', 'error');

    // ============================================
    // 8. JSX ADDITIONS
    // ============================================

    return (
        <div className="relative w-screen h-screen">
            {/* Toast Notifications - Add at the top level */}
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {/* Help Panel - Add at the top level */}
            <HelpPanel
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                shortcuts={shortcuts}
            />

            {/* Map Container */}
            <div className="absolute inset-0">
                {/* Your existing map code */}
            </div>

            {/* Search Bar - Add to top navigation */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
                <SearchBar
                    parkingAreas={getSearchableAreas()}
                    onSelect={handleSearchSelect}
                    onNavigate={handleSearchNavigate}
                />
            </div>

            {/* Statistics Dashboard - Toggle with button */}
            {showStats && (
                <div className="absolute top-24 right-8 z-10">
                    <StatsDashboard
                        stats={calculateStats()}
                        onClose={() => setShowStats(false)}
                    />
                </div>
            )}

            {/* Control Buttons - Add to toolbar */}
            <div className="absolute top-6 right-6 z-10 flex gap-2">
                {/* Statistics Button */}
                <button
                    onClick={() => setShowStats(!showStats)}
                    className={`p-3 rounded-xl backdrop-blur-xl border-2 transition-all ${showStats
                            ? 'bg-emerald-500 border-emerald-400 text-white'
                            : 'bg-slate-900/90 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                    title="Toggle Statistics (Ctrl+H)"
                >
                    <BarChart3 className="w-5 h-5" />
                </button>

                {/* Help Button */}
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className={`p-3 rounded-xl backdrop-blur-xl border-2 transition-all ${showHelp
                            ? 'bg-blue-500 border-blue-400 text-white'
                            : 'bg-slate-900/90 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                        }`}
                    title="Toggle Help (?)"
                >
                    <HelpCircle className="w-5 h-5" />
                </button>

                {/* Real-time Simulation Toggle */}
                <button
                    onClick={() => {
                        if (isSimulating) {
                            stopSimulation();
                            showToast('Real-time simulation stopped', 'info');
                        } else {
                            startSimulation();
                            showToast('Real-time simulation started', 'success');
                        }
                    }}
                    className={`px-4 py-3 rounded-xl backdrop-blur-xl border-2 transition-all text-sm font-bold ${isSimulating
                            ? 'bg-red-500 border-red-400 text-white animate-pulse'
                            : 'bg-slate-900/90 border-slate-500/30 text-slate-400 hover:bg-slate-500/20'
                        }`}
                    title="Toggle Real-time Simulation (Ctrl+R)"
                >
                    {isSimulating ? '⏸ LIVE' : '▶ SIMULATE'}
                </button>
            </div>

            {/* Your existing sidebar, toolbar, etc. */}
        </div>
    );
}

export default EnhancedApp;

import React from 'react';
import { TrendingUp, TrendingDown, Car, MapPin, Clock, Activity } from 'lucide-react';

export interface ParkingStats {
    totalSpots: number;
    occupiedSpots: number;
    availableSpots: number;
    occupancyRate: number;
    totalAreas: number;
    peakHour?: string;
    averageStayDuration?: string;
}

interface StatsDashboardProps {
    stats: ParkingStats;
    onClose?: () => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats, onClose }) => {
    const occupancyTrend = stats.occupancyRate > 50 ? 'up' : 'down';
    const trendColor = stats.occupancyRate > 75 ? 'text-red-400' : stats.occupancyRate > 50 ? 'text-amber-400' : 'text-emerald-400';

    return (
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-emerald-500/30"
            style={{
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.2), 0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-500/20">
                <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-emerald-400" />
                    <h2 className="text-emerald-400 font-bold text-xl uppercase tracking-wider">
                        Live Statistics
                    </h2>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Total Spots */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Car className="w-5 h-5 text-blue-400" />
                        <p className="text-slate-400 text-xs uppercase tracking-wide">Total Spots</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalSpots}</p>
                </div>

                {/* Available Spots */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-emerald-400" />
                        <p className="text-slate-400 text-xs uppercase tracking-wide">Available</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400">{stats.availableSpots}</p>
                </div>

                {/* Occupied Spots */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Car className="w-5 h-5 text-red-400" />
                        <p className="text-slate-400 text-xs uppercase tracking-wide">Occupied</p>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{stats.occupiedSpots}</p>
                </div>

                {/* Parking Areas */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-purple-400" />
                        <p className="text-slate-400 text-xs uppercase tracking-wide">Areas</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-400">{stats.totalAreas}</p>
                </div>
            </div>

            {/* Occupancy Rate */}
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-800/30 rounded-xl p-4 border border-emerald-500/20 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                        <p className="text-slate-300 text-sm font-semibold uppercase tracking-wide">Occupancy Rate</p>
                    </div>
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                        {occupancyTrend === 'up' ? (
                            <TrendingUp className="w-4 h-4" />
                        ) : (
                            <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-2xl font-bold">{stats.occupancyRate}%</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                            width: `${stats.occupancyRate}%`,
                            background: stats.occupancyRate > 75
                                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                : stats.occupancyRate > 50
                                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                    : 'linear-gradient(90deg, #10b981, #059669)',
                            boxShadow: stats.occupancyRate > 75
                                ? '0 0 10px rgba(239, 68, 68, 0.5)'
                                : stats.occupancyRate > 50
                                    ? '0 0 10px rgba(245, 158, 11, 0.5)'
                                    : '0 0 10px rgba(16, 185, 129, 0.5)'
                        }}
                    />
                </div>
            </div>

            {/* Additional Info */}
            {(stats.peakHour || stats.averageStayDuration) && (
                <div className="grid grid-cols-2 gap-4">
                    {stats.peakHour && (
                        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <p className="text-slate-400 text-xs uppercase">Peak Hour</p>
                            </div>
                            <p className="text-white font-semibold">{stats.peakHour}</p>
                        </div>
                    )}

                    {stats.averageStayDuration && (
                        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <p className="text-slate-400 text-xs uppercase">Avg. Stay</p>
                            </div>
                            <p className="text-white font-semibold">{stats.averageStayDuration}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

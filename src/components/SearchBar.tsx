import React, { useState, useEffect } from 'react';
import { Search, X, Navigation2 } from 'lucide-react';

export interface ParkingAreaSearchResult {
    id: string;
    name: string;
    availability: number;
    totalSlots: number;
    availableSlots: number;
    coordinates: [number, number];
}

interface SearchBarProps {
    parkingAreas: ParkingAreaSearchResult[];
    onSelect: (area: ParkingAreaSearchResult) => void;
    onNavigate?: (area: ParkingAreaSearchResult) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ parkingAreas, onSelect, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filteredResults, setFilteredResults] = useState<ParkingAreaSearchResult[]>([]);

    useEffect(() => {
        if (query.trim() === '') {
            setFilteredResults([]);
            setIsOpen(false);
            return;
        }

        const filtered = parkingAreas.filter(area =>
            area.name.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredResults(filtered);
        setIsOpen(filtered.length > 0);
    }, [query, parkingAreas]);

    const handleSelect = (area: ParkingAreaSearchResult) => {
        setQuery('');
        setIsOpen(false);
        onSelect(area);
    };

    const handleNavigate = (area: ParkingAreaSearchResult, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onNavigate) {
            onNavigate(area);
        }
    };

    const getStatusColor = (availability: number) => {
        if (availability >= 60) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' };
        if (availability >= 30) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' };
        return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' };
    };

    return (
        <div className="relative w-full max-w-md">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search parking areas..."
                    className="w-full pl-12 pr-12 py-3 bg-slate-900/90 backdrop-blur-xl border-2 border-emerald-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/60 transition-all"
                    style={{
                        boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
                    }}
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setIsOpen(false);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Search Results Dropdown */}
            {isOpen && filteredResults.length > 0 && (
                <div
                    className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden z-50"
                    style={{
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.2)',
                    }}
                >
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {filteredResults.map((area) => {
                            const colors = getStatusColor(area.availability);
                            return (
                                <div
                                    key={area.id}
                                    onClick={() => handleSelect(area)}
                                    className="px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800/50 last:border-b-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-white font-semibold text-sm mb-1">{area.name}</h4>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className={`${colors.text} font-medium`}>
                                                    {area.availability}% Available
                                                </span>
                                                <span className="text-slate-400">
                                                    {area.availableSlots}/{area.totalSlots} slots
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Status Indicator */}
                                            <div
                                                className={`w-3 h-3 rounded-full ${colors.bg}`}
                                                style={{
                                                    boxShadow: `0 0 10px ${colors.bg === 'bg-emerald-500' ? 'rgba(16, 185, 129, 0.6)' : colors.bg === 'bg-amber-500' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`,
                                                }}
                                            />

                                            {/* Navigate Button */}
                                            {onNavigate && (
                                                <button
                                                    onClick={(e) => handleNavigate(area, e)}
                                                    className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                                                    title="Navigate to this area"
                                                >
                                                    <Navigation2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* No Results */}
            {isOpen && filteredResults.length === 0 && query.trim() !== '' && (
                <div
                    className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border-2 border-slate-700/50 rounded-xl shadow-2xl p-4 text-center text-slate-400 z-50"
                >
                    <p className="text-sm">No parking areas found for "{query}"</p>
                </div>
            )}
        </div>
    );
};

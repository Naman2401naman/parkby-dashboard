import React from 'react';
import { X, Keyboard, Mouse, Info } from 'lucide-react';
import type { KeyboardShortcut } from '../utils/keyboardShortcuts';
import { getShortcutDisplay } from '../utils/keyboardShortcuts';

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts: KeyboardShortcut[];
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose, shortcuts }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-emerald-500/30 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
                style={{
                    boxShadow: '0 0 40px rgba(16, 185, 129, 0.3), 0 20px 60px rgba(0, 0, 0, 0.6)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <Info className="w-6 h-6 text-emerald-400" />
                        <h2 className="text-emerald-400 font-bold text-xl uppercase tracking-wider">
                            Help & Shortcuts
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800/50 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Keyboard Shortcuts Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Keyboard className="w-5 h-5 text-blue-400" />
                        <h3 className="text-white font-bold text-lg">Keyboard Shortcuts</h3>
                    </div>
                    <div className="space-y-2">
                        {shortcuts.map((shortcut, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-emerald-500/30 transition-colors"
                            >
                                <span className="text-slate-300 text-sm">{shortcut.description}</span>
                                <kbd className="px-3 py-1 bg-slate-700 text-emerald-400 rounded-md text-xs font-mono font-bold border border-slate-600">
                                    {getShortcutDisplay(shortcut)}
                                </kbd>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mouse Controls Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mouse className="w-5 h-5 text-purple-400" />
                        <h3 className="text-white font-bold text-lg">Mouse Controls</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <span className="text-slate-300 text-sm">Click parking area to view details</span>
                            <kbd className="px-3 py-1 bg-slate-700 text-purple-400 rounded-md text-xs font-mono font-bold border border-slate-600">
                                Left Click
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <span className="text-slate-300 text-sm">Drag to pan the map</span>
                            <kbd className="px-3 py-1 bg-slate-700 text-purple-400 rounded-md text-xs font-mono font-bold border border-slate-600">
                                Click + Drag
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <span className="text-slate-300 text-sm">Zoom in/out</span>
                            <kbd className="px-3 py-1 bg-slate-700 text-purple-400 rounded-md text-xs font-mono font-bold border border-slate-600">
                                Scroll Wheel
                            </kbd>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <span className="text-slate-300 text-sm">Rotate map (3D view)</span>
                            <kbd className="px-3 py-1 bg-slate-700 text-purple-400 rounded-md text-xs font-mono font-bold border border-slate-600">
                                Ctrl + Drag
                            </kbd>
                        </div>
                    </div>
                </div>

                {/* Features Guide */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="w-5 h-5 text-amber-400" />
                        <h3 className="text-white font-bold text-lg">Features Guide</h3>
                    </div>
                    <div className="space-y-3 text-sm text-slate-300">
                        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <p className="font-semibold text-emerald-400 mb-1">🟢 Parking Areas</p>
                            <p>Color-coded by availability: Green (60%+), Amber (30-60%), Red (&lt;30%)</p>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <p className="font-semibold text-blue-400 mb-1">🔍 Search</p>
                            <p>Quickly find parking areas by name and navigate directly to them</p>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <p className="font-semibold text-purple-400 mb-1">📊 Statistics</p>
                            <p>View real-time occupancy rates, trends, and availability metrics</p>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <p className="font-semibold text-amber-400 mb-1">✏️ Drawing Tools</p>
                            <p>Create parking areas, routes, gates, and entry points with interactive tools</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-emerald-500/20 text-center">
                    <p className="text-slate-400 text-xs">
                        Press <kbd className="px-2 py-1 bg-slate-700 text-emerald-400 rounded text-xs font-mono">?</kbd> anytime to toggle this help panel
                    </p>
                </div>
            </div>
        </div>
    );
};

// src/components/NavigationPanel.jsx

import React from 'react';
import { Navigation, Clock, X } from 'lucide-react';

export const NavigationPanel = ({ 
  instructions, 
  currentStep, 
  distanceRemaining, 
  targetZone,
  onCancel 
}) => {
  if (!instructions.length) return null;

  const current = instructions[currentStep];
  const next = instructions[currentStep + 1];

  return (
    <div className="absolute top-4 left-4 right-4 bg-black/90 backdrop-blur-xl rounded-3xl p-6 text-white shadow-2xl border border-white/10 z-30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Navigation className="text-blue-400" size={24} />
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">NAVIGATING TO</div>
            <div className="font-black text-lg">{targetZone.name}</div>
          </div>
        </div>
        <button 
          onClick={onCancel} 
          className="p-2 hover:bg-white/10 rounded-full transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* Current Instruction */}
      <div className="bg-blue-600 rounded-2xl p-6 mb-4">
        <div className="text-6xl mb-2">{current.icon}</div>
        <div className="text-2xl font-black mb-1">{current.text}</div>
        {distanceRemaining !== null && (
          <div className="text-blue-200 text-lg">
            {distanceRemaining}m ahead
          </div>
        )}
      </div>

      {/* Next Instruction Preview */}
      {next && (
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <div className="text-xs text-slate-400 mb-1">THEN</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{next.icon}</span>
            <span className="font-bold">{next.text}</span>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <span>Step {currentStep + 1}/{instructions.length}</span>
        </div>
      </div>
    </div>
  );
};

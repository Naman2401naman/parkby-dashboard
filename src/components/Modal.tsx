import React, { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

/* ─────────────────────────────────────────────────
   TOAST  (non-blocking notification)
───────────────────────────────────────────────── */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const t = setTimeout(onClose, 3500);
        return () => clearTimeout(t);
    }, [onClose]);

    const cfg = {
        success: { icon: <CheckCircle size={18} />, color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
        error: { icon: <X size={18} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
        warning: { icon: <AlertTriangle size={18} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
        info: { icon: <Info size={18} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
    }[type];

    return (
        <div
            style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 12,
                backdropFilter: 'blur(12px)',
                boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
                animation: 'slideInRight 0.3s ease-out',
                color: '#fff',
                fontSize: 14,
                maxWidth: 340,
                marginBottom: 8,
            }}
        >
            <span style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
            <span style={{ flex: 1 }}>{message}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }}>
                <X size={14} />
            </button>
        </div>
    );
};

/* ─────────────────────────────────────────────────
   TOAST CONTAINER
───────────────────────────────────────────────── */
interface ToastItem { id: number; message: string; type: ToastType; }

interface ToastContainerProps { toasts: ToastItem[]; onClose: (id: number) => void; }

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse' }}>
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => onClose(t.id)} />)}
    </div>
);

/* ─────────────────────────────────────────────────
   BASE MODAL SHELL
───────────────────────────────────────────────── */
interface ModalShellProps { title: string; onClose: () => void; children: React.ReactNode; }

const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, children }) => {
    // Close on Escape
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 8000,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f172a',
                    border: '1.5px solid rgba(16,185,129,0.35)',
                    borderRadius: 20,
                    padding: '28px 28px 24px',
                    minWidth: 340,
                    maxWidth: 460,
                    width: '90vw',
                    boxShadow: '0 0 40px rgba(16,185,129,0.2), 0 24px 60px rgba(0,0,0,0.6)',
                    animation: 'scaleIn 0.25s ease-out',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, color: '#10b981', fontSize: 17, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                        {title}
                    </h3>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#9ca3af' }}>
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────
   SHARED STYLED INPUT
───────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 10, padding: '10px 14px',
    color: '#fff', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s',
};

const labelStyle: React.CSSProperties = {
    display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
};

const btnBase: React.CSSProperties = {
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
};

/* ─────────────────────────────────────────────────
   1.  PARKING AREA MODAL
───────────────────────────────────────────────── */
export interface ParkingModalResult { name: string; totalSlots: number; }

interface ParkingModalProps {
    onConfirm: (result: ParkingModalResult) => void;
    onCancel: () => void;
    prefill?: { name?: string; totalSlots?: number };
}

export const ParkingModal: React.FC<ParkingModalProps> = ({ onConfirm, onCancel, prefill }) => {
    const [name, setName] = React.useState(prefill?.name ?? '');
    const [slots, setSlots] = React.useState(prefill?.totalSlots ? String(prefill.totalSlots) : '');
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => { nameRef.current?.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onConfirm({ name: name.trim(), totalSlots: parseInt(slots) || 0 });
    };

    return (
        <ModalShell title="🅿️ New Parking Area" onClose={onCancel}>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Parking Name</label>
                    <input ref={nameRef} style={inputStyle} value={name} onChange={e => setName(e.target.value)}
                        placeholder="e.g. Block A Parking" />
                </div>
                <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>Total Slots</label>
                    <input style={inputStyle} type="number" min={0} value={slots} onChange={e => setSlots(e.target.value)}
                        placeholder="e.g. 50" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                        Cancel
                    </button>
                    <button type="submit" style={{ ...btnBase, background: '#10b981', color: '#000' }}>
                        Draw Area →
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};

/* ─────────────────────────────────────────────────
   2.  ROUTE NAME MODAL
───────────────────────────────────────────────── */
interface NameModalProps { title: string; placeholder: string; onConfirm: (name: string) => void; onCancel: () => void; }

export const NameModal: React.FC<NameModalProps> = ({ title, placeholder, onConfirm, onCancel }) => {
    const [name, setName] = React.useState('');
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.focus(); }, []);

    return (
        <ModalShell title={title} onClose={onCancel}>
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Name</label>
                <input ref={ref} style={inputStyle} value={name} onChange={e => setName(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancel</button>
                <button onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
                    style={{ ...btnBase, background: '#3b82f6', color: '#fff' }}>
                    Confirm →
                </button>
            </div>
        </ModalShell>
    );
};

/* ─────────────────────────────────────────────────
   3.  ENTRY POINT SELECTOR MODAL
───────────────────────────────────────────────── */
interface EntryPointModalProps {
    areas: { id: string; name: string }[];
    onSelect: (areaId: string) => void;
    onCancel: () => void;
}

export const EntryPointModal: React.FC<EntryPointModalProps> = ({ areas, onSelect, onCancel }) => {
    const [selected, setSelected] = React.useState('');

    return (
        <ModalShell title="📍 Select Parking Area" onClose={onCancel}>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
                Choose a parking area to add an entry point to:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, maxHeight: 240, overflowY: 'auto' }}>
                {areas.map(a => (
                    <button key={a.id} onClick={() => setSelected(a.id)}
                        style={{
                            padding: '10px 14px', borderRadius: 10, border: 'none', textAlign: 'left',
                            cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            background: selected === a.id ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
                            color: selected === a.id ? '#10b981' : '#d1d5db',
                            outline: selected === a.id ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                            transition: 'all 0.15s',
                        }}>
                        {a.name}
                    </button>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel} style={{ ...btnBase, background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancel</button>
                <button onClick={() => { if (selected) onSelect(selected); }}
                    disabled={!selected}
                    style={{ ...btnBase, background: selected ? '#10b981' : '#374151', color: selected ? '#000' : '#6b7280', cursor: selected ? 'pointer' : 'not-allowed' }}>
                    Place Entry Point →
                </button>
            </div>
        </ModalShell>
    );
};

/* ─────────────────────────────────────────────────
   4.  INFO MODAL  (replaces alert)
───────────────────────────────────────────────── */
interface InfoModalProps { title: string; message: string; onClose: () => void; type?: 'info' | 'success' | 'warning'; }

export const InfoModal: React.FC<InfoModalProps> = ({ title, message, onClose, type = 'info' }) => {
    const colors = { info: '#3b82f6', success: '#10b981', warning: '#f59e0b' };
    const c = colors[type];

    return (
        <ModalShell title={title} onClose={onClose}>
            <p style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
            <button onClick={onClose} style={{ ...btnBase, background: c, color: '#000', width: '100%' }}>Got it</button>
        </ModalShell>
    );
};

/* ─────────────────────────────────────────────────
   HOOK: useToast
───────────────────────────────────────────────── */
let _toastId = 0;
export const useToast = () => {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);
    const add = React.useCallback((message: string, type: ToastType = 'info') => {
        const id = ++_toastId;
        setToasts(p => [...p, { id, message, type }]);
    }, []);
    const remove = React.useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
    return { toasts, add, remove };
};

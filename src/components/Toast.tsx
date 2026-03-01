import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5" />;
            case 'error':
                return <AlertCircle className="w-5 h-5" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5" />;
            case 'info':
            default:
                return <Info className="w-5 h-5" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-emerald-500/90',
                    border: 'border-emerald-400',
                    text: 'text-white'
                };
            case 'error':
                return {
                    bg: 'bg-red-500/90',
                    border: 'border-red-400',
                    text: 'text-white'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-500/90',
                    border: 'border-amber-400',
                    text: 'text-white'
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-500/90',
                    border: 'border-blue-400',
                    text: 'text-white'
                };
        }
    };

    const colors = getColors();

    return (
        <div
            className={`toast-item flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl border-2 ${colors.bg} ${colors.border} ${colors.text} shadow-2xl min-w-[300px] max-w-md`}
            style={{
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            }}
        >
            <div className="flex-shrink-0">
                {getIcon()}
            </div>
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export interface ToastContainerProps {
    toasts: ToastProps[];
    onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    return (
        <div className="toast-container fixed top-6 right-6 z-[9999] flex flex-col gap-3">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onClose={onClose} />
            ))}
        </div>
    );
};

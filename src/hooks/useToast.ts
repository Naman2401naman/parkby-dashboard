import { useState, useCallback } from 'react';
import type { ToastProps, ToastType } from '../components/Toast';

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: ToastProps = {
            id,
            message,
            type,
            duration,
            onClose: (toastId: string) => {
                setToasts(prev => prev.filter(t => t.id !== toastId));
            }
        };

        setToasts(prev => [...prev, newToast]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    return {
        toasts,
        showToast,
        removeToast,
        clearAll
    };
};

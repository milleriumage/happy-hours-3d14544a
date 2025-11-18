import { useState, useEffect, useRef, useContext, createContext, FC, ReactNode } from 'react';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastContextValue {
  toast: (props: ToastProps) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<(ToastProps & { id: number })[]>([]);
  const idRef = useRef(0);

  const toast = (props: ToastProps) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { ...props, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.variant === 'destructive' 
                ? 'rgba(239, 68, 68, 0.95)' 
                : 'rgba(34, 197, 94, 0.95)',
              color: 'white',
              padding: '1rem',
              borderRadius: '8px',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{t.title}</div>
            {t.description && (
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>{t.description}</div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

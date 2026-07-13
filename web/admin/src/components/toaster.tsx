import * as Toast from '@radix-ui/react-toast';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: 'default' | 'danger';
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((input: ToastInput) => {
    setToasts((current) => [...current, { ...input, id: nextToastId++ }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) {
                dismiss(item.id);
              }
            }}
            className={`rounded-card border bg-surface p-4 shadow-lg ${
              item.variant === 'danger' ? 'border-danger' : 'border-line'
            }`}
          >
            <Toast.Title
              className={`text-sm font-semibold ${
                item.variant === 'danger' ? 'text-danger' : 'text-ink'
              }`}
            >
              {item.title}
            </Toast.Title>
            {item.description ? (
              <Toast.Description className="mt-1 text-sm text-muted">
                {item.description}
              </Toast.Description>
            ) : null}
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 font-sans" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

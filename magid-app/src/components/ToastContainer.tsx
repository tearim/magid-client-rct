import { useEffect } from 'react';
import { useMagidStore } from '../store/magidStore';
import styles from './ToastContainer.module.css';

function ToastItem({ id, message }: { id: string; message: string }) {
  const dismissToast = useMagidStore((s) => s.dismissToast);

  useEffect(() => {
    const t = setTimeout(() => dismissToast(id), 4500);
    return () => clearTimeout(t);
  }, [id, dismissToast]);

  return (
    <div className={styles.toast} onClick={() => dismissToast(id)}>
      {message}
    </div>
  );
}

export function ToastContainer() {
  const toasts = useMagidStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} />
      ))}
    </div>
  );
}

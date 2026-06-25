import { useEffect, useRef, useCallback } from 'react';
import type { ReactNode, TouchEvent } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export const Modal = ({ open, onClose, title, children }: ModalProps) => {
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const swiping = useRef(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swiping.current) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0) {
      const content = e.currentTarget.querySelector('.modal-content') as HTMLElement;
      if (content) {
        content.style.transform = `translateY(${diff}px)`;
        content.style.opacity = `${1 - diff / 400}`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    swiping.current = false;
    const diff = currentY.current - startY.current;
    if (diff > 80) {
      onClose();
    }
    startY.current = 0;
    currentY.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="modal-content relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl transition-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {title && <h2 className="mb-4 text-xl font-semibold text-gray-900">{title}</h2>}
        {children}
      </div>
    </div>
  );
};

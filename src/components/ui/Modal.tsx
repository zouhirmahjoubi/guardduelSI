import { useState, useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-3xl' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const timeout = setTimeout(() => {
      closeRef.current?.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            ref={panelRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`panel ${maxWidth} w-full max-h-[85vh] flex flex-col overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header justify-between shrink-0">
              <div className="flex items-center gap-2 text-cyan-400">
                {icon}
                <span>{title}</span>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({
  on,
  onChange,
  colorOn = 'bg-emerald-500',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  colorOn?: string;
}) {
  return (
    <button
      className={`toggle ${on ? colorOn : 'bg-obsidian-600'}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span className={`toggle-knob ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function ThreatBadge({ level, label }: { level: string; label?: string }) {
  const map: Record<string, string> = {
    critical: 'badge-crimson',
    high: 'badge-crimson',
    medium: 'badge-amber',
    low: 'badge-cyan',
    safe: 'badge-emerald',
  };
  const cls = map[level] || 'badge-slate';
  return <span className={cls}>{label || level}</span>;
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = ref.current;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (value - start) * eased);
      setDisplay(current);
      ref.current = current;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}

export function TerminalLine({
  prefix,
  text,
  color = 'text-slate-400',
  bold = false,
}: {
  prefix?: string;
  text: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className={`font-mono text-xs leading-relaxed ${color} ${bold ? 'font-bold' : ''}`}>
      {prefix && <span className="text-slate-600">{prefix} </span>}
      {text}
    </div>
  );
}

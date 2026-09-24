import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  height?: string;
  closeOnBackdrop?: boolean;
  zIndexClass?: string;
}

/** Wrapper compartido de overlay + panel para todos los modales de la app. */
export const Modal: React.FC<ModalProps> = ({
  onClose, children, maxWidth = 'max-w-md', height, closeOnBackdrop = false, zIndexClass = 'z-50',
}) => (
  <div
    className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 animate-in fade-in duration-200`}
    onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
  >
    <div className={`bg-white rounded-2xl border border-border shadow-xl w-full ${maxWidth} ${height ?? ''} overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
      {children}
    </div>
  </div>
);

interface ModalHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** 'light' = fondo claro, texto ink (por defecto). 'brand' = fondo azul de marca, texto blanco. */
  tone?: 'light' | 'brand';
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ icon, title, subtitle, onClose, tone = 'light' }) => {
  if (tone === 'brand') {
    return (
      <div className="flex items-center justify-between px-7 py-4 bg-brand-blue shrink-0">
        <div className="flex items-center gap-3">
          {icon && <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">{icon}</div>}
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest leading-none">{title}</h2>
            {subtitle && <p className="text-[9px] text-brand-green font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-sidebar shrink-0">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-brand-blue">{icon}</span>}
        <h3 className="text-base font-bold text-ink">{title}</h3>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-border rounded-full transition-colors">
        <X className="w-4 h-4 text-muted" />
      </button>
    </div>
  );
};

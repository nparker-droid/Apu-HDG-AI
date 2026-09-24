
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  itemName?: string;
  confirmText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "¿Confirmar acción?",
  message,
  itemName,
  confirmText = 'Sí, eliminar definitivamente'
}) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" zIndexClass="z-[100]">
      <div className="p-10 flex flex-col items-center text-center">
        <div className="mb-6">
          <div className="bg-status-red/10 p-4 rounded-full">
            <AlertTriangle className="w-12 h-12 text-status-red" strokeWidth={2.5} />
          </div>
        </div>

        <h3 className="text-xl font-bold text-ink uppercase tracking-tight mb-4">
          {title}
        </h3>

        <div className="text-muted text-sm leading-relaxed mb-8 px-4">
          {message}{itemName && <> <span className="font-bold text-ink">"{itemName}"</span>.</>}
          <br />
          Esta acción borrará todos los datos asociados.
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full py-4 bg-status-red hover:opacity-90 text-white font-semibold uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
          >
            {confirmText}
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-sidebar hover:bg-border text-muted-dark font-semibold uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;

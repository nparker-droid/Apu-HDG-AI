
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  itemName: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "¿CONFIRMAR ACCIÓN?",
  message,
  itemName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-10 flex flex-col items-center text-center">
          {/* Icono de Alerta */}
          <div className="mb-6">
            <div className="bg-red-50 p-4 rounded-full">
              <AlertTriangle className="w-12 h-12 text-red-600" strokeWidth={2.5} />
            </div>
          </div>

          {/* Título */}
          <h3 className="text-2xl font-black text-[#004071] uppercase tracking-tighter mb-4">
            {title}
          </h3>

          {/* Mensaje */}
          <div className="text-slate-500 text-sm leading-relaxed mb-8 px-4">
            {message} <span className="font-black text-[#004071]">"{itemName}"</span>.
            <br />
            Esta acción borrará todos los datos asociados.
          </div>

          {/* Botones */}
          <div className="w-full space-y-3">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="w-full py-4 bg-[#E32626] hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200 active:scale-95"
            >
              SÍ, ELIMINAR DEFINITIVAMENTE
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 bg-[#F1F5F9] hover:bg-slate-200 text-slate-500 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
            >
              CANCELAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

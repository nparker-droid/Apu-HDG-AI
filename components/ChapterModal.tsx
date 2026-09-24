import React, { useState } from 'react';
import { Save, Layers } from 'lucide-react';
import { Modal, ModalHeader } from './ui/Modal';

interface ChapterModalProps {
  onClose: () => void;
  onSubmit: (name: string) => void;
}

const ChapterModal: React.FC<ChapterModalProps> = ({ onClose, onSubmit }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('El nombre del capítulo es obligatorio');
    onSubmit(name);
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <ModalHeader icon={<Layers className="w-5 h-5" />} title="Nuevo Capítulo" onClose={onClose} />

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">Nombre del Capítulo</label>
          <input
            type="text"
            autoFocus
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 bg-sidebar border border-border focus:ring-2 focus:ring-brand-blue focus:border-transparent rounded-xl text-sm font-semibold text-ink outline-none"
            placeholder="Ej: Movimiento de Tierras, Obra Gruesa..."
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Capítulo
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChapterModal;

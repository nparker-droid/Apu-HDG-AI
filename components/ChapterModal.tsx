import React, { useState } from 'react';
import { X, Save, Layers } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-800">Nuevo Capítulo</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre del Capítulo</label>
            <input 
              type="text" 
              autoFocus
              required 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-semibold"
              placeholder="Ej: Movimiento de Tierras, Obra Gruesa..."
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Capítulo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChapterModal;
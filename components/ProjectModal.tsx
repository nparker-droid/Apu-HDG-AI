import { useState } from 'react';
import { Save, Settings2, MapPin, ClipboardList, TrendingUp } from 'lucide-react';
import { Project } from '../types';
import { Modal, ModalHeader } from './ui/Modal';

const emptyFieldClass = (isEmpty: boolean) => isEmpty ? 'border border-status-amber/40 bg-status-amber/5' : 'bg-sidebar border border-transparent';

interface ProjectModalProps {
  onClose: () => void;
  // Omit updatedAt because it's handled on submit by the parent component or storage layer
  onSubmit: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: Project;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    code: initialData?.code || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    mandante: initialData?.mandante || '',
    location: initialData?.location || '',
    commune: initialData?.commune || '',
    region: initialData?.region || '',
    version: initialData?.version || '1.0',
    stage: initialData?.stage || 'Licitación',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    globalSocialLaws: initialData?.globalSocialLaws || 30,
    globalOverhead: initialData?.globalOverhead || 15,
    globalUtility: initialData?.globalUtility || 10
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return alert('Nombre y Código son obligatorios');
    // onSubmit now correctly expects the fields provided in formData
    onSubmit(formData);
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <ModalHeader icon={<Settings2 className="w-5 h-5" />} title="Ficha Técnica de Proyecto" onClose={onClose} />

      <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* SECCIÓN: IDENTIFICACIÓN */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-brand-green">
            <ClipboardList className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Identificación del Proyecto</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="md:col-span-1">
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Código HDG</label>
                <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className={`w-full px-4 py-3 rounded-xl text-sm font-mono text-ink outline-none focus:ring-2 focus:ring-brand-blue transition-colors ${emptyFieldClass(!formData.code)}`} placeholder="HDG-2024-XX" />
             </div>
             <div className="md:col-span-2">
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Nombre del Proyecto</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={`w-full px-4 py-3 rounded-xl text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brand-blue transition-colors ${emptyFieldClass(!formData.name)}`} />
             </div>
             <div className="md:col-span-1">
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Fecha Emisión</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={`w-full px-4 py-3 rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-brand-blue transition-colors ${emptyFieldClass(!formData.date)}`} />
             </div>
             <div className="md:col-span-4">
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Mandante / Entidad Licitante</label>
                <input type="text" value={formData.mandante} onChange={e => setFormData({...formData, mandante: e.target.value})} className="w-full px-4 py-3 bg-sidebar border border-transparent rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-brand-blue transition-colors" placeholder="Ej: Dirección de Obras Hidráulicas (MOP)" />
             </div>
          </div>
        </div>

        {/* SECCIÓN: DESCRIPCIÓN Y UBICACIÓN */}
        <div className="space-y-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-brand-green">
            <MapPin className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Descripción y Ubicación</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Descripción General</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-sidebar border border-transparent rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-brand-blue transition-colors" placeholder="Alcance del proyecto..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Versión / Etapa</label>
                <div className="flex gap-2">
              <input type="text" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className={`w-1/3 px-4 py-3 rounded-xl text-sm text-ink outline-none transition-colors ${emptyFieldClass(!formData.version)}`} placeholder="Ej: REV A" />
                  <select value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})} className="w-2/3 px-4 py-3 bg-sidebar border border-transparent rounded-xl text-sm text-ink outline-none transition-colors">
                    <option>Estudio de Perfil</option>
                    <option>Licitación</option>
                    <option>Construcción</option>
                    <option>As-Built</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Comuna</label>
                <input type="text" value={formData.commune} onChange={e => setFormData({...formData, commune: e.target.value})} className="w-full px-4 py-3 bg-sidebar border border-transparent rounded-xl text-sm text-ink outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-muted uppercase mb-1">Región</label>
                <input type="text" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full px-4 py-3 bg-sidebar border border-transparent rounded-xl text-sm text-ink outline-none transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN: VALORES ECONÓMICOS */}
        <div className="space-y-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-brand-blue">
            <TrendingUp className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Configuración Económica Global</h4>
          </div>
          <div className="bg-brand-blue/5 p-8 rounded-2xl grid grid-cols-3 gap-8 border border-brand-blue/10">
             <div className="space-y-2">
                <label className="block text-[9px] font-semibold text-brand-blue uppercase text-center">Leyes Sociales (%)</label>
                <input type="number" step="0.1" value={formData.globalSocialLaws} onFocus={e => e.currentTarget.select()} onChange={e => setFormData({...formData, globalSocialLaws: parseFloat(e.target.value) || 0})} className={`w-full px-4 py-3 rounded-xl text-center font-bold text-brand-blue outline-none focus:ring-2 focus:ring-brand-green transition-colors ${emptyFieldClass(!formData.globalSocialLaws)}`} />
             </div>
             <div className="space-y-2">
                <label className="block text-[9px] font-semibold text-brand-blue uppercase text-center">Gastos Generales (%)</label>
                <input type="number" step="0.1" value={formData.globalOverhead} onFocus={e => e.currentTarget.select()} onChange={e => setFormData({...formData, globalOverhead: parseFloat(e.target.value) || 0})} className={`w-full px-4 py-3 rounded-xl text-center font-bold text-brand-blue outline-none focus:ring-2 focus:ring-brand-green transition-colors ${emptyFieldClass(!formData.globalOverhead)}`} />
             </div>
             <div className="space-y-2">
                <label className="block text-[9px] font-semibold text-brand-blue uppercase text-center">Utilidades (%)</label>
                <input type="number" step="0.1" value={formData.globalUtility} onFocus={e => e.currentTarget.select()} onChange={e => setFormData({...formData, globalUtility: parseFloat(e.target.value) || 0})} className={`w-full px-4 py-3 rounded-xl text-center font-bold text-brand-blue outline-none focus:ring-2 focus:ring-brand-green transition-colors ${emptyFieldClass(!formData.globalUtility)}`} />
             </div>
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Save className="w-5 h-5" /> {initialData ? 'Actualizar Ficha de Proyecto' : 'Inicializar Nuevo Proyecto Hidrogestión'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectModal;

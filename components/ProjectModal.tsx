
import { useState } from 'react';
import { X, Save, Settings2, MapPin, ClipboardList, TrendingUp } from 'lucide-react';
import { Project } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#004071]/40 backdrop-blur-md p-4 transition-colors">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-[#004071]" />
            <h3 className="text-xl font-black text-[#004071] uppercase tracking-tighter">Ficha Técnica de Proyecto</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[85vh] overflow-y-auto no-scrollbar">
          {/* SECCIÓN: IDENTIFICACIÓN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-[#88C13E]">
              <ClipboardList className="w-4 h-4" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Identificación del Proyecto</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="md:col-span-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Código HDG</label>
                  <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#004071] transition-colors" placeholder="HDG-2024-XX" />
               </div>
               <div className="md:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Nombre del Proyecto</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#004071] transition-colors" />
               </div>
               <div className="md:col-span-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Fecha Emisión</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#004071] transition-colors" />
               </div>
            </div>
          </div>

          {/* SECCIÓN: DESCRIPCIÓN Y UBICACIÓN */}
          <div className="space-y-6 pt-4 border-t border-slate-100 transition-colors">
            <div className="flex items-center gap-2 text-[#88C13E]">
              <MapPin className="w-4 h-4" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Descripción y Ubicación</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Descripción General</label>
                  <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#004071] transition-colors" placeholder="Alcance del proyecto..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Versión / Etapa</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-1/3 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm transition-colors" placeholder="Ej: REV A" />
                    <select value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})} className="w-2/3 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm transition-colors">
                      <option>Estudio de Perfil</option>
                      <option>Licitación</option>
                      <option>Construcción</option>
                      <option>As-Built</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Comuna</label>
                  <input type="text" value={formData.commune} onChange={e => setFormData({...formData, commune: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Región</label>
                  <input type="text" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN: VALORES ECONÓMICOS */}
          <div className="space-y-6 pt-4 border-t border-slate-100 transition-colors">
            <div className="flex items-center gap-2 text-[#004071]">
              <TrendingUp className="w-4 h-4" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Configuración Económica Global</h4>
            </div>
            <div className="bg-[#004071]/5 p-8 rounded-[2rem] grid grid-cols-3 gap-8 border border-[#004071]/10 transition-colors">
               <div className="space-y-2">
                  <label className="block text-[9px] font-bold text-[#004071] uppercase text-center">Leyes Sociales (%)</label>
                  <input type="number" step="0.1" value={formData.globalSocialLaws} onChange={e => setFormData({...formData, globalSocialLaws: parseFloat(e.target.value)})} className="w-full px-4 py-3 bg-white border-none rounded-xl text-center font-black text-indigo-600 shadow-sm focus:ring-2 focus:ring-[#88C13E] transition-colors" />
               </div>
               <div className="space-y-2">
                  <label className="block text-[9px] font-bold text-[#004071] uppercase text-center">Gastos Generales (%)</label>
                  <input type="number" step="0.1" value={formData.globalOverhead} onChange={e => setFormData({...formData, globalOverhead: parseFloat(e.target.value)})} className="w-full px-4 py-3 bg-white border-none rounded-xl text-center font-black text-indigo-600 shadow-sm focus:ring-2 focus:ring-[#88C13E] transition-colors" />
               </div>
               <div className="space-y-2">
                  <label className="block text-[9px] font-bold text-[#004071] uppercase text-center">Utilidades (%)</label>
                  <input type="number" step="0.1" value={formData.globalUtility} onChange={e => setFormData({...formData, globalUtility: parseFloat(e.target.value)})} className="w-full px-4 py-3 bg-white border-none rounded-xl text-center font-black text-indigo-600 shadow-sm focus:ring-2 focus:ring-[#88C13E] transition-colors" />
               </div>
            </div>
          </div>

          <div className="pt-6">
            <button type="submit" className="w-full bg-[#004071] hover:bg-[#002D50] text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
              <Save className="w-5 h-5" /> {initialData ? 'Actualizar Ficha de Proyecto' : 'Inicializar Nuevo Proyecto Hidrogestión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;

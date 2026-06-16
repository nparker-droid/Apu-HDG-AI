import React, { useEffect } from 'react';
import { X, Cpu, FolderOpen, Layers, DollarSign, CloudUpload, Download, BookOpen, Zap, AlertTriangle, Search, ChevronRight } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Section {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: { label: string; desc: string }[];
}

const SECTIONS: Section[] = [
  {
    icon: <Layers className="w-4 h-4" />,
    title: 'Flujo de trabajo',
    color: '#004071',
    items: [
      { label: 'Nuevo proyecto', desc: 'Crea un proyecto con código, fecha y parámetros económicos globales (leyes sociales, GG, utilidad).' },
      { label: 'Capítulos', desc: 'Organiza el presupuesto en capítulos. Se numeran automáticamente. Edita el nombre haciendo clic en el ícono de lápiz.' },
      { label: 'Partidas (APU)', desc: 'Cada partida es un Análisis de Precio Unitario. Se puede crear vacía o cargar desde la biblioteca.' },
      { label: 'Ítems de costo', desc: 'Agrega recursos en 4 categorías: Material, Mano de Obra, Equipo y Otros.' },
    ],
  },
  {
    icon: <DollarSign className="w-4 h-4" />,
    title: 'Estructura de costos',
    color: '#88C13E',
    items: [
      { label: 'Costo Directo', desc: 'Σ Material + (Σ M.O. × (1 + Leyes/100)) + Σ Equipo + Σ Otros.' },
      { label: 'Precio Unitario Neto', desc: 'Costo Directo × (1 + (GG% + Utilidad%) / 100). Sin IVA.' },
      { label: 'Leyes Sociales', desc: 'Se aplican solo a Mano de Obra. Default global o por partida individualmente.' },
      { label: 'Divisor de cantidad', desc: 'Divide el precio unitario entre N unidades. Útil cuando el APU representa una cuadrilla o un grupo.' },
    ],
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    title: 'Inteligencia Artificial',
    color: '#6366f1',
    items: [
      { label: 'Generar APU con IA', desc: 'Ingresa el nombre de la partida y pulsa "Sugerir con IA". Genera todos los ítems de costo automáticamente.' },
      { label: 'Precio web', desc: 'En cada ítem de M.O., Material o Equipo: botón ✦ busca el precio actual en proveedores chilenos (requiere plan pago de Gemini).' },
      { label: 'Alerta de desviación', desc: 'Si un precio difiere significativamente del histórico, aparece un indicador naranja con análisis de la IA.' },
      { label: 'Sugerencia de campo', desc: 'En descripción, unidad y rendimiento: IA sugiere valores basándose en el contexto del APU.' },
    ],
  },
  {
    icon: <CloudUpload className="w-4 h-4" />,
    title: 'Sincronización Drive',
    color: '#2563eb',
    items: [
      { label: 'Conectar', desc: 'Botón "Drive" en el header. Requiere cuenta Google y Drive API habilitada en Google Cloud Console.' },
      { label: 'Auto-save', desc: 'Si estás conectado, el respaldo se sube automáticamente cada 5 minutos a Mi unidad / APU Hidrogestion.' },
      { label: 'Guardar manual', desc: 'Pasa el cursor sobre el botón Drive → "Guardar en Drive" para forzar un backup inmediato.' },
      { label: 'Restaurar', desc: 'Descarga el último backup desde Drive y reemplaza los datos locales. Úsalo para cambiar de dispositivo.' },
    ],
  },
  {
    icon: <Download className="w-4 h-4" />,
    title: 'Exportación',
    color: '#16a34a',
    items: [
      { label: 'Reporte Excel', desc: 'Genera un .xlsx con hoja de presupuesto general y una hoja individual por cada APU del proyecto.' },
      { label: 'PDF APUs', desc: 'En el sidebar del proyecto: exporta todas las partidas en formato de ficha técnica.' },
      { label: 'PDF Presupuesto', desc: 'Resumen por capítulos con totales netos, IVA y total bruto.' },
      { label: 'Exportar / Importar JSON', desc: 'Exporta un proyecto completo como .json para compartir con otro usuario de la plataforma.' },
    ],
  },
  {
    icon: <BookOpen className="w-4 h-4" />,
    title: 'Biblioteca',
    color: '#88C13E',
    items: [
      { label: 'Biblioteca del usuario', desc: 'Guarda recursos (insumos, mano de obra, equipos) con precio de referencia reutilizables entre proyectos.' },
      { label: 'Cargar desde biblioteca', desc: 'En el menú "+" de cada capítulo: importa APUs de proyectos anteriores o de la biblioteca estándar.' },
      { label: 'Historial de precios', desc: 'Al ingresar un recurso ya usado antes, aparece el precio histórico como referencia.' },
      { label: 'Recursos entre proyectos', desc: 'La biblioteca de usuario es transversal: los recursos guardados en un proyecto están disponibles en todos.' },
    ],
  },
];

const TIPS = [
  { icon: <Zap className="w-3 h-3" />, text: 'Los datos se guardan automáticamente en el navegador cada 2.5 segundos.' },
  { icon: <AlertTriangle className="w-3 h-3" />, text: 'El almacenamiento local tiene límite de ~5 MB. Usa Drive para proyectos grandes.' },
  { icon: <Search className="w-3 h-3" />, text: 'La búsqueda de precios web requiere el plan de pago de la API de Gemini (Google AI Studio).' },
  { icon: <FolderOpen className="w-3 h-3" />, text: 'Los precios están en CLP sin IVA. El reporte Excel incluye cálculo de IVA 19% como referencia.' },
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-[#0a1628] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-700/50">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-[#004071] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-[#88C13E]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Manual de operación</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">APU Engine — Hidrogestión</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-8 py-6 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {SECTIONS.map((section) => (
              <div key={section.title} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: section.color + '22', color: section.color }}>
                    {section.icon}
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white">{section.title}</h3>
                </div>
                <div className="space-y-2.5">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: section.color }} />
                      <div>
                        <span className="text-[9px] font-black text-slate-200 uppercase tracking-wider">{item.label} — </span>
                        <span className="text-[9px] text-slate-400 leading-relaxed">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tips técnicos */}
          <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/30">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Notas técnicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5 shrink-0">{tip.icon}</span>
                  <p className="text-[9px] text-slate-400 leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-700/60 flex items-center justify-between shrink-0">
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Presiona ESC para cerrar</p>
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Hidrogestión © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

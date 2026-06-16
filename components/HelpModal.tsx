import React, { useState, useEffect } from 'react';
import { X, Layers, DollarSign, Cpu, CloudUpload, Download, BookOpen } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  text: string;
}

interface SectionData {
  id: string;
  icon: React.ReactNode;
  label: string;
  steps: Step[];
  tip?: string;
}

const SECTIONS: SectionData[] = [
  {
    id: 'flujo',
    icon: <Layers className="w-4 h-4" />,
    label: 'Flujo de trabajo',
    steps: [
      { text: 'Crear proyecto — código, fecha, versión y parámetros económicos globales (leyes sociales, GG, utilidad).' },
      { text: 'Crear capítulos — organiza el presupuesto por especialidad o sector. Se numeran automáticamente.' },
      { text: 'Agregar partidas (APU) — crea vacía, carga desde biblioteca o genera con IA ingresando el nombre.' },
      { text: 'Completar ítems de costo — Material, Mano de Obra, Equipo y Otros. Ingresa rendimiento, precio unitario y cantidad.' },
      { text: 'Revisar resumen general — verifica totales por capítulo, costo directo y precio unitario neto.' },
      { text: 'Exportar — Reporte Excel, PDF de APUs o PDF de presupuesto general.' },
    ],
    tip: 'Los datos se guardan automáticamente cada 2.5 segundos en el navegador. Conecta Drive para respaldo en la nube.',
  },
  {
    id: 'costos',
    icon: <DollarSign className="w-4 h-4" />,
    label: 'Estructura de costos',
    steps: [
      { text: 'Costo Directo = Σ Material + (Σ M.O. × (1 + Leyes%/100)) + Σ Equipo + Σ Otros.' },
      { text: 'Las Leyes Sociales se aplican solo a Mano de Obra. Se configuran globalmente en el proyecto o por partida.' },
      { text: 'Precio Unitario Neto = Costo Directo × (1 + (GG% + Utilidad%) / 100). Sin IVA.' },
      { text: 'El divisor de cantidad permite dividir el P.U. entre N unidades — útil para cuadrillas o rendimientos globales.' },
      { text: 'Para Mano de Obra se usa Rendimiento (HH/UM) en lugar de cantidad directa.' },
      { text: 'Todos los montos en CLP. El reporte Excel incluye IVA 19% solo como referencia informativa.' },
    ],
    tip: 'Puedes sobrescribir las tasas globales del proyecto para una partida específica desactivando "Usar tasas globales".',
  },
  {
    id: 'ia',
    icon: <Cpu className="w-4 h-4" />,
    label: 'Inteligencia Artificial',
    steps: [
      { text: 'Generar APU con IA — ingresa el nombre de la partida y pulsa "Sugerir con IA". Crea todos los ítems automáticamente.' },
      { text: 'Precio web — botón ✦ en cada ítem busca precios en proveedores chilenos en tiempo real.' },
      { text: 'Alerta de desviación — si un precio difiere del histórico, aparece indicador naranja con análisis contextual.' },
      { text: 'Sugerencia de campo — la IA autocompleta descripción, unidad y rendimiento según el contexto del APU.' },
    ],
    tip: 'La búsqueda de precios web (botón ✦) requiere el plan de pago de la API de Gemini. Las demás funciones IA operan en tier gratuito.',
  },
  {
    id: 'drive',
    icon: <CloudUpload className="w-4 h-4" />,
    label: 'Drive & Backup',
    steps: [
      { text: 'Conectar — botón "Drive" en el header. Requiere cuenta Google y Google Drive API habilitada en Google Cloud Console.' },
      { text: 'Auto-save — si estás conectado, el respaldo sube automáticamente cada 5 minutos sin interrumpir el trabajo.' },
      { text: 'Guardar manual — pasa el cursor sobre el botón Drive y selecciona "Guardar en Drive".' },
      { text: 'Ubicación del archivo — Mi unidad / APU Hidrogestion / apu-engine-backup.json (carpeta visible en Drive).' },
      { text: 'Restaurar — descarga el último backup y reemplaza los datos locales. Útil para cambiar de dispositivo o navegador.' },
      { text: 'La sesión persiste entre recargas. Solo se solicita login si la sesión expira o se desconecta manualmente.' },
    ],
    tip: 'Si la app muestra error 403 al conectar Drive, habilita la Google Drive API en console.cloud.google.com → APIs y servicios.',
  },
  {
    id: 'export',
    icon: <Download className="w-4 h-4" />,
    label: 'Exportaciones',
    steps: [
      { text: 'Reporte Excel — genera un .xlsx con hoja de presupuesto general y una hoja de detalle por cada APU del proyecto.' },
      { text: 'PDF APUs — exporta todas las partidas en formato de ficha técnica (desde el sidebar del proyecto).' },
      { text: 'PDF Presupuesto — resumen por capítulos con totales netos, IVA y total bruto del proyecto.' },
      { text: 'Exportar JSON — guarda el proyecto completo como archivo .json para compartir con otro usuario de la plataforma.' },
      { text: 'Importar JSON — carga un proyecto exportado previamente. Se asignan nuevos IDs automáticamente.' },
    ],
    tip: 'Los reportes Excel y PDF requieren las librerías SheetJS y jsPDF cargadas desde CDN. Verifica conexión a internet al exportar.',
  },
  {
    id: 'biblioteca',
    icon: <BookOpen className="w-4 h-4" />,
    label: 'Biblioteca',
    steps: [
      { text: 'Biblioteca del usuario — guarda recursos (insumos, M.O., equipos) con precio de referencia para reutilizar entre proyectos.' },
      { text: 'Cargar desde biblioteca — en el menú "+" de cada capítulo: importa APUs de proyectos anteriores o de la biblioteca estándar.' },
      { text: 'Historial de precios — al ingresar un recurso ya usado antes, aparece el último precio registrado como referencia.' },
      { text: 'Los recursos guardados en la biblioteca son transversales a todos los proyectos de la cuenta.' },
    ],
    tip: 'La biblioteca estándar incluye ítems de uso frecuente en obras hidráulicas y sanitarias con valores de referencia del mercado chileno.',
  },
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeId, setActiveId] = useState('flujo');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const active = SECTIONS.find(s => s.id === activeId) || SECTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-4 bg-[#004071] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest leading-none">Referencia Técnica</h2>
              <p className="text-[9px] text-[#88C13E] font-black uppercase tracking-widest mt-0.5">APU Engine · Manual de operación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar nav */}
          <nav className="w-52 bg-[#f0f4f8] border-r border-slate-200 flex flex-col py-4 shrink-0 overflow-y-auto no-scrollbar">
            {SECTIONS.map((s) => {
              const isActive = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={`relative flex items-center gap-3 px-5 py-3 text-left transition-all ${
                    isActive
                      ? 'text-[#004071] font-black'
                      : 'text-slate-500 font-bold hover:text-[#004071] hover:bg-slate-200/50'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#004071] rounded-r-full" />
                  )}
                  <span className={`${isActive ? 'text-[#004071]' : 'text-slate-400'}`}>
                    {s.icon}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest leading-tight">{s.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-7">
            {/* Section title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#004071]/10 flex items-center justify-center text-[#004071]">
                {active.icon}
              </div>
              <h3 className="text-sm font-black text-[#004071] uppercase tracking-widest">{active.label}</h3>
            </div>

            {/* Steps */}
            <ol className="space-y-4 mb-6">
              {active.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-[#004071] text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">{step.text}</p>
                </li>
              ))}
            </ol>

            {/* Tip card */}
            {active.tip && (
              <div className="flex items-start gap-3 bg-[#88C13E]/10 border-l-2 border-[#88C13E] rounded-r-xl px-4 py-3">
                <div className="w-4 h-4 rounded-full bg-[#88C13E] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[8px] font-black">!</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">{active.tip}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">HDG Engineering · {new Date().getFullYear()}</p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#004071] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#002D50] transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

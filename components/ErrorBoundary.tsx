import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[APU Engine] Error no capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#F1F5F9] p-8">
          <div className="text-center space-y-4 max-w-md bg-white p-10 rounded-[2rem] shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-black text-[#004071] uppercase tracking-tighter">Error inesperado</h2>
            <p className="text-sm text-slate-500 font-mono bg-slate-50 p-3 rounded-lg text-left break-all">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <p className="text-xs text-slate-400">Tus datos están guardados en localStorage. Puedes recargar la app de forma segura.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#004071] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#002D50] transition-all"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

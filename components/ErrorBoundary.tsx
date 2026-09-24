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
        <div className="h-screen flex items-center justify-center bg-surface p-8">
          <div className="text-center space-y-4 max-w-md bg-white p-10 rounded-2xl shadow-sm border border-border">
            <h2 className="text-2xl font-bold text-brand-blue uppercase tracking-tighter">Error inesperado</h2>
            <p className="text-sm text-muted-dark font-mono bg-sidebar p-3 rounded-lg text-left break-all">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <p className="text-xs text-muted">Tus datos están guardados en localStorage. Puedes recargar la app de forma segura.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-blue-dark transition-all"
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

import React from 'react';
import { FolderOpen, Cloud, HardDrive, ShieldCheck, Loader2 } from 'lucide-react';
import { Modal, ModalHeader } from './ui/Modal';
import { BackupTarget } from '../services/backupData';

interface BackupSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTarget: BackupTarget | null;
  /** Nombre de la carpeta ya elegida que requiere volver a autorizar (sesión nueva) */
  pendingFolderName?: string | null;
  folderSupported: boolean;
  driveAvailable: boolean;
  busy?: boolean;
  onResumeFolder: () => void;
  onChooseFolder: () => void;
  onChooseDrive: () => void;
  onChooseNone: () => void;
}

const OptionButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: string;
}> = ({ icon, title, description, onClick, disabled, active, badge }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-left flex gap-4 items-start p-4 rounded-2xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      active ? 'border-brand-blue bg-brand-blue/5' : 'border-border hover:border-brand-blue hover:bg-sidebar'
    }`}
  >
    <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">{icon}</div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-ink flex items-center gap-2">
        {title}
        {badge && <span className="text-[8px] font-bold uppercase tracking-widest text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">{badge}</span>}
      </p>
      <p className="text-xs text-muted leading-relaxed mt-0.5">{description}</p>
    </div>
  </button>
);

/** Selección del destino de respaldo: carpeta del equipo, Google Drive o sin respaldo automático */
const BackupSetupModal: React.FC<BackupSetupModalProps> = ({
  isOpen, onClose, currentTarget, pendingFolderName, folderSupported, driveAvailable, busy,
  onResumeFolder, onChooseFolder, onChooseDrive, onChooseNone
}) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndexClass="z-[90]">
      <ModalHeader icon={<ShieldCheck className="w-5 h-5" />} title="Respaldo de tus proyectos" onClose={onClose} />
      <div className="p-6 space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          Los proyectos se guardan en este navegador. Elige dónde guardar una copia de respaldo automática
          (cada 5 minutos si hay cambios, conservando las últimas 15 versiones).
        </p>

        {pendingFolderName && (
          <button
            onClick={onResumeFolder}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            Continuar con la carpeta «{pendingFolderName}»
          </button>
        )}

        <div className="space-y-2">
          <OptionButton
            icon={<FolderOpen className="w-5 h-5" />}
            title={pendingFolderName ? 'Elegir otra carpeta' : 'Carpeta en este equipo'}
            badge={pendingFolderName ? undefined : 'Recomendado'}
            active={currentTarget === 'folder' && !pendingFolderName}
            description={folderSupported
              ? 'Selecciona una carpeta del computador. Si eliges una carpeta sincronizada (OneDrive, Dropbox o Google Drive para escritorio), el respaldo también queda en la nube.'
              : 'No disponible en este navegador. Funciona en Chrome o Edge de escritorio.'}
            onClick={onChooseFolder}
            disabled={!folderSupported || busy}
          />
          {driveAvailable && (
            <OptionButton
              icon={<Cloud className="w-5 h-5" />}
              title="Google Drive"
              active={currentTarget === 'drive'}
              description="Guarda el respaldo en tu Google Drive (carpeta «APU Hidrogestion»). Requiere iniciar sesión con Google; la sesión dura cerca de 1 hora."
              onClick={onChooseDrive}
              disabled={busy}
            />
          )}
          <OptionButton
            icon={<HardDrive className="w-5 h-5" />}
            title="Sin respaldo automático"
            active={currentTarget === 'none'}
            description="Solo descargas manuales desde el botón de respaldo. Si se borran los datos del navegador, se pierde lo no descargado."
            onClick={onChooseNone}
            disabled={busy}
          />
        </div>
      </div>
    </Modal>
  );
};

export default BackupSetupModal;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, Save, Loader2, Download, Plus, Check, Clock, Database, CloudUpload, CloudDownload, CloudOff, FolderOpen, RefreshCw, LogOut, HelpCircle, LayoutList, Layers, Table2, HardDrive, BookOpen, Share2, FileText, Table, FileInput, FileOutput } from 'lucide-react';
import { useAppStore, STORAGE_ERROR_EVENT, getStorageUsage, STORAGE_QUOTA_BYTES } from './store/useAppStore';
import ResourceSummary from './components/ResourceSummary';
import ProjectSheet from './components/ProjectSheet';
import QuickCalculator from './components/QuickCalculator';
import ConfirmationModal from './components/ui/ConfirmationModal';
import { normalizeApu } from './lib/apuCalculations';
import { formatNumber } from './lib/number';
import { buildChapterOutline } from './lib/chapters';
import Sidebar from './components/Layout/Sidebar';
import APUEditor from './components/APUEditor';
import ProjectModal from './components/ProjectModal';
import ChapterModal from './components/ChapterModal';
import LibraryModal from './components/LibraryModal';
import ProjectGeneralView from './components/ProjectGeneralView';
import HelpModal from './components/HelpModal';
import { exportProjectToExcel } from './services/excelExportService';
import { exportProjectToPDF, exportBudgetToPDF } from './services/exportService';
import { saveBlobWithPicker } from './services/fileSaveService';
import { Project, APU, Chapter, ItemCategory } from './types';
import { Toaster, toast } from 'sonner';
import {
  initDriveAuth, requestDriveAccess, saveAllToDrive, loadFromDrive,
  isDriveConnected, disconnectDrive, getLastSyncTime, GOOGLE_CLIENT_ID,
  autoReconnectDrive, inspectDriveBackup, DriveAuthRequiredError
} from './services/driveService';
import {
  isFolderBackupSupported, getSavedFolder, folderPermission, requestFolderPermission,
  pickBackupFolder, saveToFolder, loadFromFolder, inspectFolderBackup, getLastFolderSync
} from './services/localFolderService';
import {
  BackupFile, BackupGuardError, BackupTarget, getBackupTarget, setBackupTarget,
  applyBackup, isValidBackup, downloadBackupFile
} from './services/backupData';
import BackupSetupModal from './components/BackupSetupModal';

const safeUUID = () => crypto.randomUUID();

const App: React.FC = () => {
  const {
    projects, setProjects, reorderProject,
    chapters, setChapters, addChapter, moveChapter, reorderChapter, moveChildInChapter, deleteChapter,
    apus, setApus, updateApu, deleteApu, moveApu, moveApuToChapter, duplicateApu,
    history, addHistoryItem,
    activeProjectId, setActiveProjectId, loadProject, saveActiveProject,
    deleteProject, duplicateProject, lastSaved,
    reloadFromStorage, sheet, setSheet
  } = useAppStore();
  const [projectView, setProjectView] = useState<'budget' | 'resources' | 'sheet'>('budget');
  // Origen de una restauración pendiente de confirmar
  const [restoreSource, setRestoreSource] = useState<'folder' | 'drive' | 'file' | null>(null);
  const [pendingFileBackup, setPendingFileBackup] = useState<BackupFile | null>(null);
  const [storageUsage, setStorageUsage] = useState(0);

  const [currentApuId, setCurrentApuId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [chapterModalContext, setChapterModalContext] = useState<{ projectId: string; parentChapterId?: string } | null>(null);
  const [libraryChapterId, setLibraryChapterId] = useState<string | null>(null);
  const [isUserLibraryOpen, setIsUserLibraryOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  // Destino de respaldo elegido: carpeta del equipo, Google Drive o ninguno (null = sin elegir)
  const [backupTarget, setBackupTargetState] = useState<BackupTarget | null>(() => getBackupTarget());
  const [folderHandle, setFolderHandle] = useState<any | null>(null);
  const [folderReady, setFolderReady] = useState(false);
  const [showBackupSetup, setShowBackupSetup] = useState(false);
  const [backupSetupBusy, setBackupSetupBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  // Respaldo automático en pausa porque sobrescribiría un respaldo ajeno o más completo
  const [backupGuard, setBackupGuard] = useState<BackupGuardError | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]);

  const activeApu = useMemo(() => {
    if (!currentApuId || apus.length === 0) return null;
    return apus.find(a => a.id === currentApuId) || null;
  }, [apus, currentApuId]);

  const activeChapter = useMemo(() => {
    if (!activeApu || chapters.length === 0) return null;
    return chapters.find(c => c.id === activeApu.chapterId) || null;
  }, [chapters, activeApu]);

  useEffect(() => {
    if (!activeProjectId || chapters.length === 0) return;

    // Numeración única (misma que PDF/Excel): capítulo N, hijos N.k en su orden mezclado, partidas de subcapítulo N.k.j
    const codes = new Map<string, string>();
    buildChapterOutline(chapters, apus, activeProjectId).forEach(({ chapter, number, entries }) => {
      codes.set(chapter.id, number);
      entries.forEach(entry => {
        if (entry.kind === 'apu') { codes.set(entry.apu.id, entry.number); return; }
        codes.set(entry.chapter.id, entry.number);
        entry.apus.forEach(({ apu, number: apuNumber }) => codes.set(apu.id, apuNumber));
      });
    });

    const newChapters = chapters.map(ch => {
      const newCode = codes.get(ch.id);
      return newCode !== undefined && ch.code !== newCode ? { ...ch, code: newCode } : ch;
    });
    const newApus = apus.map(apu => {
      const newCode = codes.get(apu.id);
      return newCode !== undefined && apu.code !== newCode ? { ...apu, code: newCode } : apu;
    });

    if (JSON.stringify(newChapters) !== JSON.stringify(chapters)) setChapters(newChapters);
    if (JSON.stringify(newApus) !== JSON.stringify(apus)) setApus(newApus);
  }, [chapters, apus, activeProjectId]);

  const targetLabel = (t: 'folder' | 'drive') => t === 'folder' ? 'la carpeta de respaldo' : 'Google Drive';

  /** Avisa que el respaldo automático queda en pausa para no sobrescribir un respaldo existente */
  const notifyGuard = (e: BackupGuardError) => {
    setBackupGuard(e);
    toast.warning(`Respaldo automático en pausa (${targetLabel(e.target)})`, {
      description: e.reason === 'foreign'
        ? `Ya existe un respaldo guardado desde otro equipo o sesión (${new Date(e.remote.savedAt).toLocaleString('es-CL')}, ${e.remote.projectCount} proyecto(s)). Restáuralo o usa «Respaldar ahora» para reemplazarlo con los datos de este equipo.`
        : `El respaldo tiene ${e.remote.projectCount} proyectos y este equipo ${e.localCount}. Usa «Respaldar ahora» si la eliminación fue intencional.`,
      duration: 15000,
      closeButton: true
    });
  };

  /** Al activar un destino: si ya contiene un respaldo ajeno, pausa el auto-guardado */
  const checkExistingBackup = async (target: 'folder' | 'drive', handle?: any) => {
    try {
      const remote = target === 'folder' ? await inspectFolderBackup(handle) : await inspectDriveBackup();
      if (remote?.foreign) {
        notifyGuard(new BackupGuardError(target, 'foreign', remote, projectsRef.current.length));
        return false;
      }
      return true;
    } catch { return true; /* se revisará de nuevo al guardar */ }
  };

  const handleDriveExpired = () => {
    setDriveConnected(false);
    toast.warning('La sesión de Google Drive expiró', {
      description: 'El respaldo automático está detenido. Vuelve a conectar Drive para reanudarlo.',
      duration: 15000,
      closeButton: true
    });
  };

  // Al abrir la app: prepara el destino de respaldo elegido o pide elegir uno
  useEffect(() => {
    (async () => {
      const target = getBackupTarget();
      if (target === 'folder') {
        const handle = await getSavedFolder();
        if (!handle) { setShowBackupSetup(true); return; }
        setFolderHandle(handle);
        if (await folderPermission(handle) === 'granted') {
          setFolderReady(true);
          checkExistingBackup('folder', handle);
        } else {
          // El navegador exige un clic para volver a autorizar la carpeta en cada sesión
          setShowBackupSetup(true);
        }
      } else if (target === 'drive') {
        const state = await autoReconnectDrive();
        if (state === 'connected') {
          setDriveConnected(true);
          checkExistingBackup('drive');
        } else {
          toast.info('Reconecta Google Drive para reanudar el respaldo automático.', { duration: 8000 });
        }
      } else if (target === null) {
        setShowBackupSetup(true);
      }
    })();
  }, []);

  // Cierra el menú de Exportar al hacer clic fuera
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const onDown = (e: MouseEvent) => { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setIsExportMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isExportMenuOpen]);

  // Monitoreo de almacenamiento local: aviso si falla la escritura o se acerca al límite
  useEffect(() => {
    let lastToast = 0;
    const onError = () => {
      if (Date.now() - lastToast < 15000) return;
      lastToast = Date.now();
      toast.error('No se pudo guardar localmente: almacenamiento del navegador lleno.', {
        description: 'Descargue un respaldo o exporte los proyectos a JSON y elimine proyectos antiguos.',
        duration: 12000
      });
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setStorageUsage(getStorageUsage()), 1500);
    return () => clearTimeout(t);
  }, [projects, chapters, apus, sheet]);
  const storagePct = storageUsage / STORAGE_QUOTA_BYTES * 100;

  const saveRef = useRef(saveActiveProject);
  useEffect(() => { saveRef.current = saveActiveProject; }, [saveActiveProject]);

  // Refs para acceder a los valores actuales desde el intervalo sin reiniciarlo
  const backupRef = useRef({ backupTarget, folderHandle, folderReady, driveConnected, backupGuard });
  useEffect(() => {
    backupRef.current = { backupTarget, folderHandle, folderReady, driveConnected, backupGuard };
  }, [backupTarget, folderHandle, folderReady, driveConnected, backupGuard]);
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Respaldo automático cada 5 minutos (solo si hubo cambios) en el destino elegido.
  // Con Drive revisa cada minuto si el token venció (dura ~1 h) para avisar en vez de fallar en silencio.
  useEffect(() => {
    let ticks = 0;
    let failureNotified = false;
    const timer = setInterval(async () => {
      const b = backupRef.current;
      if (b.backupTarget === 'drive' && b.driveConnected && !isDriveConnected()) { handleDriveExpired(); return; }
      if (++ticks % 5 !== 0 || b.backupGuard) return;
      try {
        let saved = false;
        if (b.backupTarget === 'folder' && b.folderReady && b.folderHandle) {
          saved = await saveToFolder(b.folderHandle, projectsRef.current);
        } else if (b.backupTarget === 'drive' && b.driveConnected) {
          saved = await saveAllToDrive(projectsRef.current);
        } else return;
        if (saved) {
          setBackupStatus('synced');
          setTimeout(() => setBackupStatus('idle'), 2000);
        }
        failureNotified = false;
      } catch (e: any) {
        if (e instanceof DriveAuthRequiredError) { handleDriveExpired(); return; }
        if (e instanceof BackupGuardError) { notifyGuard(e); return; }
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
          setFolderReady(false);
          toast.warning('Se perdió el permiso sobre la carpeta de respaldo', {
            description: 'Vuelve a autorizarla desde el botón de respaldo para reanudar el respaldo automático.',
            duration: 15000,
            closeButton: true
          });
          return;
        }
        if (!failureNotified) {
          failureNotified = true;
          toast.error(`Falló el respaldo automático: ${e?.message || 'Error desconocido'}`);
        }
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setInterval(() => {
      const result = saveRef.current();
      if (result) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = setTimeout(() => {
      const result = saveRef.current();
      if (result) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [chapters, apus, activeProjectId]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    if (saveActiveProject()) {
      setSaveStatus('saved');
      toast.success("Guardado localmente");
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  };

  const handleDriveConnect = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google Client ID no configurado. Agrega VITE_GOOGLE_CLIENT_ID en .env.local');
      return;
    }
    try {
      setBackupStatus('syncing');
      await initDriveAuth();
      await requestDriveAccess();
      setDriveConnected(true);
      setBackupStatus('synced');
      toast.success('Google Drive conectado correctamente');
      setTimeout(() => setBackupStatus('idle'), 2000);
      await checkExistingBackup('drive');
    } catch (e: any) {
      setBackupStatus('error');
      toast.error(`Error conectando Drive: ${e?.message || 'Error desconocido'}`);
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  // ── Selección del destino de respaldo ──

  const chooseTarget = (target: BackupTarget) => {
    setBackupTarget(target);
    setBackupTargetState(target);
    setBackupGuard(null);
  };

  /** Primer respaldo al activar la carpeta, salvo que ya contenga uno de otro equipo */
  const activateFolder = async (handle: any) => {
    setFolderHandle(handle);
    setFolderReady(true);
    setShowBackupSetup(false);
    if (await checkExistingBackup('folder', handle)) {
      try {
        await saveToFolder(handle, projectsRef.current);
        toast.success(`Respaldo activo en la carpeta «${handle.name}»`);
      } catch (e: any) {
        if (e instanceof BackupGuardError) notifyGuard(e);
        else toast.error(`No se pudo escribir en la carpeta: ${e?.message || 'Error desconocido'}`);
      }
    }
  };

  const handleChooseFolder = async () => {
    setBackupSetupBusy(true);
    try {
      const handle = await pickBackupFolder();
      if (!handle) return;
      chooseTarget('folder');
      await activateFolder(handle);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo seleccionar la carpeta');
    } finally { setBackupSetupBusy(false); }
  };

  const handleResumeFolder = async () => {
    if (!folderHandle) return;
    setBackupSetupBusy(true);
    try {
      if (await requestFolderPermission(folderHandle)) {
        setFolderReady(true);
        setShowBackupSetup(false);
        await checkExistingBackup('folder', folderHandle);
      } else {
        toast.error('Sin permiso sobre la carpeta. Autorízala o elige otra.');
      }
    } finally { setBackupSetupBusy(false); }
  };

  const handleChooseDrive = async () => {
    chooseTarget('drive');
    setShowBackupSetup(false);
    if (!isDriveConnected()) await handleDriveConnect();
    else await checkExistingBackup('drive');
  };

  const handleChooseNone = () => {
    chooseTarget('none');
    setShowBackupSetup(false);
    toast.info('Sin respaldo automático. Puedes descargar respaldos desde el botón de respaldo.', { duration: 8000 });
  };

  // ── Respaldo manual y restauración ──

  const handleBackupNow = async (force = false) => {
    try {
      setBackupStatus('syncing');
      if (backupTarget === 'folder') {
        if (!folderHandle) { setBackupStatus('idle'); setShowBackupSetup(true); return; }
        if (!folderReady) {
          if (!(await requestFolderPermission(folderHandle))) throw new Error('Sin permiso sobre la carpeta de respaldo.');
          setFolderReady(true);
        }
        await saveToFolder(folderHandle, projects, { force });
      } else if (backupTarget === 'drive') {
        if (!isDriveConnected()) { await handleDriveConnect(); if (!isDriveConnected()) { setBackupStatus('idle'); return; } }
        await saveAllToDrive(projects, { force });
      } else {
        setBackupStatus('idle');
        return;
      }
      setBackupGuard(null);
      setBackupStatus('synced');
      toast.success(backupTarget === 'folder' ? `Respaldo guardado en «${folderHandle?.name}»` : 'Respaldo guardado en Google Drive');
      setTimeout(() => setBackupStatus('idle'), 2000);
    } catch (e: any) {
      if (e instanceof BackupGuardError) {
        setBackupGuard(e);
        setConfirmOverwrite(true);
        setBackupStatus('idle');
        return;
      }
      if (e instanceof DriveAuthRequiredError) setDriveConnected(false);
      setBackupStatus('error');
      toast.error(`Error al respaldar: ${e?.message || 'Error desconocido'}`);
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  /** Descarga un respaldo completo del almacenamiento local (todos los proyectos) */
  const downloadLocalBackup = () => {
    const dump: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith('apu_')) dump[k] = localStorage.getItem(k) || '';
    }
    const blob = new Blob([JSON.stringify({ type: 'apu-hdg-local-backup', createdAt: new Date().toISOString(), data: dump })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HDG_respaldo_local_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleRestoreFromTarget = async () => {
    if (backupTarget === 'folder') {
      if (!folderHandle) { setShowBackupSetup(true); return; }
      if (!folderReady) {
        if (!(await requestFolderPermission(folderHandle))) { toast.error('Sin permiso sobre la carpeta de respaldo.'); return; }
        setFolderReady(true);
      }
      setRestoreSource('folder');
    } else if (backupTarget === 'drive') {
      if (!isDriveConnected()) { await handleDriveConnect(); if (!isDriveConnected()) return; }
      setRestoreSource('drive');
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const data = JSON.parse(text);
      if (!isValidBackup(data)) throw new Error('formato');
      setPendingFileBackup(data);
      setRestoreSource('file');
    }).catch(() => toast.error('El archivo no es un respaldo válido de la app (apu-hdg-respaldo…json).'));
  };

  const executeRestore = async () => {
    const source = restoreSource;
    setRestoreSource(null);
    try {
      downloadLocalBackup();
      setBackupStatus('syncing');
      let backup: BackupFile | null = null;
      if (source === 'folder') backup = await loadFromFolder(folderHandle);
      else if (source === 'drive') backup = await loadFromDrive();
      else if (source === 'file' && pendingFileBackup) { applyBackup(pendingFileBackup); backup = pendingFileBackup; }
      setPendingFileBackup(null);
      if (!backup) { toast.info('No se encontró un respaldo para restaurar.'); setBackupStatus('idle'); return; }
      reloadFromStorage();
      setBackupGuard(null);
      setBackupStatus('synced');
      toast.success(`Respaldo restaurado (${new Date(backup.savedAt).toLocaleString('es-CL')})`);
      setTimeout(() => setBackupStatus('idle'), 2000);
      // Un archivo suelto pasa a ser el respaldo vigente del destino (el anterior queda como versión)
      if (source === 'file') {
        const library = backup.library || [];
        if (backupTarget === 'folder' && folderReady && folderHandle) await saveToFolder(folderHandle, library, { force: true }).catch(() => {});
        if (backupTarget === 'drive' && isDriveConnected()) await saveAllToDrive(library, { force: true }).catch(() => {});
      }
    } catch (e: any) {
      setBackupStatus('error');
      toast.error(`Error al restaurar: ${e?.message || 'Error desconocido'}`);
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  const handleDriveDisconnect = () => {
    disconnectDrive();
    setDriveConnected(false);
    setBackupGuard(null);
    toast.info('Google Drive desconectado');
  };

  const handleCreateApu = (pid: string, cid: string) => {
    const proj = projects.find(p => p.id === pid);
    const nApu: APU = {
      id: safeUUID(),
      projectId: pid,
      chapterId: cid,
      code: '',
      name: 'Nueva Partida',
      unit: 'GL',
      quantity: 1.0,
      items: {
        [ItemCategory.MATERIAL]: [],
        [ItemCategory.MANO_DE_OBRA]: [],
        [ItemCategory.EQUIPO]: [],
        [ItemCategory.OTROS]: []
      },
      useProjectGlobalRates: true,
      socialLawsPercentage: proj?.globalSocialLaws || 30,
      overheadPercentage: proj?.globalOverhead || 15,
      utilityPercentage: proj?.globalUtility || 10,
      createdAt: Date.now()
    };
    setApus([...apus, nApu]);
    setCurrentApuId(nApu.id);
  };

  const handleShareProject = async (project: Project) => {
    const exportData = {
      project,
      chapters: chapters.filter(c => c.projectId === project.id),
      apus: apus.filter(a => a.projectId === project.id),
      sheet: project.id === activeProjectId ? sheet : undefined,
      exportVersion: "2.1",
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    try {
      await saveBlobWithPicker(
        blob,
        `HDG_Export_${project.code}.json`,
        'Proyecto APU JSON',
        { 'application/json': ['.json'] }
      );
      toast.success('Proyecto exportado correctamente');
    } catch (error) {
      toast.error('No se pudo exportar el proyecto');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.project || !data.chapters || !data.apus) throw new Error("Inválido");
        
        const newProjectId = safeUUID();
        const timestamp = Date.now();
        const newProject = { ...data.project, id: newProjectId, createdAt: timestamp, updatedAt: timestamp };
        
        const newChapters = data.chapters.map((c: any) => ({ ...c, id: safeUUID(), projectId: newProjectId, oldId: c.id }));
        const newApus = data.apus.map((a: any) => {
          const chapter = newChapters.find((nc: any) => nc.oldId === a.chapterId);
          return normalizeApu({ ...a, id: safeUUID(), projectId: newProjectId, chapterId: chapter?.id || a.chapterId }, newProject);
        });

        const physicalData = { metadata: newProject, chapters: newChapters.map(({ oldId, ...c }: any) => c), apus: newApus, sheet: data.sheet || { cells: {} } };
        localStorage.setItem(`apu_engine_project_${newProjectId}`, JSON.stringify(physicalData));
        
        setProjects([newProject, ...projects]);
        loadProject(newProjectId);
        toast.success(`Proyecto "${newProject.name}" importado con éxito`);
      } catch (err) { 
        toast.error("Error al importar el archivo JSON"); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /** Botón de respaldo con tarjeta de destino y acciones (cabecera del proyecto y pantalla de inicio) */
  const backupControl = (
    <div className="relative group/backup">
      {(() => {
        const active = (backupTarget === 'folder' && folderReady) || (backupTarget === 'drive' && driveConnected);
        const pending = backupTarget === null || (backupTarget === 'folder' && !folderReady) || (backupTarget === 'drive' && !driveConnected) || !!backupGuard;
        const TargetIcon = backupTarget === 'folder' ? FolderOpen : backupTarget === 'drive' ? CloudUpload : HardDrive;
        return (
          <button
            onClick={() => { if (!active) setShowBackupSetup(true); }}
            disabled={backupStatus === 'syncing'}
            title="Respaldo de proyectos"
            className={`relative p-2 rounded-xl transition-all disabled:opacity-60 select-none ${
              active ? 'bg-brand-blue/10 text-brand-blue cursor-default' : 'text-muted hover:bg-sidebar hover:text-brand-blue cursor-pointer'
            }`}
          >
            {backupStatus === 'syncing'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : backupStatus === 'synced'
                ? <Check className="w-4 h-4 text-brand-green" />
                : <TargetIcon className="w-4 h-4" />}
            {active && !backupGuard && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-green" />}
            {pending && backupTarget !== 'none' && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-status-amber" />}
          </button>
        );
      })()}

      {/* Tarjeta con destino y acciones */}
      <div className="absolute right-0 top-full mt-2 w-64 bg-ink text-white rounded-2xl shadow-xl p-3 z-50 invisible opacity-0 group-hover/backup:visible group-hover/backup:opacity-100 transition-all duration-150 pointer-events-none group-hover/backup:pointer-events-auto">
        <div className="flex items-start gap-2 pb-2 border-b border-slate-700 mb-2">
          {backupTarget === 'drive' ? <CloudUpload className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" /> : <FolderOpen className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Destino del respaldo</p>
            <p className="text-[9px] text-slate-200 font-bold mt-0.5 break-words">
              {backupTarget === 'folder' ? `Carpeta «${folderHandle?.name || '—'}»`
                : backupTarget === 'drive' ? 'Google Drive / APU Hidrogestion'
                : backupTarget === 'none' ? 'Sin respaldo automático'
                : 'Sin configurar'}
            </p>
            {backupTarget === 'folder' && !folderReady && <p className="text-[8px] text-amber-300 font-bold">Requiere autorizar la carpeta</p>}
            {backupTarget === 'drive' && !driveConnected && <p className="text-[8px] text-amber-300 font-bold">Sesión de Google no conectada</p>}
          </div>
        </div>
        {(() => {
          const last = backupTarget === 'folder' ? getLastFolderSync() : backupTarget === 'drive' ? getLastSyncTime() : null;
          return last ? <p className="text-[8px] text-slate-500 mb-2">Último respaldo: {new Date(last).toLocaleString('es-CL')}</p> : null;
        })()}
        {backupGuard && (
          <p className="text-[8px] text-amber-300 font-bold mb-2 leading-snug">
            Respaldo automático en pausa: {backupGuard.reason === 'foreign'
              ? 'el destino tiene un respaldo de otro equipo. Restáuralo o usa «Respaldar ahora».'
              : 'este equipo tiene muchos menos proyectos que el respaldo.'}
          </p>
        )}
        <div className="space-y-1">
          {(backupTarget === 'folder' || backupTarget === 'drive') && (
            <>
              <button
                onClick={() => handleBackupNow()}
                disabled={backupStatus === 'syncing'}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-60"
              >
                <CloudUpload className="w-3 h-3" /> Respaldar ahora
              </button>
              <button
                onClick={handleRestoreFromTarget}
                disabled={backupStatus === 'syncing'}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-700 hover:bg-slate-600 text-white transition-all disabled:opacity-60"
              >
                <CloudDownload className="w-3 h-3" /> Restaurar respaldo
              </button>
            </>
          )}
          <button
            onClick={() => restoreFileRef.current?.click()}
            disabled={backupStatus === 'syncing'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-60"
          >
            <FileInput className="w-3 h-3" /> Restaurar desde archivo…
          </button>
          <button
            onClick={() => downloadBackupFile(projects)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-700 transition-all"
          >
            <Download className="w-3 h-3" /> Descargar respaldo
          </button>
          <button
            onClick={() => setShowBackupSetup(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-700 transition-all"
          >
            <FolderOpen className="w-3 h-3" /> Cambiar destino
          </button>
          {backupTarget === 'drive' && driveConnected && (
            <button
              onClick={handleDriveDisconnect}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-900/30 transition-all"
            >
              <CloudOff className="w-3 h-3" /> Desconectar Drive
            </button>
          )}
        </div>
        <p className="text-[8px] text-slate-500 mt-2">Se conservan las últimas 15 versiones con fecha.</p>
      </div>
      <input ref={restoreFileRef} type="file" accept=".json,application/json" onChange={handleRestoreFileSelected} className="hidden" />
    </div>
  );

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Toaster position="top-right" richColors />

      <Sidebar
        isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
        projects={projects} chapters={chapters} apus={apus}
        reorderProject={reorderProject}
        reorderChapter={reorderChapter} deleteChapter={deleteChapter}
        currentProjectId={activeProjectId}
        setCurrentProjectId={(id) => {
          setActiveProjectId(id);
          if (id) loadProject(id);
          setCurrentApuId(null);
          setProjectView('budget');
        }}
        currentApuId={currentApuId}
        setCurrentApuId={(id) => { if (id !== currentApuId) setCurrentApuId(id); }}
        onNewProject={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
        onEditProject={(p) => { setEditingProject(p); setIsProjectModalOpen(true); }}
        onNewChapter={() => activeProjectId && setChapterModalContext({ projectId: activeProjectId })}
        onNewSubchapter={(projectId, parentChapterId) => setChapterModalContext({ projectId, parentChapterId })}
        onLibraryOpen={setLibraryChapterId}
        onCreateApu={handleCreateApu}
        onDuplicateApu={(a) => duplicateApu(a, safeUUID())}
        onDeleteApu={(id) => { deleteApu(id); if (currentApuId === id) setCurrentApuId(null); }}
        onDeleteProject={deleteProject}
        onDuplicateProject={duplicateProject}
        moveApu={moveApu}
        moveApuToChapter={moveApuToChapter}
        moveChildInChapter={moveChildInChapter}
        onRenameChapter={(id, name) => setChapters(prev => prev.map(c => c.id === id ? { ...c, name } : c))}
      />

      <main className="flex-1 overflow-y-auto relative flex flex-col no-scrollbar bg-surface">
        {activeProject ? (
          <>
            <header className="sticky top-0 z-40 bg-white border-b border-border px-8 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-sidebar rounded-lg text-brand-blue transition-colors"><Menu className="w-5 h-5" /></button>}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-brand-blue uppercase max-w-2xl whitespace-normal break-words leading-tight">
                    {activeApu ? activeApu.name : projectView === 'resources' ? `RESUMEN DE RECURSOS: ${activeProject.name}` : projectView === 'sheet' ? `HOJA DE CÁLCULO: ${activeProject.name}` : `ESTRUCTURA GENERAL: ${activeProject.name}`}
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] text-brand-green font-bold uppercase tracking-widest">{activeProject.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {storagePct >= 60 && (
                  <span
                    title={`Almacenamiento local usado: ${formatNumber(storageUsage / 1024 / 1024, 1, 1)} MB de ~5 MB. Respalde en Drive o exporte y elimine proyectos antiguos.`}
                    className={`hidden md:flex items-center gap-1 text-[8px] font-bold uppercase px-3 py-2 rounded-xl whitespace-nowrap ${storagePct >= 85 ? 'bg-status-red/10 text-status-red' : 'bg-status-amber/10 text-status-amber'}`}
                  >
                    <HardDrive className="w-3 h-3" /> {formatNumber(storagePct, 0, 0)}%
                  </span>
                )}
                {lastSaved && (
                  <span className="hidden md:flex items-center gap-1 text-[8px] text-muted-dark font-bold uppercase bg-sidebar px-3 py-2 rounded-xl whitespace-nowrap">
                    <Clock className="w-3 h-3 text-brand-green" /> {new Date(lastSaved).toLocaleTimeString('es-CL')}
                  </span>
                )}

                <label
                  title="Importar proyecto (.json)"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white bg-brand-blue hover:bg-brand-blue-dark transition-all cursor-pointer text-[9px] font-bold uppercase tracking-widest"
                >
                  <FileInput className="w-4 h-4" /> Importar
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>

                {backupControl}

                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  title={saveStatus === 'saved' ? 'Guardado' : 'Guardar'}
                  className="p-2 rounded-xl text-muted hover:text-brand-blue hover:bg-sidebar transition-all disabled:opacity-60"
                >
                  {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-4 h-4 text-brand-green" /> : <Save className="w-4 h-4" />}
                </button>
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setIsExportMenuOpen(o => !o)}
                    title="Exportar"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white bg-brand-green hover:bg-brand-green-dark transition-all text-[9px] font-bold uppercase tracking-widest"
                  >
                    <FileOutput className="w-4 h-4" /> Exportar
                  </button>
                  {isExportMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-border rounded-xl shadow-sm z-50 p-1.5 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => { exportProjectToExcel(activeProject, chapters, apus); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-dark hover:bg-sidebar hover:text-brand-green"
                      >
                        <Download className="w-3.5 h-3.5" /> Reporte Excel
                      </button>
                      <button
                        onClick={() => { exportProjectToPDF(activeProject, chapters, apus); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-dark hover:bg-sidebar hover:text-brand-blue"
                      >
                        <FileText className="w-3.5 h-3.5" /> APUs PDF
                      </button>
                      <button
                        onClick={() => { exportBudgetToPDF(activeProject, chapters, apus); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-dark hover:bg-sidebar hover:text-brand-blue"
                      >
                        <Table className="w-3.5 h-3.5" /> Presupuesto PDF
                      </button>
                      <div className="h-px bg-border my-1.5" />
                      <button
                        disabled={!activeProject}
                        onClick={() => { if (activeProject) handleShareProject(activeProject); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-dark hover:bg-sidebar hover:text-brand-green disabled:opacity-40"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Exportar proyecto (.json)
                      </button>
                    </div>
                  )}
                </div>
                <QuickCalculator />
                <button
                  onClick={() => setIsUserLibraryOpen(true)}
                  title="Biblioteca del usuario"
                  className="p-2 rounded-xl text-muted hover:text-brand-blue hover:bg-sidebar transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  title="Manual de operación"
                  className="p-2 rounded-xl text-muted hover:text-brand-blue hover:bg-sidebar transition-all"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="p-8">
              {activeApu && activeChapter ? (
                <div key={activeApu.id}>
                  <APUEditor
                    apu={activeApu}
                    onUpdate={updateApu}
                    history={history}
                    project={activeProject}
                    chapter={activeChapter}
                    onRegisterResource={addHistoryItem}
                  />
                </div>
              ) : (
                <>
                  <div className="max-w-6xl mx-auto mb-6 flex gap-2 bg-white p-1.5 rounded-2xl border border-border w-fit">
                    {([
                      { id: 'budget', label: 'Presupuesto', icon: <LayoutList className="w-3.5 h-3.5" /> },
                      { id: 'resources', label: 'Resumen de recursos', icon: <Layers className="w-3.5 h-3.5" /> },
                      { id: 'sheet', label: 'Hoja de cálculo', icon: <Table2 className="w-3.5 h-3.5" /> }
                    ] as const).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setProjectView(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${projectView === t.id ? 'bg-brand-blue text-white' : 'text-muted hover:text-brand-blue hover:bg-sidebar'}`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  {projectView === 'budget' && (
                    <ProjectGeneralView
                      project={activeProject}
                      chapters={chapters}
                      apus={apus}
                      moveChapter={moveChapter}
                      moveApu={moveApu}
                      onToggleFlag={(id) => setApus(prev => prev.map(a => a.id === id ? { ...a, flagged: !a.flagged } : a))}
                      onOpenApu={setCurrentApuId}
                    />
                  )}
                  {projectView === 'resources' && (
                    <ResourceSummary
                      project={activeProject}
                      chapters={chapters}
                      apus={apus}
                      onUpdateApus={(updated) => {
                        const byId = new Map(updated.map(u => [u.id, u]));
                        setApus(prev => prev.map(a => byId.get(a.id) || a));
                      }}
                      onOpenApu={setCurrentApuId}
                    />
                  )}
                  {projectView === 'sheet' && (
                    <ProjectSheet project={activeProject} sheet={sheet} onChange={setSheet} />
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700 relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-sidebar rounded-lg text-brand-blue transition-colors"><Menu className="w-5 h-5" /></button>}
              {backupControl}
              <label
                title="Importar proyecto (.json)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white bg-brand-blue hover:bg-brand-blue-dark transition-all cursor-pointer text-[9px] font-bold uppercase tracking-widest"
              >
                <FileInput className="w-4 h-4" /> Importar
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <button
                onClick={() => setIsUserLibraryOpen(true)}
                title="Biblioteca del usuario"
                className="p-2 rounded-xl text-muted hover:text-brand-blue hover:bg-sidebar transition-all"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsHelpOpen(true)}
                title="Manual de operación"
                className="p-2 rounded-xl text-muted hover:text-brand-blue hover:bg-sidebar transition-all"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 bg-white rounded-full shadow-inner">
              <Database className="w-20 h-20 text-brand-blue opacity-10" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-brand-blue uppercase tracking-tighter">Hidrogestión APU ENGINE</h1>
              <p className="text-muted text-sm italic">Seleccione o cree un proyecto en la biblioteca lateral</p>
            </div>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="bg-brand-blue text-white px-10 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-sm"
            >
              Comenzar Nuevo Proyecto
            </button>
          </div>
        )}
      </main>

      {isProjectModalOpen && (
        <ProjectModal
          initialData={editingProject || undefined}
          onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
          onSubmit={(data) => {
            const timestamp = Date.now();
            if (editingProject) {
              const updatedProject = { ...editingProject, ...data, updatedAt: timestamp };
              setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
              loadProject(editingProject.id);
            } else {
              const newId = safeUUID();
              setProjects([{ ...data, id: newId, createdAt: timestamp, updatedAt: timestamp }, ...projects]);
              loadProject(newId);
            }
            setEditingProject(null);
            setIsProjectModalOpen(false);
          }}
        />
      )}

      {chapterModalContext && (
        <ChapterModal
          isSubchapter={!!chapterModalContext.parentChapterId}
          onClose={() => setChapterModalContext(null)}
          onSubmit={(name) => {
            addChapter({ id: safeUUID(), projectId: chapterModalContext.projectId, code: '', name, parentChapterId: chapterModalContext.parentChapterId });
            setChapterModalContext(null);
          }}
        />
      )}

      {libraryChapterId && (
        <LibraryModal
          onClose={() => setLibraryChapterId(null)}
          projectApus={apus.filter(a => a.projectId === activeProjectId)}
          projects={projects}
          activeProjectId={activeProjectId || ''}
          onSelect={(libApu) => {
            if (activeProjectId) {
              const proj = projects.find(p => p.id === activeProjectId);
              const nApu: APU = normalizeApu({
                ...JSON.parse(JSON.stringify(libApu)),
                id: safeUUID(),
                projectId: activeProjectId,
                chapterId: libraryChapterId,
                useProjectGlobalRates: true,
                flagged: false,
                socialLawsPercentage: proj?.globalSocialLaws ?? 30,
                overheadPercentage: proj?.globalOverhead ?? 15,
                utilityPercentage: proj?.globalUtility ?? 10,
                createdAt: Date.now()
              }, proj);
              setApus([...apus, nApu]);
              setCurrentApuId(nApu.id);
            }
            setLibraryChapterId(null);
          }}
        />
      )}

      {isUserLibraryOpen && (
        <LibraryModal
          mode="browse"
          onClose={() => setIsUserLibraryOpen(false)}
          projectApus={apus.filter(a => a.projectId === activeProjectId)}
          projects={projects}
          activeProjectId={activeProjectId || ''}
          onSelect={() => undefined}
        />
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ConfirmationModal
        isOpen={!!restoreSource}
        onClose={() => { setRestoreSource(null); setPendingFileBackup(null); }}
        onConfirm={executeRestore}
        title={restoreSource === 'file' ? 'Restaurar desde archivo' : restoreSource === 'drive' ? 'Restaurar desde Google Drive' : 'Restaurar desde la carpeta'}
        message={`Se reemplazarán TODOS los proyectos locales por la copia ${
          restoreSource === 'file'
            ? `del archivo seleccionado (${pendingFileBackup ? `${new Date(pendingFileBackup.savedAt).toLocaleString('es-CL')}, ${pendingFileBackup.library.length} proyecto(s)` : ''})`
            : restoreSource === 'drive' ? 'de Google Drive' : `de la carpeta «${folderHandle?.name || ''}»`
        }. Antes de restaurar se descargará automáticamente un respaldo local (JSON) por seguridad. ¿Continuar?`}
        confirmText="Sí, respaldar y restaurar"
      />
      <ConfirmationModal
        isOpen={confirmOverwrite && !!backupGuard}
        onClose={() => setConfirmOverwrite(false)}
        onConfirm={() => { setConfirmOverwrite(false); handleBackupNow(true); }}
        title={backupGuard?.target === 'drive' ? 'Sobrescribir respaldo en Drive' : 'Sobrescribir respaldo en la carpeta'}
        message={backupGuard
          ? `${backupGuard.reason === 'foreign'
              ? 'El respaldo existente fue guardado desde otro equipo o navegador'
              : 'El respaldo existente tiene bastantes más proyectos que este equipo'} (${new Date(backupGuard.remote.savedAt).toLocaleString('es-CL')}, ${backupGuard.remote.projectCount} proyecto(s)). Este equipo tiene ${backupGuard.localCount} proyecto(s). Si continúas, el respaldo actual se conservará como versión con fecha y será reemplazado por la copia de este equipo. ¿Continuar?`
          : ''}
        confirmText="Sí, sobrescribir respaldo"
      />
      <BackupSetupModal
        isOpen={showBackupSetup}
        onClose={() => setShowBackupSetup(false)}
        currentTarget={backupTarget}
        pendingFolderName={backupTarget === 'folder' && folderHandle && !folderReady ? folderHandle.name : null}
        folderSupported={isFolderBackupSupported()}
        driveAvailable={!!GOOGLE_CLIENT_ID}
        busy={backupSetupBusy}
        onResumeFolder={handleResumeFolder}
        onChooseFolder={handleChooseFolder}
        onChooseDrive={handleChooseDrive}
        onChooseNone={handleChooseNone}
      />
    </div>
  );
};

export default App;
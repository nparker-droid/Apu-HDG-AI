
export enum ItemCategory {
  MATERIAL = 'MATERIAL',
  MANO_DE_OBRA = 'MANO DE OBRA',
  EQUIPO = 'EQUIPO',
  OTROS = 'OTROS'
}

export interface APUItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  performance?: number;
  unitPrice: number;
  total: number;
}

export interface APU {
  id: string;
  projectId: string;
  chapterId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  items: {
    [key in ItemCategory]: APUItem[];
  };
  useProjectGlobalRates: boolean;
  socialLawsPercentage: number;
  overheadPercentage: number;
  utilityPercentage: number;
  divideUnitPrice?: boolean;
  divisorQuantity?: number;
  createdAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  code: string;
  name: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  location: string;
  commune: string;
  region: string;
  version: string;
  stage: string;
  date: string;
  globalSocialLaws: number;
  globalOverhead: number;
  globalUtility: number;
  createdAt: number;
  updatedAt: number; // Para seguimiento de persistencia
}

export interface HistoryItem {
  description: string;
  unit: string;
  unitPrice: number;
  category: ItemCategory;
  performance?: number;
  chapterName?: string;
}

export interface SingleFieldSuggestion {
  value: number;
  reasoning: string;
}

export interface ProjectFullData {
  metadata: Project;
  chapters: Chapter[];
  apus: APU[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  points: number;
  level: number;
  achievements: Achievement[];
  registeredAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export interface ConsumptionData {
  month: string;
  waterSaved: number; // liters
  energySaved: number; // kWh
  carbonReduced: number; // kg
}

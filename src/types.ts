export type Category = 'Bible' | 'Booklet' | 'Tract';
export type Language = 'EN' | 'ES';

export interface Edition {
  lang: Language;
  title: string;
  stock: number;
  code?: string;
}

export interface Title {
  code: string;
  name: string;
  cat: Category;
  reorder: number;
  pack: number;
  aliases?: string[];
  alias?: string; // legacy support
  editions: Edition[];
}

export interface EventLine {
  key: string;
  lang: Language;
  title: string;
  code: string;
  before: number;
  took: number;
  back: number;
}

export interface CorrectionChange {
  key: string;
  from: number;
  to: number;
}

export interface Correction {
  id: string;
  when: string;
  by: string;
  note: string;
  changes: CorrectionChange[];
}

export interface EventItem {
  id: string;
  date: string; // YYYY-MM-DD
  location: string;
  planned?: boolean;
  lines: EventLine[];
  materialsDistributed?: number;
  totalPassed?: number;
  corrections?: Correction[];
  categoryStats?: {
    bibles: number;
    bibles_en: number;
    bibles_es: number;
    tracts: number;
    tracts_en: number;
    tracts_es: number;
    booklets: number;
    booklets_en: number;
    booklets_es: number;
    total: number;
  };
}

export interface Movement {
  id?: string;
  iso: string;
  date: string;
  kind: 'count' | 'receipt' | 'adjust' | 'other';
  what: string;
  detail: string;
  delta: number | null;
}

export interface OrderItem {
  key: string;
  bundle?: string;
  lang?: string;
  title: string;
  code: string;
  qty: number;
  packs?: number;
  orderedDate: string;
  shortOf?: number;
  received?: number;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'View only';
  self?: boolean;
}

export interface SettingsData {
  reorder: Record<Category, number>;
  pack: Record<Category, number>;
  people: Person[];
  hallName: string;
}

export type ActiveTab = 'overview' | 'inventory' | 'events' | 'order' | 'history' | 'settings';

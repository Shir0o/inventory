import { Title, EventItem, Movement, OrderItem, SettingsData } from '../types';

export const INITIAL_TITLES: Title[] = [
  {
    code: 'BIB-NTRV',
    name: 'New Testament Recovery Version',
    cat: 'Bible',
    reorder: 20,
    pack: 10,
    aliases: ['Recovery Version NT', 'RcV New Testament'],
    editions: [
      { lang: 'EN', title: 'New Testament Recovery Version', stock: 58 },
      { lang: 'ES', title: 'Nuevo Testamento Versión Recobro', stock: 31 }
    ]
  },
  {
    code: 'BKL-BE1',
    name: 'Basic Elements of the Christian Life, vol. 1',
    cat: 'Booklet',
    reorder: 60,
    pack: 20,
    aliases: ['BE Vol 1', 'Basic Elements 1'],
    editions: [
      { lang: 'EN', title: 'Basic Elements of the Christian Life, vol. 1', stock: 148 },
      { lang: 'ES', title: 'Elementos básicos de la vida cristiana, tomo 1', stock: 84 }
    ]
  },
  {
    code: 'BKL-BE2',
    name: 'Basic Elements of the Christian Life, vol. 2',
    cat: 'Booklet',
    reorder: 60,
    pack: 20,
    aliases: ['BE Vol 2', 'Basic Elements 2'],
    editions: [
      { lang: 'EN', title: 'Basic Elements of the Christian Life, vol. 2', stock: 96 },
      { lang: 'ES', title: 'Elementos básicos de la vida cristiana, tomo 2', stock: 55 }
    ]
  },
  {
    code: 'BKL-BE3',
    name: 'Basic Elements of the Christian Life, vol. 3',
    cat: 'Booklet',
    reorder: 60,
    pack: 20,
    aliases: ['BE Vol 3', 'Basic Elements 3'],
    editions: [
      { lang: 'EN', title: 'Basic Elements of the Christian Life, vol. 3', stock: 72 },
      { lang: 'ES', title: 'Elementos básicos de la vida cristiana, tomo 3', stock: 40 }
    ]
  },
  {
    code: 'TR-FOOL',
    name: 'Foolishness or the Power of God?',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['The Word of the Cross'],
    editions: [
      { lang: 'EN', title: 'Foolishness or the Power of God?', stock: 630 },
      { lang: 'ES', title: 'La palabra de la cruz: ¿locura o sabiduría?', stock: 285 }
    ]
  },
  {
    code: 'TR-FEAR',
    name: 'Freed from the Fear of Death',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['Fear of Death'],
    editions: [
      { lang: 'EN', title: 'Freed from the Fear of Death', stock: 410 },
      { lang: 'ES', title: 'Librados del temor de la muerte', stock: 190 }
    ]
  },
  {
    code: 'TR-EXIST',
    name: 'How Can I Know God Exists?',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['God Exists'],
    editions: [
      { lang: 'EN', title: 'How Can I Know God Exists?', stock: 95 },
      { lang: 'ES', title: '¿Cómo saber que Dios existe?', stock: 240 }
    ]
  },
  {
    code: 'TR-BOAT',
    name: 'Is Jesus in Your Boat?',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['Jesus in Your Boat'],
    editions: [
      { lang: 'EN', title: 'Is Jesus in Your Boat?', stock: 520 },
      { lang: 'ES', title: '¿Está Jesús en su barca?', stock: 360 }
    ]
  },
  {
    code: 'TR-LOST',
    name: 'Lost and Found',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: [],
    editions: [
      { lang: 'EN', title: 'Lost and Found', stock: 275 },
      { lang: 'ES', title: 'Perdido y hallado', stock: 140 }
    ]
  },
  {
    code: 'TR-ENEM',
    name: 'No Longer Enemies',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: [],
    editions: [
      { lang: 'EN', title: 'No Longer Enemies', stock: 330 },
      { lang: 'ES', title: 'Ya no somos enemigos', stock: 205 }
    ]
  },
  {
    code: 'TR-HEAL',
    name: 'Only Jesus Can Heal Us',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['Healing Jesus'],
    editions: [
      { lang: 'EN', title: 'Only Jesus Can Heal Us', stock: 180 },
      { lang: 'ES', title: 'El toque que sana', stock: 118 }
    ]
  },
  {
    code: 'TR-BIGQ',
    name: 'The Big Question',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['The Ultimate Question'],
    editions: [
      { lang: 'EN', title: 'The Big Question', stock: 265 },
      { lang: 'ES', title: 'La pregunta crucial', stock: 300 }
    ]
  },
  {
    code: 'TR-THIRD',
    name: 'The Third Part',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['Human Spirit - The Third Part'],
    editions: [
      { lang: 'EN', title: 'The Third Part', stock: 445 },
      { lang: 'ES', title: 'La tercera parte', stock: 215 }
    ]
  },
  {
    code: 'TR-WHO',
    name: 'Who Is Jesus?',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: [],
    editions: [
      { lang: 'EN', title: 'Who Is Jesus?', stock: 610 },
      { lang: 'ES', title: '¿Quién es Jesús?', stock: 480 }
    ]
  },
  {
    code: 'TR-KNOW',
    name: 'You Can Know God',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['To the Unknown God'],
    editions: [
      { lang: 'EN', title: 'You Can Know God', stock: 0 },
      { lang: 'ES', title: 'Al Dios no conocido', stock: 165 }
    ]
  },
  {
    code: 'TR-BORN',
    name: 'You Must Be Born Anew',
    cat: 'Tract',
    reorder: 150,
    pack: 50,
    aliases: ['Born Again', 'Born Anew'],
    editions: [
      { lang: 'EN', title: 'You Must Be Born Anew', stock: 355 },
      { lang: 'ES', title: 'Os es necesario nacer de nuevo', stock: 225 }
    ]
  }
];

export const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'ev-0912',
    date: '2026-09-12',
    location: 'Riverside campus gate',
    planned: true,
    lines: []
  },
  {
    id: 'ev-0816',
    date: '2026-08-16',
    location: 'Riverside campus gate',
    planned: false,
    lines: [
      { key: 'TR-FOOL-EN', lang: 'EN', title: 'Foolishness or the Power of God?', code: 'TR-FOOL-EN', before: 718, took: 120, back: 32 },
      { key: 'TR-FOOL-ES', lang: 'ES', title: 'La palabra de la cruz: ¿locura o sabiduría?', code: 'TR-FOOL-ES', before: 285, took: 60, back: 18 },
      { key: 'TR-WHO-EN', lang: 'EN', title: 'Who Is Jesus?', code: 'TR-WHO-EN', before: 690, took: 80, back: 25 },
      { key: 'TR-KNOW-EN', lang: 'EN', title: 'You Can Know God', code: 'TR-KNOW-EN', before: 150, took: 150, back: 0 },
      { key: 'TR-HEAL-ES', lang: 'ES', title: 'El toque que sana', code: 'TR-HEAL-ES', before: 158, took: 60, back: 12 },
      { key: 'BKL-BE1-EN', lang: 'EN', title: 'Basic Elements of the Christian Life, vol. 1', code: 'BKL-BE1-EN', before: 160, took: 20, back: 8 }
    ]
  },
  {
    id: 'ev-0802',
    date: '2026-08-02',
    location: 'Downtown farmers market',
    planned: false,
    lines: [
      { key: 'TR-BOAT-EN', lang: 'EN', title: 'Is Jesus in Your Boat?', code: 'TR-BOAT-EN', before: 560, took: 60, back: 14 },
      { key: 'TR-BOAT-ES', lang: 'ES', title: '¿Está Jesús en su barca?', code: 'TR-BOAT-ES', before: 380, took: 40, back: 12 },
      { key: 'TR-EXIST-EN', lang: 'EN', title: 'How Can I Know God Exists?', code: 'TR-EXIST-EN', before: 135, took: 50, back: 5 },
      { key: 'TR-LOST-ES', lang: 'ES', title: 'Perdido y hallado', code: 'TR-LOST-ES', before: 160, took: 30, back: 9 }
    ]
  },
  {
    id: 'ev-0719',
    date: '2026-07-19',
    location: 'Riverside hall — open house',
    planned: false,
    lines: [
      { key: 'BKL-BE2-EN', lang: 'EN', title: 'Basic Elements of the Christian Life, vol. 2', code: 'BKL-BE2-EN', before: 120, took: 40, back: 18 },
      { key: 'BKL-BE3-ES', lang: 'ES', title: 'Elementos básicos de la vida cristiana, tomo 3', code: 'BKL-BE3-ES', before: 60, took: 30, back: 12 },
      { key: 'TR-BIGQ-EN', lang: 'EN', title: 'The Big Question', code: 'TR-BIGQ-EN', before: 300, took: 50, back: 16 }
    ]
  },
  {
    id: 'ev-0712',
    date: '2026-07-12',
    location: 'Eastside park',
    planned: false,
    lines: [
      { key: 'TR-THIRD-EN', lang: 'EN', title: 'The Third Part', code: 'TR-THIRD-EN', before: 500, took: 80, back: 34 },
      { key: 'TR-ENEM-ES', lang: 'ES', title: 'Ya no somos enemigos', code: 'TR-ENEM-ES', before: 240, took: 40, back: 11 }
    ],
    corrections: [
      {
        id: 'c-0714',
        when: '14 Jul 2026',
        by: 'Admin',
        note: 'Recounted the box on the shelf — eleven had been written down but fourteen came back.',
        changes: [{ key: 'TR-ENEM-ES', from: 11, to: 14 }]
      }
    ]
  }
];

export const INITIAL_MOVEMENTS: Movement[] = [
  { iso: '2026-08-16', kind: 'count', date: '16 Aug', what: 'Count posted — Riverside campus gate', detail: '6 editions counted back', delta: -395 },
  { iso: '2026-08-02', kind: 'receipt', date: '2 Aug', what: 'Stock received — order 26-07', detail: 'Tracts, 4 titles across both languages', delta: 1200 },
  { iso: '2026-07-29', kind: 'adjust', date: '29 Jul', what: 'Adjusted — You Can Know God (EN)', detail: 'Water damage in the storage closet', delta: -25 },
  { iso: '2026-07-19', kind: 'count', date: '19 Jul', what: 'Count posted — Riverside hall open house', detail: '3 editions counted back', delta: -74 },
  { iso: '2026-07-14', kind: 'count', date: '14 Jul', what: 'Correction filed — Eastside park', detail: 'Ya no somos enemigos: came back 11 → 14', delta: 3 },
  { iso: '2026-07-12', kind: 'count', date: '12 Jul', what: 'Count posted — Eastside park', detail: '2 editions counted back', delta: -75 },
  { iso: '2026-07-04', kind: 'receipt', date: '4 Jul', what: 'Stock received — order 26-06', detail: 'Basic elements, vols. 1–3, both languages', delta: 480 },
  { iso: '2026-06-28', kind: 'adjust', date: '28 Jun', what: 'Adjusted — The Big Question (EN)', detail: 'Shelf recount after the storage move', delta: -12 }
];

export const INITIAL_ORDERS: OrderItem[] = [
  { key: 'TR-KNOW-EN', lang: 'EN', title: 'You Can Know God', code: 'TR-KNOW-EN', qty: 200, orderedDate: '25 Aug' },
  { key: 'BND-TR-EN', bundle: 'tracts-en', lang: '', title: 'All English tracts — 1 pack of each', code: 'BND-TR-EN', qty: 600, packs: 12, orderedDate: '20 Aug' }
];

export const INITIAL_SETTINGS: SettingsData = {
  reorder: {
    Bible: 20,
    Booklet: 60,
    Tract: 150
  },
  pack: {
    Bible: 10,
    Booklet: 20,
    Tract: 50
  },
  people: [
    { id: 'p-you', name: 'Yilong Wang', email: 'YilongWang05@gmail.com', role: 'Admin', self: true },
    { id: 'p-tim', name: 'Timothy Miller', email: 'timothy.m@riversidehall.org', role: 'Admin' },
    { id: 'p-sarah', name: 'Sarah Chen', email: 'sarah.c@riversidehall.org', role: 'View only' }
  ],
  hallName: 'Riverside hall'
};

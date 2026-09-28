import { Title, EventItem, Movement, OrderItem, SettingsData } from '../types';

export const INITIAL_TITLES: Title[] = [
  {
    code: 'BIB-NTRV',
    name: 'New Testament Recovery Version',
    cat: 'Bible',
    reorder: 20,
    pack: 10,
    aliases: ['Recovery Version NT', 'RcV New Testament', 'Bible', 'Bibles', 'English Bible', 'Spanish Bible', 'Biblia'],
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
    aliases: [
      'BE Vol 1',
      'Basic Elements 1',
      'Basic Elements Vol 1',
      'Basic Elements, vol. 1',
      'Basic Elements',
      'Basic Elements of the Christian Life',
      'Elementos Básicos',
      'Elementos básicos tomo 1',
      'BKL-001',
      'BOOKLETS'
    ],
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
    aliases: [
      'BE Vol 2',
      'Basic Elements 2',
      'Basic Elements Vol 2',
      'Basic Elements, vol. 2',
      'Elementos Básicos 2',
      'Elementos básicos tomo 2',
      'BKL-002'
    ],
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
    aliases: [
      'BE Vol 3',
      'Basic Elements 3',
      'Basic Elements Vol 3',
      'Basic Elements, vol. 3',
      'Elementos Básicos 3',
      'Elementos básicos tomo 3',
      'BKL-003'
    ],
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
    aliases: ['Healing Touch', 'Healing Jesus'],
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

export const INITIAL_EVENTS: EventItem[] = [];

export const INITIAL_MOVEMENTS: Movement[] = [
  { iso: '2026-08-02', kind: 'receipt', date: '2 Aug', what: 'Stock received — order 26-07', detail: 'Tracts, 4 titles across both languages', delta: 1200 },
  { iso: '2026-07-29', kind: 'adjust', date: '29 Jul', what: 'Adjusted — You Can Know God (EN)', detail: 'Water damage in the storage closet', delta: -25 },
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
    { id: 'p-tim', name: 'Timothy Miller', email: 'timothy.m@cisa.org', role: 'Admin' },
    { id: 'p-sarah', name: 'Sarah Chen', email: 'sarah.c@cisa.org', role: 'View only' }
  ],
  hallName: 'CISA Inventory'
};

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process, { env } from 'node:process';
import type { DocumentSnapshot as AdminDocumentSnapshot, Query as AdminQuery } from 'firebase-admin/firestore';
import type { DocumentSnapshot as ClientDocumentSnapshot, Query as ClientQuery } from 'firebase/firestore';

export type FirestoreData = Record<string, unknown>;

export interface FirestoreDoc {
  id: string;
  data: FirestoreData;
}

export interface CollectionQuery {
  orderBy?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
}

export interface TransactionContext {
  get(path: string): Promise<FirestoreDoc | null>;
  update(path: string, data: FirestoreData): void;
  set(path: string, data: FirestoreData): void;
}

export interface FirestoreBackend {
  readonly mode: 'service-account' | 'client';
  readonly projectId: string;
  readonly databaseId: string;
  getDoc(path: string): Promise<FirestoreDoc | null>;
  getDocsWhere(collectionPath: string, field: string, value: unknown, max?: number): Promise<FirestoreDoc[]>;
  listCollection(collectionPath: string, options?: CollectionQuery): Promise<FirestoreDoc[]>;
  addDoc(collectionPath: string, data: FirestoreData): Promise<string>;
  runTransaction<T>(worker: (tx: TransactionContext) => Promise<T>): Promise<T>;
  serverTimestamp(): unknown;
}

interface ServiceAccountJson {
  project_id?: string;
  client_email: string;
  private_key: string;
}

interface AppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
  authDomain?: string;
  appId?: string;
}

const APPLET_CONFIG_PATH = fileURLToPath(new URL('../firebase-applet-config.json', import.meta.url));
const DEFAULT_DATABASE_ID = '(default)';

function readAppletConfig(): AppletConfig {
  try {
    return JSON.parse(readFileSync(APPLET_CONFIG_PATH, 'utf8')) as AppletConfig;
  } catch {
    return {};
  }
}

function parseServiceAccount(raw: string): ServiceAccountJson {
  const trimmed = raw.trim();
  let jsonText: string;

  if (trimmed.startsWith('{')) {
    jsonText = trimmed;
  } else {
    const path = resolve(trimmed);
    try {
      jsonText = readFileSync(path, 'utf8');
    } catch {
      throw new Error(
        `Could not read the Firebase service account file at "${path}". ` +
          'Set FIREBASE_SERVICE_ACCOUNT to a JSON string or an absolute path to the service account JSON.'
      );
    }
  }

  let parsed: Partial<ServiceAccountJson>;
  try {
    parsed = JSON.parse(jsonText) as Partial<ServiceAccountJson>;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS is not valid JSON.');
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('The service account JSON must contain "client_email" and "private_key".');
  }

  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

function resolveServiceAccount(): ServiceAccountJson | null {
  const inline = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (inline) {
    return parseServiceAccount(inline);
  }

  const adcPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (adcPath) {
    return parseServiceAccount(adcPath);
  }

  return null;
}

async function createAdminBackend(
  serviceAccount: ServiceAccountJson,
  projectId: string,
  databaseId: string
): Promise<FirestoreBackend> {
  const adminApp = await import('firebase-admin/app');
  const adminFirestore = await import('firebase-admin/firestore');

  const app =
    adminApp.getApps().find((candidate) => candidate.name === 'lit-ledger-mcp') ??
    adminApp.initializeApp(
      {
        credential: adminApp.cert({
          projectId: serviceAccount.project_id ?? projectId,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId,
      },
      'lit-ledger-mcp'
    );

  const db = databaseId === DEFAULT_DATABASE_ID
    ? adminFirestore.getFirestore(app)
    : adminFirestore.getFirestore(app, databaseId);

  const toDoc = (snapshot: AdminDocumentSnapshot): FirestoreDoc => ({
    id: snapshot.id,
    data: (snapshot.data() ?? {}) as FirestoreData,
  });

  return {
    mode: 'service-account',
    projectId,
    databaseId,

    async getDoc(path) {
      const snapshot = await db.doc(path).get();
      return snapshot.exists ? toDoc(snapshot) : null;
    },

    async getDocsWhere(collectionPath, field, value, max = 10) {
      const snapshot = await db.collection(collectionPath).where(field, '==', value).limit(max).get();
      return snapshot.docs.map(toDoc);
    },

    async listCollection(collectionPath, options = {}) {
      let query: AdminQuery = db.collection(collectionPath);
      if (options.orderBy) {
        query = query.orderBy(options.orderBy, options.direction ?? 'asc');
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map(toDoc);
    },

    async addDoc(collectionPath, data) {
      const docRef = await db.collection(collectionPath).add(data);
      return docRef.id;
    },

    runTransaction(worker) {
      return db.runTransaction(async (transaction) =>
        worker({
          async get(path) {
            const snapshot = await transaction.get(db.doc(path));
            return snapshot.exists ? toDoc(snapshot) : null;
          },
          update(path, data) {
            transaction.update(db.doc(path), data);
          },
          set(path, data) {
            transaction.set(db.doc(path), data);
          },
        })
      );
    },

    serverTimestamp() {
      return adminFirestore.FieldValue.serverTimestamp();
    },
  };
}

async function createClientBackend(options: {
  projectId: string;
  databaseId: string;
  apiKey: string;
  authDomain?: string;
  appId?: string;
  email: string;
  password: string;
}): Promise<FirestoreBackend> {
  const clientApp = await import('firebase/app');
  const clientAuth = await import('firebase/auth');
  const clientFirestore = await import('firebase/firestore');

  const app =
    clientApp.getApps().find((candidate) => candidate.name === 'lit-ledger-mcp') ??
    clientApp.initializeApp(
      {
        apiKey: options.apiKey,
        authDomain: options.authDomain ?? `${options.projectId}.firebaseapp.com`,
        projectId: options.projectId,
        ...(options.appId ? { appId: options.appId } : {}),
      },
      'lit-ledger-mcp'
    );

  const auth = clientAuth.getAuth(app);
  try {
    await clientAuth.signInWithEmailAndPassword(auth, options.email, options.password);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Firebase client sign-in failed for ${options.email}: ${message}. ` +
        'Check FIREBASE_AUTH_EMAIL / FIREBASE_AUTH_PASSWORD.'
    );
  }

  const db = options.databaseId === DEFAULT_DATABASE_ID
    ? clientFirestore.getFirestore(app)
    : clientFirestore.getFirestore(app, options.databaseId);

  const toDoc = (snapshot: ClientDocumentSnapshot): FirestoreDoc => ({
    id: snapshot.id,
    data: (snapshot.data() ?? {}) as FirestoreData,
  });

  return {
    mode: 'client',
    projectId: options.projectId,
    databaseId: options.databaseId,

    async getDoc(path) {
      const snapshot = await clientFirestore.getDoc(clientFirestore.doc(db, path));
      return snapshot.exists() ? toDoc(snapshot) : null;
    },

    async getDocsWhere(collectionPath, field, value, max = 10) {
      const snapshot = await clientFirestore.getDocs(
        clientFirestore.query(
          clientFirestore.collection(db, collectionPath),
          clientFirestore.where(field, '==', value),
          clientFirestore.limit(max)
        )
      );
      return snapshot.docs.map(toDoc);
    },

    async listCollection(collectionPath, queryOptions = {}) {
      let query: ClientQuery = clientFirestore.collection(db, collectionPath);
      if (queryOptions.orderBy) {
        query = clientFirestore.query(
          query,
          clientFirestore.orderBy(queryOptions.orderBy, queryOptions.direction ?? 'asc')
        );
      }
      if (queryOptions.limit) {
        query = clientFirestore.query(query, clientFirestore.limit(queryOptions.limit));
      }
      const snapshot = await clientFirestore.getDocs(query);
      return snapshot.docs.map(toDoc);
    },

    async addDoc(collectionPath, data) {
      const docRef = await clientFirestore.addDoc(clientFirestore.collection(db, collectionPath), data);
      return docRef.id;
    },

    runTransaction(worker) {
      return clientFirestore.runTransaction(db, async (transaction) =>
        worker({
          async get(path) {
            const snapshot = await transaction.get(clientFirestore.doc(db, path));
            return snapshot.exists() ? toDoc(snapshot) : null;
          },
          update(path, data) {
            transaction.update(clientFirestore.doc(db, path), data);
          },
          set(path, data) {
            transaction.set(clientFirestore.doc(db, path), data);
          },
        })
      );
    },

    serverTimestamp() {
      return clientFirestore.serverTimestamp();
    },
  };
}

/**
 * Creates a Firestore backend from environment variables.
 *
 * Preferred: FIREBASE_SERVICE_ACCOUNT (inline JSON or path) or
 * GOOGLE_APPLICATION_CREDENTIALS, using firebase-admin.
 *
 * Fallback: FIREBASE_API_KEY + FIREBASE_AUTH_EMAIL + FIREBASE_AUTH_PASSWORD,
 * using the Firebase client SDK (security rules apply, as the signed-in user).
 */
export async function createBackend(): Promise<FirestoreBackend> {
  const applet = readAppletConfig();
  const projectId = env.FIREBASE_PROJECT_ID?.trim() || applet.projectId;

  if (!projectId) {
    throw new Error(
      'No Firebase project id found. Set FIREBASE_PROJECT_ID or keep firebase-applet-config.json in the project root.'
    );
  }

  const databaseId =
    env.FIREBASE_DATABASE_ID?.trim() || applet.firestoreDatabaseId || DEFAULT_DATABASE_ID;

  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    return createAdminBackend(serviceAccount, projectId, databaseId);
  }

  const apiKey = env.FIREBASE_API_KEY?.trim() || env.VITE_FIREBASE_API_KEY?.trim() || applet.apiKey;
  const email = env.FIREBASE_AUTH_EMAIL?.trim();
  const password = env.FIREBASE_AUTH_PASSWORD;

  if (apiKey && email && password) {
    return createClientBackend({
      projectId,
      databaseId,
      apiKey,
      authDomain: env.FIREBASE_AUTH_DOMAIN?.trim() || applet.authDomain,
      appId: env.FIREBASE_APP_ID?.trim() || applet.appId,
      email,
      password,
    });
  }

  throw new Error(
    'No Firestore credentials configured. Set FIREBASE_SERVICE_ACCOUNT (recommended; JSON string or path) ' +
      'or GOOGLE_APPLICATION_CREDENTIALS. To use the Firebase client SDK instead, set FIREBASE_API_KEY, ' +
      'FIREBASE_AUTH_EMAIL and FIREBASE_AUTH_PASSWORD.'
  );
}

export function logToStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

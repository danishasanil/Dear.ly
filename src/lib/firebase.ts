import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Firebase Web configuration: The apiKey is a public client identifier for Google/Firebase routing.
// Real security boundaries are enforced server-side via Firebase Auth and Firestore Security Rules.
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider options
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Configure Firestore instance using databaseId if provided
export const db: Firestore = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strips all `undefined` values and nested `undefined` values from an object or array
 * to prevent Firestore runtime write exceptions.
 */
export function sanitizePayload<T extends Record<string, any>>(obj: T): Partial<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null && !(item instanceof Date) ? sanitizePayload(item) : item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

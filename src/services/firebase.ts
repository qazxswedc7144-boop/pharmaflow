import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "dummy",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]!;
const rtdb = getDatabase(app);
const db = getFirestore(app);
const auth = getAuth(app);

export enum OperationType {
  GET = "GET",
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE"
}

export const handleFirestoreError = (error: unknown, opType: OperationType, context: string) => {
  console.error(`Firestore ${opType} error in ${context}:`, error);
  throw error;
};

export const loginWithGoogleFirebase = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export { app, rtdb, db, auth };
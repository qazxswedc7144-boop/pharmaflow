import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import firebaseAppletConfig from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  ...(import.meta.env.VITE_FIREBASE_DATABASE_URL && { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL })
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]!;
const rtdb = getDatabase(app);
const db = firebaseAppletConfig.firestoreDatabaseId && firebaseAppletConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, firebaseAppletConfig.firestoreDatabaseId)
  : getFirestore(app);
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
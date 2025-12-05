import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBe2viQe-sbdNFJ-awTzhFgPN9OTYGOwyQ",
  authDomain: "maeconomy-10d88.firebaseapp.com",
  projectId: "maeconomy-10d88",
  // Use the `*.appspot.com` bucket hostname for Firebase Storage
  storageBucket: "maeconomy-10d88.appspot.com",
  messagingSenderId: "603502699206",
  appId: "1:603502699206:web:ebe4947d2768a9bcf4edc7",
  measurementId: "G-J2S5KYP8BS"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Debug: log initialization so we can confirm the app is configured at runtime
try {
  // Some environments may not show console output the same way; this is helpful during development
  // eslint-disable-next-line no-console
  console.log('[firebase] initialized:', app?.name, app?.options?.projectId);
  // eslint-disable-next-line no-console
  console.log('[firebase] options:', JSON.stringify(app?.options || {}));
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[firebase] init log failed:', e);
}

// Export what the rest of your app already importeert
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;

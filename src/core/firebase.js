// Thin shim — all modules use window.fbAuth, window.fbDB etc directly
// or import Firebase SDK lazily themselves.
export const auth      = () => window.fbAuth;
export const db        = () => window.fbDB;
export const storage   = () => window.fbStorage;
export const functions = () => window.fbFunctions;

// Re-exports for any module that still imports from here
export const serverTimestamp = async () => {
  const { serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
  return serverTimestamp();
};

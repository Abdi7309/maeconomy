import { Platform } from 'react-native';

// Firebase doesn't need the same reconnect logic as Supabase
// This is kept as a stub for backwards compatibility
export const setupSupabaseWakeUp = (onVisibilityRestore) => {
  if (Platform.OS !== 'web') return;

  // Firebase handles reconnection automatically via onAuthStateChanged
  // Just trigger data refresh when tab becomes visible
  if (typeof document === 'undefined' || !window) return;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[SupabaseWakeUp] Tab visible - triggering data refresh');
      if (onVisibilityRestore && typeof onVisibilityRestore === 'function') {
        onVisibilityRestore();
      }
    }
  });

  console.log('[SupabaseWakeUp] Visibility listener registered (Firebase mode)');
};

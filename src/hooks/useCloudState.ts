import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppState } from '@/lib/store';
import { loadAppState } from '@/lib/store';

/**
 * Hook that syncs AppState to the cloud database for the authenticated user.
 * Falls back to localStorage defaults on first load, then persists to cloud.
 */
export function useCloudState(userId: string | undefined) {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load state from cloud on mount
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('user_app_state')
          .select('state')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data?.state) {
          setAppState(data.state as unknown as AppState);
        } else {
          // First time user — load from localStorage defaults and save to cloud
          const local = loadAppState();
          setAppState(local);
          await supabase.from('user_app_state').insert({
            user_id: userId,
            state: local as any,
          });
        }
      } catch (err) {
        console.error('Error loading cloud state:', err);
        // Fallback to localStorage
        setAppState(loadAppState());
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  // Save to cloud with debounce
  const saveToCloud = useCallback(
    (newState: AppState) => {
      if (!userId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from('user_app_state')
            .update({ state: newState as any })
            .eq('user_id', userId);
        } catch (err) {
          console.error('Error saving to cloud:', err);
        }
      }, 1000); // debounce 1s
    },
    [userId]
  );

  const updateAppState = useCallback(
    (updater: AppState | ((prev: AppState) => AppState)) => {
      setAppState(prev => {
        if (!prev) return prev;
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveToCloud(next);
        return next;
      });
    },
    [saveToCloud]
  );

  return { appState, setAppState: updateAppState, loading };
}

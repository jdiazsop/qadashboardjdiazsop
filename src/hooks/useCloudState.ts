import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppState } from '@/lib/store';
import { loadAppState, saveAppState } from '@/lib/store';

const STORAGE_KEY = 'qa-dashboard-v13';
const CLOUD_TIMESTAMP_KEY = 'qa-cloud-last-sync';

/**
 * Hook that syncs AppState to the cloud database for the authenticated user.
 * Compares localStorage and cloud data, preferring the most recent version.
 */
export function useCloudState(userId: string | undefined) {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load state: compare cloud vs localStorage and use the most recent
  useEffect(() => {
    if (!userId) {
      // No user yet — fall back to localStorage so UI isn't stuck on "loading"
      setAppState(loadAppState());
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('user_app_state')
          .select('state, updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;

        const localState = loadAppState();
        const localTimestamp = localStorage.getItem(CLOUD_TIMESTAMP_KEY);
        const hasLocalData = localStorage.getItem('qa-dashboard-v13') !== null;

        if (data?.state) {
          const neverSynced = !localTimestamp;
          const localTime = localTimestamp ? new Date(localTimestamp).getTime() : 0;
          const cloudTime = new Date(data.updated_at).getTime();
          
          if ((neverSynced && hasLocalData) || (localTime > cloudTime && localState.tabs.length > 0)) {
            console.log('Using localStorage (newer or never synced)');
            setAppState(localState);
            await supabase
              .from('user_app_state')
              .update({ state: localState as any })
              .eq('user_id', userId);
            localStorage.setItem(CLOUD_TIMESTAMP_KEY, new Date().toISOString());
          } else {
            console.log('Using cloud data');
            setAppState(data.state as unknown as AppState);
            saveAppState(data.state as unknown as AppState);
            localStorage.setItem(CLOUD_TIMESTAMP_KEY, data.updated_at);
          }
        } else {
          setAppState(localState);
          await supabase.from('user_app_state').insert({
            user_id: userId,
            state: localState as any,
          });
          localStorage.setItem(CLOUD_TIMESTAMP_KEY, new Date().toISOString());
        }
      } catch (err) {
        console.error('Error loading cloud state:', err);
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
      // Always save to localStorage immediately
      saveAppState(newState);
      localStorage.setItem(CLOUD_TIMESTAMP_KEY, new Date().toISOString());

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
      }, 1000);
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
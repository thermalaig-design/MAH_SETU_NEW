import { supabase } from './supabaseClient';

const CACHE_KEY = 'feature_flags_cache_v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Cache helpers ──────────────────────────────────────────────────
const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts || !parsed.flags) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.flags;
  } catch {
    return null;
  }
};

const writeCache = (flags) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), flags }));
  } catch {
    // ignore storage errors
  }
};

export const clearFeatureFlagsCache = () => {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
};

// ── Fetch feature flags for a given trust ─────────────────────────
// Uses features + feature_flags join
// Returns: { success, flags: { feature_key: boolean }, cached? }
export const fetchFeatureFlags = async (trustId = null, opts = {}) => {
  try {
    const cached = readCache();
    if (!opts.force && cached) return { success: true, flags: cached, cached: true };

    if (!trustId) {
      // No trust selected — default all features to enabled
      return { success: true, flags: {} };
    }

    const { data: rows, error } = await supabase
      .from('feature_flags')
      .select('is_enabled, features(name)')
      .eq('trust_id', trustId)
      .eq('tier', 'general');

    if (error) {
      console.error('[FeatureFlags] Fetch error:', error.message);
      return { success: false, flags: {} };
    }

    // Build a flat map: { feature_key: boolean }
    const flags = {};
    (rows || []).forEach((row) => {
      const key = row?.features?.name;
      if (key) {
        flags[key] = !!row.is_enabled;
      }
    });

    writeCache(flags);
    return { success: true, flags };
  } catch (err) {
    console.error('[FeatureFlags] Unexpected error:', err.message || err);
    return { success: false, flags: {} };
  }
};

// ── Subscribe to real-time feature flag changes ────────────────────
export const subscribeFeatureFlags = (trustId, onChange) => {
  try {
    const channel = supabase
      .channel(`feature-flags-${trustId || 'global'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_flags' },
        () => {
          clearFeatureFlagsCache();
          if (typeof onChange === 'function') onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  } catch {
    return () => {};
  }
};

// ── Helper: is a feature enabled? (default true when key not found) ─
// Usage: isFeatureEnabled(featureFlags, 'feature_gallery')
export const isFeatureEnabled = (flags, key) => {
  if (!flags || typeof flags !== 'object') return true;
  if (!(key in flags)) return true; // not configured = enabled by default
  return flags[key] !== false;
};

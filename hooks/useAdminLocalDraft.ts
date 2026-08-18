import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

type DraftEnvelope<T> = {
  savedAt: string;
  data: T;
};

type UseAdminLocalDraftParams<T> = {
  storageKey: string;
  value: T;
  enabled: boolean;
  onRestore: (value: T) => void;
  remoteDraftKey?: string;
  remoteEnabled?: boolean;
};

const safeParseDraft = <T,>(raw: string | null): DraftEnvelope<T> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed !== 'object' || !('savedAt' in parsed) || !('data' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const toTimestamp = (value?: string | null) => {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const pickLatestDraft = <T,>(localDraft: DraftEnvelope<T> | null, remoteDraft: DraftEnvelope<T> | null) => {
  if (!localDraft) return remoteDraft;
  if (!remoteDraft) return localDraft;
  return toTimestamp(remoteDraft.savedAt) > toTimestamp(localDraft.savedAt) ? remoteDraft : localDraft;
};

export const useAdminLocalDraft = <T,>({
  storageKey,
  value,
  enabled,
  onRestore,
  remoteDraftKey,
  remoteEnabled = true,
}: UseAdminLocalDraftParams<T>) => {
  const serializedValue = useMemo(() => safeStringify(value), [value]);
  const [storedDraft, setStoredDraft] = useState<DraftEnvelope<T> | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<DraftEnvelope<T> | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [isReadyToPersist, setIsReadyToPersist] = useState(false);

  const loadStoredDraft = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const nextDraft = safeParseDraft<T>(window.localStorage.getItem(storageKey));
    setStoredDraft(nextDraft);
    return nextDraft;
  }, [storageKey]);

  useEffect(() => {
    let isCancelled = false;
    setIsReadyToPersist(false);

    const bootDrafts = async () => {
      const localDraft = loadStoredDraft();

      if (remoteEnabled && remoteDraftKey) {
        setRemoteStatus('loading');
        try {
          const remote = await api.getAdminEditorDraft<T>(remoteDraftKey);
          if (isCancelled) return;
          const nextRemoteDraft = remote ? { savedAt: remote.saved_at, data: remote.data } : null;
          setRemoteDraft(nextRemoteDraft);
          setRemoteStatus(nextRemoteDraft ? 'saved' : 'idle');
          setRemoteError(null);
        } catch (error: any) {
          if (isCancelled) return;
          setRemoteDraft(null);
          setRemoteStatus('error');
          setRemoteError(error?.message || 'Không thể đọc bản nháp server.');
        }
      } else {
        setRemoteDraft(null);
        setRemoteStatus('idle');
        setRemoteError(null);
      }

      if (!isCancelled) {
        setStoredDraft(localDraft);
        setIsReadyToPersist(true);
      }
    };

    void bootDrafts();
    return () => {
      isCancelled = true;
    };
  }, [loadStoredDraft, remoteDraftKey, remoteEnabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isReadyToPersist) return undefined;

    const timer = window.setTimeout(() => {
      const envelope: DraftEnvelope<T> = {
        savedAt: new Date().toISOString(),
        data: value,
      };

      window.localStorage.setItem(storageKey, JSON.stringify(envelope));
      setStoredDraft(envelope);

      if (remoteEnabled && remoteDraftKey) {
        setRemoteStatus('saving');
        void api.saveAdminEditorDraft<T>({
          draftKey: remoteDraftKey,
          savedAt: envelope.savedAt,
          data: value,
        }).then((savedDraft) => {
          setRemoteDraft({ savedAt: savedDraft.saved_at, data: savedDraft.data });
          setRemoteStatus('saved');
          setRemoteError(null);
        }).catch((error: any) => {
          setRemoteStatus('error');
          setRemoteError(error?.message || 'Không thể đồng bộ bản nháp lên server.');
        });
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [enabled, isReadyToPersist, remoteDraftKey, remoteEnabled, storageKey, value, serializedValue]);

  const latestDraft = useMemo(() => pickLatestDraft(storedDraft, remoteDraft), [remoteDraft, storedDraft]);

  const hasRestorableDraft = useMemo(() => {
    if (!latestDraft) return false;
    return safeStringify(latestDraft.data) !== serializedValue;
  }, [latestDraft, serializedValue]);

  const restoreDraft = useCallback(() => {
    const nextDraft = pickLatestDraft(loadStoredDraft(), remoteDraft);
    if (!nextDraft) return false;
    onRestore(nextDraft.data);
    return true;
  }, [loadStoredDraft, onRestore, remoteDraft]);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    setStoredDraft(null);

    if (remoteEnabled && remoteDraftKey) {
      setRemoteStatus('saving');
      void api.deleteAdminEditorDraft(remoteDraftKey).then(() => {
        setRemoteDraft(null);
        setRemoteStatus('idle');
        setRemoteError(null);
      }).catch((error: any) => {
        setRemoteStatus('error');
        setRemoteError(error?.message || 'Không thể xóa bản nháp server.');
      });
      return;
    }

    setRemoteDraft(null);
    setRemoteStatus('idle');
    setRemoteError(null);
  }, [remoteDraftKey, remoteEnabled, storageKey]);

  const note = remoteEnabled && remoteDraftKey
    ? remoteError
      ? `Máy chủ chưa đồng bộ được bản nháp: ${remoteError}`
      : 'Bản nháp được giữ cả trên máy này và trên server riêng tư.'
    : 'Bản nháp chỉ được giữ trên máy này.';

  return {
    clearDraft,
    discardDraft: clearDraft,
    hasRestorableDraft,
    lastSavedAt: latestDraft?.savedAt || null,
    lastRemoteSavedAt: remoteDraft?.savedAt || null,
    note,
    remoteError,
    remoteStatus,
    restoreDraft,
  };
};

export default useAdminLocalDraft;

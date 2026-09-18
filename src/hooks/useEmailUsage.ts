import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/functions';
import type { EmailUsage } from '../lib/tipos';

const getEmailUsageFn = httpsCallable<void, EmailUsage>(functions, 'getEmailUsage');

export const useEmailUsage = () => {
  const [data, setData] = useState<EmailUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEmailUsageFn();
      setData(result.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error obteniendo uso de correos:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
};

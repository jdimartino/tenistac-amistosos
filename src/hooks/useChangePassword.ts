import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/functions';

const changeOwnPasswordFn = httpsCallable<{ newPassword: string }, void>(functions, 'changeOwnPassword');

export const useChangePassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cambiar = useCallback(async (newPassword: string) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await changeOwnPasswordFn({ newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { cambiar, loading, error, success, reset };
};

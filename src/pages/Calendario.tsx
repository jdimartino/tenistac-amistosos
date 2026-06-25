import { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { CalendarioGrid } from '../components/calendario/CalendarioGrid';
import { CalendarioCapitan } from '../components/calendario/CalendarioCapitan';
import { Button } from '../components/ui/Button';
import { hoy, sumarDias, formatoFecha } from '../lib/fecha';
import { useAuth } from '../hooks/useAuth';

const getDiasPorVista = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 7 : 15);

export const Calendario = () => {
  const { usuario } = useAuth();
  const [diasPorVista, setDiasPorVista] = useState(getDiasPorVista);
  const [inicio, setInicio] = useState(hoy());

  useEffect(() => {
    const handleResize = () => setDiasPorVista(getDiasPorVista());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fin = sumarDias(inicio, diasPorVista - 1);
  const esAdmin = usuario?.role === 'admin';

  const avanzar = () => setInicio((prev) => sumarDias(prev, diasPorVista));
  const retroceder = () => setInicio((prev) => sumarDias(prev, -diasPorVista));
  const resetear = () => setInicio(hoy());

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={retroceder}>Ant.</Button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-900">Calendario de canchas</h2>
          <p className="text-xs text-gray-500">{formatoFecha(inicio)} al {formatoFecha(fin)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={avanzar}>Sig.</Button>
      </div>
      <Button variant="ghost" size="sm" onClick={resetear} className="mb-4 w-full sm:w-auto">
        Hoy
      </Button>
      {esAdmin ? (
        <CalendarioGrid fechaInicio={inicio} fechaFin={fin} />
      ) : (
        <CalendarioCapitan fechaInicio={inicio} fechaFin={fin} />
      )}
    </AppShell>
  );
};

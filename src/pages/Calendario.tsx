import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { CalendarioGrid } from '../components/calendario/CalendarioGrid';
import { CalendarioCapitan } from '../components/calendario/CalendarioCapitan';
import { Button } from '../components/ui/Button';
import { hoy, sumarDias, inicioSemana, formatoFecha } from '../lib/fecha';
import { useAuth } from '../hooks/useAuth';

const DIAS_POR_VISTA = 15;

export const Calendario = () => {
  const { usuario } = useAuth();
  const [inicio, setInicio] = useState(inicioSemana(hoy()));

  const fin = sumarDias(inicio, DIAS_POR_VISTA - 1);
  const esAdmin = usuario?.role === 'admin';

  const avanzar = () => setInicio((prev) => sumarDias(prev, DIAS_POR_VISTA));
  const retroceder = () => setInicio((prev) => sumarDias(prev, -DIAS_POR_VISTA));
  const resetear = () => setInicio(inicioSemana(hoy()));

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

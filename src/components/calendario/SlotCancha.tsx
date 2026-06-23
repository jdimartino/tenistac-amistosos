import type { SlotInfo } from '../../lib/tipos';
import { coloresSlot } from '../../lib/slot';
import { twMerge } from 'tailwind-merge';

interface SlotCanchaProps {
  slot: SlotInfo;
  onEditar?: () => void;
}

const estadoLabel: Record<SlotInfo['estado'], string> = {
  disponible: 'Libre',
  solicitado: 'Solicitado',
  reservado: 'Reservado',
  bloqueado: 'No disp.',
};

export const SlotCancha = ({ slot, onEditar }: SlotCanchaProps) => {
  const esClickeable = slot.reserva && onEditar;

  return (
    <button
      type="button"
      onClick={esClickeable ? onEditar : undefined}
      aria-label={
        slot.reserva
          ? `Reservado por ${slot.reserva.capitanNombre} - Cancha ${slot.cancha}`
          : `Cancha ${slot.cancha} - ${estadoLabel[slot.estado]}`
      }
      className={twMerge(
        'flex w-full flex-col items-center justify-center rounded-xl border p-2 text-center',
        'min-h-[4.5rem] sm:min-h-[5.5rem]',
        esClickeable ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : '',
        coloresSlot[slot.estado]
      )}
    >
      <span className="text-xs font-semibold">C{slot.cancha}</span>
      <span className="text-[10px] leading-tight">{estadoLabel[slot.estado]}</span>
      {slot.reserva && (
        <>
          <span className="text-[9px] leading-tight mt-1 truncate w-full">
            {slot.reserva.capitanNombre}
          </span>
          {slot.reserva.capitanEquipo && (
            <span className="text-[8px] text-gray-500 truncate w-full">
              {slot.reserva.capitanEquipo}
            </span>
          )}
        </>
      )}
    </button>
  );
};

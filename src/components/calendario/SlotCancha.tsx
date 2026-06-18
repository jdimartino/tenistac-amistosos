import type { SlotInfo } from '../../lib/tipos';
import { coloresSlot } from '../../lib/slot';
import { twMerge } from 'tailwind-merge';

interface SlotCanchaProps {
  slot: SlotInfo;
}

const estadoLabel: Record<SlotInfo['estado'], string> = {
  disponible: 'Libre',
  solicitado: 'Solicitado',
  reservado: 'Reservado',
  bloqueado: 'No disp.',
};

export const SlotCancha = ({ slot }: SlotCanchaProps) => {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col items-center justify-center rounded-xl border p-2 text-center',
        'min-h-[4.5rem] sm:min-h-[5.5rem]',
        coloresSlot[slot.estado]
      )}
    >
      <span className="text-xs font-semibold">C{slot.cancha}</span>
      <span className="text-[10px] leading-tight">{estadoLabel[slot.estado]}</span>
      {slot.reserva && (
        <span className="text-[9px] leading-tight mt-1 truncate w-full">
          {slot.reserva.capitanNombre}
        </span>
      )}
    </div>
  );
};

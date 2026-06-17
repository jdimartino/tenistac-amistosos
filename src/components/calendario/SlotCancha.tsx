import { useState } from 'react';
import type { SlotInfo } from '../../lib/tipos';
import { coloresSlot } from '../../lib/slot';
import { SolicitudModal } from './SolicitudModal';
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
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    if (slot.estado === 'bloqueado') return;
    if (slot.estado === 'disponible') setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={slot.estado === 'bloqueado'}
        className={twMerge(
          'flex w-full flex-col items-center justify-center rounded-xl border p-2 text-center transition-colors',
          'min-h-[4.5rem] sm:min-h-[5.5rem]',
          coloresSlot[slot.estado]
        )}
      >
        <span className="text-xs font-semibold">C{slot.cancha}</span>
        <span className="text-[10px] leading-tight">{estadoLabel[slot.estado]}</span>
      </button>

      <SolicitudModal slot={slot} open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

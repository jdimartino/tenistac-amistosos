import { useEffect } from 'react';
import { useEmailUsage } from '../../hooks/useEmailUsage';
import { Spinner } from '../../components/ui/Spinner';
import type { EmailUsageEstado } from '../../lib/tipos';

const ESTADO_CONFIG: Record<EmailUsageEstado, { label: string; color: string; bg: string; barColor: string }> = {
  normal: { label: 'Normal', color: 'text-green-700', bg: 'bg-green-100', barColor: 'bg-green-500' },
  advertencia: { label: 'Advertencia', color: 'text-yellow-700', bg: 'bg-yellow-100', barColor: 'bg-yellow-500' },
  critico: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-100', barColor: 'bg-red-500' },
};

const formatPeriodo = (inicio: string, fin: string): string => {
  if (!inicio || !fin) return 'No disponible';
  const [, mesI, diaI] = inicio.split('-');
  const [, mesF, diaF] = fin.split('-');
  if (inicio === fin) {
    return `${diaI}/${mesI} (hoy)`;
  }
  return `Del ${diaI}/${mesI} al ${diaF}/${mesF}`;
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  subscription: 'Suscripción de pago',
  payAsYouGo: 'Pay-as-you-go',
};

export const UsoCorreosPanel = () => {
  const { data, loading, error, fetch: fetchUsage } = useEmailUsage();

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8 text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Uso de correos</h3>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Error al obtener los datos: {error}</p>
          <button
            type="button"
            onClick={() => fetchUsage()}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Uso de correos</h3>
        <p className="py-8 text-center text-gray-500">No hay datos disponibles.</p>
      </div>
    );
  }

  const estado = ESTADO_CONFIG[data.estado];
  const porcentajeBar = Math.min(data.porcentaje, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Uso de correos</h3>
        <button
          type="button"
          onClick={() => fetchUsage()}
          disabled={loading}
          className="text-sm font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Estado general */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estado.color} ${estado.bg}`}>
            {estado.label}
          </span>
          <span className="text-sm text-gray-600">
            {data.provider} · Plan {PLAN_LABELS[data.planType] || data.planType}
          </span>
        </div>

        {/* Barra de progreso */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Uso</span>
            <span className={`font-bold ${estado.color}`}>{data.porcentaje}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${estado.barColor}`}
              style={{ width: `${porcentajeBar}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tarjetas de datos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Correos enviados"
          value={data.enviados}
          sublabel="en el período actual"
          color="text-blue-700"
        />
        <StatCard
          label="Límite"
          value={data.limite}
          sublabel={
            data.limiteNominal !== null
              ? `nominal (${data.limiteNominalPeriodo ?? ''})`
              : 'derivado (enviados + restantes)'
          }
          color="text-gray-900"
        />
        <StatCard
          label="Correos restantes"
          value={data.restantes}
          sublabel="valor real de Brevo"
          color={data.estado === 'critico' ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard
          label="Porcentaje utilizado"
          value={`${data.porcentaje}%`}
          sublabel={`${data.enviados} / ${data.limite}`}
          color={estado.color}
        />
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-1">Período</p>
          <p className="text-sm font-semibold text-gray-900">{formatPeriodo(data.periodoInicio, data.periodoFin)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-1">Fecha de reinicio</p>
          <p className="text-sm font-semibold text-gray-900">{data.fechaReinicio ?? 'No aplica'}</p>
        </div>
      </div>

      {/* Notas */}
      {data.notas && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500 leading-relaxed">{data.notas}</p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, sublabel, color }: {
  label: string;
  value: number | string;
  sublabel: string;
  color: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString('es-VE') : value}</p>
    <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
  </div>
);

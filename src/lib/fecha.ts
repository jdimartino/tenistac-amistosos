export const formatoISO = (d: Date): string => {
  return d.toISOString().split('T')[0];
};

export const hoy = (): string => {
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
};

export const sumarDias = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return formatoISO(d);
};

export const diferenciaDias = (a: string, b: string): number => {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
};

export const nombreDia = (fecha: string): string => {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const d = new Date(`${fecha}T12:00:00`);
  return dias[d.getDay()];
};

export const nombreDiaCompleto = (fecha: string): string => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = new Date(`${fecha}T12:00:00`);
  return dias[d.getDay()];
};

export const esFechaValida = (fecha: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(new Date(`${fecha}T12:00:00`).getTime());
};

export const generarRangoDias = (inicio: string, fin: string): string[] => {
  const dias: string[] = [];
  let actual = inicio;
  while (actual <= fin) {
    dias.push(actual);
    actual = sumarDias(actual, 1);
  }
  return dias;
};

export const inicioSemana = (fecha: string): string => {
  const d = new Date(`${fecha}T12:00:00`);
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  return sumarDias(fecha, offset);
};

export const rango15DiasDesde = (fecha: string): string[] => {
  const inicio = inicioSemana(fecha);
  return Array.from({ length: 15 }, (_, i) => sumarDias(inicio, i));
};

export const formatoFecha = (fecha: string): string => {
  const [, mes, dia] = fecha.split('-');
  return `${dia}/${mes}`;
};

export const formatoFechaCompleto = (fecha: string): string => {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
};

export const formatFechaVenezuela = (date: Date | any): string => {
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  }).format(d);
};

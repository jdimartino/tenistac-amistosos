export type Rol = 'admin' | 'capitan' | 'subcapitan';

export type Turno = 'maniana' | 'tarde';

export type PreferenciaTurno = 'maniana' | 'tarde' | 'cualquiera';

export type Motivo = 'amistoso' | 'entrenamiento' | 'clases' | 'torneo';

export type EstadoReserva = 'solicitado' | 'reservado' | 'cancelado';

export interface Usuario {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  role: Rol;
  equipo: string;
  activo: boolean;
  primerLogin: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface UsuarioInput {
  username: string;
  email?: string;
  displayName?: string;
  role: Rol;
  equipo?: string;
}

export interface Reserva {
  id: string;
  fecha: string;
  turno: Turno | null;
  turnoPreferencia: PreferenciaTurno;
  canchas: number[];
  estado: EstadoReserva;
  capitanEquipo: string;
  capitanNombre: string;
  capitanUid: string;
  equipoRival: string;
  motivo: Motivo;
  observaciones: string;
  solicitadoEn: Date;
  aprobadoEn: Date | null;
  aprobadoPor: string | null;
}

export interface ReservaInput {
  fecha: string;
  turnoPreferencia: PreferenciaTurno;
  capitanEquipo: string;
  capitanNombre: string;
  equipoRival: string;
  motivo: Motivo;
  observaciones: string;
}

export interface Bloqueo {
  id: string;
  tipo: 'dia' | 'turno' | 'rango';
  fechaInicio: string;
  fechaFin: string;
  turno: Turno | 'ambos';
  cancha: number | null;
  motivo: string;
  creadoPor: string;
  creadoEn: Date;
}

export interface BloqueoInput {
  tipo: 'dia' | 'turno' | 'rango';
  fechaInicio: string;
  fechaFin: string;
  turno: Turno | 'ambos';
  cancha: number | null;
  motivo: string;
}

export interface SlotBloqueado {
  id: string;
  fecha: string;
  turno: Turno;
  cancha: number;
  bloqueoId: string;
  motivo: string;
}

export type EstadoSlot = 'disponible' | 'solicitado' | 'reservado' | 'bloqueado';

export interface SlotInfo {
  fecha: string;
  turno: Turno;
  cancha: number;
  estado: EstadoSlot;
  reserva?: Reserva;
  bloqueo?: SlotBloqueado;
}

export type LogReservaTipo = 'reserva_aprobada' | 'reserva_rechazada' | 'reserva_eliminada';

export interface LogReserva {
  id: string;
  tipo: LogReservaTipo;
  reservaId: string;
  capitanUid: string | null;
  capitanNombre: string | null;
  fecha: string | null;
  turno?: string;
  canchas?: number[];
  motivo?: string;
  realizadoPor: string;
  realizadoEn: Date;
}

// MENSAJES INTERNOS
export type MensajeCategoria = 'comunicacion' | 'aprobacion' | 'rechazo';
export type MensajeTipo = 'directo' | 'sistema';

export interface Mensaje {
  id: string;
  paraUid: string;
  deUid: string;
  deNombre: string;
  deRol: Rol;
  tipo: MensajeTipo;
  categoria: MensajeCategoria;
  asunto: string;
  cuerpo: string;
  leido: boolean;
  threadId: string;
  createdAt: Date;
}

export interface MensajeInput {
  paraUid: string;
  asunto: string;
  cuerpo: string;
  threadId?: string;
}

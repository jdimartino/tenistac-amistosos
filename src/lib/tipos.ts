export type Rol = 'admin' | 'capitan' | 'subcapitan';

export type Turno = 'maniana' | 'tarde';

export type EstadoReserva = 'solicitado' | 'reservado' | 'cancelado';

export type Categoria = 'A' | 'B' | 'C' | 'libre';

export interface Usuario {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  role: Rol;
  equipo: string;
  activo: boolean;
  createdAt: Date;
  createdBy: string;
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
  turno: Turno;
  cancha: number;
  estado: EstadoReserva;
  categoria: Categoria;
  capitanNombre: string;
  capitanUid: string;
  equipoRival: string;
  observaciones: string;
  solicitadoEn: Date;
  aprobadoEn: Date | null;
  aprobadoPor: string | null;
}

export interface ReservaInput {
  fecha: string;
  turno: Turno;
  cancha: number;
  categoria: Categoria;
  capitanNombre: string;
  equipoRival: string;
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

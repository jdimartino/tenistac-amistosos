import { collection, doc } from 'firebase/firestore';
import { db } from './config';

export const usuariosRef = collection(db, 'usuarios');
export const usuarioDoc = (uid: string) => doc(db, 'usuarios', uid);

export const reservasRef = collection(db, 'reservas');
export const reservaDoc = (id: string) => doc(db, 'reservas', id);

export const bloqueosRef = collection(db, 'bloqueos');
export const bloqueoDoc = (id: string) => doc(db, 'bloqueos', id);

export const slotsBloqueadosRef = collection(db, 'slotsBloqueados');
export const slotBloqueadoDoc = (id: string) => doc(db, 'slotsBloqueados', id);

export const mensajesRef = collection(db, 'mensajes');
export const mensajeDoc = (id: string) => doc(db, 'mensajes', id);

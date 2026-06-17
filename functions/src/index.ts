import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();
const auth = getAuth();

setGlobalOptions({ region: 'us-central1' });

const CANCHAS = [1, 2, 3];

type Turno = 'maniana' | 'tarde';
type Rol = 'admin' | 'capitan' | 'subcapitan';

interface UsuarioInput {
  email: string;
  displayName: string;
  role: Rol;
  equipo: string;
}

interface BloqueoInput {
  tipo: 'dia' | 'turno' | 'rango';
  fechaInicio: string;
  fechaFin: string;
  turno: Turno | 'ambos';
  cancha: number | null;
  motivo: string;
}

const assertAdmin = async (uid: string) => {
  const doc = await db.collection('usuarios').doc(uid).get();
  if (!doc.exists || doc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo los administradores pueden realizar esta acción.');
  }
};

const sumarDias = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

const expandirBloqueo = async (
  bloqueoId: string,
  fechaInicio: string,
  fechaFin: string,
  turno: Turno | 'ambos',
  cancha: number | null,
  motivo: string
) => {
  const dias: string[] = [];
  let actual = fechaInicio;
  while (actual <= fechaFin) {
    dias.push(actual);
    actual = sumarDias(actual, 1);
  }

  const turnos: Turno[] = turno === 'ambos' ? ['maniana', 'tarde'] : [turno];
  const canchas = cancha === null ? CANCHAS : [cancha];

  const batch = db.batch();
  for (const d of dias) {
    for (const t of turnos) {
      for (const c of canchas) {
        const slotRef = db.collection('slotsBloqueados').doc(`${d}_${t}_${c}`);
        batch.set(slotRef, { fecha: d, turno: t, cancha: c, bloqueoId, motivo });
      }
    }
  }
  await batch.commit();
};

export const createUser = onCall<UsuarioInput & { password: string }, Promise<{ uid: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { email, password, displayName, role, equipo } = request.data;
    const user = await auth.createUser({ email, password, displayName });

    await db.collection('usuarios').doc(user.uid).set({
      uid: user.uid,
      email,
      displayName,
      role,
      equipo: equipo || '',
      activo: true,
      createdAt: Timestamp.now(),
      createdBy: request.auth.uid,
    });

    return { uid: user.uid };
  }
);

export const updateUser = onCall<
  { uid: string } & Partial<UsuarioInput>,
  void
>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { uid, ...data } = request.data;
  const authUpdate: { displayName?: string } = {};
  if (data.displayName) authUpdate.displayName = data.displayName;
  await auth.updateUser(uid, authUpdate);
  await db.collection('usuarios').doc(uid).update(data);
});

export const deleteUser = onCall<{ uid: string }, void>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { uid } = request.data;
  await auth.deleteUser(uid);
  await db.collection('usuarios').doc(uid).delete();
});

export const resetPassword = onCall<{ uid: string }, Promise<{ link: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid } = request.data;
    const user = await auth.getUser(uid);
    if (!user.email) {
      throw new HttpsError('not-found', 'El usuario no tiene correo registrado.');
    }
    const link = await auth.generatePasswordResetLink(user.email);
    return { link };
  }
);

export const createBloqueo = onCall<BloqueoInput, Promise<{ id: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { tipo, fechaInicio, fechaFin, turno, cancha, motivo } = request.data;

    const bloqueoRef = db.collection('bloqueos').doc();
    await bloqueoRef.set({
      tipo,
      fechaInicio,
      fechaFin,
      turno,
      cancha: cancha ?? null,
      motivo,
      creadoPor: request.auth.uid,
      creadoEn: Timestamp.now(),
    });

    await expandirBloqueo(bloqueoRef.id, fechaInicio, fechaFin, turno, cancha, motivo);
    return { id: bloqueoRef.id };
  }
);

export const deleteBloqueo = onCall<{ id: string }, void>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { id } = request.data;
  const slotsSnap = await db.collection('slotsBloqueados').where('bloqueoId', '==', id).get();

  const batch = db.batch();
  slotsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await db.collection('bloqueos').doc(id).delete();
});

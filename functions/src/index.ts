import { initializeApp } from 'firebase-admin/app';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();
const auth = getAuth();

setGlobalOptions({ region: 'us-central1' });

const CANCHAS = [1, 2, 3, 4, 5];

type Turno = 'maniana' | 'tarde';
type Rol = 'admin' | 'capitan' | 'subcapitan';

interface UsuarioInput {
  username: string;
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
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
      }
      await assertAdmin(request.auth.uid);

      const data = request.data;

      // Validar username
      if (!data.username || typeof data.username !== 'string') {
        throw new HttpsError('invalid-argument', 'El nombre de usuario es obligatorio.');
      }

      const username = data.username.toLowerCase().trim();

      if (username.length < 2) {
        throw new HttpsError('invalid-argument', 'El nombre de usuario debe tener al menos 2 caracteres.');
      }

      // Validar que solo contenga letras
      if (!/^[a-z]+$/.test(username)) {
        throw new HttpsError('invalid-argument', 'El nombre de usuario solo puede contener letras minúsculas.');
      }

      if (!data.password || data.password.length < 6) {
        throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
      }

      // Verificar unicidad del username
      const existing = await db.collection('usuarios').where('username', '==', username).get();
      if (!existing.empty) {
        throw new HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
      }

      const internalEmail = `${username}@tenistac-amistosos.app`;

      // Validar formato del email generado
      if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(internalEmail)) {
        throw new HttpsError('invalid-argument', 'Formato de email inválido generado.');
      }

      console.log('Creating user with:', {
        username,
        internalEmail,
        hasPassword: !!data.password,
        referenceEmail: data.email || '',
      });

      const finalDisplayName = (data.displayName && data.displayName.trim()) 
        ? data.displayName.trim() 
        : username;

      const createUserData: admin.auth.CreateRequest = {
        email: internalEmail,
        password: data.password,
        displayName: finalDisplayName,
      };

      let user;
      try {
        user = await auth.createUser(createUserData);
      } catch (err: any) {
        console.error('Auth creation failed:', err, 'with data:', createUserData);
        if (err.code?.includes('email-already-exists')) {
          throw new HttpsError('already-exists', 'Ya existe un usuario con ese username.');
        }
        throw new HttpsError('internal', `Error creando usuario en Auth: ${err.message}`);
      }

      await db.collection('usuarios').doc(user.uid).set({
        uid: user.uid,
        username,
        email: data.email || '',
        internalEmail,
        displayName: finalDisplayName,
        role: data.role,
        equipo: data.equipo || '',
        activo: true,
        createdAt: Timestamp.now(),
        createdBy: request.auth.uid,
      });

      return { uid: user.uid };
    } catch (error: any) {
      console.error('createUser error:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', error.message || 'Error interno al crear el usuario.');
    }
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

  const { uid, username, ...data } = request.data;

  // Si se está cambiando el username, verificar unicidad
  if (username) {
    const existing = await db.collection('usuarios').where('username', '==', username).get();
    const isTakenByOther = existing.docs.some(doc => doc.id !== uid);
    if (isTakenByOther) {
      throw new HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
    }
  }

  const authUpdate: { displayName?: string; email?: string } = {};
  if (data.displayName) authUpdate.displayName = data.displayName;
  if (username) authUpdate.email = `${username}@tenistac-amistosos.app`;

  if (Object.keys(authUpdate).length > 0) {
    await auth.updateUser(uid, authUpdate);
  }

  const updateData: any = { ...data };
  if (username) updateData.username = username;

  await db.collection('usuarios').doc(uid).update(updateData);
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

export const setPassword = onCall<{ uid: string; newPassword: string }, Promise<{ password: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid, newPassword } = request.data;

    if (!newPassword || newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }

    await auth.updateUser(uid, { password: newPassword });

    return { password: newPassword };
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


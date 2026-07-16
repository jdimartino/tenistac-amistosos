import { initializeApp } from 'firebase-admin/app';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { BrevoClient } from '@getbrevo/brevo';

initializeApp();
const db = getFirestore();
const auth = getAuth();

setGlobalOptions({ region: 'us-central1' });

const brevoApiKey = defineSecret('BREVO_API_KEY');

const CANCHAS = [1, 2, 3, 4, 5];
const CANCHAS_SET = new Set(CANCHAS);

type Turno = 'maniana' | 'tarde';
type Rol = 'admin' | 'capitan' | 'subcapitan';

const TURNOS_VALIDOS: Turno[] = ['maniana', 'tarde'];
const TURNOS_AMBOS_VALIDOS: Array<Turno | 'ambos'> = ['maniana', 'tarde', 'ambos'];
const ROLES_VALIDOS: Rol[] = ['admin', 'capitan', 'subcapitan'];
const TIPOS_BLOQUEO = ['dia', 'turno', 'rango'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validarFecha = (fecha: string, fieldName: string): void => {
  if (!fecha || typeof fecha !== 'string' || !FECHA_REGEX.test(fecha)) {
    throw new HttpsError('invalid-argument', `${fieldName} debe ser una fecha válida (YYYY-MM-DD).`);
  }
  if (Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
    throw new HttpsError('invalid-argument', `${fieldName} no es una fecha válida.`);
  }
};

const validarCanchas = (canchas: unknown): number[] => {
  if (!Array.isArray(canchas)) {
    throw new HttpsError('invalid-argument', 'canchas debe ser un array.');
  }
  if (canchas.length === 0) {
    throw new HttpsError('invalid-argument', 'Debe seleccionar al menos una cancha.');
  }
  for (const c of canchas) {
    if (typeof c !== 'number' || !CANCHAS_SET.has(c)) {
      throw new HttpsError('invalid-argument', `Cancha inválida: ${c}. Debe ser un número del 1 al 5.`);
    }
  }
  return canchas as number[];
};

const validarString = (value: unknown, fieldName: string, opts?: { minLength?: number; maxLength?: number; pattern?: RegExp; required?: boolean }): void => {
  const required = opts?.required !== false;
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpsError('invalid-argument', `${fieldName} es obligatorio.`);
    return;
  }
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} debe ser un texto.`);
  }
  const trimmed = value.trim();
  if (opts?.minLength && trimmed.length < opts.minLength) {
    throw new HttpsError('invalid-argument', `${fieldName} debe tener al menos ${opts.minLength} caracteres.`);
  }
  if (opts?.maxLength && trimmed.length > opts.maxLength) {
    throw new HttpsError('invalid-argument', `${fieldName} no debe exceder ${opts.maxLength} caracteres.`);
  }
  if (opts?.pattern && !opts.pattern.test(trimmed)) {
    throw new HttpsError('invalid-argument', `${fieldName} tiene un formato inválido.`);
  }
};

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

const getAdminEmails = async (): Promise<string[]> => {
  const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
  return adminsSnap.docs
    .map(doc => doc.data().email)
    .filter(email => email && typeof email === 'string' && email.trim()) as string[];
};

const sendAdminNotification = async (subject: string, htmlContent: string) => {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) {
    console.log('No admin emails found, skipping notification.');
    return;
  }
  
  const client = new BrevoClient({ apiKey: brevoApiKey.value() });
  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
      to: adminEmails.map((email) => ({ email })),
      subject,
      htmlContent,
    });
  } catch (err: unknown) {
    console.error('Error sending admin email notification:', err);
  }
};

const sumarDias = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

const formatFechaVenezuela = (date: any): string => {
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  }).format(d);
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

export const createUser = onCall<
  UsuarioInput & { password: string },
  Promise<{ uid: string }>
>(
  {
    secrets: [brevoApiKey],
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
      }
      await assertAdmin(request.auth.uid);

      const data = request.data;

      // Validar username
      validarString(data.username, 'username', { required: true, minLength: 2, maxLength: 30, pattern: /^[a-z]+$/ });

      const username = data.username.toLowerCase().trim();

      // Validar contraseña
      if (!data.password || typeof data.password !== 'string') {
        throw new HttpsError('invalid-argument', 'La contraseña es obligatoria.');
      }
      if (data.password.length < 6) {
        throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
      }
      if (data.password.length > 128) {
        throw new HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
      }

      // Validar role
      if (!data.role || !ROLES_VALIDOS.includes(data.role)) {
        throw new HttpsError('invalid-argument', `role inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}`);
      }

      // Validar displayName si se provee
      if (data.displayName) {
        validarString(data.displayName, 'displayName', { required: false, maxLength: 100 });
      }

      // Validar equipo si se provee
      if (data.equipo) {
        validarString(data.equipo, 'equipo', { required: false, maxLength: 100 });
      }

      // Validar email (obligatorio para poder enviar credenciales)
      if (!data.email || !data.email.trim()) {
        throw new HttpsError('invalid-argument', 'El correo es obligatorio para enviar las credenciales.');
      }
      validarString(data.email, 'email', { required: true, maxLength: 200 });

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
        console.error('Auth creation failed:', err.code);
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
        primerLogin: true,
        createdAt: Timestamp.now(),
        createdBy: request.auth.uid,
      });

      console.log(`Usuario creado: ${user.uid} (${username}) por ${request.auth.uid}`);

      const client = new BrevoClient({ apiKey: brevoApiKey.value() });
      try {
        await client.transactionalEmails.sendTransacEmail({
          sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
          to: [{ email: data.email }],
          subject: '[TenisTac] Tus credenciales de acceso',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Bienvenido a TenisTac</h2>
              <p>Hola ${finalDisplayName},</p>
              <p>Tu cuenta ha sido creada. Estas son tus credenciales de acceso:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p><strong>Usuario:</strong> ${username}</p>
                <p><strong>Contraseña:</strong> ${data.password}</p>
              </div>
              <p>Ingresá en <a href="https://canchas.tenistac.com">canchas.tenistac.com</a></p>
              <p style="color: #dc2626; font-size: 12px;">Por seguridad, te recomendamos cambiar tu contraseña la primera vez que ingreses.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p style="color: #9ca3af; font-size: 12px;">Club Táchira — Solicitud de Canchas</p>
            </div>
          `,
        });
        console.log(`Email de credenciales enviado a ${data.email}`);
      } catch (err: unknown) {
        console.error('Error enviando email de credenciales:', err);
      }

      await db.collection('logs').add({
        tipo: 'usuario_creado',
        usuarioId: user.uid,
        username,
        role: data.role,
        realizadoPor: request.auth.uid,
        realizadoEn: Timestamp.now(),
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
  Promise<void>
>(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid, username, ...data } = request.data;

    if (!uid || typeof uid !== 'string') {
      throw new HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
    }

    // Validar username si se está cambiando
    if (username) {
      validarString(username, 'username', { required: true, minLength: 2, maxLength: 30, pattern: /^[a-z]+$/ });
    }

    // Validar role si se está cambiando
    if (data.role && !ROLES_VALIDOS.includes(data.role)) {
      throw new HttpsError('invalid-argument', `role inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}`);
    }

    // Validar campos de texto si se proveen
    if (data.displayName !== undefined) validarString(data.displayName, 'displayName', { required: false, maxLength: 100 });
    if (data.equipo !== undefined) validarString(data.equipo, 'equipo', { required: false, maxLength: 100 });
    if (data.email !== undefined) validarString(data.email, 'email', { required: false, maxLength: 200 });

    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'El usuario no existe.');
    }

    // Si se está cambiando el username, verificar unicidad
    if (username) {
      const cleanUsername = username.toLowerCase().trim();

      const existing = await db.collection('usuarios').where('username', '==', cleanUsername).get();
      const isTakenByOther = existing.docs.some(doc => doc.id !== uid);
      if (isTakenByOther) {
        throw new HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
      }
    }

    const finalUsername = username ? username.toLowerCase().trim() : userDoc.data()?.username;

    const authUpdate: { displayName?: string; email?: string } = {};
    if (data.displayName !== undefined) authUpdate.displayName = data.displayName || finalUsername;
    if (username) authUpdate.email = `${finalUsername}@tenistac-amistosos.app`;

    if (Object.keys(authUpdate).length > 0) {
      try {
        await auth.updateUser(uid, authUpdate);
      } catch (err: any) {
        console.error('Auth update failed:', err.code);
        if (err.code?.includes('email-already-exists')) {
          throw new HttpsError('already-exists', 'Ya existe otro usuario con ese nombre de usuario.');
        }
        if (err.code?.includes('user-not-found')) {
          throw new HttpsError('not-found', 'El usuario no existe en Firebase Authentication.');
        }
        throw new HttpsError('internal', `Error actualizando usuario en Auth: ${err.message}`);
      }
    }

    const updateData: any = { ...data, updatedAt: Timestamp.now(), updatedBy: request.auth.uid };
    if (username) updateData.username = username.toLowerCase().trim();

    await db.collection('usuarios').doc(uid).update(updateData);

    console.log(`Usuario ${uid} actualizado por ${request.auth.uid}:`, JSON.stringify(updateData));

    await db.collection('logs').add({
      tipo: 'usuario_actualizado',
      usuarioId: uid,
      cambios: updateData,
      realizadoPor: request.auth.uid,
      realizadoEn: Timestamp.now(),
    });
  } catch (error: any) {
    console.error('updateUser error:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', error.message || 'Error interno al actualizar el usuario.');
  }
});

export const deleteUser = onCall<{ uid: string }, void>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { uid } = request.data;

  const userDoc = await db.collection('usuarios').doc(uid).get();
  const userData = userDoc.data();

  await auth.deleteUser(uid);
  await db.collection('usuarios').doc(uid).delete();

  console.log(`Usuario eliminado: ${uid} (${userData?.username || '?'}) por ${request.auth.uid}`);

  await db.collection('logs').add({
    tipo: 'usuario_eliminado',
    usuarioId: uid,
    username: userData?.username || null,
    role: userData?.role || null,
    realizadoPor: request.auth.uid,
    realizadoEn: Timestamp.now(),
  });
});

export const setPassword = onCall<{ uid: string; newPassword: string }, Promise<{ password: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid, newPassword } = request.data;

    validarString(uid, 'uid', { required: true, minLength: 10, maxLength: 200 });

    if (!newPassword || typeof newPassword !== 'string') {
      throw new HttpsError('invalid-argument', 'La nueva contraseña es obligatoria.');
    }
    if (newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword.length > 128) {
      throw new HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
    }

    await auth.updateUser(uid, { password: newPassword });

    console.log(`Contraseña actualizada para usuario ${uid} por ${request.auth.uid}`);

    await db.collection('logs').add({
      tipo: 'usuario_password',
      usuarioId: uid,
      realizadoPor: request.auth.uid,
      realizadoEn: Timestamp.now(),
    });

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

    // Validar tipo
    if (!TIPOS_BLOQUEO.includes(tipo)) {
      throw new HttpsError('invalid-argument', `tipo inválido. Debe ser: ${TIPOS_BLOQUEO.join(', ')}`);
    }

    // Validar fechas
    validarFecha(fechaInicio, 'fechaInicio');
    validarFecha(fechaFin, 'fechaFin');
    if (fechaInicio > fechaFin) {
      throw new HttpsError('invalid-argument', 'fechaInicio no puede ser posterior a fechaFin.');
    }

    // Validar turno
    if (!TURNOS_AMBOS_VALIDOS.includes(turno)) {
      throw new HttpsError('invalid-argument', `turno inválido. Debe ser: ${TURNOS_AMBOS_VALIDOS.join(', ')}`);
    }

    // Validar cancha (null = todas, o número 1-5)
    if (cancha !== null && (typeof cancha !== 'number' || !CANCHAS_SET.has(cancha))) {
      throw new HttpsError('invalid-argument', 'cancha inválida. Debe ser null o un número del 1 al 5.');
    }

    // Validar motivo
    validarString(motivo, 'motivo', { required: true, maxLength: 200 });

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

    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';
    const canchalabel = cancha === null ? 'Todas' : `Cancha ${cancha}`;

    await sendAdminNotification(
      `[TenisTac] Nuevo bloqueo creado`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Nuevo bloqueo de cancha</h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Tipo:</strong> ${tipo}</p>
          <p><strong>Fechas:</strong> ${fechaInicio} a ${fechaFin}</p>
          <p><strong>Turno:</strong> ${turno}</p>
          <p><strong>Cancha:</strong> ${canchalabel}</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
          <p><strong>Creado por:</strong> ${adminName}</p>
        </div>
      </div>
      `
    );

    return { id: bloqueoRef.id };
  }
);

export const deleteBloqueo = onCall<{ id: string }, void>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { id } = request.data;
  const bloqueoSnap = await db.collection('bloqueos').doc(id).get();
  const bloqueoData = bloqueoSnap.data();

  const slotsSnap = await db.collection('slotsBloqueados').where('bloqueoId', '==', id).get();

  const batch = db.batch();
  slotsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await db.collection('bloqueos').doc(id).delete();

  // Notify admins
  if (bloqueoData) {
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';
    const canchalabel = bloqueoData.cancha === null ? 'Todas' : `Cancha ${bloqueoData.cancha}`;
    
    await sendAdminNotification(
      `[TenisTac] Bloqueo eliminado`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Bloqueo de cancha eliminado</h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Tipo:</strong> ${bloqueoData.tipo}</p>
          <p><strong>Fechas:</strong> ${bloqueoData.fechaInicio} a ${bloqueoData.fechaFin}</p>
          <p><strong>Turno:</strong> ${bloqueoData.turno}</p>
          <p><strong>Cancha:</strong> ${canchalabel}</p>
          <p><strong>Motivo:</strong> ${bloqueoData.motivo}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
          <p><strong>Eliminado por:</strong> ${adminName}</p>
        </div>
      </div>
      `
    );
  }
});

export const updateBloqueo = onCall<{ id: string } & BloqueoInput, void>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const { id, tipo, fechaInicio, fechaFin, turno, cancha, motivo } = request.data;

  // Borrar slots viejos
  const oldSlots = await db.collection('slotsBloqueados').where('bloqueoId', '==', id).get();
  const deleteBatch = db.batch();
  oldSlots.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  // Actualizar documento
  await db.collection('bloqueos').doc(id).update({
    tipo,
    fechaInicio,
    fechaFin,
    turno,
    cancha: cancha ?? null,
    motivo,
  });

  // Expandir nuevos slots
  await expandirBloqueo(id, fechaInicio, fechaFin, turno, cancha, motivo);
});

export const backfillBloqueos = onCall<void, Promise<{ message: string }>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  await assertAdmin(request.auth.uid);

  const bloqueosSnap = await db.collection('bloqueos').get();
  let count = 0;

  for (const doc of bloqueosSnap.docs) {
    const data = doc.data();
    try {
      // Borrar slots viejos para este bloqueo (por si acaso)
      const oldSlots = await db.collection('slotsBloqueados').where('bloqueoId', '==', doc.id).get();
      const deleteBatch = db.batch();
      oldSlots.docs.forEach((d) => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      // Re-expandir
      await expandirBloqueo(
        doc.id,
        data.fechaInicio,
        data.fechaFin,
        data.turno,
        data.cancha ?? null,
        data.motivo
      );
      count++;
    } catch (err: any) {
      console.error(`Error backfilling bloqueo ${doc.id}:`, err.message);
    }
  }

  return { message: `Backfill completado: ${count} bloqueo(s) procesado(s).` };
});

// Email notification when a new message is created in Firestore
export const sendEmailNotification = onDocumentCreated(
  {
    document: 'mensajes/{mensajeId}',
    secrets: [brevoApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { paraUid, deNombre, deRol, asunto, cuerpo, threadId } = data as {
      paraUid: string;
      deNombre: string;
      deRol: string;
      asunto: string;
      cuerpo: string;
      threadId?: string;
    };

    // Build recipient email list
    const recipientEmails: string[] = [];

    if (paraUid === 'admin') {
      const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
      for (const doc of adminsSnap.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.trim()) recipientEmails.push(email);
      }
    } else {
      const userSnap = await db.collection('usuarios').doc(paraUid).get();
      if (userSnap.exists) {
        const email = userSnap.data()?.email;
        if (email && typeof email === 'string' && email.trim()) recipientEmails.push(email);
      }
    }

    if (recipientEmails.length === 0) {
      console.log('No recipients with email found, skipping notification.');
      return;
    }

    // Initialize Brevo client
    const client = new BrevoClient({ apiKey: brevoApiKey.value() });

    const rolLabel = deRol === 'admin' ? 'Administrador' : deRol === 'capitan' ? 'Capitán' : 'Sub-Capitán';

    try {
      await client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
        to: recipientEmails.map((email) => ({ email })),
        subject: `[TenisTac] Nuevo mensaje de ${deNombre}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Nuevo mensaje en TenisTac</h2>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p><strong>De:</strong> ${deNombre} (${rolLabel})</p>
              <p><strong>Asunto:</strong> ${asunto}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p style="white-space: pre-wrap;">${cuerpo}</p>
            </div>
            <a href="https://canchas.tenistac.com/mensajes/${threadId || ''}"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
              Ver mensaje en TenisTac
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Este es un mensaje automático de Club Táchira Solicitud de Canchas.
            </p>
          </div>
        `,
      });
      console.log(`Email notification sent to ${recipientEmails.join(', ')}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error sending email notification:', errorMessage);
    }
  }
);

// Email notification when a reservation request is created
export const onReservaSolicitada = onDocumentCreated(
  {
    document: 'reservas/{reservaId}',
    secrets: [brevoApiKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.estado !== 'solicitado') return;

    const { capitanUid, capitanNombre, capitanEquipo, equipoRival, fecha, turnoPreferencia, motivo, observaciones, solicitadoEn } = data as {
      capitanUid: string;
      capitanNombre: string;
      capitanEquipo: string;
      equipoRival: string;
      fecha: string;
      turnoPreferencia: string;
      motivo?: string;
      observaciones?: string;
      solicitadoEn?: any;
    };

    // Get all active admins with email
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    const recipientEmails: string[] = [];
    for (const doc of adminsSnap.docs) {
      const email = doc.data().email;
      if (email && typeof email === 'string' && email.trim()) recipientEmails.push(email);
    }

    // Add captain email
    if (capitanUid) {
      const captainSnap = await db.collection('usuarios').doc(capitanUid).get();
      if (captainSnap.exists) {
        const email = captainSnap.data()?.email;
        if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email)) recipientEmails.push(email);
      }
    }

    if (recipientEmails.length === 0) {
      console.log('No recipient emails found, skipping notification.');
      return;
    }

    const turnoLabel = turnoPreferencia === 'maniana' ? 'Mañana' : turnoPreferencia === 'tarde' ? 'Tarde' : 'Cualquiera';
    const motivoLabel = motivo === 'amistoso' ? 'Amistoso' : motivo === 'entrenamiento' ? 'Entrenamiento' : motivo === 'clases' ? 'Clases' : motivo === 'torneo' ? 'Torneo' : motivo || '';
    const fechaSolicitud = solicitadoEn ? formatFechaVenezuela(solicitadoEn) : 'No disponible';

    const client = new BrevoClient({ apiKey: brevoApiKey.value() });

    try {
      await client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
        to: recipientEmails.map((email) => ({ email })),
        subject: `[TenisTac] Nueva solicitud de ${capitanNombre}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Nueva solicitud de cancha</h2>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p><strong>Capitán:</strong> ${capitanNombre}</p>
              <p><strong>Equipo:</strong> ${capitanEquipo}</p>
              <p><strong>Rival:</strong> ${equipoRival}</p>
              <p><strong>Fecha:</strong> ${fecha}</p>
              <p><strong>Prefiere:</strong> ${turnoLabel}</p>
              <p><strong>Motivo:</strong> ${motivoLabel}</p>
              <p><strong>Solicitado el:</strong> ${fechaSolicitud}</p>
              ${observaciones ? `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;"><p><strong>Observaciones:</strong></p><p style="white-space: pre-wrap;">${observaciones}</p>` : ''}
            </div>
            <a href="https://canchas.tenistac.com/admin"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
              Ver solicitudes en TenisTac
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Este es un mensaje automático de Club Táchira Solicitud de Canchas.
            </p>
          </div>
        `,
      });
      console.log(`Reservation request email sent to ${recipientEmails.join(', ')}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error sending reservation request email:', errorMessage);
    }
  }
);

// Allow any authenticated user to change their own password
export const changeOwnPassword = onCall<{ newPassword: string }, void>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const { newPassword } = request.data;
    if (!newPassword || typeof newPassword !== 'string') {
      throw new HttpsError('invalid-argument', 'La nueva contraseña es obligatoria.');
    }
    if (newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword.length > 128) {
      throw new HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
    }
    await auth.updateUser(request.auth.uid, { password: newPassword });
    await db.collection('usuarios').doc(request.auth.uid).update({
      primerLogin: false,
      updatedAt: Timestamp.now(),
      updatedBy: request.auth.uid,
    });
  }
);

const generarPasswordSegura = (length: number): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const adminResetPassword = onCall<
  { uid: string },
  Promise<{ newPassword: string }>
>(
  {
    secrets: [brevoApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid } = request.data;
    if (!uid || typeof uid !== 'string') {
      throw new HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
    }

    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'El usuario no existe.');
    }
    const userData = userDoc.data()!;

    const newPassword = generarPasswordSegura(12);

    await auth.updateUser(uid, { password: newPassword });

    console.log(`Contraseña restablecida para usuario ${uid} por ${request.auth.uid}`);

    if (userData.email && typeof userData.email === 'string' && userData.email.trim()) {
      const client = new BrevoClient({ apiKey: brevoApiKey.value() });
      try {
        await client.transactionalEmails.sendTransacEmail({
          sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
          to: [{ email: userData.email }],
          subject: '[TenisTac] Tu contraseña ha sido restablecida',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Contraseña restablecida</h2>
              <p>Hola ${userData.displayName || userData.username},</p>
              <p>Tu contraseña ha sido restablecida por un administrador. Estas son tus nuevas credenciales:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p><strong>Usuario:</strong> ${userData.username}</p>
                <p><strong>Nueva contraseña:</strong> ${newPassword}</p>
              </div>
              <p>Ingresá en <a href="https://canchas.tenistac.com">canchas.tenistac.com</a></p>
              <p style="color: #dc2626; font-size: 12px;">Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p style="color: #9ca3af; font-size: 12px;">Club Táchira — Solicitud de Canchas</p>
            </div>
          `,
        });
        console.log(`Email de restablecimiento enviado a ${userData.email}`);
      } catch (err: unknown) {
        console.error('Error enviando email de restablecimiento:', err);
      }
    }

    await db.collection('logs').add({
      tipo: 'usuario_password_reset',
      usuarioId: uid,
      username: userData.username,
      realizadoPor: request.auth.uid,
      realizadoEn: Timestamp.now(),
    });

    return { newPassword };
  }
);

// Reject a reservation request and notify captain + admins via email
export const rechazarReserva = onCall<{ reservaId: string; motivo: string }, Promise<{ success: boolean }>>(
  {
    secrets: [brevoApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { reservaId, motivo } = request.data;
    validarString(reservaId, 'reservaId', { required: true, minLength: 5, maxLength: 200 });
    validarString(motivo, 'motivo', { required: true, maxLength: 500 });

    // Get the reservation
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists) {
      throw new HttpsError('not-found', 'La solicitud no existe.');
    }
    const reserva = reservaSnap.data()!;

    // Delete the reservation
    await db.collection('reservas').doc(reservaId).delete();

    // Get admin name
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';

    // Collect recipient emails: captain + all admins
    const recipientEmails: string[] = [];

    // Captain email
    if (reserva.capitanUid) {
      const captainSnap = await db.collection('usuarios').doc(reserva.capitanUid).get();
      if (captainSnap.exists) {
        const email = captainSnap.data()?.email;
        if (email && typeof email === 'string' && email.trim()) recipientEmails.push(email);
      }
    }

    // Admin emails
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    for (const doc of adminsSnap.docs) {
      const email = doc.data().email;
      if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email)) {
        recipientEmails.push(email);
      }
    }

    if (recipientEmails.length === 0) {
      console.log('No recipients with email found, skipping rejection notification.');
      return { success: true };
    }

    const turnoLabel = reserva.turnoPreferencia === 'maniana' ? 'Mañana' : reserva.turnoPreferencia === 'tarde' ? 'Tarde' : 'Cualquiera';
    const motivoReservaLabel = reserva.motivo === 'amistoso' ? 'Amistoso' : reserva.motivo === 'entrenamiento' ? 'Entrenamiento' : reserva.motivo === 'clases' ? 'Clases' : reserva.motivo === 'torneo' ? 'Torneo' : reserva.motivo || '';

    const client = new BrevoClient({ apiKey: brevoApiKey.value() });

    try {
      await client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
        to: recipientEmails.map((email) => ({ email })),
        subject: `[TenisTac] Solicitud rechazada - ${reserva.capitanNombre}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Solicitud de cancha rechazada</h2>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p><strong>Capitán:</strong> ${reserva.capitanNombre}</p>
              <p><strong>Equipo:</strong> ${reserva.capitanEquipo}</p>
              <p><strong>Rival:</strong> ${reserva.equipoRival}</p>
              <p><strong>Fecha:</strong> ${reserva.fecha}</p>
              <p><strong>Prefiere:</strong> ${turnoLabel}</p>
              <p><strong>Motivo original:</strong> ${motivoReservaLabel}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p><strong>Motivo del rechazo:</strong></p>
              <p style="white-space: pre-wrap; color: #dc2626;">${motivo}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p><strong>Rechazado por:</strong> ${adminName}</p>
            </div>
            <a href="https://canchas.tenistac.com/admin"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
              Ver solicitudes en TenisTac
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Este es un mensaje automático de Club Táchira Solicitud de Canchas.
            </p>
          </div>
        `,
      });
      console.log(`Rejection email sent to ${recipientEmails.join(', ')}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error sending rejection email:', errorMessage);
    }

    return { success: true };
  }
);

// Delete a pending request directly WITHOUT notifying anyone (for mistaken requests)
export const eliminarSolicitud = onCall<{ reservaId: string }, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { reservaId } = request.data;
    if (!reservaId || typeof reservaId !== 'string') {
      throw new HttpsError('invalid-argument', 'El ID de la solicitud es obligatorio.');
    }

    const snap = await db.collection('reservas').doc(reservaId).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'La solicitud no existe.');
    }
    const data = snap.data()!;

    await db.collection('reservas').doc(reservaId).delete();

    console.log(`Solicitud ${reservaId} eliminada por ${request.auth.uid} (sin notificación)`);

    await db.collection('logs').add({
      tipo: 'reserva_eliminada',
      reservaId,
      capitanUid: data.capitanUid ?? null,
      capitanNombre: data.capitanNombre ?? null,
      fecha: data.fecha ?? null,
      realizadoPor: request.auth.uid,
      realizadoEn: Timestamp.now(),
    });

    return { success: true };
  }
);

// Approve a reservation request and notify captain + admins via email
export const aprobarReserva = onCall<{ reservaId: string; turno: Turno; canchas: number[] }, Promise<{ success: boolean }>>(
  {
    secrets: [brevoApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { reservaId, turno, canchas } = request.data;

    // Validar reservaId
    validarString(reservaId, 'reservaId', { required: true, minLength: 5, maxLength: 200 });

    // Validar turno
    if (!TURNOS_VALIDOS.includes(turno)) {
      throw new HttpsError('invalid-argument', `turno inválido. Debe ser: ${TURNOS_VALIDOS.join(', ')}`);
    }

    // Validar canchas
    const canchasValidadas = validarCanchas(canchas);

    // Get the reservation
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists) {
      throw new HttpsError('not-found', 'La solicitud no existe.');
    }
    const reserva = reservaSnap.data()!;

    // Get admin name
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';

    // Update reservation
    await db.collection('reservas').doc(reservaId).update({
      estado: 'reservado',
      turno,
      canchas: canchasValidadas,
      aprobadoEn: Timestamp.now(),
      aprobadoPor: request.auth.uid,
    });

    // Collect recipient emails: captain + all admins
    const recipientEmails: string[] = [];

    // Captain email
    if (reserva.capitanUid) {
      const captainSnap = await db.collection('usuarios').doc(reserva.capitanUid).get();
      if (captainSnap.exists) {
        const email = captainSnap.data()?.email;
        if (email && typeof email === 'string' && email.trim()) recipientEmails.push(email);
      }
    }

    // Admin emails
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    for (const doc of adminsSnap.docs) {
      const email = doc.data().email;
      if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email)) {
        recipientEmails.push(email);
      }
    }

    if (recipientEmails.length === 0) {
      console.log('No recipients with email found, skipping approval notification.');
      return { success: true };
    }

    const turnoLabelReserva = reserva.turnoPreferencia === 'maniana' ? 'Mañana' : reserva.turnoPreferencia === 'tarde' ? 'Tarde' : 'Cualquiera';
    const turnoLabelAsignado = turno === 'maniana' ? 'Mañana' : 'Tarde';
    const motivoReservaLabel = reserva.motivo === 'amistoso' ? 'Amistoso' : reserva.motivo === 'entrenamiento' ? 'Entrenamiento' : reserva.motivo === 'clases' ? 'Clases' : reserva.motivo === 'torneo' ? 'Torneo' : reserva.motivo || '';

    const client = new BrevoClient({ apiKey: brevoApiKey.value() });

    try {
      await client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
        to: recipientEmails.map((email) => ({ email })),
        subject: `[TenisTac] Solicitud aprobada - ${reserva.capitanNombre}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Solicitud de cancha aprobada</h2>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p><strong>Capitán:</strong> ${reserva.capitanNombre}</p>
              <p><strong>Equipo:</strong> ${reserva.capitanEquipo}</p>
              <p><strong>Rival:</strong> ${reserva.equipoRival}</p>
              <p><strong>Fecha:</strong> ${reserva.fecha}</p>
              <p><strong>Pedía:</strong> ${turnoLabelReserva}</p>
              <p><strong>Asignado:</strong> Turno ${turnoLabelAsignado} · Canchas ${canchas.join(', ')}</p>
              <p><strong>Motivo:</strong> ${motivoReservaLabel}</p>
              ${reserva.observaciones ? `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;"><p><strong>Observaciones:</strong></p><p style="white-space: pre-wrap;">${reserva.observaciones}</p>` : ''}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
              <p><strong>Aprobado por:</strong> ${adminName}</p>
            </div>
            <a href="https://canchas.tenistac.com/admin"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
              Ver solicitudes en TenisTac
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Este es un mensaje automático de Club Táchira Solicitud de Canchas.
            </p>
          </div>
        `,
      });
      console.log(`Approval email sent to ${recipientEmails.join(', ')}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error sending approval email:', errorMessage);
    }

    return { success: true };
  }
);


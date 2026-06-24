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
  Promise<void>
>(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);

    const { uid, username, ...data } = request.data;

    if (!uid) {
      throw new HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
    }

    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'El usuario no existe.');
    }

    // Si se está cambiando el username, verificar unicidad
    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      if (cleanUsername.length < 2) {
        throw new HttpsError('invalid-argument', 'El nombre de usuario debe tener al menos 2 caracteres.');
      }
      if (!/^[a-z]+$/.test(cleanUsername)) {
        throw new HttpsError('invalid-argument', 'El nombre de usuario solo puede contener letras minúsculas.');
      }

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
        console.error('Auth update failed:', err, 'with data:', authUpdate);
        if (err.code?.includes('email-already-exists')) {
          throw new HttpsError('already-exists', 'Ya existe otro usuario con ese nombre de usuario.');
        }
        if (err.code?.includes('user-not-found')) {
          throw new HttpsError('not-found', 'El usuario no existe en Firebase Authentication.');
        }
        throw new HttpsError('internal', `Error actualizando usuario en Auth: ${err.message}`);
      }
    }

    const updateData: any = { ...data };
    if (username) updateData.username = username.toLowerCase().trim();

    await db.collection('usuarios').doc(uid).update(updateData);
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
    if (!newPassword || newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    await auth.updateUser(request.auth.uid, { password: newPassword });
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
    if (!motivo || !motivo.trim()) {
      throw new HttpsError('invalid-argument', 'El motivo del rechazo es obligatorio.');
    }

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
      canchas,
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


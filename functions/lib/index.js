"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aprobarReserva = exports.rechazarReserva = exports.changeOwnPassword = exports.onReservaSolicitada = exports.sendEmailNotification = exports.backfillBloqueos = exports.updateBloqueo = exports.deleteBloqueo = exports.createBloqueo = exports.setPassword = exports.deleteUser = exports.updateUser = exports.createUser = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const brevo_1 = require("@getbrevo/brevo");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
(0, v2_1.setGlobalOptions)({ region: 'us-central1' });
const brevoApiKey = (0, params_1.defineSecret)('BREVO_API_KEY');
const CANCHAS = [1, 2, 3, 4, 5];
const assertAdmin = async (uid) => {
    const doc = await db.collection('usuarios').doc(uid).get();
    if (!doc.exists || doc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Solo los administradores pueden realizar esta acción.');
    }
};
const sumarDias = (fecha, dias) => {
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
};
const expandirBloqueo = async (bloqueoId, fechaInicio, fechaFin, turno, cancha, motivo) => {
    const dias = [];
    let actual = fechaInicio;
    while (actual <= fechaFin) {
        dias.push(actual);
        actual = sumarDias(actual, 1);
    }
    const turnos = turno === 'ambos' ? ['maniana', 'tarde'] : [turno];
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
exports.createUser = (0, https_1.onCall)(async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }
        await assertAdmin(request.auth.uid);
        const data = request.data;
        // Validar username
        if (!data.username || typeof data.username !== 'string') {
            throw new https_1.HttpsError('invalid-argument', 'El nombre de usuario es obligatorio.');
        }
        const username = data.username.toLowerCase().trim();
        if (username.length < 2) {
            throw new https_1.HttpsError('invalid-argument', 'El nombre de usuario debe tener al menos 2 caracteres.');
        }
        // Validar que solo contenga letras
        if (!/^[a-z]+$/.test(username)) {
            throw new https_1.HttpsError('invalid-argument', 'El nombre de usuario solo puede contener letras minúsculas.');
        }
        if (!data.password || data.password.length < 6) {
            throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
        }
        // Verificar unicidad del username
        const existing = await db.collection('usuarios').where('username', '==', username).get();
        if (!existing.empty) {
            throw new https_1.HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
        }
        const internalEmail = `${username}@tenistac-amistosos.app`;
        // Validar formato del email generado
        if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(internalEmail)) {
            throw new https_1.HttpsError('invalid-argument', 'Formato de email inválido generado.');
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
        const createUserData = {
            email: internalEmail,
            password: data.password,
            displayName: finalDisplayName,
        };
        let user;
        try {
            user = await auth.createUser(createUserData);
        }
        catch (err) {
            console.error('Auth creation failed:', err, 'with data:', createUserData);
            if (err.code?.includes('email-already-exists')) {
                throw new https_1.HttpsError('already-exists', 'Ya existe un usuario con ese username.');
            }
            throw new https_1.HttpsError('internal', `Error creando usuario en Auth: ${err.message}`);
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
            createdAt: firestore_1.Timestamp.now(),
            createdBy: request.auth.uid,
        });
        return { uid: user.uid };
    }
    catch (error) {
        console.error('createUser error:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Error interno al crear el usuario.');
    }
});
exports.updateUser = (0, https_1.onCall)(async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }
        await assertAdmin(request.auth.uid);
        const { uid, username, ...data } = request.data;
        if (!uid) {
            throw new https_1.HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
        }
        const userDoc = await db.collection('usuarios').doc(uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'El usuario no existe.');
        }
        // Si se está cambiando el username, verificar unicidad
        if (username) {
            const cleanUsername = username.toLowerCase().trim();
            if (cleanUsername.length < 2) {
                throw new https_1.HttpsError('invalid-argument', 'El nombre de usuario debe tener al menos 2 caracteres.');
            }
            if (!/^[a-z]+$/.test(cleanUsername)) {
                throw new https_1.HttpsError('invalid-argument', 'El nombre de usuario solo puede contener letras minúsculas.');
            }
            const existing = await db.collection('usuarios').where('username', '==', cleanUsername).get();
            const isTakenByOther = existing.docs.some(doc => doc.id !== uid);
            if (isTakenByOther) {
                throw new https_1.HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
            }
        }
        const finalUsername = username ? username.toLowerCase().trim() : userDoc.data()?.username;
        const authUpdate = {};
        if (data.displayName !== undefined)
            authUpdate.displayName = data.displayName || finalUsername;
        if (username)
            authUpdate.email = `${finalUsername}@tenistac-amistosos.app`;
        if (Object.keys(authUpdate).length > 0) {
            try {
                await auth.updateUser(uid, authUpdate);
            }
            catch (err) {
                console.error('Auth update failed:', err, 'with data:', authUpdate);
                if (err.code?.includes('email-already-exists')) {
                    throw new https_1.HttpsError('already-exists', 'Ya existe otro usuario con ese nombre de usuario.');
                }
                if (err.code?.includes('user-not-found')) {
                    throw new https_1.HttpsError('not-found', 'El usuario no existe en Firebase Authentication.');
                }
                throw new https_1.HttpsError('internal', `Error actualizando usuario en Auth: ${err.message}`);
            }
        }
        const updateData = { ...data };
        if (username)
            updateData.username = username.toLowerCase().trim();
        await db.collection('usuarios').doc(uid).update(updateData);
    }
    catch (error) {
        console.error('updateUser error:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Error interno al actualizar el usuario.');
    }
});
exports.deleteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { uid } = request.data;
    await auth.deleteUser(uid);
    await db.collection('usuarios').doc(uid).delete();
});
exports.setPassword = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { uid, newPassword } = request.data;
    if (!newPassword || newPassword.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    await auth.updateUser(uid, { password: newPassword });
    return { password: newPassword };
});
exports.createBloqueo = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
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
        creadoEn: firestore_1.Timestamp.now(),
    });
    await expandirBloqueo(bloqueoRef.id, fechaInicio, fechaFin, turno, cancha, motivo);
    return { id: bloqueoRef.id };
});
exports.deleteBloqueo = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { id } = request.data;
    const slotsSnap = await db.collection('slotsBloqueados').where('bloqueoId', '==', id).get();
    const batch = db.batch();
    slotsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await db.collection('bloqueos').doc(id).delete();
});
exports.updateBloqueo = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
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
exports.backfillBloqueos = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
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
            await expandirBloqueo(doc.id, data.fechaInicio, data.fechaFin, data.turno, data.cancha ?? null, data.motivo);
            count++;
        }
        catch (err) {
            console.error(`Error backfilling bloqueo ${doc.id}:`, err.message);
        }
    }
    return { message: `Backfill completado: ${count} bloqueo(s) procesado(s).` };
});
// Email notification when a new message is created in Firestore
exports.sendEmailNotification = (0, firestore_2.onDocumentCreated)({
    document: 'mensajes/{mensajeId}',
    secrets: [brevoApiKey],
}, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const { paraUid, deNombre, deRol, asunto, cuerpo, threadId } = data;
    // Build recipient email list
    const recipientEmails = [];
    if (paraUid === 'admin') {
        const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
        for (const doc of adminsSnap.docs) {
            const email = doc.data().email;
            if (email && typeof email === 'string' && email.trim())
                recipientEmails.push(email);
        }
    }
    else {
        const userSnap = await db.collection('usuarios').doc(paraUid).get();
        if (userSnap.exists) {
            const email = userSnap.data()?.email;
            if (email && typeof email === 'string' && email.trim())
                recipientEmails.push(email);
        }
    }
    if (recipientEmails.length === 0) {
        console.log('No recipients with email found, skipping notification.');
        return;
    }
    // Initialize Brevo client
    const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error sending email notification:', errorMessage);
    }
});
// Email notification when a reservation request is created
exports.onReservaSolicitada = (0, firestore_2.onDocumentCreated)({
    document: 'reservas/{reservaId}',
    secrets: [brevoApiKey],
}, async (event) => {
    const data = event.data?.data();
    if (!data || data.estado !== 'solicitado')
        return;
    const { capitanNombre, capitanEquipo, equipoRival, fecha, turnoPreferencia, motivo, observaciones } = data;
    // Get all active admins with email
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    const recipientEmails = [];
    for (const doc of adminsSnap.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.trim())
            recipientEmails.push(email);
    }
    if (recipientEmails.length === 0) {
        console.log('No admin emails found, skipping notification.');
        return;
    }
    const turnoLabel = turnoPreferencia === 'maniana' ? 'Mañana' : turnoPreferencia === 'tarde' ? 'Tarde' : 'Cualquiera';
    const motivoLabel = motivo === 'amistoso' ? 'Amistoso' : motivo === 'entrenamiento' ? 'Entrenamiento' : motivo === 'clases' ? 'Clases' : motivo === 'torneo' ? 'Torneo' : motivo || '';
    const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error sending reservation request email:', errorMessage);
    }
});
// Allow any authenticated user to change their own password
exports.changeOwnPassword = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const { newPassword } = request.data;
    if (!newPassword || newPassword.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    await auth.updateUser(request.auth.uid, { password: newPassword });
});
// Reject a reservation request and notify captain + admins via email
exports.rechazarReserva = (0, https_1.onCall)({
    secrets: [brevoApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { reservaId, motivo } = request.data;
    if (!motivo || !motivo.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'El motivo del rechazo es obligatorio.');
    }
    // Get the reservation
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'La solicitud no existe.');
    }
    const reserva = reservaSnap.data();
    // Delete the reservation
    await db.collection('reservas').doc(reservaId).delete();
    // Get admin name
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';
    // Collect recipient emails: captain + all admins
    const recipientEmails = [];
    // Captain email
    if (reserva.capitanUid) {
        const captainSnap = await db.collection('usuarios').doc(reserva.capitanUid).get();
        if (captainSnap.exists) {
            const email = captainSnap.data()?.email;
            if (email && typeof email === 'string' && email.trim())
                recipientEmails.push(email);
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
    const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error sending rejection email:', errorMessage);
    }
    return { success: true };
});
// Approve a reservation request and notify captain + admins via email
exports.aprobarReserva = (0, https_1.onCall)({
    secrets: [brevoApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { reservaId, turno, canchas } = request.data;
    // Get the reservation
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'La solicitud no existe.');
    }
    const reserva = reservaSnap.data();
    // Get admin name
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';
    // Update reservation
    await db.collection('reservas').doc(reservaId).update({
        estado: 'reservado',
        turno,
        canchas,
        aprobadoEn: firestore_1.Timestamp.now(),
        aprobadoPor: request.auth.uid,
    });
    // Collect recipient emails: captain + all admins
    const recipientEmails = [];
    // Captain email
    if (reserva.capitanUid) {
        const captainSnap = await db.collection('usuarios').doc(reserva.capitanUid).get();
        if (captainSnap.exists) {
            const email = captainSnap.data()?.email;
            if (email && typeof email === 'string' && email.trim())
                recipientEmails.push(email);
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
    const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error sending approval email:', errorMessage);
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map
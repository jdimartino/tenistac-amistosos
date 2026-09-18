"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailUsage = exports.aprobarReserva = exports.eliminarSolicitud = exports.rechazarReserva = exports.adminResetPassword = exports.changeOwnPassword = exports.onReservaSolicitada = exports.sendEmailNotification = exports.backfillBloqueos = exports.updateBloqueo = exports.deleteBloqueo = exports.createBloqueo = exports.setPassword = exports.deleteUser = exports.updateUser = exports.createUser = void 0;
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
const CANCHAS_SET = new Set(CANCHAS);
const TURNOS_VALIDOS = ['maniana', 'tarde', 'noche'];
const TURNOS_AMBOS_VALIDOS = ['maniana', 'tarde', 'noche', 'ambos'];
const ROLES_VALIDOS = ['admin', 'capitan', 'subcapitan'];
const TIPOS_BLOQUEO = ['dia', 'turno', 'rango'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const validarFecha = (fecha, fieldName) => {
    if (!fecha || typeof fecha !== 'string' || !FECHA_REGEX.test(fecha)) {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} debe ser una fecha válida (YYYY-MM-DD).`);
    }
    if (Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} no es una fecha válida.`);
    }
};
const validarCanchas = (canchas, solicitaChuruata) => {
    if (!Array.isArray(canchas)) {
        throw new https_1.HttpsError('invalid-argument', 'canchas debe ser un array.');
    }
    if (canchas.length === 0 && !solicitaChuruata) {
        throw new https_1.HttpsError('invalid-argument', 'Debe seleccionar al menos una cancha.');
    }
    for (const c of canchas) {
        if (typeof c !== 'number' || !CANCHAS_SET.has(c)) {
            throw new https_1.HttpsError('invalid-argument', `Cancha inválida: ${c}. Debe ser un número del 1 al 5.`);
        }
    }
    return canchas;
};
const validarString = (value, fieldName, opts) => {
    const required = opts?.required !== false;
    if (value === undefined || value === null || value === '') {
        if (required)
            throw new https_1.HttpsError('invalid-argument', `${fieldName} es obligatorio.`);
        return;
    }
    if (typeof value !== 'string') {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} debe ser un texto.`);
    }
    const trimmed = value.trim();
    if (opts?.minLength && trimmed.length < opts.minLength) {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} debe tener al menos ${opts.minLength} caracteres.`);
    }
    if (opts?.maxLength && trimmed.length > opts.maxLength) {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} no debe exceder ${opts.maxLength} caracteres.`);
    }
    if (opts?.pattern && !opts.pattern.test(trimmed)) {
        throw new https_1.HttpsError('invalid-argument', `${fieldName} tiene un formato inválido.`);
    }
};
const assertAdmin = async (uid) => {
    const doc = await db.collection('usuarios').doc(uid).get();
    if (!doc.exists || doc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Solo los administradores pueden realizar esta acción.');
    }
};
const EXCLUDED_EMAILS = ['lucrevitar@gmail.com', 'nunodb@hotmail.com'];
const getAdminEmails = async () => {
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    return adminsSnap.docs
        .map(doc => doc.data().email)
        .filter(email => email && typeof email === 'string' && email.trim() && !EXCLUDED_EMAILS.includes(email));
};
const sendAdminNotification = async (subject, htmlContent) => {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) {
        console.log('No admin emails found, skipping notification.');
        return;
    }
    const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
    try {
        await client.transactionalEmails.sendTransacEmail({
            sender: { name: 'Club Táchira', email: 'notificaciones@tenistac.com' },
            to: adminEmails.map((email) => ({ email })),
            subject,
            htmlContent,
        });
    }
    catch (err) {
        console.error('Error sending admin email notification:', err);
    }
};
const sumarDias = (fecha, dias) => {
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
};
const formatFechaVenezuela = (date) => {
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    const hours12 = hours % 12 || 12;
    return `${day}/${month}/${year}, ${hours12}:${minutes} ${ampm}`;
};
const formatFechaLarga = (fecha) => {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
};
const expandirBloqueo = async (bloqueoId, fechaInicio, fechaFin, turno, cancha, motivo) => {
    const dias = [];
    let actual = fechaInicio;
    while (actual <= fechaFin) {
        dias.push(actual);
        actual = sumarDias(actual, 1);
    }
    const turnos = turno === 'ambos' ? ['maniana', 'tarde', 'noche'] : [turno];
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
exports.createUser = (0, https_1.onCall)({
    secrets: [brevoApiKey],
}, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }
        await assertAdmin(request.auth.uid);
        const data = request.data;
        // Validar username
        validarString(data.username, 'username', { required: true, minLength: 2, maxLength: 30, pattern: /^[a-z]+$/ });
        const username = data.username.toLowerCase().trim();
        // Validar contraseña
        if (!data.password || typeof data.password !== 'string') {
            throw new https_1.HttpsError('invalid-argument', 'La contraseña es obligatoria.');
        }
        if (data.password.length < 6) {
            throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
        }
        if (data.password.length > 128) {
            throw new https_1.HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
        }
        // Validar role
        if (!data.role || !ROLES_VALIDOS.includes(data.role)) {
            throw new https_1.HttpsError('invalid-argument', `role inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}`);
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
            throw new https_1.HttpsError('invalid-argument', 'El correo es obligatorio para enviar las credenciales.');
        }
        validarString(data.email, 'email', { required: true, maxLength: 200 });
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
            console.error('Auth creation failed:', err.code);
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
            primerLogin: true,
            createdAt: firestore_1.Timestamp.now(),
            createdBy: request.auth.uid,
        });
        console.log(`Usuario creado: ${user.uid} (${username}) por ${request.auth.uid}`);
        const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
              <p style="color: #9ca3af; font-size: 12px;">Desarrollado por JDM Services Systems</p>
            </div>
          `,
            });
            console.log(`Email de credenciales enviado a ${data.email}`);
        }
        catch (err) {
            console.error('Error enviando email de credenciales:', err);
        }
        await db.collection('logs').add({
            tipo: 'usuario_creado',
            usuarioId: user.uid,
            username,
            role: data.role,
            realizadoPor: request.auth.uid,
            realizadoEn: firestore_1.Timestamp.now(),
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
        if (!uid || typeof uid !== 'string') {
            throw new https_1.HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
        }
        // Validar username si se está cambiando
        if (username) {
            validarString(username, 'username', { required: true, minLength: 2, maxLength: 30, pattern: /^[a-z]+$/ });
        }
        // Validar role si se está cambiando
        if (data.role && !ROLES_VALIDOS.includes(data.role)) {
            throw new https_1.HttpsError('invalid-argument', `role inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}`);
        }
        // Validar campos de texto si se proveen
        if (data.displayName !== undefined)
            validarString(data.displayName, 'displayName', { required: false, maxLength: 100 });
        if (data.equipo !== undefined)
            validarString(data.equipo, 'equipo', { required: false, maxLength: 100 });
        if (data.email !== undefined)
            validarString(data.email, 'email', { required: false, maxLength: 200 });
        const userDoc = await db.collection('usuarios').doc(uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'El usuario no existe.');
        }
        // Si se está cambiando el username, verificar unicidad
        if (username) {
            const cleanUsername = username.toLowerCase().trim();
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
                console.error('Auth update failed:', err.code);
                if (err.code?.includes('email-already-exists')) {
                    throw new https_1.HttpsError('already-exists', 'Ya existe otro usuario con ese nombre de usuario.');
                }
                if (err.code?.includes('user-not-found')) {
                    throw new https_1.HttpsError('not-found', 'El usuario no existe en Firebase Authentication.');
                }
                throw new https_1.HttpsError('internal', `Error actualizando usuario en Auth: ${err.message}`);
            }
        }
        const updateData = { ...data, updatedAt: firestore_1.Timestamp.now(), updatedBy: request.auth.uid };
        if (username)
            updateData.username = username.toLowerCase().trim();
        await db.collection('usuarios').doc(uid).update(updateData);
        console.log(`Usuario ${uid} actualizado por ${request.auth.uid}:`, JSON.stringify(updateData));
        await db.collection('logs').add({
            tipo: 'usuario_actualizado',
            usuarioId: uid,
            cambios: updateData,
            realizadoPor: request.auth.uid,
            realizadoEn: firestore_1.Timestamp.now(),
        });
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
        realizadoEn: firestore_1.Timestamp.now(),
    });
});
exports.setPassword = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { uid, newPassword } = request.data;
    validarString(uid, 'uid', { required: true, minLength: 10, maxLength: 200 });
    if (!newPassword || typeof newPassword !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'La nueva contraseña es obligatoria.');
    }
    if (newPassword.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword.length > 128) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
    }
    await auth.updateUser(uid, { password: newPassword });
    console.log(`Contraseña actualizada para usuario ${uid} por ${request.auth.uid}`);
    await db.collection('logs').add({
        tipo: 'usuario_password',
        usuarioId: uid,
        realizadoPor: request.auth.uid,
        realizadoEn: firestore_1.Timestamp.now(),
    });
    return { password: newPassword };
});
exports.createBloqueo = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { tipo, fechaInicio, fechaFin, turno, cancha, motivo } = request.data;
    // Validar tipo
    if (!TIPOS_BLOQUEO.includes(tipo)) {
        throw new https_1.HttpsError('invalid-argument', `tipo inválido. Debe ser: ${TIPOS_BLOQUEO.join(', ')}`);
    }
    // Validar fechas
    validarFecha(fechaInicio, 'fechaInicio');
    validarFecha(fechaFin, 'fechaFin');
    if (fechaInicio > fechaFin) {
        throw new https_1.HttpsError('invalid-argument', 'fechaInicio no puede ser posterior a fechaFin.');
    }
    // Validar turno
    if (!TURNOS_AMBOS_VALIDOS.includes(turno)) {
        throw new https_1.HttpsError('invalid-argument', `turno inválido. Debe ser: ${TURNOS_AMBOS_VALIDOS.join(', ')}`);
    }
    // Validar cancha (null = todas, o número 1-5)
    if (cancha !== null && (typeof cancha !== 'number' || !CANCHAS_SET.has(cancha))) {
        throw new https_1.HttpsError('invalid-argument', 'cancha inválida. Debe ser null o un número del 1 al 5.');
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
        creadoEn: firestore_1.Timestamp.now(),
    });
    await expandirBloqueo(bloqueoRef.id, fechaInicio, fechaFin, turno, cancha, motivo);
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const adminName = adminSnap.data()?.displayName || adminSnap.data()?.username || 'Admin';
    const canchalabel = cancha === null ? 'Todas' : `Cancha ${cancha}`;
    await sendAdminNotification(`[TenisTac] Nuevo bloqueo creado`, `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Nuevo bloqueo de cancha</h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Tipo:</strong> ${tipo}</p>
          <p><strong>Fechas:</strong> ${formatFechaLarga(fechaInicio)} a ${formatFechaLarga(fechaFin)}</p>
          <p><strong>Turno:</strong> ${turno}</p>
          <p><strong>Cancha:</strong> ${canchalabel}</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
          <p><strong>Creado por:</strong> ${adminName}</p>
        </div>
      </div>
      `);
    return { id: bloqueoRef.id };
});
exports.deleteBloqueo = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
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
        await sendAdminNotification(`[TenisTac] Bloqueo eliminado`, `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Bloqueo de cancha eliminado</h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Tipo:</strong> ${bloqueoData.tipo}</p>
          <p><strong>Fechas:</strong> ${formatFechaLarga(bloqueoData.fechaInicio)} a ${formatFechaLarga(bloqueoData.fechaFin)}</p>
          <p><strong>Turno:</strong> ${bloqueoData.turno}</p>
          <p><strong>Cancha:</strong> ${canchalabel}</p>
          <p><strong>Motivo:</strong> ${bloqueoData.motivo}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;">
          <p><strong>Eliminado por:</strong> ${adminName}</p>
        </div>
      </div>
      `);
    }
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
              <br />
              Desarrollado por JDM Services Systems
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
    const { capitanUid, capitanNombre, capitanEquipo, equipoRival, fecha, turnoPreferencia, motivo, solicitaChuruata, observaciones, solicitadoEn } = data;
    // Get all active admins with email
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    const recipientEmails = [];
    for (const doc of adminsSnap.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.trim() && !EXCLUDED_EMAILS.includes(email))
            recipientEmails.push(email);
    }
    // Add captain email
    if (capitanUid) {
        const captainSnap = await db.collection('usuarios').doc(capitanUid).get();
        if (captainSnap.exists) {
            const email = captainSnap.data()?.email;
            if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email) && !EXCLUDED_EMAILS.includes(email))
                recipientEmails.push(email);
        }
    }
    if (recipientEmails.length === 0) {
        console.log('No recipient emails found, skipping notification.');
        return;
    }
    const turnoLabel = turnoPreferencia === 'maniana' ? 'Mañana' : turnoPreferencia === 'tarde' ? 'Tarde' : turnoPreferencia === 'noche' ? 'Noche' : 'Cualquiera';
    const motivoLabel = motivo === 'amistoso' ? 'Amistoso' : motivo === 'entrenamiento' ? 'Entrenamiento' : motivo === 'clases' ? 'Clases' : motivo === 'torneo' ? 'Torneo' : motivo || '';
    const fechaSolicitud = solicitadoEn ? formatFechaVenezuela(solicitadoEn) : 'No disponible';
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
              <p><strong>Fecha:</strong> ${formatFechaLarga(fecha)}</p>
              <p><strong>Prefiere:</strong> ${turnoLabel}</p>
              <p><strong>Motivo:</strong> ${motivoLabel}</p>
              ${solicitaChuruata ? '<p><strong>Solicita churuata:</strong> Sí</p>' : ''}
              <p><strong>Solicitado el:</strong> ${fechaSolicitud}</p>
              ${observaciones ? `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;"><p><strong>Observaciones:</strong></p><p style="white-space: pre-wrap;">${observaciones}</p>` : ''}
            </div>
            <a href="https://canchas.tenistac.com/admin"
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
              Ver solicitudes en TenisTac
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Este es un mensaje automático de Club Táchira Solicitud de Canchas.
              <br />
              Desarrollado por JDM Services Systems
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
    if (!newPassword || typeof newPassword !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'La nueva contraseña es obligatoria.');
    }
    if (newPassword.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
    if (newPassword.length > 128) {
        throw new https_1.HttpsError('invalid-argument', 'La contraseña no debe exceder 128 caracteres.');
    }
    await auth.updateUser(request.auth.uid, { password: newPassword });
    await db.collection('usuarios').doc(request.auth.uid).update({
        primerLogin: false,
        updatedAt: firestore_1.Timestamp.now(),
        updatedBy: request.auth.uid,
    });
});
const generarPasswordSegura = (length) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};
exports.adminResetPassword = (0, https_1.onCall)({
    secrets: [brevoApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { uid } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El uid del usuario es obligatorio.');
    }
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'El usuario no existe.');
    }
    const userData = userDoc.data();
    const newPassword = generarPasswordSegura(12);
    await auth.updateUser(uid, { password: newPassword });
    console.log(`Contraseña restablecida para usuario ${uid} por ${request.auth.uid}`);
    if (userData.email && typeof userData.email === 'string' && userData.email.trim()) {
        const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
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
              <p style="color: #9ca3af; font-size: 12px;">Desarrollado por JDM Services Systems</p>
            </div>
          `,
            });
            console.log(`Email de restablecimiento enviado a ${userData.email}`);
        }
        catch (err) {
            console.error('Error enviando email de restablecimiento:', err);
        }
    }
    await db.collection('logs').add({
        tipo: 'usuario_password_reset',
        usuarioId: uid,
        username: userData.username,
        realizadoPor: request.auth.uid,
        realizadoEn: firestore_1.Timestamp.now(),
    });
    return { newPassword };
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
    validarString(reservaId, 'reservaId', { required: true, minLength: 5, maxLength: 200 });
    validarString(motivo, 'motivo', { required: true, maxLength: 500 });
    // auditoria: este evento se registra en logs al rechazar (ver abajo)
    // Get the reservation
    const reservaSnap = await db.collection('reservas').doc(reservaId).get();
    if (!reservaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'La solicitud no existe.');
    }
    const reserva = reservaSnap.data();
    // Delete the reservation
    await db.collection('reservas').doc(reservaId).delete();
    await db.collection('logs').add({
        tipo: 'reserva_rechazada',
        reservaId,
        capitanUid: reserva.capitanUid ?? null,
        capitanNombre: reserva.capitanNombre ?? null,
        fecha: reserva.fecha ?? null,
        motivo: motivo,
        realizadoPor: request.auth.uid,
        realizadoEn: firestore_1.Timestamp.now(),
    });
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
            if (email && typeof email === 'string' && email.trim() && !EXCLUDED_EMAILS.includes(email))
                recipientEmails.push(email);
        }
    }
    // Admin emails
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    for (const doc of adminsSnap.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email) && !EXCLUDED_EMAILS.includes(email)) {
            recipientEmails.push(email);
        }
    }
    if (recipientEmails.length === 0) {
        console.log('No recipients with email found, skipping rejection notification.');
        return { success: true };
    }
    const turnoLabel = reserva.turnoPreferencia === 'maniana' ? 'Mañana' : reserva.turnoPreferencia === 'tarde' ? 'Tarde' : reserva.turnoPreferencia === 'noche' ? 'Noche' : 'Cualquiera';
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
              <p><strong>Fecha:</strong> ${formatFechaLarga(reserva.fecha)}</p>
              <p><strong>Prefiere:</strong> ${turnoLabel}</p>
              <p><strong>Motivo original:</strong> ${motivoReservaLabel}</p>
              ${reserva.solicitaChuruata ? '<p><strong>Solicita churuata:</strong> Sí</p>' : ''}
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
              <br />
              Desarrollado por JDM Services Systems
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
// Delete a pending request directly WITHOUT notifying anyone (for mistaken requests)
exports.eliminarSolicitud = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { reservaId } = request.data;
    if (!reservaId || typeof reservaId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El ID de la solicitud es obligatorio.');
    }
    const snap = await db.collection('reservas').doc(reservaId).get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'La solicitud no existe.');
    }
    const data = snap.data();
    await db.collection('reservas').doc(reservaId).delete();
    console.log(`Solicitud ${reservaId} eliminada por ${request.auth.uid} (sin notificación)`);
    await db.collection('logs').add({
        tipo: 'reserva_eliminada',
        reservaId,
        capitanUid: data.capitanUid ?? null,
        capitanNombre: data.capitanNombre ?? null,
        fecha: data.fecha ?? null,
        realizadoPor: request.auth.uid,
        realizadoEn: firestore_1.Timestamp.now(),
    });
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
    const { reservaId, turno, canchas, solicitaChuruata } = request.data;
    // Validar reservaId
    validarString(reservaId, 'reservaId', { required: true, minLength: 5, maxLength: 200 });
    // Validar turno
    if (!TURNOS_VALIDOS.includes(turno)) {
        throw new https_1.HttpsError('invalid-argument', `turno inválido. Debe ser: ${TURNOS_VALIDOS.join(', ')}`);
    }
    // Validar canchas
    const canchasValidadas = validarCanchas(canchas, solicitaChuruata);
    // auditoria: este evento se registra en logs al aprobar (ver abajo)
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
        canchas: canchasValidadas,
        solicitaChuruata: solicitaChuruata || false,
        aprobadoEn: firestore_1.Timestamp.now(),
        aprobadoPor: request.auth.uid,
    });
    await db.collection('logs').add({
        tipo: 'reserva_aprobada',
        reservaId,
        capitanUid: reserva.capitanUid ?? null,
        capitanNombre: reserva.capitanNombre ?? null,
        fecha: reserva.fecha ?? null,
        turno,
        canchas: canchasValidadas,
        realizadoPor: request.auth.uid,
        realizadoEn: firestore_1.Timestamp.now(),
    });
    // Collect recipient emails: captain + all admins
    const recipientEmails = [];
    // Captain email
    if (reserva.capitanUid) {
        const captainSnap = await db.collection('usuarios').doc(reserva.capitanUid).get();
        if (captainSnap.exists) {
            const email = captainSnap.data()?.email;
            if (email && typeof email === 'string' && email.trim() && !EXCLUDED_EMAILS.includes(email))
                recipientEmails.push(email);
        }
    }
    // Admin emails
    const adminsSnap = await db.collection('usuarios').where('role', '==', 'admin').where('activo', '==', true).get();
    for (const doc of adminsSnap.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.trim() && !recipientEmails.includes(email) && !EXCLUDED_EMAILS.includes(email)) {
            recipientEmails.push(email);
        }
    }
    if (recipientEmails.length === 0) {
        console.log('No recipients with email found, skipping approval notification.');
        return { success: true };
    }
    const turnoLabelReserva = reserva.turnoPreferencia === 'maniana' ? 'Mañana' : reserva.turnoPreferencia === 'tarde' ? 'Tarde' : reserva.turnoPreferencia === 'noche' ? 'Noche' : 'Cualquiera';
    const turnoLabelAsignado = turno === 'maniana' ? 'Mañana' : turno === 'tarde' ? 'Tarde' : 'Noche';
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
              <p><strong>Fecha:</strong> ${formatFechaLarga(reserva.fecha)}</p>
              <p><strong>Pedía:</strong> ${turnoLabelReserva}</p>
              <p><strong>Asignado:</strong> Turno ${turnoLabelAsignado}${canchas.length > 0 ? ` · Canchas ${canchas.join(', ')}` : ''}${solicitaChuruata ? ' · Churuata' : ''}</p>
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
              <br />
              Desarrollado por JDM Services Systems
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
const formatTimestampToYYYYMMDD = (ts, tz) => {
    if (!ts)
        return '';
    const ms = Number(ts) * 1000;
    if (Number.isNaN(ms))
        return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
};
const getTodayInTimezone = (tz) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
};
exports.getEmailUsage = (0, https_1.onCall)({
    secrets: [brevoApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    try {
        const client = new brevo_1.BrevoClient({ apiKey: brevoApiKey.value() });
        const accountData = await client.account.getAccount();
        console.log('getEmailUsage accountData.plan:', JSON.stringify(accountData.plan));
        const sendLimitPlan = accountData.plan.find((p) => p.creditsType === 'sendLimit' && p.type !== 'sms');
        const restantes = sendLimitPlan?.credits ?? 0;
        const planType = sendLimitPlan?.type ?? 'free';
        const timezone = accountData.dateTimePreferences?.timezone ?? 'America/Caracas';
        let periodoInicio;
        let periodoFin;
        if (sendLimitPlan?.startDate && sendLimitPlan?.endDate) {
            periodoInicio = formatTimestampToYYYYMMDD(sendLimitPlan.startDate, timezone);
            periodoFin = formatTimestampToYYYYMMDD(sendLimitPlan.endDate, timezone);
        }
        else {
            const hoy = getTodayInTimezone(timezone);
            periodoInicio = hoy;
            periodoFin = hoy;
        }
        let enviados = 0;
        try {
            const reportRes = await client.transactionalEmails.getAggregatedSmtpReport({
                startDate: periodoInicio,
                endDate: periodoFin,
            });
            enviados = reportRes.requests ?? 0;
        }
        catch (reportErr) {
            console.error('Error obteniendo reporte SMTP:', reportErr);
            try {
                const fallbackRes = await client.transactionalEmails.getAggregatedSmtpReport({
                    days: 1,
                });
                enviados = fallbackRes.requests ?? 0;
            }
            catch (fallbackErr) {
                console.error('Error en fallback reporte SMTP:', fallbackErr);
            }
        }
        let limiteNominal = null;
        let limiteNominalPeriodo = null;
        let notas = null;
        if (planType === 'free') {
            limiteNominal = 300;
            limiteNominalPeriodo = 'diario';
            notas = 'Límite nominal verificado: 300 correos/día (plan gratuito Brevo).';
        }
        else if (planType === 'subscription') {
            notas = 'Plan de pago detectado. El límite nominal depende del tier contratado (no disponible vía API). El límite mostrado es derivado (enviados + restantes).';
        }
        else if (planType === 'payAsYouGo') {
            notas = 'Plan pay-as-you-go detectado. Los créditos se consumen por envío.';
        }
        const limite = limiteNominal ?? (enviados + restantes);
        const porcentaje = limite > 0 ? Math.round((enviados / limite) * 100) : 0;
        let estado;
        if (restantes === 0 || porcentaje >= 95) {
            estado = 'critico';
        }
        else if (porcentaje >= 80) {
            estado = 'advertencia';
        }
        else {
            estado = 'normal';
        }
        let fechaReinicio = null;
        if (planType === 'free') {
            fechaReinicio = 'Reinicia diariamente a medianoche (zona horaria de la cuenta).';
        }
        else if (sendLimitPlan?.endDate) {
            const msEnd = Number(sendLimitPlan.endDate) * 1000;
            if (!Number.isNaN(msEnd)) {
                fechaReinicio = new Intl.DateTimeFormat('es-VE', {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                }).format(new Date(msEnd));
            }
        }
        return {
            provider: 'Brevo',
            planType,
            enviados,
            restantes,
            limite,
            limiteNominal,
            limiteNominalPeriodo,
            porcentaje,
            estado,
            periodoInicio,
            periodoFin,
            timezone,
            fechaReinicio,
            notas,
        };
    }
    catch (err) {
        console.error('Error completo en getEmailUsage:', err);
        throw new https_1.HttpsError('internal', err instanceof Error ? err.message : 'Error al obtener uso de correos.');
    }
});
//# sourceMappingURL=index.js.map
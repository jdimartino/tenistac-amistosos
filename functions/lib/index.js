"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReservaUpdated = exports.backfillBloqueos = exports.updateBloqueo = exports.deleteBloqueo = exports.createBloqueo = exports.setPassword = exports.deleteUser = exports.updateUser = exports.createUser = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
(0, v2_1.setGlobalOptions)({ region: 'us-central1' });
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
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    await assertAdmin(request.auth.uid);
    const { uid, username, ...data } = request.data;
    // Si se está cambiando el username, verificar unicidad
    if (username) {
        const existing = await db.collection('usuarios').where('username', '==', username).get();
        const isTakenByOther = existing.docs.some(doc => doc.id !== uid);
        if (isTakenByOther) {
            throw new https_1.HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
        }
    }
    const authUpdate = {};
    if (data.displayName)
        authUpdate.displayName = data.displayName;
    if (username)
        authUpdate.email = `${username}@tenistac-amistosos.app`;
    if (Object.keys(authUpdate).length > 0) {
        await auth.updateUser(uid, authUpdate);
    }
    const updateData = { ...data };
    if (username)
        updateData.username = username;
    await db.collection('usuarios').doc(uid).update(updateData);
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
const formatoFechaCompleto = (fecha) => {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
};
const labelTurno = (turno) => {
    if (turno === 'maniana')
        return 'Mañana';
    if (turno === 'tarde')
        return 'Tarde';
    return 'Cualquiera';
};
exports.onReservaUpdated = (0, firestore_2.onDocumentUpdated)('reservas/{reservaId}', async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData)
        return;
    const antes = beforeData.estado;
    const despues = afterData.estado;
    if (antes !== 'solicitado')
        return;
    const reservaId = event.params?.reservaId ?? '';
    const capitanUid = afterData.capitanUid ?? '';
    const fecha = afterData.fecha ?? '';
    const equipoRival = afterData.equipoRival ?? '';
    const fechaTexto = formatoFechaCompleto(fecha);
    if (despues === 'reservado') {
        const turno = afterData.turno;
        const cancha = afterData.cancha;
        const aprobadoPor = afterData.aprobadoPor ?? '';
        await db.collection('mensajes').add({
            paraUid: capitanUid,
            deUid: aprobadoPor,
            deNombre: 'Sistema',
            deRol: 'admin',
            tipo: 'sistema',
            categoria: 'aprobacion',
            asunto: 'Cancha aprobada',
            cuerpo: `Tu solicitud para el ${fechaTexto} fue aprobada.\nTurno: ${labelTurno(turno)}\nCancha: ${cancha}\nEquipo rival: ${equipoRival || '-'}`,
            leido: false,
            reservaId,
            createdAt: firestore_1.Timestamp.now(),
        });
    }
    else if (despues === 'rechazado') {
        const rechazadoPor = afterData.rechazadoPor ?? '';
        await db.collection('mensajes').add({
            paraUid: capitanUid,
            deUid: rechazadoPor,
            deNombre: 'Sistema',
            deRol: 'admin',
            tipo: 'sistema',
            categoria: 'rechazo',
            asunto: 'Solicitud rechazada',
            cuerpo: `Tu solicitud para el ${fechaTexto} fue rechazada.\nEquipo rival: ${equipoRival || '-'}`,
            leido: false,
            reservaId,
            createdAt: firestore_1.Timestamp.now(),
        });
    }
});
//# sourceMappingURL=index.js.map
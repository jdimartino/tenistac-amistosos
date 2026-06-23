# ⚙️ Manual del Administrador

## Tenis Táchira — Solicitud de Canchas

---

## 1. Bienvenida

Como administrador de **Tenis Táchira**, tienes acceso completo a todas las funcionalidades de la aplicación. Este manual explica todo lo que puedes hacer.

---

## 2. Cómo Ingresar

1. Abre tu navegador y ve a **canchas.tenistac.com**
2. Ingresa tu **usuario** y **contraseña**
3. Toca **Ingresar**

---

## 3. Navegación

### Pestañas principales (parte inferior)

| Pestaña | Función |
|---------|---------|
| **Canchas** | Calendario de la grilla |
| **Mensajes** | Bandeja de mensajes internos |
| **Administración** | Panel de administración |

### Sub-pestañas de Administración

| Pestaña | Función |
|---------|---------|
| **Solicitudes** | Ver y gestionar solicitudes pendientes |
| **Usuarios** | Crear, editar y eliminar usuarios |
| **Bloqueos** | Bloquear y desbloquear canchas |

---

## 4. El Calendario Admin

El calendario admin muestra una **grilla detallada** de 15 días × 2 turnos × 5 canchas.

### Turnos

| Turno | Horario |
|-------|---------|
| **Mañana** | 08:00 |
| **Tarde** | 14:00 |

### Colores de los slots

| Color | Significado |
|-------|-------------|
| ⬜ **Blanco** | Libre — disponible para reservar |
| 🟡 **Amarillo** | Solicitado — esperando aprobación |
| 🟢 **Verde** | Reservado — ya asignado |
| ⬫ **Gris** | Bloqueado — no disponible |

### Acciones desde el calendario

- **Click en slot verde** → Ver detalles de la reserva (puedes editar o eliminar)
- **Click en slot gris** → Ver bloqueo (puedes desbloquear)
- **Solicitudes pendientes** → Se muestran en un recuadro amarillo arriba de cada día

---

## 5. Gestionar Solicitudes

Accede a la pestaña **Solicitudes** en el panel de administración.

### Ver solicitudes pendientes

Cada solicitud muestra:
- Nombre del capitán
- Equipo y rival
- Fecha preferida
- Turno preferido (Mañana / Tarde / Cualquiera)
- Motivo (Amistoso / Entrenamiento / Clases / Torneo)
- Observaciones (si las hay)

### Aprobar una solicitud

1. Selecciona el **turno** a asignar (Mañana o Tarde)
2. Marca las **canchas** (puedes seleccionar varias: ☑ C1 ☐ C2 ☑ C3 ☐ C4 ☐ C5)
3. Toca **Asignar**

> 📧 Se envía un correo al capitán y a todos los admins con los detalles de la aprobación.

### Rechazar una solicitud

1. Toca **Rechazar**
2. Escribe el **motivo del rechazo** *(obligatorio)*
3. Toca **Confirmar rechazo**

> 📧 Se envía un correo al capitán y a todos los admins indicando quién rechazó y por qué.

### Editar una solicitud

1. Toca **Editar**
2. Modifica los campos que necesites (fecha, turno, canchas, capitán, motivo, etc.)
3. Toca **Guardar cambios**

---

## 6. Gestionar Usuarios

Accede a la pestaña **Usuarios** en el panel de administración.

### Crear un usuario

1. Toca **+ Agregar usuario**
2. Completa el formulario:
   - **Usuario** (solo letras, sin espacios)
   - **Correo** *(opcional, solo referencia)*
   - **Nombre** (nombre para mostrar)
   - **Rol** (Capitán / Sub-Capitán / Admin)
   - **Equipo** (nombre del equipo)
   - **Contraseña** (mínimo 6 caracteres)
3. Toca **Crear usuario**

> 💡 El usuario se creará tanto en Firebase Authentication como en la base de datos.

### Editar un usuario

1. Busca el usuario en la lista (puedes usar la **búsqueda**)
2. Toca **Editar**
3. Modifica los campos necesarios
4. Toca **Guardar cambios**

### Resetear contraseña de un usuario

1. Busca el usuario
2. Toca **Editar**
3. Toca **Asignar nueva contraseña**
4. Escribe la nueva contraseña
5. La contraseña se mostrará en pantalla — cópiala y compártela con el usuario

### Eliminar un usuario

1. Busca el usuario
2. Toca **Eliminar**
3. Confirma la acción

> ⚠️ Esta acción elimina al usuario permanentemente de Authentication y de la base de datos.

---

## 7. Gestionar Bloqueos

Accede a la pestaña **Bloqueos** en el panel de administración.

### Crear un bloqueo

1. Completa el formulario:
   - **Desde** — fecha de inicio
   - **Hasta** — fecha de fin
   - **Turno** — Ambos turnos / Mañana / Tarde
   - **Cancha** — Todas / Cancha específica
   - **Motivo** — razón del bloqueo (ej: mantenimiento, torneo)
2. Toca **Bloquear**

> El sistema creará automáticamente los bloques individuales para cada combinación de fecha × turno × cancha.

### Editar un bloqueo

1. Busca el bloqueo en la lista
2. Toca **Editar**
3. Modifica los campos
4. Toca **Guardar cambios**

### Eliminar un bloqueo

1. Busca el bloqueo
2. Toca **Eliminar**
3. Confirma la acción

> Los bloques individuales de canchas se eliminarán automáticamente.

### Desbloquear una cancha individual

Desde el **calendario**:
1. Haz click en un slot **gris** (bloqueado)
2. Toca **Desbloquear**
3. La cancha se liberará para ese turno específico

---

## 8. Mensajería Interna

### Bandeja de mensajes

La pestaña **Mensajes** muestra todas tus conversaciones:

- Los hilos con mensajes **no leídos** tienen borde verde
- Badge verde muestra la cantidad de mensajes sin leer por hilo
- Toca un hilo para leerlo

### Enviar un mensaje nuevo

1. Toca **Nuevo mensaje**
2. Selecciona el destinatario:
   - **Administradores** — bandeja compartida de todos los admins
   - Un **capitán o sub-capitán** específico
3. Escribe el **asunto** y el **mensaje**
4. Toca **Enviar**

> 📧 El destinatario recibirá un correo con tu mensaje.

### Responder un mensaje

1. Abre un hilo de conversación
2. Escribe tu respuesta
3. Toca **Enviar**

> 💡 El sistema detecta automáticamente a quién responder según quién envió el último mensaje.

### Eliminar un mensaje

1. Pasa el cursor sobre un mensaje
2. Toca el icono de **🗑️ basura**
3. Confirma la acción

### Marcar todo como leído

1. Toca **Marcar todo leído**
2. Todos los mensajes no leídos se marcarán como leídos

---

## 9. Notificaciones 🔔

La **campanita** 🔔 en el header muestra un resumen de todo lo pendiente:

### Admin ve:

📋 **Solicitudes** — Lista de solicitudes pendientes con:
- Nombre del capitán
- Equipo rival
- Motivo
- Fecha

💬 **Mensajes nuevos** — Últimos 5 mensajes no leídos con:
- Nombre del remitente
- Asunto
- Preview del mensaje

> Toca un elemento para ir directamente a la sección correspondiente.

---

## 10. Cambiar mi Contraseña

1. En la esquina superior derecha, toca **🔐 Clave**
2. Escribe tu **nueva contraseña** (mínimo 6 caracteres)
3. **Confirma** la contraseña
4. Toca **Cambiar contraseña**

---

## 11. Cerrar Sesión

Toca **Salir** en la esquina superior derecha.

---

## Resumen de Funcionalidades Admin

| Función | Dónde |
|---------|-------|
| Ver calendario grilla | Pestaña Canchas |
| Aprobar solicitud | Pestaña Solicitudes → Asignar |
| Rechazar solicitud | Pestaña Solicitudes → Rechazar |
| Editar reserva | Click slot verde → Editar |
| Eliminar reserva | Click slot verde → Eliminar |
| Crear usuario | Pestaña Usuarios → + Agregar usuario |
| Editar usuario | Pestaña Usuarios → Editar |
| Resetear contraseña | Pestaña Usuarios → Editar → Asignar nueva contraseña |
| Eliminar usuario | Pestaña Usuarios → Eliminar |
| Bloquear canchas | Pestaña Bloqueos → Bloquear |
| Desbloquear cancha | Click slot gris → Desbloquear |
| Enviar mensaje | Mensajes → Nuevo mensaje |
| Ver notificaciones | Header → 🔔 Campanita |
| Cambiar contraseña | Header → 🔐 Clave |

---

## Flujo de Reserva Completo

```
Capitán solicita → Admin aprueba → Email a capitán + admins
                   admin rechaza → Email con motivo a capitán + admins
```

1. El **capitán** selecciona un día y envía una solicitud
2. El **admin** recibe notificación (campanita + correo)
3. El **admin** asigna turno y canchas (o rechaza con motivo)
4. El **capitán** recibe un correo con el resultado
5. La cancha aparece reservada en el calendario

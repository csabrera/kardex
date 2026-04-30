# Preguntas frecuentes y solución de problemas

---

## Login y contraseñas

### No puedo iniciar sesión, dice "credenciales inválidas"

- Verifica que estás escribiendo el **número de documento exacto** (sin guiones ni puntos, solo números).
- La contraseña distingue mayúsculas/minúsculas.
- Si olvidaste tu contraseña, click **"¿Olvidaste tu contraseña?"** desde el login. El sistema enviará un enlace de recuperación al email registrado.
- Si no recuerdas el documento o no tienes acceso al email, pide al admin que verifique o resetee tu cuenta.

### El sistema me obliga a cambiar la contraseña

Pasa la primera vez que entras (o cuando el admin reseteó tu cuenta). Es por seguridad — la contraseña inicial la conoce alguien más. Eliges una nueva, mínimo 8 caracteres, y listo.

### Quiero cambiar mi contraseña

- Click en tu **avatar** (esquina superior derecha) → **Cambiar contraseña**.
- O ve directamente a `/cambiar-password` en la barra de URL.

---

## Stock y disponibilidad

### En la tabla del almacén veo "1 / 3" en la columna Stock — ¿qué significa?

Es la nueva forma de mostrar el stock para herramientas (ítems tipo PRÉSTAMO):

- **1** = disponibles ahora (libres para prestar).
- **3** = total bajo custodia del almacén.

Diferencia: 2 unidades están en préstamo activo (con obreros). La herramienta sigue siendo "del almacén" pero no la puedes prestar otra vez hasta que vuelva.

Para items tipo CONSUMO o ASIGNACIÓN (no prestables), la columna muestra solo el total.

### Veo "⚠ 2 no utilizables" junto al nombre de un ítem

Significa que **2 unidades fueron devueltas con condición DAÑADO**. Cuentan en el stock total (todavía las tienes físicamente) pero no son utilizables.

Cuando decidas darlas de baja oficialmente (mandarlas a reparación, descartar, devolver a proveedor), haz un **AJUSTE** o una **SALIDA con motivo BAJA** para descontarlas del inventario.

### Quiero prestar una herramienta pero el sistema no me deja

Posibles causas:

1. **No hay disponible**: ya están todas prestadas. Espera a que devuelvan alguna.
2. **El ítem no es tipo PRÉSTAMO**: solo se prestan herramientas/equipos. Materiales y EPP no se "prestan", se consumen o asignan.
3. **El almacén es CENTRAL (Principal)**: los préstamos solo se hacen desde almacenes de obra, no desde el Principal.
4. **Tu rol no permite prestar en ese almacén**: solo el residente responsable de la obra (o el admin con motivo de excepción) puede prestar.

---

## Transferencias

### Hice una transferencia y la quiero cancelar

Si está en `EN_TRÁNSITO` (aún no recibida): tab Transferencias → click en la transferencia → **Cancelar**. El stock vuelve al origen.

Si ya está `RECIBIDA`: no se puede cancelar. Tendrías que crear una transferencia inversa de obra → Principal para devolver el stock.

### Recibí una transferencia con menos cantidad de la enviada

En el formulario de recepción, ingresa la **cantidad recibida real** (no la enviada). El sistema marcará la transferencia con discrepancia y generará una alerta para el almacenero. La diferencia queda registrada para investigación.

### El residente rechazó mi transferencia

El stock vuelve automáticamente al Principal. Revisa el motivo del rechazo (lo escribió el residente). Causas comunes: cantidad incorrecta, materiales dañados, ítem equivocado. Corrige y crea una transferencia nueva.

### Una transferencia lleva días en EN_TRÁNSITO

Como almacenero o admin: contacta al residente de la obra destino para que confirme la recepción. Si el residente dice que ya llegó pero olvidó confirmarla, dile que vaya a Mi Obra → tab Almacén → recibir.

---

## Préstamos

### Un obrero se fue sin devolver una herramienta

Si la situación es definitiva (el obrero ya no trabaja allí y la herramienta no va a volver):

1. Mi Obra → tab Préstamos → encuentra el préstamo activo.
2. **Marcar perdido**.
3. El sistema genera una `Movement SALIDA` con motivo `LOST_LOAN` y descuenta del stock.

Esto es **distinto** a "Devolver con condición DAÑADO": LOST descuenta del stock total, DAMAGED no.

### El obrero devolvió la herramienta dañada — ¿qué condición elijo?

- **DAÑADO**: si está rota, no funciona, o requiere reparación significativa. Sigue contando en stock total pero como "no utilizable".
- **REGULAR**: si funciona pero está gastada (mango raspado, conector flojo, etc.). Vuelve al pool de disponibles.
- **BUENO**: si está como nueva.

### ¿Puedo prestar a un obrero que no está asignado a mi obra?

No. El sistema valida que el obrero esté asignado a la obra del almacén donde haces el préstamo. Si necesitas prestar a alguien externo, primero pide al almacenero/admin que actualice la asignación del obrero.

---

## EPP

### Diferencia entre asignación inicial y reposición

- **Asignación inicial**: la primera vez que entregas un EPP a un obrero (ej. su primer casco al ingresar a la obra).
- **Reposición**: cuando el obrero perdió o dañó su EPP y le entregas uno nuevo.

Ambas descuentan del stock, pero la reposición queda **vinculada** a la asignación original. Útil para reportes (qué obreros piden reposiciones más frecuentemente).

### Asigné un EPP por error — ¿cómo lo deshago?

El sistema actualmente no soporta "deshacer" una asignación. Si fue un error:

1. Registra una **ENTRADA** al almacén con motivo `DEVOLUCION` por la cantidad asignada incorrectamente.
2. En notas explica el caso.
3. Crea la asignación correcta.

---

## Acciones como ADMIN

### Cuando hago algo de campo, el sistema me pide "Motivo de excepción"

Es por diseño. Las acciones de campo (préstamos, recepciones, EPP) las hace el almacenero o residente. Si el admin las hace, es porque hay una excepción y queremos dejar el motivo registrado.

Escribe **mínimo 5 caracteres** explicando por qué tú estás haciendo la acción. El motivo queda registrado para siempre.

Ejemplos buenos: _"Residente de baja médica, presto martillo de urgencia para cerrar muro hoy"_.

Ejemplos malos (rechazados o inútiles): _"asd"_, _"prueba"_, vacío.

### ¿Por qué se exige a admin pero no a almacenero?

Porque es un **flujo de campo**. El almacenero también es operativo y se asume que crea préstamos como parte normal de su trabajo. El admin es supervisor y solo opera por excepción.

---

## Items y catálogos

### Creé un ítem con tipo equivocado, ¿puedo cambiarlo?

Sí, edita el ítem y cambia el tipo. **Pero hay restricciones:**

- Si el ítem ya tiene movimientos/préstamos/asignaciones registrados, cambiar el tipo puede generar inconsistencias.
- Conviene crear un ítem nuevo con el tipo correcto y desactivar el anterior.

### No encuentro la categoría/unidad/especialidad que necesito

- En formularios donde aparece como combobox: hay un botón **"+ Nueva ..."** inline que abre un sub-formulario rápido sin salir de lo que estás haciendo.
- Como admin: ve a **Configuración → Categorías/Unidades/Especialidades** para gestión completa.

### El stock inicial que cargué al crear un ítem está mal

Genera un **AJUSTE** corrigiendo a la cantidad real. Anota en el motivo que el stock inicial fue cargado erróneamente.

---

## Alertas

### Recibo muchas alertas de stock bajo

Probablemente los **mínimos de algunos ítems están demasiado altos**. Edita el ítem y baja el `Stock mínimo` a un valor más realista. La alerta se dispara cuando `stock < mínimo`.

### Una alerta sigue apareciendo aunque ya compré el material

Marca la alerta como **leída** después de tomar acción. Si el stock subió por encima del mínimo, no se generan nuevas alertas — pero las viejas no se cierran solas, hay que marcarlas a mano.

---

## Reportes

### El stock valorizado no me cuadra con la contabilidad

El sistema usa el **último costo unitario conocido** de cada ítem (el del último movimiento de entrada). No es un costo promedio ponderado ni FIFO/LIFO. Si necesitas un cálculo distinto, exporta los datos a Excel y haz el cálculo allí.

---

## Errores y problemas técnicos

### "Conflicto al actualizar stock" / "STOCK_CONFLICT"

Significa que **dos personas modificaron el mismo stock al mismo tiempo**. El sistema usa control optimista de versiones para evitar pérdidas de datos. Refresca la página y vuelve a intentar la operación.

### Una página no carga, se queda en blanco

- Recarga (F5 o Ctrl+R).
- Si persiste, cierra sesión y vuelve a entrar.
- Si sigue, abre la consola del navegador (F12) y reporta el error al admin.

### "No tienes permiso para hacer esto"

Tu rol no permite la acción. Posibles soluciones:

- Pide al admin que te asigne el rol correcto.
- O pide al usuario con el rol correcto que haga la acción.
- Si crees que es un bug, repórtalo al admin.

### Olvidé en qué almacén estaba viendo

- El **breadcrumb** arriba (debajo del header) te dice dónde estás.
- Click en el logo Kardex (esquina superior izquierda) te lleva al Dashboard.
- Ctrl+K abre la búsqueda rápida — escribe el nombre del almacén/obra/ítem y vas directo.

---

## Comunicación con tu equipo

### Necesito que el almacenero me envíe X material

El sistema **no tiene chat ni mensajería interna**. Coordina por WhatsApp/teléfono/email con el almacenero. Una vez te lo envíe, te llegará la transferencia y la confirmas en el sistema.

### Quiero saber qué ha hecho un usuario en el último mes

Solo el admin puede ver eso, en **Auditoría**. Filtra por usuario y rango de fechas.

---

## ¿Algo no está cubierto aquí?

Reporta dudas o problemas al admin del sistema. Todos los manuales son **vivos** — si una sección no es clara, dilo y la mejoramos.

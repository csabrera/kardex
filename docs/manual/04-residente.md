# Guía para RESIDENTE

Como residente eres responsable del **almacén de tu obra**: recibes lo que llega, prestas herramientas a los obreros, asignas EPP, y mantienes el inventario al día.

> **Lectura previa recomendada:** [Conceptos básicos](01-conceptos.md).

---

## Tu menú lateral

```
Mi Obra
```

Solo eso. Mi Obra es tu pantalla única — todo lo que necesitas está dentro.

---

## La pantalla "Mi Obra"

Tiene un **selector de almacén** arriba y **6 pestañas** abajo:

### Selector de almacén

- Si estás a cargo de **una sola obra**, te muestra ese almacén directamente.
- Si estás a cargo de **varias obras**, puedes elegir entre cada almacén o "**TODOS**" (vista consolidada — suma todo y muestra desglose por almacén).

### Pestañas

| Pestaña         | Para qué                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Almacén**     | Ver el stock actual de tu(s) almacén(es). Hacer ajustes y salidas directas. Recibir transferencias pendientes. |
| **Préstamos**   | Crear préstamos de herramientas y registrar devoluciones.                                                      |
| **EPP**         | Asignar EPP a obreros y reponer EPP dañado.                                                                    |
| **Estaciones**  | Crear/editar estaciones de trabajo de la obra.                                                                 |
| **Movimientos** | Ver el historial de entradas/salidas/ajustes de tu almacén.                                                    |
| **Alertas**     | Alertas activas que afectan a tu obra.                                                                         |

---

## 1. Recibir una transferencia que llegó

**Cuándo:** el almacenero te envió materiales y los tienes físicamente en obra.

**Pasos:**

1. Ve a **Mi Obra → tab Almacén**. Si hay transferencias pendientes, aparece una sección de aviso al inicio.
2. Click en la transferencia (código `TRF-XXXXX`).
3. Verifica que **lo recibido físicamente coincida con lo que dice la transferencia** (cantidad, ítem).
4. **Si todo está correcto**: click **Recibir** → confirma.
5. **Si hay diferencias**: en el campo de cantidad recibida, registra la cantidad real (la que llegó). El sistema marcará la transferencia con discrepancia y generará una alerta para el almacenero.
6. **Si está completamente equivocada o dañada**: click **Rechazar** → motivo del rechazo (ej. _"Materiales con humedad evidente, no aceptamos"_). El stock vuelve al almacén origen.

**Qué pasa al recibir:**

- El stock entra al almacén de tu obra.
- La transferencia queda en estado `RECIBIDA`.
- Quedas registrado como quien recibió, con la fecha exacta.

---

## 2. Crear un préstamo de herramienta

**Cuándo:** un obrero te pide una herramienta para trabajar.

**Pasos:**

1. Mi Obra → tab **Préstamos** → **Nuevo préstamo**.
2. Llenas:
   - **Empleado**: el obrero que recibe (debe estar registrado en tu obra; si no, pide al admin/almacenero que lo cree).
   - **Estación de trabajo**: dónde se va a usar (frente, sector). Si no existe la estación, primero créala en la pestaña Estaciones.
   - **Ítem**: la herramienta (solo aparecen ítems tipo PRÉSTAMO).
   - **Cantidad**: cuántas unidades.
   - **Fecha esperada de devolución**: cuándo debe devolverla.
   - **Notas** opcionales (ej. _"se llevó cargador y batería extra"_).
3. **Crear préstamo.** Genera código `PRT-XXXXX`.

**Qué pasa al crearlo:**

- El préstamo queda activo (status `ACTIVE`).
- **El stock NO baja** físicamente del almacén — la herramienta sigue siendo del almacén, solo está temporalmente con el obrero.
- En la tabla de stock verás "Disponibles / Total". Por ejemplo si tenías 3 taladros y prestaste 1, verás "2 / 3" — 2 disponibles (libres en estante), 3 totales (en custodia del almacén).

> **El sistema te impide prestar más de lo disponible.** Si tienes 3 taladros y 3 ya están prestados, la columna "Disponible" muestra 0 y el sistema rechaza un nuevo préstamo.

---

## 3. Devolver un préstamo

**Cuándo:** el obrero te trae la herramienta de vuelta.

**Pasos:**

1. Mi Obra → tab **Préstamos** → encuentra el préstamo activo.
2. En la fila → **Devolver**.
3. **Condición de devolución** (importante):
   - **BUENO**: la herramienta está perfecta, vuelve al pool de disponibles.
   - **REGULAR**: tiene desgaste pero funciona, también vuelve al pool de disponibles.
   - **DAÑADO**: no funciona o requiere reparación. El sistema la cuenta en el stock total pero la marca como "no utilizable" — verás una marca **"⚠ X no utilizables"** en la tabla. Cuando decidas darla de baja, hazlo con un AJUSTE manual.
4. **Notas** opcionales (ej. _"requiere cambio de mandril, mandar a reparar"_).
5. **Confirmar devolución.**

**Qué pasa:**

- El préstamo cambia a status `RETURNED`.
- El stock **disponible** sube (si fue BUENO o REGULAR) o se queda en el "no utilizables" (si fue DAÑADO).
- Quedas registrado como quien recibió la devolución.

---

## 4. Marcar un préstamo como perdido (LOST)

**Cuándo:** el obrero ya no trabaja en la obra y nunca devolvió la herramienta, o la herramienta se perdió/robó.

**Pasos:**

1. Mi Obra → tab **Préstamos** → encuentra el préstamo activo.
2. En la fila → **Marcar perdido**.
3. Confirma.

**Qué pasa:**

- El préstamo cambia a status `LOST`.
- **Esta vez SÍ baja del stock total** — el sistema genera automáticamente una `Movement SALIDA` con motivo `LOST_LOAN`. Lo verás en la pestaña Movimientos como "Pérdida de préstamo".
- Es la única condición de cierre de préstamo que afecta el inventario físico (a diferencia de devolución BUENO/REGULAR/DAMAGED).

---

## 5. Asignar EPP a un trabajador

**Cuándo:** un obrero ingresa a la obra o necesita reponer EPP.

**Pasos:**

1. Mi Obra → tab **EPP** → **Nueva asignación**.
2. Llenas:
   - **Empleado**: el obrero que recibe.
   - **Ítem**: solo aparecen ítems tipo ASIGNACIÓN (cascos, guantes, arneses, etc.).
   - **Cantidad**: típicamente 1 (o más si entrega varios pares de guantes, etc.).
   - **Notas** opcionales.
3. **Asignar.** Genera código `EPP-XXXXX`.

**Qué pasa:**

- **El stock baja inmediatamente** (a diferencia del préstamo, el EPP es entrega definitiva).
- El sistema genera automáticamente un `Movement SALIDA` para descontar el stock.
- Queda registrado: a quién, qué, cuándo, por quién.

### Reposición de EPP

Si el obrero pierde o daña su casco y necesita uno nuevo:

1. Tab **EPP** → encuentra la asignación original → **Reponer**.
2. Llenas el motivo de reposición.
3. Confirma.

Genera otra asignación vinculada a la anterior, descuenta otra unidad del stock, y queda el rastro de que fue una reposición (no una asignación inicial).

---

## 6. Ajustar stock de tu almacén

**Cuándo:** hiciste un conteo físico y la realidad no coincide con el sistema.

**Pasos:**

1. Mi Obra → tab **Almacén** (en modo específico de un almacén, no en TODOS).
2. En la fila del ítem → botón **Ajustar** (icono ámbar).
3. Cantidad **real** (la que contaste de verdad).
4. Motivo obligatorio (ej. _"Conteo físico, faltan 2 sacos por mojado en obra"_).
5. **Guardar.** Genera código `AJU-XXXXX`.

> **Importante:** los ajustes son tu responsabilidad. Sé honesto sobre la realidad. El motivo queda registrado para siempre.

---

## 7. Registrar salida directa (consumo en obra)

**Cuándo:** se consumió material en la obra y quieres descontarlo del almacén.

> **Nota:** muchos casos no necesitan registro explícito — el material que sale para una tarea diaria normalmente se da por consumido sin un movimiento aparte. Usa esta función cuando hay un consumo grande o quieres trazabilidad de un evento específico.

**Pasos:**

1. Mi Obra → tab **Almacén** → fila del ítem → botón **Salida** (icono rojo).
2. Cantidad a sacar (no puede exceder el disponible — si la herramienta está prestada, el botón Salida está deshabilitado).
3. Motivo (`CONSUMO`, `BAJA`, etc.) y notas.
4. **Guardar.**

---

## 8. Crear estaciones de trabajo

**Cuándo:** vas a empezar un nuevo frente de trabajo en la obra.

**Pasos:**

1. Mi Obra → tab **Estaciones** → **Nueva estación**.
2. Nombre (ej. _"Encofrado nivel 3"_, _"Frente Norte"_, _"Sector A"_).
3. Descripción opcional.
4. **Crear.**

Las estaciones aparecen como opciones cuando creas un préstamo. Si una estación cierra, puedes desactivarla (no eliminarla si tiene préstamos asociados).

---

## 9. Vista TODOS — modo consolidado

Si eres responsable de **varias obras**, el selector "Almacén" en la parte superior de Mi Obra incluye una opción **"Todos los almacenes"**. Esta vista:

- Suma todos los stocks de todos tus almacenes.
- Muestra el desglose por almacén en una columna ("En almacenes").
- Útil para ver el panorama general de todo lo que manejas.
- En este modo **NO puedes** hacer ajustes/salidas (porque no es claro a qué almacén afectarían). Para esas acciones, selecciona un almacén específico.

---

## Reglas importantes que el sistema te impone

- **Solo puedes ver y operar sobre TUS obras** (las que tienes asignadas como responsable).
- **Solo puedes prestar herramientas (tipo PRÉSTAMO) y asignar EPP** — no creas ítems del catálogo (eso lo hace el almacenero).
- **No puedes registrar entradas (compras)** en tu almacén — solo el almacenero puede, y solo al Almacén Principal. Lo que llega a tu obra llega vía transferencia.
- **No puedes prestar más de lo disponible** — si tienes 3 taladros y los 3 están prestados, no puedes prestar un 4to.

---

## Checklist diario

- [ ] Revisar **Mi Obra → tab Almacén**: ¿hay transferencias pendientes de recibir?
- [ ] Atender devoluciones de préstamos del día anterior.
- [ ] Crear préstamos / asignaciones de EPP que pidan los obreros.
- [ ] Revisar tab Alertas: ¿hay algo crítico de mi obra?
- [ ] Si hubo eventos importantes (pérdida, daño, conteo), registrarlos antes de cerrar el día.

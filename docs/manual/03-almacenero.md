# Guía para ALMACENERO

Como almacenero eres responsable de la **operación diaria del Almacén Principal**: registrar lo que llega, enviarlo a las obras, mantener el catálogo de ítems al día y vigilar las alertas.

> **Lectura previa recomendada:** [Conceptos básicos](01-conceptos.md).

---

## Tu menú lateral

```
Dashboard
Almacén Principal      ← tu hub principal
─── Organización ───
  Obras
  Empleados
  Almacenes
  Proveedores
─── Análisis ───
  Reportes
  Alertas
```

No tienes acceso a Usuarios, Configuración del sistema ni Auditoría — eso lo maneja el admin.

---

## Tu día a día — el Almacén Principal como hub

Tu pantalla principal es **Almacén Principal**. Tiene 6 pestañas:

| Pestaña            | Para qué sirve                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| **Inventario**     | Catálogo de ítems con su stock actual. Aquí creas, editas y ves todo.     |
| **Movimientos**    | Historial de entradas, salidas y ajustes.                                 |
| **Transferencias** | Lista de transferencias hacia obras (en tránsito, recibidas, rechazadas). |
| **Préstamos**      | Vista global de todos los préstamos del sistema (solo lectura).           |
| **EPP**            | Vista global de todas las asignaciones de EPP.                            |
| **Inventarios**    | Conteos físicos del Almacén Principal.                                    |

Las pestañas Préstamos y EPP son **solo de lectura** desde aquí — los préstamos y asignaciones se crean desde el almacén de la obra correspondiente.

---

## 1. Crear un ítem nuevo

**Cuándo:** cuando llega un material/herramienta/EPP que aún no está en el catálogo.

**Pasos:**

1. **Almacén Principal → tab Inventario → Nuevo ítem.**
2. Selecciona el **Tipo** (3 opciones, según cómo se va a usar el ítem):
   - **Consumo**: materiales/repuestos que se gastan.
   - **Préstamo**: herramientas/equipos que se prestan y vuelven.
   - **Asignación (EPP)**: EPP que se entrega individualmente.
3. Llena: **Nombre**, **Categoría** (combobox buscable), **Unidad** (combobox buscable), **Mínimo** y **Máximo**.
4. **Si quieres cargar stock inicial al crearlo**: marca el checkbox "Cargar stock al crear" y llena cantidad, costo unitario, motivo (típicamente COMPRA), proveedor, notas. El sistema genera automáticamente una **ENTRADA** con código `ENT-XXXXX`.

> **Tips:**
>
> - Si no encuentras la categoría o unidad, click "+ Nueva categoría" / "+ Nueva unidad" inline y la creas sin salir del formulario.
> - El **código del ítem** se genera automáticamente (`ITM-XXXXXX`), no lo escribes.
> - **Mínimo** dispara alerta cuando el stock baja a esa cantidad. **Máximo** es informativo.

---

## 2. Registrar una entrada (compra)

**Cuándo:** llegó una compra al Almacén Principal con su factura/boleta.

**Hay 2 formas:**

### A) Desde la fila del ítem (rápido, un solo ítem)

1. **Almacén Principal → tab Inventario.**
2. En la fila del ítem → **Acciones → Registrar entrada**.
3. Llenas cantidad, costo unitario, motivo (`COMPRA`), proveedor, notas.
4. **Guardar.**

### B) Desde tab Movimientos (varios ítems en un solo movimiento)

1. **Almacén Principal → tab Movimientos → Nuevo movimiento.**
2. Tipo: **ENTRADA**, motivo: **COMPRA**.
3. Selecciona el proveedor.
4. Agrega cada ítem con su cantidad y costo unitario.
5. **Guardar.** Genera un solo código `ENT-XXXXX` con varios ítems.

> **Restricción importante:** las ENTRADAs **solo se permiten al Almacén Principal**. No puedes registrar una entrada directa a un almacén de obra. Si llegó algo directo a una obra, el flujo correcto es: ENTRADA al Principal → Transferencia a la obra → Recepción.

---

## 3. Transferir materiales a una obra

**Cuándo:** una obra necesita material y tú lo envías desde el Principal.

**Pasos:**

1. **Almacén Principal → tab Inventario → Acciones → Transferir a obra** (o tab Transferencias → Nueva transferencia).
2. Selecciona el **almacén destino** (el almacén de la obra a la que envías).
3. Agrega los ítems con la cantidad de cada uno. El sistema te muestra el stock disponible y te avisa si pides más de lo que hay.
4. Notas opcionales.
5. **Crear transferencia.**

**Qué pasa al crearla:**

- El stock **sale inmediatamente** del Principal (de 100 baja a 70 si transferiste 30).
- La transferencia queda en estado **EN_TRÁNSITO** con código `TRF-XXXXX`.
- El residente de la obra destino recibe una notificación.
- En la tab Transferencias la ves con badge ámbar "EN_TRÁNSITO".

**Qué pasa después:**

- El **residente confirma la recepción** desde su pantalla "Mi Obra" → tab Almacén → transferencia pendiente. Solo entonces el stock entra al almacén de la obra.
- Si el residente **rechaza** (porque llegó incompleto, dañado, equivocado), el stock **vuelve automáticamente** al Principal.

### Cancelar una transferencia EN_TRÁNSITO

Si te equivocaste y la transferencia aún no fue recibida:

1. **Tab Transferencias → click en la transferencia → Cancelar.**
2. El stock vuelve al Principal.

No puedes cancelar una transferencia ya RECIBIDA o RECHAZADA.

---

## 4. Salida directa (consumo, baja, etc.)

**Cuándo:** algo sale del Principal pero NO va a una obra (ej. baja por daño, devolución a proveedor, mermas).

**Pasos:**

1. **Almacén Principal → tab Inventario → Acciones → Salida directa** (o tab Movimientos → Nuevo movimiento → SALIDA).
2. Selecciona el **motivo**:
   - `BAJA`: dado de baja por daño/obsolescencia.
   - `DEVOLUCION`: devuelto a proveedor.
   - `CONSUMO`: usado en operaciones internas.
   - `AJUSTE`: corrección por error.
3. Agrega ítems y cantidades.
4. Notas explicativas.
5. **Guardar** (genera código `SAL-XXXXX`).

> **Diferencia con transferencia:** una transferencia mueve stock **a otro almacén** del sistema. Una salida directa **descuenta del sistema** (lo perdiste, lo regresaste, se rompió).

---

## 5. Ajuste de stock (después de un conteo físico)

**Cuándo:** hiciste un conteo físico y el sistema dice que hay 50 pero en la realidad hay 47.

**Pasos:**

1. **Almacén Principal → tab Inventario → Acciones → Ajustar stock**.
2. Cantidad física **real** (lo que contaste de verdad).
3. Motivo obligatorio (ej. _"Conteo físico semanal — diferencia de 3 unidades, posible mal registro de salida"_).
4. **Guardar** (genera código `AJU-XXXXX`).

> **Mejor práctica:** cuando el conteo abarca todo el almacén, usa **Inventario físico** (sección 6) en lugar de ajustes uno por uno.

---

## 6. Inventario físico completo

**Cuándo:** vas a contar TODO el almacén (ej. cierre de mes).

**Pasos:**

1. **Almacén Principal → tab Inventarios → Nuevo inventario.**
2. El sistema "fotografía" el stock actual de cada ítem como `Cantidad esperada`. Lo deja en estado `EN_PROGRESO`.
3. Vas contando físicamente y entras al inventario para registrar la cantidad real de cada ítem. El sistema muestra la diferencia (variance).
4. Cuando terminas, **Cerrar inventario** → genera un único movimiento `AJUSTE` con todas las diferencias.
5. Si quieres cancelar sin aplicar cambios → **Cancelar inventario**.

> **Importante:** solo puedes tener **un inventario en progreso por almacén** a la vez. Termina el actual antes de empezar otro.

---

## 7. Catálogos

### 7.1. Crear obras

**Cuándo:** entra una obra nueva.

**Pasos:** **Organización → Obras → Nueva obra.** Llenas nombre, cliente, **responsable** (debe existir como usuario residente — el admin lo crea), fechas, estado.

Al guardar, el sistema **automáticamente crea el almacén tipo OBRA** asociado. No lo crees a mano.

### 7.2. Crear empleados (workers)

**Cuándo:** se contrata a un obrero nuevo.

**Pasos:** **Organización → Empleados → Nuevo empleado.** Llenas DNI/CE, nombres, apellidos, **celular** (9 dígitos que empieza con 9, formato Perú), **especialidad** (Albañil, Electricista, etc.), **obra asignada** (opcional).

> **Recordatorio:** los empleados **NO inician sesión**. Solo aparecen como destinatarios de préstamos y asignaciones de EPP.

### 7.3. Crear proveedores

**Cuándo:** vas a registrar una compra de un proveedor que no está aún.

**Pasos:** **Organización → Proveedores → Nuevo proveedor.** Llenas razón social, RUC (opcional pero único si lo provees), contacto, teléfono, email, dirección.

> **Tip:** desde el formulario de "Nueva entrada" puedes crear el proveedor inline con el botón **"+ Nuevo proveedor"** sin salir, si la compra es de uno nuevo.

---

## 8. Alertas — vigilancia diaria

Ve a **Análisis → Alertas**. Tienes que revisar esto **al menos 1 vez por día** para detectar:

- **STOCK_BAJO**: un ítem está por debajo del mínimo. Hay que comprar.
- **STOCK_CRITICO**: un ítem llegó a cero. Comprar urgente.
- **TRANSFER_DISCREPANCIA**: un residente recibió una transferencia con diferencias respecto a lo enviado. Investigar.

Click en cada alerta para ver el detalle. Marcas como leída cuando ya tomaste acción.

---

## 9. Reportes — para tomar decisiones

Ve a **Análisis → Reportes**. Los 4 más útiles para ti:

- **Consumo por obra**: qué obra está consumiendo más material.
- **Top items**: cuáles son los productos más movidos.
- **Stock valorizado**: cuánto vale el inventario hoy (último costo conocido).
- **Movimientos**: actividad por día/mes.

Filtra por rango de fechas y por almacén/obra según necesites.

---

## 10. Importar ítems desde Excel

Si tienes que cargar muchos ítems de golpe (ej. catálogo inicial), no los hagas uno por uno.

1. **Almacén Principal → tab Inventario → Importar Excel.**
2. Descarga la **plantilla**.
3. Llénala con tus ítems. Si pones `stockinicial` y `proveedor`, el sistema crea automáticamente las entradas correspondientes.
4. Sube el archivo. Verifica el resultado.

---

## Checklist diario

- [ ] Revisar **alertas** de stock bajo/crítico → comprar lo que falte.
- [ ] Revisar **transferencias en tránsito** que llevan más de X días sin recibirse → consultar al residente.
- [ ] Registrar las **compras del día** (entradas).
- [ ] Atender solicitudes de transferencia de los residentes.
- [ ] Al final del día, verificar que no quedan alertas críticas sin atender.

---

## Lo que NO puedes hacer como almacenero

(lo hace el admin o el residente)

- Crear/eliminar usuarios → **Admin**
- Configurar categorías, unidades, especialidades del sistema → **Admin**
- Ver auditoría → **Admin**
- Crear préstamos → **Residente** (en su almacén de obra)
- Recibir transferencias → **Residente** (en su almacén de obra)
- Asignar EPP a obreros → **Residente**

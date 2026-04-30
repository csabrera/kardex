# Guía para ADMIN

Como administrador del sistema tienes acceso a todo. Esta guía cubre las tareas que solo tú puedes hacer (y algunas que también puede hacer el almacenero, por si las haces tú directamente).

> **Lectura previa recomendada:** [Conceptos básicos](01-conceptos.md).

---

## Tu menú lateral

```
Dashboard
Almacén Principal
─── Organización ───
  Obras
  Empleados
  Almacenes
  Proveedores
─── Análisis ───
  Reportes
  Alertas
─── Administración ───
  Usuarios
  Auditoría
─── Configuración ───
  Categorías
  Unidades
  Especialidades
```

---

## 1. Configuración inicial del sistema

Esto se hace una sola vez, al empezar. Todos los catálogos base ya vienen pre-cargados (unidades como kg/bolsa/metro, categorías como Cementos/EPP, especialidades como Albañil/Electricista). Solo agregas lo específico de tu empresa.

### 1.1. Crear usuarios

Ve a **Usuarios → Nuevo usuario**.

Necesitas crear:

- Un usuario **ALMACENERO** que estará a cargo del Almacén Principal y registrará las compras.
- Un usuario **RESIDENTE** por cada jefe/responsable de obra.

Para cada usuario llenas: tipo de documento (DNI / CE / PASAPORTE), número, nombres, apellidos, email, **rol**, y una contraseña inicial. Marca **"Forzar cambio de contraseña en primer login"** para que el usuario la cambie cuando entre.

### 1.2. Verificar catálogos base

Ve a:

- **Configuración → Especialidades** — debería tener 10 oficios pre-cargados (Albañil, Electricista, Gasfitero, Operador, Maestro de obra, Oficial, Ayudante, Soldador, Pintor, Carpintero). Agrega los que falten para tu empresa.
- **Configuración → Categorías** — 9 categorías pre-cargadas (Materiales de construcción, EPP, Ferretería, etc.). Agrega las que necesites.
- **Configuración → Unidades** — 20 unidades pre-cargadas (kg, bolsa, metro, litro, etc.). Difícilmente necesitas agregar más.

### 1.3. Crear el primer proveedor

Ve a **Organización → Proveedores → Nuevo proveedor**.

El sistema viene con un proveedor especial llamado **"Proveedor eventual - Efectivo"** (`PRV-EVENTUAL`). Es el catch-all para compras menores en efectivo sin factura. Puedes usarlo siempre, pero conviene registrar tus proveedores frecuentes con su RUC, contacto y correo, así los reportes salen con nombres reales.

---

## 2. Crear una obra

Ve a **Organización → Obras → Nueva obra**.

Llenas:

- **Nombre** (ej. "Edificio Plaza San Isidro")
- **Cliente** (opcional)
- **Responsable**: el usuario residente que la lidera. Tiene que existir como usuario antes (paso 1.1).
- **Fechas** de inicio y fin
- **Estado** (déjalo en "Planificación" si aún no arranca)

Al guardar, el sistema crea automáticamente:

- La obra con código `OBR-XXXXXX`.
- Un **almacén tipo OBRA** con código `ALM-{código de la obra}`. No tienes que crearlo aparte.

Después puedes crear empleados asignados a esa obra y estaciones de trabajo dentro de la obra (ve **Obras → click en la obra → tab Estaciones**).

---

## 3. Auditoría — historial completo

Ve a **Administración → Auditoría**.

Cada acción que afecta datos importantes queda registrada: quién la hizo, cuándo, sobre qué recurso, qué cambió. Filtra por:

- **Recurso** (Item, Movement, Transfer, ToolLoan, etc.)
- **Acción** (CREATE, UPDATE, DELETE)
- **Usuario** (quién lo hizo)
- **Rango de fechas**

Útil para:

- Investigar discrepancias ("¿quién modificó este ítem?")
- Verificar acciones de un usuario en un periodo
- Dar trazabilidad ante el cliente o auditoría externa

---

## 4. Acciones de campo como ADMIN — el "motivo de excepción"

Por diseño, las acciones operativas de campo (crear préstamos, recibir transferencias, asignar EPP, marcar como perdido) las hacen el **almacenero** y el **residente**. El admin existe para configurar y supervisar.

Pero a veces el residente no está disponible, o hay una emergencia, y el admin tiene que actuar. En esos casos el sistema te permite hacerlo, **pero te exige justificarlo**:

- Aparece un **banner ámbar** en el formulario.
- Hay un campo obligatorio **"Motivo de excepción"** que debe tener al menos 5 caracteres.
- Lo que escribas queda guardado en el registro permanentemente.

Esto aplica a estas acciones cuando las haces tú como admin:

- Crear préstamo de herramienta
- Devolver préstamo
- Marcar préstamo como perdido
- Recibir transferencia
- Rechazar transferencia
- Cancelar transferencia
- Asignar EPP
- Reponer EPP

**Recomendación:** escribe motivos claros para que mañana entiendas qué pasó. Ejemplos buenos:

- _"Residente Pedro de baja médica, prestar amoladora de urgencia para terminar techado"_
- _"Recibo transferencia porque residente sale recién mañana de viaje"_

Ejemplos malos: _"asd"_, _"prueba"_, _"ok"_.

---

## 5. Reportes

Ve a **Análisis → Reportes**. Hay 4:

### Consumo por obra

Cuánto de cada ítem se ha consumido en cada obra (en un rango de fechas). Útil para:

- Saber qué obra está usando más cemento
- Comparar consumo con presupuesto del proyecto
- Detectar consumos anormales

### Top items

Ranking de ítems más movidos por cantidad. Útil para identificar los productos clave de la operación.

### Stock valorizado

Cuánto vale tu inventario actual. Toma el último costo unitario conocido de cada ítem y lo multiplica por la cantidad en stock. Total al pie. Útil para reportes financieros.

### Movimientos

Resumen de movimientos por día o por mes (entradas, salidas, ajustes). Útil para ver la actividad general del almacén en el tiempo.

Todos los reportes filtran por rango de fechas. La mayoría también por almacén u obra.

---

## 6. Alertas

Ve a **Análisis → Alertas**.

El sistema genera alertas automáticamente para:

- **Stock bajo mínimo**: cuando un ítem cae bajo el mínimo configurado.
- **Stock crítico**: cuando llega a cero.
- **Discrepancia en transferencia**: cuando el residente reporta una diferencia entre lo enviado y lo recibido.

Como admin puedes:

- Ver todas las alertas (de todos los almacenes y obras).
- Marcarlas como leídas.
- Filtrar por tipo o por almacén.

---

## 7. Inventarios físicos

Aunque típicamente los hace el almacenero o residente, como admin puedes lanzar inventarios físicos en cualquier almacén.

Ve a **Almacén Principal → tab Inventarios** (o desde la ficha del almacén que quieras contar) → **Nuevo inventario**.

El sistema toma una foto del stock actual ("expectedQty") y abre un inventario en estado `EN_PROGRESO`. Vas contando físicamente cada ítem y registras la cantidad real. Al final, **cerrar** genera un único movimiento `AJUSTE` con todas las diferencias.

Si no quieres cerrarlo, puedes **cancelar** y descartar el conteo sin tocar el stock.

---

## 8. Importar ítems desde Excel

Si tienes un catálogo grande, no lo crees uno por uno. Ve a **Almacén Principal → tab Inventario → Importar Excel**.

El sistema descarga una **plantilla**. La rellenas con tus ítems (nombre, categoría, unidad, mínimo, máximo, **stock inicial**, etc.) y la subes.

- Si pones **stock inicial** y **proveedor**, el sistema crea automáticamente una **ENTRADA tipo COMPRA** por cada ítem.
- Si pones stock inicial **sin** proveedor, usa el "Proveedor eventual" como fallback.
- Si dejas stock inicial vacío o en 0, el ítem se crea sin stock (lo cargas después con una entrada normal).

Acepta los nombres viejos de tipo (`MATERIAL`, `HERRAMIENTA`, `EPP`, etc.) además de los actuales (`CONSUMO`, `PRESTAMO`, `ASIGNACION`), por compatibilidad con plantillas anteriores.

---

## 9. Cambiar tu contraseña

Click en tu **avatar** (esquina superior derecha) → **Cambiar contraseña**. O ve directo a `/cambiar-password`.

---

## Acciones que típicamente NO haces como admin

(las hace el almacenero o residente, tú solo si hay excepción)

- Registrar entradas de compras → **Almacenero**
- Crear transferencias del Principal → **Almacenero**
- Crear préstamos → **Residente**
- Devolver préstamos → **Residente**
- Recibir transferencias → **Residente**
- Asignar EPP → **Residente**

Si las haces tú, el sistema te exigirá motivo de excepción (ver sección 4).

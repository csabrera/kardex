# Conceptos básicos

Antes de usar el sistema, conviene entender 5 conceptos clave: **obra, almacén, ítem, movimiento y transferencia**. Todo lo demás se construye sobre ellos.

---

## 1. Obra

Una **obra** es un proyecto de construcción de la empresa: un edificio, una vivienda, una remodelación, etc. Cada obra tiene:

- Un **código** auto-generado (ej. `OBR-A4X6K2`).
- Un **nombre** descriptivo (ej. "Edificio Plaza San Isidro").
- Un **cliente** opcional (a quién pertenece la obra).
- Un **responsable** — el usuario residente que está a cargo.
- Un **estado**: Planificación, Activa, Suspendida o Finalizada.
- **Fechas** de inicio y fin previstas.

Cuando creas una obra, el sistema **automáticamente le crea un almacén propio** (tipo OBRA) con código `ALM-{código de la obra}`. No tienes que crearlo a mano.

---

## 2. Almacén

Un **almacén** es un lugar físico donde se guardan ítems. Hay 2 tipos:

### Almacén Principal (CENTRAL)

- **Solo hay UNO** en todo el sistema (código fijo: `ALM-PRINCIPAL`).
- Es el punto de entrada de todas las **compras**. Cualquier material que se compra entra aquí primero.
- Desde aquí se hacen las **transferencias** a las obras.
- No se pueden hacer **préstamos de herramientas** desde el Principal (los préstamos siempre son desde almacenes de obra).

### Almacenes de OBRA

- Uno por cada obra activa.
- Reciben materiales por **transferencia** desde el Principal.
- Desde aquí se hacen los **préstamos** a obreros y las **asignaciones de EPP**.
- También se pueden registrar **salidas directas** (consumo del material en la obra).

---

## 3. Ítem

Un **ítem** es cualquier cosa que se almacena. El sistema clasifica los ítems en **3 tipos** según su comportamiento operativo:

### CONSUMO

_Materiales y repuestos que salen del almacén y no vuelven._

Ejemplos: cemento, ladrillos, fierros, clavos, repuestos de maquinaria.

Flujo: entran por compra al Principal, se transfieren a la obra, se consumen (salida directa) en la obra.

### PRÉSTAMO

_Herramientas y equipos que se prestan a un obrero y deben volver._

Ejemplos: taladros, amoladoras, escaleras, andamios, equipos eléctricos.

Flujo: entran al Principal, se transfieren a una obra, allí se prestan a un obrero asignado a una estación de trabajo. El préstamo queda **registrado** pero no sale del stock — la herramienta sigue siendo del almacén, solo está en uso. Cuando el obrero la devuelve, se registra la condición (Bueno, Regular o Dañado).

**Importante:** la columna "Stock" de un almacén con herramientas muestra dos números: **Disponibles / Total**. Por ejemplo "1 / 3" significa que hay 3 taladros en total, de los cuales 1 está libre para prestar y 2 están actualmente en préstamo activo.

### ASIGNACIÓN (EPP)

_Equipos de protección personal que se entregan individualmente a cada trabajador._

Ejemplos: cascos, guantes, lentes, arneses, mamelucos.

Flujo: entran al Principal, se transfieren a la obra, se asignan al obrero. Cada asignación **descuenta del stock** (a diferencia del préstamo, el EPP no vuelve). Si se daña, el obrero pide una **reposición**.

---

## 4. Movimiento

Un **movimiento** es cualquier cambio de stock que el sistema registra con un código identificador. Hay 3 tipos:

| Tipo        | Cuándo ocurre                                     | Ejemplo de código |
| ----------- | ------------------------------------------------- | ----------------- |
| **ENTRADA** | Una compra que llega, una devolución de obra      | `ENT-00001`       |
| **SALIDA**  | Consumo en obra, baja por daño, asignación de EPP | `SAL-00001`       |
| **AJUSTE**  | Conteo físico, corrección por error               | `AJU-00001`       |

Cada movimiento queda permanentemente registrado: quién lo hizo, cuándo, en qué almacén, con qué motivo (compra, consumo, ajuste, devolución, baja, pérdida de préstamo, etc.) y, si aplica, con qué proveedor o documento.

---

## 5. Transferencia

Una **transferencia** mueve ítems de un almacén a otro (típicamente Principal → Obra). Tiene 2 pasos:

1. **Crear**: el almacenero o admin selecciona los ítems y la cantidad. **El stock sale del almacén origen inmediatamente**. La transferencia queda en estado `EN_TRÁNSITO`.
2. **Recibir**: el residente de la obra destino confirma que llegó (en la cantidad correcta o reportando discrepancias). **El stock entra al almacén destino solo en este momento**.

Si el residente rechaza la transferencia (por cantidad incorrecta, materiales dañados, etc.), el stock vuelve automáticamente al almacén origen.

Estados posibles de una transferencia:

- `EN_TRÁNSITO`: ya salió del origen, falta confirmar recepción
- `RECIBIDA`: completada, el stock entró al destino
- `RECHAZADA`: el residente la rechazó, el stock volvió al origen
- `CANCELADA`: el almacenero la canceló antes de ser recibida

---

## Roles del sistema

El sistema tiene **3 roles**. Cada uno ve un menú lateral distinto y tiene permisos distintos.

### ADMIN — Administrador

- **Acceso total**. Ve todo, puede hacer todo.
- Gestiona **usuarios y roles**.
- Configura **catálogos del sistema** (categorías, unidades, especialidades).
- Revisa **auditoría** (historial completo de quién hizo qué).
- Para acciones operativas (crear préstamos, recibir transferencias, marcar perdido), el sistema le pide un **motivo de excepción** porque normalmente esas acciones las hace el almacenero o residente.

### ALMACENERO — Operación diaria del almacén central

- Registra **compras** (entradas al Principal).
- Crea **ítems** del catálogo.
- Hace **transferencias** del Principal a obras.
- Gestiona **proveedores**.
- Vigila **alertas** de stock bajo.
- No tiene acceso a configuración del sistema ni a auditoría.

### RESIDENTE — Responsable de una obra

- Solo ve la sección **"Mi Obra"**.
- **Recibe** las transferencias que llegan a su(s) obra(s).
- **Presta herramientas** a obreros en estaciones de trabajo.
- **Asigna EPP** a obreros.
- Hace **inventarios físicos** y **ajustes** del almacén de su obra.
- Solo ve la información de las obras de las que es responsable.

---

## Empleados (Workers) ≠ Usuarios

**Importante:** el sistema distingue entre 2 tipos de "personas":

- **Usuarios**: las personas que **inician sesión** (ADMIN, ALMACENERO, RESIDENTE). Tienen documento, contraseña, rol.
- **Empleados (Workers)**: los **obreros de campo** (albañiles, electricistas, etc.). **NO inician sesión**. Solo aparecen como destinatarios de préstamos y asignaciones de EPP.

Cuando un residente presta un taladro, lo presta a un **Worker**, no a un Usuario. El Worker tiene DNI, nombre, especialidad, obra asignada, pero nunca abre el sistema.

---

## Estación de trabajo

Cada obra se divide en **estaciones de trabajo** (frentes, sectores, áreas). Por ejemplo: "Frente Norte", "Sector A", "Encofrado piso 3".

Los **préstamos** se registran asociados a una estación de trabajo, así sabes no solo a quién prestaste la herramienta sino también dónde se está usando.

---

## Diagrama del flujo completo

```
              COMPRAS
                 │
                 ▼ ENTRADA (solo aquí)
                 │
        ┌────────────────────┐
        │  ALMACÉN PRINCIPAL │   un solo almacén central
        │   (ALM-PRINCIPAL)  │
        └─────────┬──────────┘
                  │
                  ▼ TRANSFERENCIA (2 pasos: crear → recibir)
                  │
        ┌────────────────────┐
        │  Almacén de OBRA   │   un almacén por cada obra activa
        │  (ALM-{código})    │
        └─────────┬──────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
   PRÉSTAMO  ASIGNACIÓN   SALIDA
   (vuelve)   EPP         directa
              (no         (consumo
              vuelve)     en obra)
       │          │          │
       ▼          ▼          ▼
              EMPLEADO en
              ESTACIÓN DE
              TRABAJO
```

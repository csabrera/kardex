# Manual de Usuario — Kardex

Sistema de gestión de almacenes para empresa constructora.

---

## Índice

1. [Quick Start — primeros pasos en 5 minutos](#quick-start)
2. [Conceptos básicos](01-conceptos.md) — qué es una obra, un almacén, los tipos de ítem, los roles
3. [Guía para ADMIN](02-admin.md) — administrador del sistema (acceso total)
4. [Guía para ALMACENERO](03-almacenero.md) — operación diaria del almacén
5. [Guía para RESIDENTE](04-residente.md) — residente de obra (recibe transferencias, presta herramientas)
6. [Preguntas frecuentes y solución de problemas](05-faq.md)

---

## ¿Qué hace el sistema?

Kardex te permite controlar **qué tienes, dónde está y quién lo tiene** en una empresa constructora con varias obras simultáneas:

- **Materiales y repuestos** que entran por compra y se consumen en obra
- **Herramientas y equipos** que se prestan a obreros y deben volver
- **EPP** (cascos, guantes, arneses) que se entregan individualmente a cada trabajador

Todo queda registrado: quién recibió qué, cuándo, en qué obra, en qué condiciones, con qué documento.

---

## Quick Start

### Paso 1 — Iniciar sesión

1. Abre el navegador en la URL que te dio tu administrador (ej. `https://kardex-web-production.up.railway.app`).
2. Ingresa tu **número de documento** (DNI) y tu **contraseña**.
3. Si es la primera vez, el sistema te pedirá cambiar la contraseña por una que solo tú conozcas.

### Paso 2 — Reconoce tu rol

En el menú lateral izquierdo verás opciones distintas según tu rol:

- **ADMIN**: ves todo (Obras, Empleados, Almacenes, Proveedores, Reportes, Configuración, Usuarios, Auditoría).
- **ALMACENERO**: ves la operación diaria (Almacén Principal, Obras, Empleados, Almacenes, Proveedores, Reportes, Alertas).
- **RESIDENTE**: ves solo "Mi Obra".

### Paso 3 — Las 5 acciones más comunes

| Quiero...                                       | Ve a...                                                           | Quién             |
| ----------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| Ver el inventario del almacén central           | Almacén Principal → tab **Inventario**                            | ADMIN, ALMACENERO |
| Registrar una compra que entró al almacén       | Almacén Principal → ítem → **Acciones → Registrar entrada**       | ADMIN, ALMACENERO |
| Enviar materiales a una obra                    | Almacén Principal → ítem → **Acciones → Transferir a obra**       | ADMIN, ALMACENERO |
| Confirmar que llegaron los materiales a mi obra | Mi Obra → tab **Almacén** → transferencia pendiente → **Recibir** | RESIDENTE         |
| Prestar una herramienta a un trabajador         | Mi Obra → tab **Préstamos** → **Nuevo préstamo**                  | RESIDENTE         |

### Paso 4 — Dónde encontrar más

- Si no entiendes los términos: lee [Conceptos básicos](01-conceptos.md).
- Si tienes un rol específico: lee la guía de tu rol ([ADMIN](02-admin.md), [ALMACENERO](03-almacenero.md), [RESIDENTE](04-residente.md)).
- Si algo no funciona como esperas: revisa [FAQ](05-faq.md).

---

## Atajos útiles

| Atajo                     | Acción                                               |
| ------------------------- | ---------------------------------------------------- |
| **Ctrl+B** (Cmd+B en Mac) | Ocultar / mostrar el menú lateral                    |
| **Ctrl+K** (Cmd+K en Mac) | Buscar rápido cualquier ítem, obra, almacén o página |
| **Esc**                   | Cerrar la búsqueda rápida o el menú                  |

import { apiGet, apiPost, unwrap } from './api.helper';
import { loginViaApi } from './auth.helper';

/**
 * Escenario de prueba: crea datos únicos vía API para no chocar con otros runs
 * ni con el dataset de desarrollo. Requiere un admin ya autenticado.
 */

export interface ScenarioOptions {
  /** Prefix para los códigos/nombres generados (default: un timestamp). */
  prefix?: string;
}

export interface ScenarioResult {
  adminToken: string;
  obraId: string;
  obraName: string;
  centralWarehouseId: string;
  obraWarehouseId: string;
  obraWarehouseName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  residenteToken: string;
  residenteUser: {
    id: string;
    documentNumber: string;
    password: string;
  };
}

/**
 * Loguea como el admin configurado en E2E_ADMIN_*.
 */
export async function loginAsAdmin() {
  const documentType = (process.env.E2E_ADMIN_DOC_TYPE ?? 'DNI') as
    | 'DNI'
    | 'CE'
    | 'PASAPORTE';
  const documentNumber = process.env.E2E_ADMIN_DOC_NUMBER ?? '12345678';
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'CambiarEn_PrimerLogin_2026';
  return loginViaApi({ documentType, documentNumber, password });
}

/**
 * Crea un escenario completo para pruebas de transferencia:
 * - Usuario RESIDENTE nuevo
 * - Obra con responsable = el residente
 * - Almacén de OBRA
 * - Ítem en el catálogo
 * - Stock inicial en el Almacén Principal vía ENTRADA
 *
 * Todo con códigos/nombres únicos al timestamp.
 */
export async function createTransferScenario(
  options: ScenarioOptions = {},
): Promise<ScenarioResult> {
  const suffix = options.prefix ?? `E2E${Date.now().toString(36).toUpperCase()}`;

  const { accessToken: adminToken } = await loginAsAdmin();

  // Obtener el almacén Principal (auto-sembrado).
  const warehousesRes = await apiGet<{
    data: { items: Array<{ id: string; code: string; type: string }> };
  }>('/warehouses?type=CENTRAL&pageSize=5', { token: adminToken });
  const central = warehousesRes.data.data.items.find((w) => w.code === 'ALM-PRINCIPAL');
  if (!central) throw new Error('No se encontró el Almacén Principal (ALM-PRINCIPAL)');

  // Categoría y unidad (tomar la primera disponible — están sembradas).
  const categoriesRes = await apiGet<{ data: { items: Array<{ id: string }> } }>(
    '/categories?pageSize=1',
    { token: adminToken },
  );
  const categoryId = categoriesRes.data.data.items[0]?.id;
  if (!categoryId) throw new Error('Sin categorías sembradas');

  const unitsRes = await apiGet<{ data: { items: Array<{ id: string }> } }>(
    '/units?pageSize=5',
    { token: adminToken },
  );
  const unitId = unitsRes.data.data.items[0]?.id;
  if (!unitId) throw new Error('Sin unidades sembradas');

  // Rol RESIDENTE (buscamos su id).
  const rolesRes = await apiGet<{ data: Array<{ id: string; name: string }> }>(
    '/users/roles',
    { token: adminToken },
  );
  const residenteRole = rolesRes.data.data.find((r) => r.name === 'RESIDENTE');
  if (!residenteRole) throw new Error('Rol RESIDENTE no encontrado');

  // 1. Crear usuario RESIDENTE (con contraseña temporal — se cambiará abajo)
  const residenteDni = generateUniqueDni();
  const tempPassword = 'TempPass123!';
  const residentePassword = 'ResidentePass456!';
  const createUserRes = await apiPost<{ data: { id: string } }>(
    '/users',
    {
      documentType: 'DNI',
      documentNumber: residenteDni,
      firstName: `Residente${suffix}`,
      lastName: 'E2E',
      password: tempPassword,
      roleId: residenteRole.id,
    },
    { token: adminToken },
  );
  if (createUserRes.status !== 200 && createUserRes.status !== 201) {
    throw new Error(
      `No se pudo crear residente: HTTP ${createUserRes.status} — ${JSON.stringify(createUserRes.data)}`,
    );
  }
  const residenteUser = unwrap<{ id: string }>(createUserRes);

  // Usuario recién creado tiene mustChangePassword=true. Cambiamos la pass
  // vía el endpoint del backend para dejarlo listo para login normal.
  const firstLogin = await loginViaApi({
    documentType: 'DNI',
    documentNumber: residenteDni,
    password: tempPassword,
  });
  const changePassRes = await apiPost(
    '/auth/change-password',
    {
      oldPassword: tempPassword,
      newPassword: residentePassword,
      confirmPassword: residentePassword,
    },
    { token: firstLogin.accessToken },
  );
  if (changePassRes.status !== 204 && changePassRes.status !== 200) {
    throw new Error(
      `Change-password falló: HTTP ${changePassRes.status} — ${JSON.stringify(changePassRes.data)}`,
    );
  }

  // 2. Crear obra con el residente como responsable
  const obraRes = await apiPost<{ data: { id: string; code: string } }>(
    '/obras',
    {
      name: `Obra ${suffix}`,
      address: 'Av. Test E2E 123',
      client: 'Cliente E2E',
      status: 'ACTIVA',
      responsibleUserId: residenteUser.id,
    },
    { token: adminToken },
  );
  const obra = unwrap<{ id: string; code: string }>(obraRes);

  // 3. Crear almacén de OBRA
  const obraWarehouseName = `Almacén ${suffix}`;
  const whRes = await apiPost<{ data: { id: string } }>(
    '/warehouses',
    {
      name: obraWarehouseName,
      type: 'OBRA',
      obraId: obra.id,
    },
    { token: adminToken },
  );
  const obraWarehouse = unwrap<{ id: string }>(whRes);

  // 4. Crear ítem
  const itemRes = await apiPost<{
    data: { id: string; code: string; name: string };
  }>(
    '/items',
    {
      name: `Cemento E2E ${suffix}`,
      description: 'Ítem para pruebas E2E',
      type: 'MATERIAL',
      categoryId,
      unitId,
      minStock: 10,
    },
    { token: adminToken },
  );
  const item = unwrap<{ id: string; code: string; name: string }>(itemRes);

  // 5. ENTRADA al Principal (stock inicial 100)
  // Buscar el proveedor eventual sembrado (PRV-EVENTUAL) — required cuando source=COMPRA
  const suppliersRes = await apiGet<{
    data: { items: Array<{ id: string; code: string }> };
  }>('/suppliers?pageSize=20', { token: adminToken });
  const eventualSupplier = suppliersRes.data.data.items.find(
    (s) => s.code === 'PRV-EVENTUAL',
  );
  if (!eventualSupplier) {
    throw new Error(
      'No se encontró el proveedor PRV-EVENTUAL — verifique que el seed corrió',
    );
  }

  const entradaRes = await apiPost(
    '/movements',
    {
      type: 'ENTRADA',
      source: 'COMPRA',
      warehouseId: central.id,
      supplierId: eventualSupplier.id,
      notes: `ENTRADA inicial ${suffix}`,
      items: [{ itemId: item.id, quantity: 100, unitCost: 25 }],
    },
    { token: adminToken },
  );
  if (entradaRes.status !== 200 && entradaRes.status !== 201) {
    throw new Error(
      `ENTRADA falló: HTTP ${entradaRes.status} — ${JSON.stringify(entradaRes.data)}`,
    );
  }

  // 6. Login como residente para tener su token
  const residenteLogin = await loginViaApi({
    documentType: 'DNI',
    documentNumber: residenteDni,
    password: residentePassword,
  });

  return {
    adminToken,
    obraId: obra.id,
    obraName: `Obra ${suffix}`,
    centralWarehouseId: central.id,
    obraWarehouseId: obraWarehouse.id,
    obraWarehouseName,
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    residenteToken: residenteLogin.accessToken,
    residenteUser: {
      id: residenteUser.id,
      documentNumber: residenteDni,
      password: residentePassword,
    },
  };
}

/** Genera un DNI 8 dígitos único al milisegundo para evitar duplicados en paralelo. */
function generateUniqueDni(): string {
  const base = Date.now() % 100_000_000;
  const rand = Math.floor(Math.random() * 100);
  return String((base * 100 + rand) % 100_000_000).padStart(8, '0');
}

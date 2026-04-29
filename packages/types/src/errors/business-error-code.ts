export enum BusinessErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_DOCUMENT_FORMAT = 'INVALID_DOCUMENT_FORMAT',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  MUST_CHANGE_PASSWORD = 'MUST_CHANGE_PASSWORD',
  SETUP_ALREADY_COMPLETED = 'SETUP_ALREADY_COMPLETED',
  SETUP_NOT_COMPLETED = 'SETUP_NOT_COMPLETED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  WAREHOUSE_SCOPE_VIOLATION = 'WAREHOUSE_SCOPE_VIOLATION',

  // User errors
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  DOCUMENT_ALREADY_REGISTERED = 'DOCUMENT_ALREADY_REGISTERED',

  // Stock & Movement errors
  STOCK_INSUFFICIENT = 'STOCK_INSUFFICIENT',
  STOCK_CONFLICT = 'STOCK_CONFLICT',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  ITEM_ALREADY_EXISTS = 'ITEM_ALREADY_EXISTS',
  WAREHOUSE_NOT_FOUND = 'WAREHOUSE_NOT_FOUND',
  NEGATIVE_QUANTITY_NOT_ALLOWED = 'NEGATIVE_QUANTITY_NOT_ALLOWED',

  // Transfer errors
  TRANSFER_NOT_FOUND = 'TRANSFER_NOT_FOUND',
  TRANSFER_INVALID_STATE = 'TRANSFER_INVALID_STATE',
  TRANSFER_SAME_WAREHOUSE = 'TRANSFER_SAME_WAREHOUSE',

  // Requisition errors
  REQUISITION_NOT_FOUND = 'REQUISITION_NOT_FOUND',
  REQUISITION_INVALID_STATE = 'REQUISITION_INVALID_STATE',

  // EPP & Tools
  WORKER_NOT_FOUND = 'WORKER_NOT_FOUND',
  TOOL_LOAN_NOT_FOUND = 'TOOL_LOAN_NOT_FOUND',
  TOOL_ALREADY_LOANED = 'TOOL_ALREADY_LOANED',

  // Import errors
  IMPORT_VALIDATION_FAILED = 'IMPORT_VALIDATION_FAILED',
  IMPORT_DUPLICATE_CODES = 'IMPORT_DUPLICATE_CODES',

  // Export errors
  EXPORT_JOB_NOT_FOUND = 'EXPORT_JOB_NOT_FOUND',
  EXPORT_GENERATION_FAILED = 'EXPORT_GENERATION_FAILED',

  // Generic
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_IN_USE = 'RESOURCE_IN_USE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export const ERROR_MESSAGES: Record<BusinessErrorCode, string> = {
  [BusinessErrorCode.INVALID_CREDENTIALS]: 'Credenciales inválidas',
  [BusinessErrorCode.INVALID_DOCUMENT_FORMAT]: 'Formato de documento inválido',
  [BusinessErrorCode.USER_NOT_FOUND]: 'Usuario no encontrado',
  [BusinessErrorCode.USER_INACTIVE]: 'Usuario inactivo',
  [BusinessErrorCode.MUST_CHANGE_PASSWORD]:
    'Debe cambiar su contraseña antes de continuar',
  [BusinessErrorCode.SETUP_ALREADY_COMPLETED]: 'El setup inicial ya fue completado',
  [BusinessErrorCode.SETUP_NOT_COMPLETED]:
    'El setup inicial del sistema no ha sido completado',
  [BusinessErrorCode.TOKEN_EXPIRED]: 'Token expirado',
  [BusinessErrorCode.TOKEN_INVALID]: 'Token inválido',
  [BusinessErrorCode.REFRESH_TOKEN_EXPIRED]: 'Refresh token expirado',

  [BusinessErrorCode.PERMISSION_DENIED]: 'No tiene permiso para realizar esta acción',
  [BusinessErrorCode.WAREHOUSE_SCOPE_VIOLATION]: 'No tiene acceso a este almacén',

  [BusinessErrorCode.USER_ALREADY_EXISTS]: 'El usuario ya existe',
  [BusinessErrorCode.DOCUMENT_ALREADY_REGISTERED]: 'El documento ya está registrado',

  [BusinessErrorCode.STOCK_INSUFFICIENT]: 'Stock insuficiente',
  [BusinessErrorCode.STOCK_CONFLICT]:
    'El stock fue modificado por otra transacción. Por favor reintente',
  [BusinessErrorCode.ITEM_NOT_FOUND]: 'Ítem no encontrado',
  [BusinessErrorCode.ITEM_ALREADY_EXISTS]: 'El ítem ya existe',
  [BusinessErrorCode.WAREHOUSE_NOT_FOUND]: 'Almacén no encontrado',
  [BusinessErrorCode.NEGATIVE_QUANTITY_NOT_ALLOWED]:
    'No se permiten cantidades negativas',

  [BusinessErrorCode.TRANSFER_NOT_FOUND]: 'Transferencia no encontrada',
  [BusinessErrorCode.TRANSFER_INVALID_STATE]:
    'La transferencia no está en un estado válido para esta acción',
  [BusinessErrorCode.TRANSFER_SAME_WAREHOUSE]:
    'El almacén origen y destino no pueden ser el mismo',

  [BusinessErrorCode.REQUISITION_NOT_FOUND]: 'Requisición no encontrada',
  [BusinessErrorCode.REQUISITION_INVALID_STATE]:
    'La requisición no está en un estado válido para esta acción',

  [BusinessErrorCode.WORKER_NOT_FOUND]: 'Trabajador no encontrado',
  [BusinessErrorCode.TOOL_LOAN_NOT_FOUND]: 'Préstamo de herramienta no encontrado',
  [BusinessErrorCode.TOOL_ALREADY_LOANED]: 'La herramienta ya está prestada',

  [BusinessErrorCode.IMPORT_VALIDATION_FAILED]: 'La validación de importación falló',
  [BusinessErrorCode.IMPORT_DUPLICATE_CODES]: 'El archivo contiene códigos duplicados',

  [BusinessErrorCode.EXPORT_JOB_NOT_FOUND]: 'Job de exportación no encontrado',
  [BusinessErrorCode.EXPORT_GENERATION_FAILED]:
    'Error al generar el archivo de exportación',

  [BusinessErrorCode.INVALID_INPUT]: 'Datos de entrada inválidos',
  [BusinessErrorCode.NOT_FOUND]: 'Recurso no encontrado',
  [BusinessErrorCode.DUPLICATE_RESOURCE]: 'Ya existe un recurso con ese identificador',
  [BusinessErrorCode.RESOURCE_IN_USE]:
    'El recurso no puede eliminarse porque está en uso',
  [BusinessErrorCode.INTERNAL_SERVER_ERROR]: 'Error interno del servidor',
  [BusinessErrorCode.RATE_LIMIT_EXCEEDED]:
    'Demasiadas peticiones. Por favor intente más tarde',
};

export function getErrorMessage(code: BusinessErrorCode): string {
  return ERROR_MESSAGES[code] ?? 'Error desconocido';
}

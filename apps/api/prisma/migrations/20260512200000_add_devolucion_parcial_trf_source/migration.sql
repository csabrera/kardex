-- Modelo C: cuando una TRF se recibe parcial, las unidades no recibidas
-- vuelven contablemente al origen vía ENTRADA con este source. Hace visible
-- el saldo pendiente en el almacén origen (responsabilidad contable hasta que
-- se cierre como faltante o se reciba en una segunda remesa).

ALTER TYPE "MovementSource" ADD VALUE 'DEVOLUCION_PARCIAL_TRF';

# ADR-0004: Async Queue para Generación de PDFs (BullMQ)

## Status
✅ Accepted

## Context
Exportación de reportes a PDF usando Puppeteer. Puppeteer toma 2-5 segundos por PDF (renderizar HTML → screenshot → guardar). Si lo hacemos síncrono en request:
- Usuario espera 5 seg (timeout posible).
- Bloquea el request.

## Decision
Usar **BullMQ** (job queue sobre Redis) para generar PDFs de forma asíncrona.

**Flujo:**
```typescript
// Request API (síncrono)
@Post('/export/pdf')
async exportPdf(body: ExportPdfDto) {
  const job = await pdfQueue.add('generate', body);
  return { jobId: job.id, status: 'PENDING' };
}

// Cliente: polling
GET /export/pdf/:jobId
// Responde: { status: 'COMPLETED', downloadUrl: '...' }

// Worker (async)
pdfQueue.process(async (job) => {
  const pdf = await puppeteerService.generatePdf(job.data);
  return { url: pdf.url };
});
```

## Consequences

✅ **Positivos:**
- No bloquea UI (user experience mejor).
- Reintenta automático si Puppeteer falla.
- Escalable (múltiples workers).
- Historial de jobs en Redis.

⚠️ **Trade-offs:**
- Complejidad: polling en frontend, worker en backend.
- Dependencia: Redis + BullMQ.
- Storage: PDFs en /tmp o S3 (futuro).

## Alternatives Considered

1. **Síncrono (sin queue):**
   - ✅ Simple.
   - ❌ UX pobre (esperar 5 seg).
   - ❌ Timeouts en Railway.

2. **WebSocket para notificación:**
   - Mejor que polling, pero más complejo.

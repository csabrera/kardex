import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import * as path from 'path';
import * as fs from 'fs/promises';
import puppeteer from 'puppeteer';

import {
  ExportService,
  EXPORT_JOB,
  EXPORT_QUEUE,
  ExportJobData,
  TMP_DIR,
} from './export.service';

@Processor(EXPORT_QUEUE)
export class PdfProcessor {
  constructor(private readonly exportService: ExportService) {}

  @Process(EXPORT_JOB)
  async handleGeneratePdf(job: Job<ExportJobData>) {
    await job.progress(10);

    const { reportType, filters } = job.data;

    const html = await this.exportService.buildHtml(reportType, filters);
    await job.progress(40);

    await fs.mkdir(TMP_DIR, { recursive: true });
    const fileName = `${reportType}-${job.id}-${Date.now()}.pdf`;
    const filePath = path.join(TMP_DIR, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      await job.progress(60);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: reportType === 'stock' || reportType === 'movements',
        margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
        printBackground: true,
      });

      await job.progress(90);
    } finally {
      await browser.close();
    }

    await job.progress(100);
    return { filePath };
  }
}

'use client';

import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';

interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

interface FileUploadProps {
  value?: { filename: string; originalName: string } | null;
  onChange: (value: { filename: string; originalName: string } | null) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({ value, onChange, disabled, className }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera el límite de 10 MB');
      return;
    }
    const allowed = /^(image\/.+|application\/pdf)$/;
    if (!allowed.test(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, etc.) y PDF');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<{ data: UploadResult }>('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { filename, originalName } = res.data.data;
      onChange({ filename, originalName });
    } catch {
      toast.error('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-accent" />
          <span className="flex-1 truncate">{value.originalName}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Quitar archivo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors',
            uploading || disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-accent hover:bg-accent/5',
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            {uploading ? 'Subiendo...' : 'Arrastra aquí o haz clic para seleccionar'}
          </span>
          <span className="text-[11px] text-muted-foreground/70">
            PDF, JPG, PNG · máx. 10 MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

/** Botón para ver un archivo ya subido */
export function DocumentViewButton({
  filename,
  originalName,
}: {
  filename: string;
  originalName: string;
}) {
  // /api/* routes go through Next.js proxy → NestJS in both dev and prod
  const url = `/api/uploads/${filename}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-sm hover:bg-muted/70 transition-colors"
    >
      <FileText className="h-3.5 w-3.5 text-accent" />
      <span className="truncate max-w-[200px]">{originalName}</span>
    </a>
  );
}

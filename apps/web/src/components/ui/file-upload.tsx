'use client';

import { FileText, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/use-auth-store';

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

/**
 * Sube un archivo vía fetch nativo a /api/attachments/upload.
 * Axios no sirve para multipart/form-data (no añade boundary correcto).
 */
async function uploadFile(file: File, token: string | null): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/attachments/upload', {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Error ${res.status}`);
  }

  const json = await res.json();
  return json.data as UploadedFile;
}

function FileIcon({ mimetype }: { mimetype: string }) {
  if (mimetype.startsWith('image/')) {
    return <ImageIcon className="h-4 w-4 shrink-0 text-accent" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-accent" />;
}

interface MultiFileUploadProps {
  value: UploadedFile[];
  onChange: (next: UploadedFile[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
  /** Texto contextual del label (ej. "Guía y boleta de la compra"). */
  label?: string;
}

/**
 * Subida múltiple de archivos. Tope por defecto: 5. Cada archivo se sube al
 * elegirlo (POST inmediato) y se acumula en `value`. Quitar de la lista solo
 * borra localmente — el archivo en disco queda huérfano hasta cron cleanup.
 */
export function MultiFileUpload({
  value,
  onChange,
  max = 5,
  disabled,
  className,
  label,
}: MultiFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.accessToken);

  const atCapacity = value.length >= max;

  const handleFiles = async (files: FileList | File[]) => {
    const remaining = max - value.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) return;

    setUploading(true);
    const next: UploadedFile[] = [];
    for (const file of list) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" supera el límite de 10 MB`);
        continue;
      }
      try {
        const result = await uploadFile(file, token);
        next.push(result);
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? `${file.name}: ${e.message}` : 'Error al subir archivo',
        );
      }
    }
    if (next.length > 0) {
      onChange([...value, ...next]);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading || atCapacity) return;
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const removeAt = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f, i) => (
            <li
              key={f.filename}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              <FileIcon mimetype={f.mimetype} />
              <span className="flex-1 truncate" title={f.originalName}>
                {f.originalName}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!atCapacity && (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-md border-2 border-dashed p-3 text-center text-sm transition-colors',
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
            {uploading
              ? 'Subiendo...'
              : (label ?? 'Arrastra archivos o haz clic para seleccionar')}
          </span>
          <span className="text-[11px] text-muted-foreground/70">
            PDF, JPG, PNG · máx. 10 MB c/u · {value.length}/{max}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
            }}
          />
        </label>
      )}
      {atCapacity && (
        <p className="text-[11px] text-muted-foreground">
          Límite alcanzado ({max}). Quita un archivo si quieres reemplazarlo.
        </p>
      )}
    </div>
  );
}

/** Botón para ver un archivo ya subido. */
export function DocumentViewButton({
  filename,
  originalName,
  onRemove,
}: {
  filename: string;
  originalName: string;
  onRemove?: () => void;
}) {
  const url = `/api/uploads/${filename}`;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 pl-3 pr-1.5 py-1.5 text-sm hover:bg-muted/70 transition-colors">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5"
      >
        <FileText className="h-3.5 w-3.5 text-accent" />
        <span className="truncate max-w-[200px]">{originalName}</span>
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1.5 rounded-md p-0.5 text-muted-foreground hover:text-destructive hover:bg-muted"
          aria-label="Quitar adjunto"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

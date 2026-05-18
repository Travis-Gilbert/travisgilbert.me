"use client";

/**
 * useFileUpload.
 *
 * Vendored from Index-API/docs/Design Components/File uploader.md.
 * Headless hook that owns drag-drop state, file validation,
 * multi-file mode, error surfacing, and an unstyled `getInputProps()`
 * helper.
 *
 * Currently unused: the Retro Lab port of `/act` wires drag-drop +
 * a hidden `<input type="file">` directly. Hook is preserved here so
 * a future caller (e.g. a Dynamic Island TOC drop zone) can adopt it
 * without re-vendoring.
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type Ref,
} from "react";

export type FileMetadata = {
  name: string;
  size: number;
  type: string;
  url: string;
  id: string;
};

export type FileWithPreview = {
  file: File | FileMetadata;
  id: string;
  preview?: string;
};

export type FileUploadOptions = {
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
  initialFiles?: FileMetadata[];
  onFilesChange?: (files: FileWithPreview[]) => void;
  onFilesAdded?: (added: FileWithPreview[]) => void;
};

export type FileUploadState = {
  files: FileWithPreview[];
  isDragging: boolean;
  errors: string[];
};

export type FileUploadActions = {
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  clearErrors: () => void;
  handleDragEnter: (e: DragEvent<HTMLElement>) => void;
  handleDragLeave: (e: DragEvent<HTMLElement>) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  openFileDialog: () => void;
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>,
  ) => InputHTMLAttributes<HTMLInputElement> & { ref: Ref<HTMLInputElement> };
};

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function useFileUpload(
  options: FileUploadOptions = {},
): [FileUploadState, FileUploadActions] {
  const {
    maxFiles = Infinity,
    maxSize = Infinity,
    accept = "*",
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
  } = options;

  const [state, setState] = useState<FileUploadState>({
    files: initialFiles.map((file) => ({ file, id: file.id, preview: file.url })),
    isDragging: false,
    errors: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File | FileMetadata): string | null => {
      const size = file.size;
      if (size > maxSize) {
        return `File "${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`;
      }
      if (accept !== "*") {
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        const fileType = file instanceof File ? file.type || "" : file.type;
        const ext = `.${file.name.split(".").pop()}`;
        const ok = acceptedTypes.some((type) => {
          if (type.startsWith(".")) return ext.toLowerCase() === type.toLowerCase();
          if (type.endsWith("/*")) return fileType.startsWith(`${type.split("/")[0]}/`);
          return fileType === type;
        });
        if (!ok) return `File "${file.name}" is not an accepted file type.`;
      }
      return null;
    },
    [accept, maxSize],
  );

  const createPreview = useCallback((file: File | FileMetadata): string | undefined => {
    if (file instanceof File) return URL.createObjectURL(file);
    return file.url;
  }, []);

  const generateUniqueId = useCallback((file: File | FileMetadata): string => {
    if (file instanceof File) {
      return `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    return file.id;
  }, []);

  const clearFiles = useCallback(() => {
    setState((prev) => {
      prev.files.forEach((f) => {
        if (f.preview && f.file instanceof File && f.file.type.startsWith("image/")) {
          URL.revokeObjectURL(f.preview);
        }
      });
      if (inputRef.current) inputRef.current.value = "";
      const next = { ...prev, files: [], errors: [] };
      onFilesChange?.(next.files);
      return next;
    });
  }, [onFilesChange]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (!incoming || incoming.length === 0) return;
      const arr = Array.from(incoming);
      const errors: string[] = [];
      setState((prev) => ({ ...prev, errors: [] }));
      if (!multiple) clearFiles();
      if (multiple && maxFiles !== Infinity && state.files.length + arr.length > maxFiles) {
        errors.push(`You can only upload a maximum of ${maxFiles} files.`);
        setState((prev) => ({ ...prev, errors }));
        return;
      }
      const valid: FileWithPreview[] = [];
      arr.forEach((file) => {
        if (multiple) {
          const dup = state.files.some(
            (existing) => existing.file.name === file.name && existing.file.size === file.size,
          );
          if (dup) return;
        }
        const err = validateFile(file);
        if (err) errors.push(err);
        else
          valid.push({ file, id: generateUniqueId(file), preview: createPreview(file) });
      });
      if (valid.length > 0) {
        onFilesAdded?.(valid);
        setState((prev) => {
          const next = !multiple ? valid : [...prev.files, ...valid];
          onFilesChange?.(next);
          return { ...prev, files: next, errors };
        });
      } else if (errors.length > 0) {
        setState((prev) => ({ ...prev, errors }));
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [state.files, maxFiles, multiple, validateFile, createPreview, generateUniqueId, clearFiles, onFilesChange, onFilesAdded],
  );

  const removeFile = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.files.find((f) => f.id === id);
        if (target?.preview && target.file instanceof File && target.file.type.startsWith("image/")) {
          URL.revokeObjectURL(target.preview);
        }
        const next = prev.files.filter((f) => f.id !== id);
        onFilesChange?.(next);
        return { ...prev, files: next, errors: [] };
      });
    },
    [onFilesChange],
  );

  const clearErrors = useCallback(() => setState((prev) => ({ ...prev, errors: [] })), []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState((prev) => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isDragging: false }));
      if (inputRef.current?.disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (!multiple) addFiles([e.dataTransfer.files[0]]);
        else addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, multiple],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    },
    [addFiles],
  );

  const openFileDialog = useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({
      ...props,
      type: "file" as const,
      onChange: handleFileChange,
      accept: props.accept || accept,
      multiple: props.multiple !== undefined ? props.multiple : multiple,
      ref: inputRef,
    }),
    [accept, multiple, handleFileChange],
  );

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
    },
  ];
}

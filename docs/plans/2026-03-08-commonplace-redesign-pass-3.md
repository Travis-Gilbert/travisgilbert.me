# CommonPlace Redesign: Pass 3 (File Ingestion, Info Tab, Tasks, Draggable Tabs)

> Multi-format file ingestion, Info tab with formatted linked content,
> object sub-tasks, draggable drawer tabs.
> Full spec delivered as COMMONPLACE_PASS_3.md artifact.

## Batch Summary

| Batch | What | Key Files |
|---|---|---|
| 14 | Multi-format file ingestion (DOCX, XLSX, PPTX, images, code files) | `file_ingestion.py` (NEW), `pdf_ingestion.py` (EDIT router) |
| 15 | Info tab (formatted linked content, thumbnails, editable Tiptap) | `ObjectDrawer.tsx` (EDIT: add Info tab) |
| 16 | Object tasks (sub-tasks as Components, reorderable, trigger Timeline Nodes) | `ObjectTasks.tsx` (NEW) |
| 17 | Draggable/reorderable drawer tabs (framer-motion Reorder) | `ObjectDrawer.tsx` (EDIT: Reorder tabs) |

## New Backend Dependencies

```
python-docx>=1.1.0
openpyxl>=3.1.0
python-pptx>=0.6.23
Pillow>=10.0.0
pytesseract>=0.3.10
scikit-image>=0.22.0
tree-sitter>=0.22.0
tree-sitter-python>=0.23.0
tree-sitter-javascript>=0.23.0
tree-sitter-typescript>=0.23.0
```

System dependency: `tesseract-ocr` (Aptfile for Railway)

## Key Design Decisions

- Code files (.py, .js, .ts) parsed with tree-sitter for structural extraction
  (imports, functions, classes, docstrings) not just raw text
- Images: Tier 1 (Pillow + pytesseract, always) and Tier 2 (SAM-2, async/optional)
- Info tab renders content inline, NOT as external links
- Tasks stored as Components (component_type: task), completing triggers Timeline Node
- Drawer tabs are draggable with framer-motion, order persists per session

## Implementation Order

Batch 14 > 15 > 16 > 17

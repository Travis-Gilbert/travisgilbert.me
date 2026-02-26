/**
 * Studio JS: interactivity layer for Django Studio.
 *
 * Systems:
 *   1. Markdown Toolbar: formatting buttons for the body textarea
 *   2. Autosave: debounced field-level saves
 *   3. Character counters, Tab indent, Cmd+S
 *   4. Structured list widget: add/remove rows via <template> cloning
 */

(function () {
    'use strict';

    // ─── Utilities ──────────────────────────────────────────────────────

    function getCSRFToken() {
        var el = document.querySelector('[name=csrfmiddlewaretoken]');
        return el ? el.value : '';
    }

    // ─── 1. Markdown Toolbar ────────────────────────────────────────────

    function initToolbar() {
        var toolbar = document.getElementById('editor-toolbar');
        if (!toolbar) return;

        var textarea = document.getElementById('editor-body');
        if (!textarea) return;

        function wrapSelection(before, after) {
            var start = textarea.selectionStart;
            var end = textarea.selectionEnd;
            var selected = textarea.value.substring(start, end);
            var replacement = before + selected + after;
            textarea.setRangeText(replacement, start, end, 'select');
            textarea.focus();
            // Place cursor after the inserted text if nothing was selected
            if (start === end) {
                textarea.selectionStart = start + before.length;
                textarea.selectionEnd = start + before.length;
            }
        }

        function insertAtLineStart(prefix) {
            var start = textarea.selectionStart;
            var val = textarea.value;
            // Find the beginning of the current line
            var lineStart = val.lastIndexOf('\n', start - 1) + 1;
            textarea.setRangeText(prefix, lineStart, lineStart, 'end');
            textarea.focus();
        }

        function insertText(text) {
            var start = textarea.selectionStart;
            textarea.setRangeText(text, start, textarea.selectionEnd, 'end');
            textarea.focus();
        }

        var actions = {
            bold: function () { wrapSelection('**', '**'); },
            italic: function () { wrapSelection('*', '*'); },
            h2: function () { insertAtLineStart('## '); },
            h3: function () { insertAtLineStart('### '); },
            h4: function () { insertAtLineStart('#### '); },
            rule: function () { insertText('\n---\n'); },
            ul: function () { insertAtLineStart('- '); },
            ol: function () { insertAtLineStart('1. '); },
            blockquote: function () { insertAtLineStart('> '); },
            code: function () {
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                var selected = textarea.value.substring(start, end);
                if (selected.indexOf('\n') !== -1) {
                    wrapSelection('\n```\n', '\n```\n');
                } else {
                    wrapSelection('`', '`');
                }
            },
            link: function () {
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                var selected = textarea.value.substring(start, end);
                if (selected) {
                    wrapSelection('[', '](url)');
                } else {
                    insertText('[link text](url)');
                }
            }
        };

        toolbar.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action;
            if (actions[action]) {
                e.preventDefault();
                actions[action]();
            }
        });

        // Keyboard shortcuts: Cmd+B, Cmd+I, Cmd+K
        textarea.addEventListener('keydown', function (e) {
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === 'b') { e.preventDefault(); actions.bold(); }
            else if (e.key === 'i') { e.preventDefault(); actions.italic(); }
            else if (e.key === 'k') { e.preventDefault(); actions.link(); }
        });
    }

    // ─── 2. Autosave ────────────────────────────────────────────────────

    function initAutosave() {
        var form = document.getElementById('content-form');
        if (!form) return;

        // Determine content type and slug from the page URL or data attrs
        var body = document.body;
        var contentType = body.dataset.contentType;
        var slug = body.dataset.slug;
        if (!contentType || !slug) return;

        var indicator = document.getElementById('save-indicator');
        var saveTimer = null;
        var lastSavedValues = {};

        // Capture initial field values
        var trackedFields = form.querySelectorAll(
            'input:not([type=hidden]):not([type=submit]),' +
            'textarea, select'
        );
        trackedFields.forEach(function (field) {
            if (field.name) {
                lastSavedValues[field.name] = field.value;
            }
        });

        function getChangedFields() {
            var changed = {};
            trackedFields.forEach(function (field) {
                if (!field.name) return;
                var current = field.type === 'checkbox' ? field.checked : field.value;
                var last = lastSavedValues[field.name];
                if (current !== last) {
                    changed[field.name] = current;
                }
            });
            return changed;
        }

        function setIndicator(text, color) {
            if (!indicator) return;
            indicator.textContent = text;
            indicator.style.color = color || '';
        }

        function doAutosave() {
            var changed = getChangedFields();
            if (Object.keys(changed).length === 0) return;

            setIndicator('Saving...', 'var(--color-ink-muted)');

            fetch('/auto-save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    content_type: contentType,
                    slug: slug,
                    fields: changed
                })
            })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.saved) {
                    // Update tracked values so we only send diffs next time
                    Object.keys(changed).forEach(function (key) {
                        lastSavedValues[key] = changed[key];
                    });
                    setIndicator('Saved', 'var(--color-success)');
                    setTimeout(function () { setIndicator(''); }, 3000);
                } else {
                    setIndicator('Save failed', 'var(--color-error)');
                }
            })
            .catch(function () {
                setIndicator('Save failed', 'var(--color-error)');
            });
        }

        function scheduleAutosave() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(doAutosave, 3000);
        }

        // Listen on tracked fields
        trackedFields.forEach(function (field) {
            field.addEventListener('input', scheduleAutosave);
            field.addEventListener('change', scheduleAutosave);
        });
    }

    // ─── 3. Character Counters ──────────────────────────────────────────

    function initCharCounters() {
        document.querySelectorAll('.field-count').forEach(function (counter) {
            var max = parseInt(counter.dataset.max, 10);
            var fieldId = counter.dataset.field;
            var field = document.getElementById(fieldId);
            if (!field) return;

            function update() {
                var len = field.value.length;
                counter.textContent = len + ' / ' + max;
                counter.style.color = len > max ? 'var(--color-error)' : '';
            }

            field.addEventListener('input', update);
            update();
        });
    }

    // ─── 4. Tab Key in Textarea ─────────────────────────────────────────

    function initTabIndent() {
        var body = document.getElementById('editor-body');
        if (!body || body.tagName !== 'TEXTAREA') return;

        body.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });
    }

    // ─── 5. Cmd/Ctrl+S to Save ──────────────────────────────────────────

    function initSaveShortcut() {
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                var form = document.getElementById('content-form');
                if (form) form.submit();
            }
        });
    }

    // ─── 6. Structured List Widget: add/remove rows via <template> ─────

    function initStructuredLists() {
        // Each StructuredListWidget container has:
        //   data-field="<field_name>"  data-schema-count="<N>"
        // Inside: a rows div (<id>-rows), a <template> (<id>-template),
        //   and an add button with data-field="<field_name>"
        // Each row has data-index="<N>" and a remove button (last <button>)

        document.querySelectorAll('[data-field][data-schema-count]').forEach(function (container) {
            var fieldName = container.dataset.field;
            var rowsDiv = container.querySelector('[id$="-rows"]');
            if (!rowsDiv) return;

            var templateEl = container.querySelector('template');
            if (!templateEl) return;

            function reindex() {
                var rows = rowsDiv.children;
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    row.dataset.index = i;
                    var inputs = row.querySelectorAll('input, textarea, select');
                    for (var j = 0; j < inputs.length; j++) {
                        var input = inputs[j];
                        // Name format: fieldName__INDEX__subfield
                        var parts = input.name.split('__');
                        if (parts.length === 3) {
                            input.name = parts[0] + '__' + i + '__' + parts[2];
                        }
                    }
                }
            }

            // Add row button: button with data-field matching this container
            var addBtn = container.querySelector('button[data-field="' + fieldName + '"]');
            if (addBtn) {
                addBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var idx = rowsDiv.children.length;
                    var clone = templateEl.content.cloneNode(true);
                    // Replace __INDEX__ placeholder in cloned inputs
                    var inputs = clone.querySelectorAll('input, textarea, select');
                    for (var i = 0; i < inputs.length; i++) {
                        inputs[i].name = inputs[i].name.replace('__INDEX__', '__' + idx + '__').replace('__INDEX__', idx);
                    }
                    var rowEl = clone.firstElementChild;
                    if (rowEl) rowEl.dataset.index = idx;
                    rowsDiv.appendChild(clone);
                    // Bind remove on the new row
                    bindRemoveButtons(rowsDiv);
                });
            }

            function bindRemoveButtons(parent) {
                parent.querySelectorAll('[data-index] button[title="Remove"]').forEach(function (btn) {
                    // Avoid double-binding by checking a flag
                    if (btn._slBound) return;
                    btn._slBound = true;
                    btn.addEventListener('click', function () {
                        var row = btn.closest('[data-index]');
                        if (row) row.remove();
                        reindex();
                    });
                });
            }

            // Bind remove buttons on existing rows
            bindRemoveButtons(rowsDiv);
        });
    }

    // ─── Init ───────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        initToolbar();
        initAutosave();
        initCharCounters();
        initTabIndent();
        initSaveShortcut();
        initStructuredLists();
    });
})();

/**
 * Studio JS: minimal interactivity layer.
 *
 * Handles:
 *   - Character count on summary/excerpt fields
 *   - Tab key in textarea (inserts spaces instead of losing focus)
 *   - Keyboard shortcut: Cmd/Ctrl+S to save form
 */

document.addEventListener('DOMContentLoaded', function () {
    // Character counters
    document.querySelectorAll('.field-count').forEach(function (counter) {
        const max = parseInt(counter.dataset.max, 10);
        const fieldId = counter.dataset.field;
        const field = document.getElementById(fieldId);
        if (!field) return;

        function update() {
            const len = field.value.length;
            counter.textContent = len + ' / ' + max;
            if (len > max) {
                counter.style.color = 'var(--studio-error)';
            } else {
                counter.style.color = '';
            }
        }

        field.addEventListener('input', update);
        update();
    });

    // Tab in textarea inserts 4 spaces
    const body = document.getElementById('editor-body');
    if (body && body.tagName === 'TEXTAREA') {
        body.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });
    }

    // Cmd/Ctrl+S to save
    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            var form = document.getElementById('content-form');
            if (form) form.submit();
        }
    });
});

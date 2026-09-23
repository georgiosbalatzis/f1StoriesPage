(function (global) {
    'use strict';

    var queue = Promise.resolve();
    var styleInstalled = false;

    function installStyle() {
        if (styleInstalled) return;
        styleInstalled = true;

        var style = document.createElement('style');
        style.setAttribute('data-f1s-author-dialogs', '');
        style.textContent = [
            '.f1s-author-dialog-backdrop{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(17,17,19,.86)}',
            '.f1s-author-dialog{width:min(520px,100%);max-height:min(86vh,720px);overflow:auto;border:1px solid var(--border,#ffffff14);border-radius:2px;background:var(--bg-surface,#161618);color:var(--text-primary,#e5e5e7);box-shadow:0 24px 70px rgba(0,0,0,.48);opacity:1}',
            // Scoped under the backdrop so page-level section/h2 styles cannot resize the dialog.
            '.f1s-author-dialog-backdrop .f1s-author-dialog{padding:0;margin:0}',
            '.f1s-author-dialog-head{padding:1rem 1.1rem .35rem}',
            '.f1s-author-dialog-backdrop .f1s-author-dialog-title{margin:0;font-family:inherit;font-size:1.05rem;font-weight:600;line-height:1.25;letter-spacing:0;text-transform:none}',
            '.f1s-author-dialog-body{padding:.45rem 1.1rem 1rem}',
            '.f1s-author-dialog-message{margin:0;color:var(--text-secondary,#a1a1a6);font-size:.9rem;line-height:1.5;white-space:pre-wrap}',
            '.f1s-author-dialog-input{width:100%;margin-top:.85rem;border:1px solid var(--border,#ffffff14);border-radius:2px;background:var(--bg-base,#111113);color:var(--text-primary,#e5e5e7);padding:.72rem .8rem;font:inherit;opacity:1}',
            '.f1s-author-dialog-actions{display:flex;justify-content:flex-end;gap:.55rem;padding:.85rem 1.1rem 1.05rem;border-top:1px solid var(--border,rgba(255,255,255,.1))}',
            '.f1s-author-dialog-btn{border:1px solid var(--border,#ffffff14);border-radius:2px;background:var(--bg-surface-alt,#1e1e20);color:var(--text-primary,#e5e5e7);padding:.55rem .9rem;font:inherit;font-weight:700;cursor:pointer;opacity:1}',
            '.f1s-author-dialog-btn-primary{border-color:var(--accent,#41b6e6);background:var(--accent,#41b6e6);color:var(--accent-contrast,#061018)}',
            '.f1s-author-dialog-btn:focus-visible,.f1s-author-dialog-input:focus-visible{outline:2px solid var(--accent,#41b6e6);outline-offset:2px}',
            '.f1s-author-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
            '.f1s-author-dialog-choices{display:grid;gap:.5rem;margin:.85rem 0 0;padding:0;border:0}',
            '.f1s-author-dialog-choice{display:grid;grid-template-columns:20px 1fr;gap:.6rem;align-items:start;padding:.7rem .75rem;border:1px solid var(--border,#ffffff14);cursor:pointer;color:var(--text-primary,#e5e5e7);font-size:.9rem}',
            '.f1s-author-dialog-choice:has(input:checked){border-color:var(--accent,#41b6e6)}',
            '.f1s-author-dialog-choice input{margin:.2rem 0 0;accent-color:var(--accent,#41b6e6)}',
            '.f1s-author-dialog-choice small{display:block;margin-top:.15rem;color:var(--text-secondary,#a1a1a6);font-size:.8rem}',
            '@media (max-width:560px){.f1s-author-dialog-backdrop{align-items:flex-end;padding:.75rem}.f1s-author-dialog-actions{display:grid;grid-template-columns:1fr}.f1s-author-dialog-actions .f1s-author-dialog-btn-primary{order:-1}}'
        ].join('');
        document.head.appendChild(style);
    }

    function appendTextBlock(parent, className, text) {
        var node = document.createElement('p');
        node.className = className;
        node.textContent = String(text || '');
        parent.appendChild(node);
        return node;
    }

    function createButton(label, primary) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = primary ? 'f1s-author-dialog-btn f1s-author-dialog-btn-primary' : 'f1s-author-dialog-btn';
        button.textContent = label;
        return button;
    }

    function restoreFocus(el) {
        try {
            if (el && typeof el.focus === 'function') el.focus();
        } catch (_) {}
    }

    function openDialog(options) {
        options = options || {};
        var kind = options.kind || 'alert';
        var title = options.title || (kind === 'alert' ? 'Ειδοποίηση' : kind === 'prompt' ? 'Απαιτείται στοιχείο' : 'Επιβεβαίωση');
        var previousFocus = document.activeElement;

        installStyle();

        return new Promise(function (resolve) {
            var settled = false;
            var backdrop = document.createElement('div');
            backdrop.className = 'f1s-author-dialog-backdrop';

            var dialog = document.createElement('section');
            dialog.className = 'f1s-author-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'f1s-author-dialog-title');
            dialog.setAttribute('aria-describedby', 'f1s-author-dialog-message');

            var head = document.createElement('div');
            head.className = 'f1s-author-dialog-head';
            var heading = document.createElement('h2');
            heading.className = 'f1s-author-dialog-title';
            heading.id = 'f1s-author-dialog-title';
            heading.textContent = title;
            head.appendChild(heading);

            var body = document.createElement('div');
            body.className = 'f1s-author-dialog-body';
            var message = appendTextBlock(body, 'f1s-author-dialog-message', options.message);
            message.id = 'f1s-author-dialog-message';

            var input = null;
            if (kind === 'prompt') {
                input = document.createElement('input');
                input.className = 'f1s-author-dialog-input';
                input.type = options.inputType || 'text';
                input.autocomplete = options.autocomplete || 'off';
                input.spellcheck = false;
                input.value = options.defaultValue || '';
                input.setAttribute('aria-label', options.inputLabel || title);
                body.appendChild(input);
            }

            // Choice: one radio per option; resolves with the chosen value.
            var choiceInputs = [];
            if (kind === 'choice') {
                var group = document.createElement('fieldset');
                group.className = 'f1s-author-dialog-choices';
                var legend = document.createElement('legend');
                legend.className = 'f1s-author-sr';
                legend.textContent = title;
                group.appendChild(legend);
                (options.choices || []).forEach(function (choice, index) {
                    var row = document.createElement('label');
                    row.className = 'f1s-author-dialog-choice';
                    var radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'f1s-author-dialog-choice';
                    radio.value = choice.value;
                    radio.checked = options.defaultValue ? choice.value === options.defaultValue : index === 0;
                    var text = document.createElement('span');
                    text.textContent = choice.label;
                    if (choice.detail) {
                        var detail = document.createElement('small');
                        detail.textContent = choice.detail;
                        text.appendChild(detail);
                    }
                    row.appendChild(radio);
                    row.appendChild(text);
                    group.appendChild(row);
                    choiceInputs.push(radio);
                });
                body.appendChild(group);
            }

            var actions = document.createElement('div');
            actions.className = 'f1s-author-dialog-actions';
            var cancelButton = null;
            if (kind !== 'alert') {
                cancelButton = createButton(options.cancelLabel || 'Ακύρωση', false);
                actions.appendChild(cancelButton);
            }
            var okButton = createButton(options.okLabel || 'OK', true);
            actions.appendChild(okButton);

            dialog.appendChild(head);
            dialog.appendChild(body);
            dialog.appendChild(actions);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            function finish(value) {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', onKeydown);
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                restoreFocus(previousFocus);
                resolve(value);
            }

            function cancel() {
                finish(kind === 'prompt' || kind === 'choice' ? null : false);
            }

            function accept() {
                if (kind === 'prompt') {
                    finish(input.value);
                    return;
                }
                if (kind === 'choice') {
                    var picked = choiceInputs.filter(function (radio) { return radio.checked; })[0];
                    finish(picked ? picked.value : null);
                    return;
                }
                finish(true);
            }

            function onKeydown(event) {
                if (event.key === 'Escape' && kind !== 'alert') {
                    event.preventDefault();
                    cancel();
                } else if (event.key === 'Enter' && kind !== 'alert' && document.activeElement === input) {
                    event.preventDefault();
                    accept();
                }
            }

            okButton.addEventListener('click', accept);
            if (cancelButton) cancelButton.addEventListener('click', cancel);
            document.addEventListener('keydown', onKeydown);

            setTimeout(function () {
                (input || choiceInputs.filter(function (radio) { return radio.checked; })[0] || okButton).focus();
                if (input) input.select();
            }, 0);
        });
    }

    function enqueue(options) {
        var next = queue.then(function () {
            return openDialog(options);
        });
        queue = next.catch(function () {});
        return next;
    }

    global.F1S_AUTHOR_DIALOGS = {
        alert: function (message, options) {
            options = options || {};
            options.kind = 'alert';
            options.message = message;
            return enqueue(options).then(function () {});
        },
        confirm: function (message, options) {
            options = options || {};
            options.kind = 'confirm';
            options.message = message;
            return enqueue(options);
        },
        // choices: [{ value, label, detail? }]. Resolves with a value, or null on cancel.
        choose: function (message, choices, options) {
            options = options || {};
            options.kind = 'choice';
            options.message = message;
            options.choices = choices;
            return enqueue(options);
        },
        prompt: function (message, defaultValue, options) {
            options = options || {};
            options.kind = 'prompt';
            options.message = message;
            options.defaultValue = defaultValue || '';
            return enqueue(options);
        }
    };
})(window);

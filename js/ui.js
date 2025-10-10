window.DefCost = window.DefCost || {};
window.DefCost.state = window.DefCost.state || {};
window.DefCost.api = window.DefCost.api || {};
window.DefCost.ui = window.DefCost.ui || {};

(function(){
  var DEFAULT_TOAST_MS = 3000;

  function getImportSummaryFormatter() {
    var api = window.DefCost.api || {};
    if (typeof api.formatCurrencyWithSymbol === 'function') {
      return api.formatCurrencyWithSymbol;
    }
    if (typeof api.formatCurrency === 'function') {
      return function (value) {
        var formatted = api.formatCurrency(value);
        if (formatted && formatted.indexOf('$') !== 0) {
          return '$' + formatted;
        }
        return formatted;
      };
    }
    return function (value) {
      var number = Number(value);
      if (!isFinite(number)) {
        return '$0.00';
      }
      return '$' + number.toFixed(2);
    };
  }

  function showToast(message, opts) {
    var toastEl = document.getElementById('toast');
    if (!toastEl) {
      return;
    }
    var state = window.DefCost.state = window.DefCost.state || {};
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    var options;
    if (typeof opts === 'function') {
      options = { onClick: opts };
    } else {
      options = opts || {};
    }

    var actionHandler = null;
    if (typeof options.onClick === 'function') {
      actionHandler = options.onClick;
    } else if (typeof options.onUndo === 'function') {
      actionHandler = options.onUndo;
    }

    toastEl.textContent = message == null ? '' : String(message);
    toastEl.classList.add('show');

    var clear = function () {
      toastEl.classList.remove('show');
      toastEl.style.cursor = 'default';
      toastEl.onclick = null;
      if (state.toastTimer) {
        clearTimeout(state.toastTimer);
        state.toastTimer = null;
      }
    };

    if (actionHandler) {
      toastEl.style.cursor = 'pointer';
      toastEl.onclick = function (ev) {
        if (ev && typeof ev.preventDefault === 'function') {
          ev.preventDefault();
        }
        actionHandler();
        clear();
      };
    } else {
      toastEl.style.cursor = 'default';
      toastEl.onclick = null;
    }

    var duration = options && isFinite(options.duration) ? options.duration : DEFAULT_TOAST_MS;
    state.toastTimer = window.setTimeout(function () {
      clear();
    }, duration);
  }

  function showImportSummaryModal(summary, options) {
    if (!summary) {
      return;
    }
    var api = window.DefCost.api || {};
    if (typeof api.closeImportSummaryModal === 'function') {
      api.closeImportSummaryModal();
    }

    var overlay = document.createElement('div');
    overlay.className = 'import-summary-backdrop';
    overlay.setAttribute('role', 'presentation');

    var card = document.createElement('div');
    card.className = 'import-summary-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('tabindex', '-1');

    var title = document.createElement('h2');
    title.className = 'import-summary-title';
    title.id = 'import-summary-title';
    title.textContent = 'Import Summary';
    card.setAttribute('aria-labelledby', 'import-summary-title');

    var subtitle = document.createElement('p');
    subtitle.className = 'import-summary-subtitle';
    subtitle.id = 'import-summary-subtitle';
    subtitle.textContent = 'Your quote has been successfully imported.';
    card.setAttribute('aria-describedby', 'import-summary-subtitle');

    var table = document.createElement('table');
    table.className = 'import-summary-table';
    var tbody = document.createElement('tbody');

    var formatCurrency = getImportSummaryFormatter();
    var rows = [
      ['Imported Sections', String(summary.sections || 0)],
      ['Parent Items', String(summary.parents || 0)],
      ['Child Items', String(summary.children || 0)],
      ['Notes', String(summary.notes || 0)],
      ['Quote Total (Ex. GST)', formatCurrency(summary.totalEx)]
    ];

    for (var i = 0; i < rows.length; i++) {
      var tr = document.createElement('tr');
      var labelTd = document.createElement('td');
      labelTd.textContent = rows[i][0];
      var valueTd = document.createElement('td');
      valueTd.textContent = rows[i][1];
      tr.appendChild(labelTd);
      tr.appendChild(valueTd);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    var divider = document.createElement('div');
    divider.className = 'import-summary-divider';

    var actions = document.createElement('div');
    actions.className = 'import-summary-actions';

    var viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'import-summary-view-btn';
    viewBtn.textContent = 'View Quote';

    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'import-summary-undo-btn';
    undoBtn.textContent = 'Undo Import';

    actions.appendChild(viewBtn);
    actions.appendChild(undoBtn);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(table);
    card.appendChild(divider);
    card.appendChild(actions);

    overlay.appendChild(card);

    var previousFocus = document.activeElement;
    var previousOverflow = document.body.style.overflow;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var focusables = Array.prototype.slice.call(
      card.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
    );

    var keyHandler = function (ev) {
      var currentState = window.DefCost && window.DefCost.state ? window.DefCost.state.importSummaryState : null;
      if (!currentState) {
        return;
      }
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        if (typeof api.closeImportSummaryModal === 'function') {
          api.closeImportSummaryModal();
        }
        return;
      }
      if (ev.key === 'Tab') {
        if (!focusables.length) {
          return;
        }
        var active = document.activeElement;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (ev.shiftKey) {
          if (!card.contains(active) || active === first) {
            ev.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    };

    var focusHandler = function (ev) {
      var currentState = window.DefCost && window.DefCost.state ? window.DefCost.state.importSummaryState : null;
      if (!currentState) {
        return;
      }
      if (!overlay.contains(ev.target)) {
        ev.stopPropagation();
        if (focusables.length) {
          focusables[0].focus();
        } else {
          card.focus();
        }
      }
    };

    var modalState = {
      overlay: overlay,
      keyHandler: keyHandler,
      focusHandler: focusHandler,
      previousFocus: previousFocus,
      bodyOverflow: previousOverflow
    };

    window.DefCost.state.importSummaryState = modalState;

    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('focus', focusHandler, true);

    setTimeout(function () {
      try {
        viewBtn.focus();
      } catch (err) {
        // ignore focus errors
      }
    }, 0);

    viewBtn.addEventListener('click', function () {
      if (typeof api.closeImportSummaryModal === 'function') {
        api.closeImportSummaryModal();
      }
    });

    undoBtn.addEventListener('click', function () {
      if (typeof api.closeImportSummaryModal === 'function') {
        api.closeImportSummaryModal();
      }
      if (options && typeof options.onUndo === 'function') {
        options.onUndo();
      }
    });
  }

  window.DefCost.ui.showImportSummaryModal = showImportSummaryModal;
  window.DefCost.ui.showToast = showToast;
})();

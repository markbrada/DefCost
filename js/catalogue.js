(function(){
  window.DefCost = window.DefCost || {};
  window.DefCost.state = window.DefCost.state || {};
  var state = window.DefCost.state.catalogue = window.DefCost.state.catalogue || {};
  var api = window.DefCost.catalogue = window.DefCost.catalogue || {};

  var STORAGE_KEY = 'defcost_catalogue_state';
  var MIN_WIDTH = 320;
  var MIN_HEIGHT = 280;

  var elements = {
    windowEl: null,
    dockIcon: null,
    titlebar: null,
    resizeHandle: null
  };

  var callbacks = {
    onDragStart: null,
    onDragEnd: null,
    onResizeStart: null,
    onResizeEnd: null
  };

  var dragContext = null;
  var resizeContext = null;
  var searchBinding = null;

  function assignElements(opts){
    opts = opts || {};
    elements.windowEl = opts.element || document.getElementById('catalogWindow');
    elements.dockIcon = opts.dockIcon || document.getElementById('catalogDockIcon');
    elements.titlebar = opts.titlebar || document.getElementById('catalogTitlebar');
    elements.resizeHandle = opts.resizeHandle || document.getElementById('catalogResizeHandle');
  }

  function getDefaultState(){
    var winW = window.innerWidth || 1200;
    var winH = window.innerHeight || 800;
    var width = Math.min(1100, Math.max(360, Math.round((winW || 0) * 0.9) || 600));
    if(!isFinite(width) || width <= 0) width = 800;
    if(width > winW && winW > 0) width = winW;
    var height = Math.round((winH || 0) * 0.65) || 520;
    height = Math.min(height, Math.round((winH || 0) * 0.8) || height);
    if(!isFinite(height) || height <= 0) height = Math.min(winH || 600, 600);
    if(height > winH && winH > 0) height = winH;
    var maxX = Math.max(0, (winW || width) - width - 32);
    var y = Math.min(64, Math.max(0, (winH || height) - height));
    return {
      isOpen: true,
      x: maxX,
      y: y,
      w: width,
      h: height
    };
  }

  function normalizeState(raw){
    var defaults = getDefaultState();
    raw = raw && typeof raw === 'object' ? raw : {};
    var winW = window.innerWidth || defaults.w;
    var winH = window.innerHeight || defaults.h;
    var next = {
      isOpen: typeof raw.isOpen === 'boolean' ? raw.isOpen : defaults.isOpen,
      x: parseFloat(raw.x),
      y: parseFloat(raw.y),
      w: parseFloat(raw.w),
      h: parseFloat(raw.h)
    };
    if(!isFinite(next.w) || next.w < MIN_WIDTH) next.w = defaults.w;
    next.w = Math.min(Math.max(MIN_WIDTH, next.w), winW || next.w);
    if(!isFinite(next.h) || next.h < MIN_HEIGHT) next.h = defaults.h;
    next.h = Math.min(Math.max(MIN_HEIGHT, next.h), winH || next.h);
    if(!isFinite(next.x)) next.x = Math.max(0, (winW || next.w) - next.w - 32);
    if(!isFinite(next.y)) next.y = defaults.y;
    var maxX = Math.max(0, (winW || next.w) - next.w);
    var maxY = Math.max(0, (winH || next.h) - next.h);
    next.x = Math.min(Math.max(0, next.x), maxX);
    next.y = Math.min(Math.max(0, next.y), maxY);
    return next;
  }

  function syncState(raw){
    var normalized = normalizeState(raw || state);
    state.isOpen = normalized.isOpen;
    state.x = normalized.x;
    state.y = normalized.y;
    state.w = normalized.w;
    state.h = normalized.h;
    return normalized;
  }

  function ensureWithinViewport(current){
    if(!current) return current;
    var winW = window.innerWidth || current.w || MIN_WIDTH;
    var winH = window.innerHeight || current.h || MIN_HEIGHT;
    current.w = Math.min(Math.max(MIN_WIDTH, current.w || MIN_WIDTH), winW || current.w || MIN_WIDTH);
    current.h = Math.min(Math.max(MIN_HEIGHT, current.h || MIN_HEIGHT), winH || current.h || MIN_HEIGHT);
    var maxX = Math.max(0, (winW || current.w) - current.w);
    var maxY = Math.max(0, (winH || current.h) - current.h);
    if(!isFinite(current.x)) current.x = maxX;
    if(!isFinite(current.y)) current.y = Math.min(64, maxY);
    current.x = Math.min(Math.max(0, current.x), maxX);
    current.y = Math.min(Math.max(0, current.y), maxY);
    return current;
  }

  function getElements(opts){
    opts = opts || {};
    return {
      windowEl: opts.element || elements.windowEl || document.getElementById('catalogWindow'),
      dockIcon: opts.dockIcon || elements.dockIcon || document.getElementById('catalogDockIcon')
    };
  }

  function applyDisplay(current, opts){
    var cfg = getElements(opts);
    var qbWindow = cfg.windowEl;
    var qbDockIcon = cfg.dockIcon;
    if(!qbWindow) return;
    if(current.isOpen){
      qbWindow.style.display = 'flex';
      qbWindow.setAttribute('aria-hidden', 'false');
      if(qbDockIcon){
        qbDockIcon.style.display = 'none';
      }
    }else{
      qbWindow.style.display = 'none';
      qbWindow.setAttribute('aria-hidden', 'true');
      if(qbDockIcon){
        qbDockIcon.style.display = 'inline-flex';
      }
    }
  }

  function applyPosition(current, opts){
    opts = opts || {};
    if(opts.skipPosition) return;
    var qbWindow = getElements(opts).windowEl;
    if(!qbWindow) return;
    qbWindow.style.top = (isFinite(current.y) ? current.y : 0) + 'px';
    qbWindow.style.left = (isFinite(current.x) ? current.x : 0) + 'px';
    qbWindow.style.right = 'auto';
    qbWindow.style.bottom = 'auto';
    qbWindow.style.width = current.w ? current.w + 'px' : '';
    qbWindow.style.height = current.h ? current.h + 'px' : '';
  }

  function setActiveClass(active){
    var qbWindow = elements.windowEl;
    if(!qbWindow) return;
    qbWindow.classList.toggle('catalogue-active', !!active);
  }

  function isDragHandleTarget(target){
    if(!target) return true;
    var node = target;
    if(node.closest){
      if(node.closest('#catalogDots')) return false;
    }
    while(node && node !== elements.titlebar){
      var tag = node.tagName;
      if(tag && (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'LABEL')) return false;
      node = node.parentNode;
    }
    return true;
  }

  function extractCoords(ev){
    if(ev.touches && ev.touches.length){
      return { clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY };
    }
    if(ev.changedTouches && ev.changedTouches.length){
      return { clientX: ev.changedTouches[0].clientX, clientY: ev.changedTouches[0].clientY };
    }
    return { clientX: ev.clientX, clientY: ev.clientY };
  }

  function updateDragPosition(clientX, clientY){
    if(!dragContext || !elements.windowEl) return;
    if(typeof clientX === 'undefined') return;
    var winW = window.innerWidth || dragContext.startWidth || MIN_WIDTH;
    var winH = window.innerHeight || dragContext.startHeight || MIN_HEIGHT;
    var width = Math.min(Math.max(MIN_WIDTH, dragContext.startWidth || MIN_WIDTH), winW || MIN_WIDTH);
    var height = Math.min(Math.max(MIN_HEIGHT, dragContext.startHeight || MIN_HEIGHT), winH || MIN_HEIGHT);
    var x = clientX - dragContext.offsetX;
    var y = clientY - dragContext.offsetY;
    var maxX = Math.max(0, (winW || width) - width);
    var maxY = Math.max(0, (winH || height) - height);
    if(x < 0) x = 0;
    if(y < 0) y = 0;
    if(x > maxX) x = maxX;
    if(y > maxY) y = maxY;
    state.full = false;
    state.docked = false;
    state.isOpen = true;
    state.w = width;
    state.h = height;
    state.x = x;
    state.y = y;
    var qbWindow = elements.windowEl;
    qbWindow.classList.remove('qb-full');
    qbWindow.classList.add('qb-floating');
    qbWindow.style.left = x + 'px';
    qbWindow.style.top = y + 'px';
    qbWindow.style.right = 'auto';
    qbWindow.style.bottom = 'auto';
    qbWindow.style.width = width + 'px';
    qbWindow.style.height = height + 'px';
    qbWindow.style.display = 'flex';
  }

  function endDragInteraction(){
    if(!dragContext) return;
    document.body.style.userSelect = dragContext.prevUserSelect || '';
    setActiveClass(false);
    if(dragContext.mode === 'pointer'){
      window.removeEventListener('pointermove', dragPointerMove);
      window.removeEventListener('pointerup', dragPointerUp);
      window.removeEventListener('pointercancel', dragPointerUp);
      if(elements.windowEl && elements.windowEl.releasePointerCapture && typeof dragContext.pointerId !== 'undefined'){
        try{ elements.windowEl.releasePointerCapture(dragContext.pointerId); }catch(e){}
      }
    }else if(dragContext.mode === 'mouse'){
      document.removeEventListener('mousemove', dragMouseMove);
      document.removeEventListener('mouseup', dragMouseUp);
    }else if(dragContext.mode === 'touch'){
      document.removeEventListener('touchmove', dragTouchMove);
      document.removeEventListener('touchend', dragTouchEnd);
      document.removeEventListener('touchcancel', dragTouchEnd);
    }
    dragContext = null;
    ensureWithinViewport(state);
    api.persistState();
    if(typeof callbacks.onDragEnd === 'function'){
      callbacks.onDragEnd();
    }
  }

  function startDragSession(ev, coords, mode){
    if(!elements.windowEl || state.full || state.isOpen === false || state.docked) return;
    if(dragContext) return;
    if(typeof callbacks.onDragStart === 'function'){
      callbacks.onDragStart();
    }
    var rect = elements.windowEl.getBoundingClientRect();
    dragContext = {
      mode: mode,
      pointerId: typeof ev.pointerId !== 'undefined' ? ev.pointerId : null,
      offsetX: coords.clientX - rect.left,
      offsetY: coords.clientY - rect.top,
      startWidth: rect.width,
      startHeight: rect.height,
      prevUserSelect: document.body.style.userSelect || ''
    };
    document.body.style.userSelect = 'none';
    setActiveClass(true);
    if(mode === 'pointer' && elements.windowEl.setPointerCapture && typeof ev.pointerId !== 'undefined'){
      try{ elements.windowEl.setPointerCapture(ev.pointerId); }catch(e){}
    }
    if(mode === 'pointer'){
      window.addEventListener('pointermove', dragPointerMove, { passive: false });
      window.addEventListener('pointerup', dragPointerUp);
      window.addEventListener('pointercancel', dragPointerUp);
    }else if(mode === 'mouse'){
      document.addEventListener('mousemove', dragMouseMove);
      document.addEventListener('mouseup', dragMouseUp);
    }else if(mode === 'touch'){
      document.addEventListener('touchmove', dragTouchMove, { passive: false });
      document.addEventListener('touchend', dragTouchEnd);
      document.addEventListener('touchcancel', dragTouchEnd);
    }
    updateDragPosition(coords.clientX, coords.clientY);
  }

  function dragPointerDown(ev){
    if(ev.button !== undefined && ev.button !== 0) return;
    if(!isDragHandleTarget(ev.target)) return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    startDragSession(ev, coords, 'pointer');
  }

  function dragPointerMove(ev){
    if(!dragContext || dragContext.mode !== 'pointer') return;
    if(typeof dragContext.pointerId !== 'undefined' && ev.pointerId !== dragContext.pointerId) return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    updateDragPosition(coords.clientX, coords.clientY);
  }

  function dragPointerUp(ev){
    if(!dragContext || dragContext.mode !== 'pointer') return;
    if(typeof dragContext.pointerId !== 'undefined' && ev.pointerId !== dragContext.pointerId) return;
    if(ev.cancelable) ev.preventDefault();
    endDragInteraction();
  }

  function dragMouseDown(ev){
    if(ev.button !== 0) return;
    if(!isDragHandleTarget(ev.target)) return;
    var coords = extractCoords(ev);
    if(ev.cancelable) ev.preventDefault();
    startDragSession(ev, coords, 'mouse');
  }

  function dragMouseMove(ev){
    if(!dragContext || dragContext.mode !== 'mouse') return;
    var coords = extractCoords(ev);
    if(ev.cancelable) ev.preventDefault();
    updateDragPosition(coords.clientX, coords.clientY);
  }

  function dragMouseUp(ev){
    if(!dragContext || dragContext.mode !== 'mouse') return;
    if(ev.cancelable) ev.preventDefault();
    endDragInteraction();
  }

  function dragTouchStart(ev){
    if(!isDragHandleTarget(ev.target)) return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    startDragSession(ev, coords, 'touch');
  }

  function dragTouchMove(ev){
    if(!dragContext || dragContext.mode !== 'touch') return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    updateDragPosition(coords.clientX, coords.clientY);
  }

  function dragTouchEnd(ev){
    if(!dragContext || dragContext.mode !== 'touch') return;
    if(ev.cancelable) ev.preventDefault();
    endDragInteraction();
  }

  function updateResize(clientX, clientY){
    if(!resizeContext || !elements.windowEl) return;
    if(typeof clientX === 'undefined') return;
    var winW = window.innerWidth || resizeContext.startW || MIN_WIDTH;
    var winH = window.innerHeight || resizeContext.startH || MIN_HEIGHT;
    var deltaX = clientX - resizeContext.startX;
    var deltaY = clientY - resizeContext.startY;
    var newW = (resizeContext.startW || MIN_WIDTH) + deltaX;
    var newH = (resizeContext.startH || MIN_HEIGHT) + deltaY;
    var maxW = winW - (isFinite(state.x) ? state.x : 0);
    var maxH = winH - (isFinite(state.y) ? state.y : 0);
    if(!isFinite(maxW) || maxW < MIN_WIDTH) maxW = winW;
    if(!isFinite(maxH) || maxH < MIN_HEIGHT) maxH = winH;
    if(newW < MIN_WIDTH) newW = MIN_WIDTH;
    if(newH < MIN_HEIGHT) newH = MIN_HEIGHT;
    if(newW > maxW) newW = maxW;
    if(newH > maxH) newH = maxH;
    state.full = false;
    state.docked = false;
    state.isOpen = true;
    state.w = newW;
    state.h = newH;
    var qbWindow = elements.windowEl;
    qbWindow.classList.add('qb-floating');
    qbWindow.classList.remove('qb-full');
    qbWindow.style.width = newW + 'px';
    qbWindow.style.height = newH + 'px';
  }

  function endResizeInteraction(){
    if(!resizeContext) return;
    document.body.style.userSelect = resizeContext.prevUserSelect || '';
    setActiveClass(false);
    if(resizeContext.mode === 'pointer'){
      window.removeEventListener('pointermove', resizePointerMove);
      window.removeEventListener('pointerup', resizePointerUp);
      window.removeEventListener('pointercancel', resizePointerUp);
      if(elements.windowEl && elements.windowEl.releasePointerCapture && typeof resizeContext.pointerId !== 'undefined'){
        try{ elements.windowEl.releasePointerCapture(resizeContext.pointerId); }catch(e){}
      }
    }else if(resizeContext.mode === 'mouse'){
      document.removeEventListener('mousemove', resizeMouseMove);
      document.removeEventListener('mouseup', resizeMouseUp);
    }else if(resizeContext.mode === 'touch'){
      document.removeEventListener('touchmove', resizeTouchMove);
      document.removeEventListener('touchend', resizeTouchEnd);
      document.removeEventListener('touchcancel', resizeTouchEnd);
    }
    ensureWithinViewport(state);
    applyPosition(state, { element: elements.windowEl });
    resizeContext = null;
    api.persistState();
    if(typeof callbacks.onResizeEnd === 'function'){
      callbacks.onResizeEnd();
    }
  }

  function startResizeSession(ev, coords, mode){
    if(!elements.windowEl || state.full || state.isOpen === false || state.docked) return;
    if(resizeContext) return;
    if(typeof callbacks.onResizeStart === 'function'){
      callbacks.onResizeStart();
    }
    var rect = elements.windowEl.getBoundingClientRect();
    resizeContext = {
      mode: mode,
      pointerId: typeof ev.pointerId !== 'undefined' ? ev.pointerId : null,
      startX: coords.clientX,
      startY: coords.clientY,
      startW: state.w || rect.width || MIN_WIDTH,
      startH: state.h || rect.height || MIN_HEIGHT,
      prevUserSelect: document.body.style.userSelect || ''
    };
    document.body.style.userSelect = 'none';
    setActiveClass(true);
    if(mode === 'pointer' && elements.windowEl.setPointerCapture && typeof ev.pointerId !== 'undefined'){
      try{ elements.windowEl.setPointerCapture(ev.pointerId); }catch(e){}
    }
    if(mode === 'pointer'){
      window.addEventListener('pointermove', resizePointerMove, { passive: false });
      window.addEventListener('pointerup', resizePointerUp);
      window.addEventListener('pointercancel', resizePointerUp);
    }else if(mode === 'mouse'){
      document.addEventListener('mousemove', resizeMouseMove);
      document.addEventListener('mouseup', resizeMouseUp);
    }else if(mode === 'touch'){
      document.addEventListener('touchmove', resizeTouchMove, { passive: false });
      document.addEventListener('touchend', resizeTouchEnd);
      document.addEventListener('touchcancel', resizeTouchEnd);
    }
  }

  function resizePointerDown(ev){
    if(ev.button !== undefined && ev.button !== 0) return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    startResizeSession(ev, coords, 'pointer');
  }

  function resizePointerMove(ev){
    if(!resizeContext || resizeContext.mode !== 'pointer') return;
    if(typeof resizeContext.pointerId !== 'undefined' && ev.pointerId !== resizeContext.pointerId) return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    updateResize(coords.clientX, coords.clientY);
  }

  function resizePointerUp(ev){
    if(!resizeContext || resizeContext.mode !== 'pointer') return;
    if(typeof resizeContext.pointerId !== 'undefined' && ev.pointerId !== resizeContext.pointerId) return;
    if(ev.cancelable) ev.preventDefault();
    endResizeInteraction();
  }

  function resizeMouseDown(ev){
    if(ev.button !== 0) return;
    var coords = extractCoords(ev);
    if(ev.cancelable) ev.preventDefault();
    startResizeSession(ev, coords, 'mouse');
  }

  function resizeMouseMove(ev){
    if(!resizeContext || resizeContext.mode !== 'mouse') return;
    var coords = extractCoords(ev);
    if(ev.cancelable) ev.preventDefault();
    updateResize(coords.clientX, coords.clientY);
  }

  function resizeMouseUp(ev){
    if(!resizeContext || resizeContext.mode !== 'mouse') return;
    if(ev.cancelable) ev.preventDefault();
    endResizeInteraction();
  }

  function resizeTouchStart(ev){
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    startResizeSession(ev, coords, 'touch');
  }

  function resizeTouchMove(ev){
    if(!resizeContext || resizeContext.mode !== 'touch') return;
    var coords = extractCoords(ev);
    if(typeof coords.clientX === 'undefined') return;
    if(ev.cancelable) ev.preventDefault();
    updateResize(coords.clientX, coords.clientY);
  }

  function resizeTouchEnd(ev){
    if(!resizeContext || resizeContext.mode !== 'touch') return;
    if(ev.cancelable) ev.preventDefault();
    endResizeInteraction();
  }

  function attachDragHandlers(){
    var titlebar = elements.titlebar;
    if(!titlebar) return;
    if(window.PointerEvent){
      titlebar.addEventListener('pointerdown', dragPointerDown, { passive: false });
    }else{
      titlebar.addEventListener('mousedown', dragMouseDown);
      titlebar.addEventListener('touchstart', dragTouchStart, { passive: false });
    }
  }

  function attachResizeHandlers(){
    var handle = elements.resizeHandle;
    if(!handle) return;
    if(window.PointerEvent){
      handle.addEventListener('pointerdown', resizePointerDown, { passive: false });
    }else{
      handle.addEventListener('mousedown', resizeMouseDown);
      handle.addEventListener('touchstart', resizeTouchStart, { passive: false });
    }
  }

  function detachSearch(){
    if(!searchBinding) return;
    if(searchBinding.input){
      searchBinding.input.removeEventListener('input', searchBinding.handleInput);
      searchBinding.input.removeEventListener('keydown', searchBinding.handleKeyDown);
    }
    if(searchBinding.clearButton){
      searchBinding.clearButton.removeEventListener('click', searchBinding.handleClear);
    }
    if(searchBinding.debounceTimer){
      clearTimeout(searchBinding.debounceTimer);
    }
    searchBinding = null;
  }

  function setupSearch(opts){
    opts = opts || {};
    detachSearch();
    var input = opts.input;
    if(!input) return null;
    var clearButton = opts.clearButton || null;
    var onSearch = typeof opts.onSearch === 'function' ? opts.onSearch : function(){};
    searchBinding = {
      input: input,
      clearButton: clearButton,
      onSearch: onSearch,
      debounceTimer: null
    };
    searchBinding.updateClear = function(){
      if(!searchBinding.clearButton) return;
      var hasValue = !!searchBinding.input.value;
      searchBinding.clearButton.classList.toggle('visible', hasValue);
      searchBinding.clearButton.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
      if(hasValue){
        searchBinding.clearButton.removeAttribute('tabindex');
      }else{
        searchBinding.clearButton.setAttribute('tabindex', '-1');
      }
    };
    searchBinding.triggerSearch = function(immediate){
      if(searchBinding.debounceTimer){
        clearTimeout(searchBinding.debounceTimer);
        searchBinding.debounceTimer = null;
      }
      var fire = function(){
        searchBinding.onSearch(searchBinding.input.value || '');
      };
      if(immediate){
        fire();
      }else{
        searchBinding.debounceTimer = setTimeout(fire, 250);
      }
    };
    searchBinding.handleInput = function(){
      searchBinding.updateClear();
      searchBinding.triggerSearch(false);
    };
    searchBinding.handleKeyDown = function(ev){
      if(ev.key === 'Escape' || ev.key === 'Esc'){
        if(searchBinding.input.value){
          searchBinding.input.value = '';
          searchBinding.updateClear();
          searchBinding.triggerSearch(true);
        }
        ev.stopPropagation();
        ev.preventDefault();
      }
    };
    searchBinding.handleClear = function(ev){
      if(ev && ev.preventDefault) ev.preventDefault();
      if(searchBinding.input.value){
        searchBinding.input.value = '';
      }
      searchBinding.updateClear();
      searchBinding.triggerSearch(true);
      try{
        searchBinding.input.focus({ preventScroll: true });
      }catch(e){
        try{ searchBinding.input.focus(); }catch(err){}
      }
    };
    input.addEventListener('input', searchBinding.handleInput);
    input.addEventListener('keydown', searchBinding.handleKeyDown);
    if(clearButton){
      clearButton.addEventListener('click', searchBinding.handleClear);
    }
    searchBinding.updateClear();
    return searchBinding;
  }

  api.setupSearch = setupSearch;

  api.filter = function(query, opts){
    if(!searchBinding || !searchBinding.input) return '';
    var value = typeof query === 'string' ? query : '';
    searchBinding.input.value = value;
    searchBinding.updateClear();
    var immediate = !(opts && opts.debounce === false);
    searchBinding.triggerSearch(immediate);
    return value;
  };

  api.focusSearch = function(){
    if(!searchBinding || !searchBinding.input) return;
    try{
      searchBinding.input.focus({ preventScroll: true });
    }catch(e){
      try{ searchBinding.input.focus(); }catch(err){}
    }
    searchBinding.input.select();
  };

  api.persistState = function(opts){
    var normalized = ensureWithinViewport(syncState(state));
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        isOpen: normalized.isOpen,
        x: Math.round(isFinite(normalized.x) ? normalized.x : 0),
        y: Math.round(isFinite(normalized.y) ? normalized.y : 0),
        w: Math.round(isFinite(normalized.w) ? normalized.w : 0),
        h: Math.round(isFinite(normalized.h) ? normalized.h : 0)
      }));
    }catch(e){}
    return normalized;
  };

  api.restoreState = function(opts){
    var stored = null;
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        stored = JSON.parse(raw);
      }
    }catch(e){}
    var normalized = ensureWithinViewport(syncState(stored));
    applyDisplay(normalized, Object.assign({}, opts, { skipPosition: true }));
    applyPosition(normalized, opts);
    return state;
  };

  function setOpenState(next, opts){
    opts = opts || {};
    var normalized = syncState(state);
    if(normalized.isOpen !== next){
      normalized.isOpen = next;
      normalized = syncState(normalized);
    }
    if(next){
      applyDisplay(normalized, opts);
      applyPosition(normalized, opts);
    }else{
      applyDisplay(normalized, Object.assign({}, opts, { skipPosition: true }));
    }
    if(!opts.skipSave){
      api.persistState(opts);
    }
    return state;
  }

  api.open = function(opts){
    return setOpenState(true, opts);
  };

  api.close = function(opts){
    return setOpenState(false, opts);
  };

  api.toggle = function(opts){
    var normalized = syncState(state);
    return setOpenState(!(normalized.isOpen === false), opts);
  };

  api.init = function(opts){
    opts = opts || {};
    assignElements(opts);
    callbacks.onDragStart = typeof opts.onDragStart === 'function' ? opts.onDragStart : null;
    callbacks.onDragEnd = typeof opts.onDragEnd === 'function' ? opts.onDragEnd : null;
    callbacks.onResizeStart = typeof opts.onResizeStart === 'function' ? opts.onResizeStart : null;
    callbacks.onResizeEnd = typeof opts.onResizeEnd === 'function' ? opts.onResizeEnd : null;
    attachDragHandlers();
    attachResizeHandlers();
    api.restoreState(opts);
  };
})();

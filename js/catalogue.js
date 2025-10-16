import { loadCatalogueState, saveCatalogueState } from './storage.js';

(function(){
  window.DefCost = window.DefCost || {};
  window.DefCost.state = window.DefCost.state || {};
  var state = window.DefCost.state.catalogue = window.DefCost.state.catalogue || {};
  var api = window.DefCost.catalogue = window.DefCost.catalogue || {};

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
      h: height,
      allTabs: false
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
      h: parseFloat(raw.h),
      allTabs: typeof raw.allTabs === 'boolean' ? raw.allTabs : defaults.allTabs
    };
    if(!isFinite(next.w) || next.w < 320) next.w = defaults.w;
    next.w = Math.min(Math.max(320, next.w), winW || next.w);
    if(!isFinite(next.h) || next.h < 280) next.h = defaults.h;
    next.h = Math.min(Math.max(280, next.h), winH || next.h);
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
    state.allTabs = !!normalized.allTabs;
    state.visibleResults = Array.isArray(state.visibleResults) ? state.visibleResults : [];
    state.addFirstHandler = typeof state.addFirstHandler === 'function' ? state.addFirstHandler : null;
    return normalized;
  }

  function persistCatalogueState(raw){
    var normalized = syncState(raw || state);
    try{
      saveCatalogueState({
        isOpen: normalized.isOpen,
        x: normalized.x,
        y: normalized.y,
        w: normalized.w,
        h: normalized.h,
        allTabs: normalized.allTabs
      });
    }catch(e){}
    return normalized;
  }

  function getElements(opts){
    opts = opts || {};
    var el = opts.element || document.getElementById('catalogWindow');
    var dock = opts.dockIcon || document.getElementById('catalogDockIcon');
    return { windowEl: el, dockIcon: dock };
  }

  function applyDisplay(current, opts){
    var elements = getElements(opts);
    var qbWindow = elements.windowEl;
    var qbDockIcon = elements.dockIcon;
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

  api.persistState = function(){
    return persistCatalogueState(state);
  };

  api.restoreState = function(opts){
    var stored = null;
    try{
      stored = loadCatalogueState();
    }catch(e){}
    var normalized = syncState(stored);
    applyDisplay(normalized, Object.assign({}, opts, { skipPosition: true }));
    applyPosition(normalized, opts);
    return state;
  };

  api.open = function(opts){
    opts = opts || {};
    var normalized = syncState(state);
    if(!normalized.isOpen){
      normalized.isOpen = true;
      normalized = syncState(normalized);
    }
    applyDisplay(normalized, opts);
    applyPosition(normalized, opts);
    if(!opts.skipSave){
      persistCatalogueState(normalized);
    }
    return state;
  };

  api.close = function(opts){
    opts = opts || {};
    var normalized = syncState(state);
    if(normalized.isOpen){
      normalized.isOpen = false;
      normalized = syncState(normalized);
    }
    applyDisplay(normalized, Object.assign({}, opts, { skipPosition: true }));
    if(!opts.skipSave){
      persistCatalogueState(normalized);
    }
    return state;
  };

  api.isAllTabsEnabled = function(){
    return !!state.allTabs;
  };

  api.setAllTabs = function(next, opts){
    var target = !!next;
    var normalized = syncState(Object.assign({}, state, { allTabs: target }));
    state.allTabs = normalized.allTabs;
    if(!opts || !opts.skipSave){
      persistCatalogueState(normalized);
    }
    return state.allTabs;
  };

  api.toggleAllTabs = function(opts){
    return api.setAllTabs(!state.allTabs, opts);
  };

  api.setVisibleResults = function(results){
    state.visibleResults = Array.isArray(results) ? results.slice(0) : [];
    return state.visibleResults;
  };

  api.getVisibleResults = function(){
    return Array.isArray(state.visibleResults) ? state.visibleResults.slice(0) : [];
  };

  api.registerAddFirstHandler = function(handler){
    state.addFirstHandler = typeof handler === 'function' ? handler : null;
  };

  api.addFirstVisibleResult = function(){
    var list = Array.isArray(state.visibleResults) ? state.visibleResults : [];
    if(!list.length){
      return false;
    }
    var first = list[0];
    if(first && typeof first.onAdd === 'function'){
      first.onAdd();
      return true;
    }
    if(state.addFirstHandler){
      try{
        state.addFirstHandler(first);
        return true;
      }catch(e){
        return false;
      }
    }
    return false;
  };
})();

(function(){
var ORDER=[["bannister rail","cat-orange"],["stainless steel grabrail","cat-orange"],["aluminium grabrail, powder coated","cat-orange"],["shower parts","cat-blue"],["plumbing","cat-blue"],["door components","cat-brown"],["fire safety","cat-red"],["anti slip solutions","cat-yellow"],["uncategorised","cat-yellow"]];
var META=(function(){var o={};for(var i=0;i<ORDER.length;i++){o[ORDER[i][0]]={idx:i,cls:ORDER[i][1]};}return o;})();
var FALL=META["uncategorised"];
var PRICE_EX=["Rate Ex. GST","Price Ex. GST","Price","Price Ex Tax","Price ex GST"];
var TOAST_MS=3000,UNDO_TOAST_MS=60000,GST_RATE=0.10,LS_KEY='defcost_basket_v2',BACKUP_KEY='defcost_basket_backup',UI_KEY='defcost_qb_ui_v1',IMPORT_HEADER=['Section','Item','Quantity','Price','Line Total'],SUMMARY_ROWS={'Total (Ex GST)':1,'Discount (%)':2,'Grand Total (Ex GST)':1,'GST':1,'Grand Total (Incl. GST)':1};
var wb=null,basket=[],sections=getDefaultSections(),uid=0,sectionSeq=1,activeSectionId=sections[0].id,captureParentId=null,toastTimer=null;
var tabs=document.getElementById("sheetTabs"),container=document.getElementById("sheetContainer"),toast=document.getElementById("toast"),sectionTabsEl=document.getElementById("sectionTabs"),grandTotalsEl=document.getElementById("grandTotals"),grandTotalsWrap=document.querySelector('.grand-totals-wrapper');
var discountPercent=0,currentGrandTotal=0,lastBaseTotal=0,grandTotalsUi=null,latestReport=null;
var currencyFormatter=(function(){try{return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2});}catch(e){return null;}})();
var importSummaryState=null;
var qbWindow=document.getElementById('catalogWindow'),qbTitlebar=document.getElementById('catalogTitlebar'),qbDockIcon=document.getElementById('catalogDockIcon'),qbMin=document.getElementById('catalogMin'),qbClose=document.getElementById('catalogClose'),qbZoom=document.getElementById('catalogZoom'),qbResizeHandle=document.getElementById('catalogResizeHandle');
var addSectionBtn=document.getElementById("addSectionBtn"),importBtn=document.getElementById('importCsvBtn'),importInput=document.getElementById('importCsvInput'),qbTitle=document.getElementById('qbTitle'),clearQuoteBtn=document.getElementById('clearQuoteBtn');
var qbState=loadUiState();
var lastFreeRect=cloneRect(qbState);
if(!lastFreeRect.w||!lastFreeRect.h){lastFreeRect=cloneRect(defaultUiState());}
var dragInfo=null,resizeInfo=null,prevUserSelect='';
var currentSearchInput=null;
applyQBState(true);
ensureWindowWithinViewport(true);
renderSectionTabs();
 if(qbTitlebar){qbTitlebar.addEventListener('mousedown',startDrag);qbTitlebar.addEventListener('touchstart',startDrag,{passive:false});}
 if(qbMin){qbMin.addEventListener('click',toggleDock);}
 if(qbDockIcon){qbDockIcon.addEventListener('click',restoreFromDock);}
 if(qbClose){qbClose.addEventListener('click',function(){setMinimized(true);});}
 if(qbZoom){qbZoom.addEventListener('click',toggleFull);}
 if(qbResizeHandle){qbResizeHandle.addEventListener('mousedown',startResize);qbResizeHandle.addEventListener('touchstart',startResize,{passive:false});}
if(clearQuoteBtn){clearQuoteBtn.addEventListener('click',showDeleteDialog);}
window.addEventListener('resize',function(){ensureWindowWithinViewport();});
 document.addEventListener('keydown',function(ev){
   if((ev.metaKey||ev.ctrlKey)&&!ev.altKey&&!ev.shiftKey&&(ev.key==='f'||ev.key==='F')){
     ev.preventDefault();
     focusSearchField();
     return;
   }
   if(ev.key==='Escape'||ev.key==='Esc'){
     if(qbState.full){toggleFull();}else if(!qbState.minimized){setMinimized(true);}
   }
 });
function active(n){if(!tabs)return;var kids=tabs.children;for(var i=0;i<kids.length;i++){var b=kids[i];b.classList.toggle('active',b.dataset&&b.dataset.sheet===n);}}
function saveBasket(){
  try{
    var payload={items:basket,sections:sections,activeSectionId:activeSectionId,discountPercent:isFinite(discountPercent)?discountPercent:0};
    localStorage.setItem(LS_KEY,JSON.stringify(payload));
  }catch(e){}
}
function loadBasket(){
  try{
    var raw=localStorage.getItem(LS_KEY);
    if(raw){
      var data=JSON.parse(raw);
      if(Array.isArray(data)){
        basket=data;
      }else if(data&&typeof data==='object'){
        basket=Array.isArray(data.items)?data.items:[];
        if(Array.isArray(data.sections)&&data.sections.length){sections=data.sections;}
        if(data.activeSectionId){activeSectionId=data.activeSectionId;}
        if(typeof data.discountPercent!=='undefined'&&isFinite(data.discountPercent)){discountPercent=+data.discountPercent;}
      }
    }
  }catch(e){}
  currentGrandTotal=0;
  lastBaseTotal=0;
  ensureSectionState();
  normalizeBasketItems();
  renderBasket();
}
function showToast(msg,undo,duration){
  var el=toast;
  if(!el) return;
  if(toastTimer){
    clearTimeout(toastTimer);
    toastTimer=null;
  }
  el.textContent=msg;
  el.classList.add("show");
  var clear=function(){
    el.classList.remove("show");
    el.style.cursor="default";
    el.onclick=null;
    if(toastTimer){
      clearTimeout(toastTimer);
      toastTimer=null;
    }
  };
  if(undo){
    el.style.cursor="pointer";
    el.onclick=function(ev){
      if(ev){ev.preventDefault();}
      undo();
      clear();
    };
  }else{
    el.style.cursor="default";
    el.onclick=null;
  }
  var timeout=isFinite(duration)?duration:TOAST_MS;
  toastTimer=setTimeout(function(){
    clear();
  },timeout);
}
function backupCurrentQuote(){
  try{
    var payload={
      items:basket,
      sections:sections,
      activeSectionId:activeSectionId,
      discountPercent:isFinite(discountPercent)?discountPercent:0
    };
    localStorage.setItem(BACKUP_KEY,JSON.stringify(payload));
  }catch(e){}
}
function restoreBackup(){
  closeImportSummaryModal();
  try{
    var raw=localStorage.getItem(BACKUP_KEY);
    if(!raw){
      showToast('No backup available');
      return;
    }
    var data=JSON.parse(raw);
    if(!data||typeof data!=='object'){
      showToast('No backup available');
      return;
    }
    basket=Array.isArray(data.items)?data.items:[];
    sections=Array.isArray(data.sections)&&data.sections.length?data.sections:getDefaultSections();
    activeSectionId=data.activeSectionId;
    if(!sections.some(function(sec){return sec.id===activeSectionId;})){
      activeSectionId=sections[0]?sections[0].id:1;
    }
    discountPercent=isFinite(data.discountPercent)?+data.discountPercent:0;
    captureParentId=null;
    currentGrandTotal=0;
    lastBaseTotal=0;
    normalizeBasketItems();
    ensureSectionState();
    renderBasket();
    showToast('Quote restored from backup');
  }catch(e){
    showToast('Unable to restore backup');
  }
}
function showIssuesModal(title,messages){
  if(!Array.isArray(messages)||!messages.length) return;
  var existing=document.querySelector('.import-error-modal');
  if(existing&&existing.parentNode){
    existing.parentNode.removeChild(existing);
  }
  var overlay=document.createElement('div');
  overlay.className='qb-modal-backdrop import-error-modal';
  var modal=document.createElement('div');
  modal.className='qb-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  var heading=document.createElement('h4');
  heading.textContent=title||'Import failed';
  var intro=document.createElement('p');
  intro.textContent='Resolve the following issues and try again:';
  var list=document.createElement('ul');
  for(var i=0;i<messages.length&&i<5;i++){
    var li=document.createElement('li');
    li.textContent=messages[i];
    list.appendChild(li);
  }
  var buttons=document.createElement('div');
  buttons.className='qb-modal-buttons';
  var closeBtn=document.createElement('button');
  closeBtn.type='button';
  closeBtn.textContent='Close';
  closeBtn.classList.add('neutral');
  buttons.appendChild(closeBtn);
  modal.appendChild(heading);
  modal.appendChild(intro);
  modal.appendChild(list);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  function close(){
    document.removeEventListener('keydown',handleKey,true);
    if(overlay&&overlay.parentNode){
      overlay.parentNode.removeChild(overlay);
    }
  }
  function handleKey(ev){
    if(ev.key==='Escape'||ev.key==='Esc'){
      ev.preventDefault();
      close();
    }
  }
  document.addEventListener('keydown',handleKey,true);
  overlay.addEventListener('click',function(ev){
    if(ev.target===overlay){
      close();
    }
  });
  closeBtn.addEventListener('click',close);
  document.body.appendChild(overlay);
  setTimeout(function(){
    try{closeBtn.focus();}catch(e){}
  },0);
}
function closeImportSummaryModal(){
  if(!importSummaryState) return;
  document.removeEventListener('focus',importSummaryState.focusHandler,true);
  document.removeEventListener('keydown',importSummaryState.keyHandler,true);
  if(importSummaryState.overlay&&importSummaryState.overlay.parentNode){
    importSummaryState.overlay.parentNode.removeChild(importSummaryState.overlay);
  }
  document.body.style.overflow=importSummaryState.bodyOverflow||'';
  var lastFocus=importSummaryState.previousFocus;
  importSummaryState=null;
  if(lastFocus&&typeof lastFocus.focus==='function'){
    try{lastFocus.focus();}catch(e){}
  }
}
function showImportSummaryModal(summary){
  if(!summary) return;
  closeImportSummaryModal();
  var overlay=document.createElement('div');
  overlay.className='import-summary-backdrop';
  overlay.setAttribute('role','presentation');
  var card=document.createElement('div');
  card.className='import-summary-card';
  card.setAttribute('role','dialog');
  card.setAttribute('aria-modal','true');
  card.setAttribute('tabindex','-1');
  var title=document.createElement('h2');
  title.className='import-summary-title';
  title.id='import-summary-title';
  title.textContent='Import Summary';
  card.setAttribute('aria-labelledby','import-summary-title');
  var subtitle=document.createElement('p');
  subtitle.className='import-summary-subtitle';
  subtitle.id='import-summary-subtitle';
  subtitle.textContent='Your quote has been successfully imported.';
  card.setAttribute('aria-describedby','import-summary-subtitle');
  var table=document.createElement('table');
  table.className='import-summary-table';
  var tbody=document.createElement('tbody');
  var rows=[
    ['Imported Sections',String(summary.sections||0)],
    ['Parent Items',String(summary.parents||0)],
    ['Child Items',String(summary.children||0)],
    ['Notes',String(summary.notes||0)],
    ['Quote Total (Ex. GST)',formatCurrencyWithSymbol(summary.totalEx)]
  ];
  for(var i=0;i<rows.length;i++){
    var tr=document.createElement('tr');
    var labelTd=document.createElement('td');
    labelTd.textContent=rows[i][0];
    var valueTd=document.createElement('td');
    valueTd.textContent=rows[i][1];
    tr.appendChild(labelTd);
    tr.appendChild(valueTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  var divider=document.createElement('div');
  divider.className='import-summary-divider';
  var actions=document.createElement('div');
  actions.className='import-summary-actions';
  var viewBtn=document.createElement('button');
  viewBtn.type='button';
  viewBtn.className='import-summary-view-btn';
  viewBtn.textContent='View Quote';
  var undoBtn=document.createElement('button');
  undoBtn.type='button';
  undoBtn.className='import-summary-undo-btn';
  undoBtn.textContent='Undo Import';
  actions.appendChild(viewBtn);
  actions.appendChild(undoBtn);
  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(table);
  card.appendChild(divider);
  card.appendChild(actions);
  overlay.appendChild(card);
  var previousFocus=document.activeElement;
  var previousOverflow=document.body.style.overflow;
  document.body.appendChild(overlay);
  document.body.style.overflow='hidden';
  var focusables=Array.prototype.slice.call(card.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  var keyHandler=function(ev){
    if(!importSummaryState) return;
    if(ev.key==='Escape'||ev.key==='Esc'){
      ev.preventDefault();
      closeImportSummaryModal();
      return;
    }
    if(ev.key==='Tab'){
      if(!focusables.length) return;
      var active=document.activeElement;
      var first=focusables[0];
      var last=focusables[focusables.length-1];
      if(ev.shiftKey){
        if(!card.contains(active)||active===first){
          ev.preventDefault();
          last.focus();
        }
      }else{
        if(active===last){
          ev.preventDefault();
          first.focus();
        }
      }
    }
  };
  var focusHandler=function(ev){
    if(!importSummaryState) return;
    if(!overlay.contains(ev.target)){
      ev.stopPropagation();
      if(focusables.length){
        focusables[0].focus();
      }else{
        card.focus();
      }
    }
  };
  importSummaryState={
    overlay:overlay,
    keyHandler:keyHandler,
    focusHandler:focusHandler,
    previousFocus:previousFocus,
    bodyOverflow:previousOverflow
  };
  document.addEventListener('keydown',keyHandler,true);
  document.addEventListener('focus',focusHandler,true);
  setTimeout(function(){
    try{viewBtn.focus();}catch(e){}
  },0);
  viewBtn.addEventListener('click',function(){
    closeImportSummaryModal();
  });
  undoBtn.addEventListener('click',function(){
    closeImportSummaryModal();
    restoreBackup();
  });
}
function parseNumericCell(raw,rowNumber,label,issues){
  var str=raw==null?'':String(raw).trim();
  if(!str){
    return {value:0};
  }
  var cleaned=str.replace(/[$,\s]/g,'');
  if(!cleaned){
    return {value:0};
  }
  var num=parseFloat(cleaned);
  if(!isFinite(num)){
    issues.push('Row '+rowNumber+': '+label+' is not a number');
    return {value:0,invalid:true};
  }
  return {value:num};
}
function buildImportModel(rows){
  var issues=[];
  if(!rows||!rows.length){
    issues.push('Row 1: Header must be "'+IMPORT_HEADER.join(',')+'"');
    return {issues:issues};
  }
  var header=rows[0]?rows[0].slice(0):[];
  if(header.length){
    header[0]=String(header[0]==null?'':header[0]).replace(/^\ufeff/,'');
  }
  if(header.length!==IMPORT_HEADER.length){
    issues.push('Row 1: Header must be "'+IMPORT_HEADER.join(',')+'"');
    return {issues:issues};
  }
  for(var h=0;h<IMPORT_HEADER.length;h++){
    var cell=header[h]==null?'':String(header[h]);
    if(cell!==IMPORT_HEADER[h]){
      issues.push('Row 1: Header must be "'+IMPORT_HEADER.join(',')+'"');
      return {issues:issues};
    }
  }
  var sectionsModel=[];
  var sectionMap={};
  var lastParentBySection={};
  var pendingNotes={};
  var discountPercentValue=null;
  for(var i=1;i<rows.length;i++){
    var row=rows[i];
    var rowNumber=i+1;
    if(!row){
      continue;
    }
    var nonEmpty=false;
    for(var c=0;c<IMPORT_HEADER.length;c++){
      if(row[c]!=null&&String(row[c]).trim()!==''){
        nonEmpty=true;
        break;
      }
    }
    if(!nonEmpty){
      continue;
    }
    var sectionCell=row[0]==null?'':String(row[0]).trim();
    if(SUMMARY_ROWS[sectionCell]){
      if(sectionCell==='Discount (%)'){
        var discStr=row[4]==null?'':String(row[4]).trim();
        if(discStr){
          var cleanedDisc=discStr.replace(/[$,\s]/g,'');
          var parsedDisc=parseFloat(cleanedDisc);
          if(isFinite(parsedDisc)){
            discountPercentValue=parsedDisc;
          }
        }
      }
      continue;
    }
    var notesMatch=/^Section\s+(\d+)\s+Notes$/.exec(sectionCell);
    if(notesMatch){
      var noteIndex=parseInt(notesMatch[1],10);
      if(isFinite(noteIndex)&&noteIndex>0){
        var noteText=row[1]==null?'':String(row[1]).trim();
        if(noteText){
          pendingNotes[noteIndex]={text:noteText,row:rowNumber};
        }
      }
      continue;
    }
    if(!sectionCell){
      issues.push('Row '+rowNumber+': Section is required');
      continue;
    }
    var section=sectionMap[sectionCell];
    if(!section){
      section={title:sectionCell,items:[],notes:''};
      sectionMap[sectionCell]=section;
      sectionsModel.push(section);
      lastParentBySection[sectionCell]=null;
    }
    var rawItem=row[1]==null?'':String(row[1]);
    var trimmedItem=rawItem.trim();
    var escaped=false;
    if(trimmedItem.indexOf('\\- ')==0){
      escaped=true;
      trimmedItem=trimmedItem.slice(1);
    }
    var isChild=false;
    if(!escaped&&trimmedItem.indexOf('- ')==0){
      isChild=true;
      trimmedItem=trimmedItem.slice(2);
    }
    var qtyInfo=parseNumericCell(row[2],rowNumber,'Quantity',issues);
    var priceInfo=parseNumericCell(row[3],rowNumber,'Price',issues);
    var itemName=trimmedItem;
    if(isChild){
      var parent=lastParentBySection[sectionCell];
      if(!parent){
        issues.push('Row '+rowNumber+': Child row without a parent in section "'+sectionCell+'"');
        continue;
      }
      parent.children.push({name:itemName,qty:qtyInfo.value,price:priceInfo.value});
    }else{
      var parentItem={name:itemName,qty:qtyInfo.value,price:priceInfo.value,children:[]};
      section.items.push(parentItem);
      lastParentBySection[sectionCell]=parentItem;
    }
  }
  for(var key in pendingNotes){
    if(!pendingNotes.hasOwnProperty(key)) continue;
    var noteIndex=parseInt(key,10);
    var targetSection=sectionsModel[noteIndex-1];
    if(targetSection){
      targetSection.notes=pendingNotes[key].text;
    }else{
      issues.push('Row '+pendingNotes[key].row+': Notes row references missing Section '+noteIndex);
    }
  }
  if(!sectionsModel.length){
    issues.push('No section data found in CSV');
  }
  return {sections:sectionsModel,discount:discountPercentValue,issues:issues};
}
function applyImportedModel(model){
  if(!model||!Array.isArray(model.sections)||!model.sections.length){
    showIssuesModal('Import failed',['No section data found in CSV']);
    return;
  }
  var parsedSections=model.sections;
  var newSections=[];
  var newBasket=[];
  var newSectionId=0;
  var newUid=0;
  var parentCount=0;
  var childCount=0;
  var notesCount=0;
  for(var i=0;i<parsedSections.length;i++){
    var src=parsedSections[i];
    newSectionId++;
    var secId=newSectionId;
    var sectionNotes=typeof src.notes==='string'?src.notes:'';
    if(sectionNotes&&sectionNotes.trim()){notesCount++;}
    newSections.push({id:secId,name:src.title||('Section '+secId),notes:sectionNotes});
    var items=Array.isArray(src.items)?src.items:[];
    for(var j=0;j<items.length;j++){
      var item=items[j];
      newUid++;
      var parentId=newUid;
      newBasket.push({id:parentId,pid:null,kind:'line',collapsed:false,sectionId:secId,item:item&&item.name?item.name:'',qty:isFinite(item&&item.qty)?item.qty:0,ex:isFinite(item&&item.price)?item.price:0});
      parentCount++;
      var children=Array.isArray(item&&item.children)?item.children:[];
      childCount+=children.length;
      for(var k=0;k<children.length;k++){
        var child=children[k];
        newUid++;
        newBasket.push({id:newUid,pid:parentId,kind:'sub',sectionId:secId,item:child&&child.name?child.name:'',qty:isFinite(child&&child.qty)?child.qty:0,ex:isFinite(child&&child.price)?child.price:0});
      }
    }
  }
  var summaryData={sections:newSections.length,parents:parentCount,children:childCount,notes:notesCount,totalEx:0};
  basket=newBasket;
  sections=newSections;
  sectionSeq=newSectionId;
  uid=newUid;
  activeSectionId=newSections[0]?newSections[0].id:1;
  captureParentId=null;
  discountPercent=isFinite(model.discount)?model.discount:0;
  currentGrandTotal=0;
  lastBaseTotal=0;
  normalizeBasketItems();
  ensureSectionState();
  renderBasket();
  if(latestReport&&isFinite(latestReport.grandEx)){
    summaryData.totalEx=latestReport.grandEx;
  }else{
    var fallbackReport=buildReportModel(basket,sections);
    summaryData.totalEx=fallbackReport&&isFinite(fallbackReport.grandEx)?fallbackReport.grandEx:0;
  }
  showImportSummaryModal(summaryData);
  showToast('✅ Quote imported. Undo?',function(){restoreBackup();},UNDO_TOAST_MS);
}
function handleImportInputChange(){
  if(!importInput) return;
  var file=importInput.files&&importInput.files[0];
  if(!file){
    return;
  }
  if(!window.confirm('Importing will replace the current quote. Continue?')){
    importInput.value='';
    return;
  }
  if(!window.Papa){
    importInput.value='';
    showIssuesModal('Import failed',['Papa Parse library is unavailable.']);
    return;
  }
  backupCurrentQuote();
  Papa.parse(file,{
    header:false,
    dynamicTyping:false,
    skipEmptyLines:false,
    complete:function(results){
      importInput.value='';
      var parserIssues=[];
      if(results&&Array.isArray(results.errors)){
        for(var i=0;i<results.errors.length;i++){
          var err=results.errors[i];
          if(err&&err.message){
            var rowNumber=(typeof err.row==='number'&&err.row>=0)?(err.row+1):'?';
            parserIssues.push('Row '+rowNumber+': '+err.message);
          }
        }
      }
      var model=buildImportModel(results&&results.data?results.data:[]);
      var combinedIssues=parserIssues.slice();
      if(model&&Array.isArray(model.issues)&&model.issues.length){
        combinedIssues=combinedIssues.concat(model.issues);
      }
      if(combinedIssues.length){
        showIssuesModal('Import failed',combinedIssues.slice(0,5));
        return;
      }
      applyImportedModel(model);
    },
    error:function(err){
      importInput.value='';
      var message=err&&err.message?err.message:'Unable to parse CSV file.';
      showIssuesModal('Import failed',[message]);
    }
  });
}
function cloneRect(state){if(!state||typeof state!=='object')return{x:0,y:0,w:0,h:0,dockHeight:0};return{x:isFinite(state.x)?+state.x:0,y:isFinite(state.y)?+state.y:0,w:isFinite(state.w)?+state.w:0,h:isFinite(state.h)?+state.h:0,dockHeight:isFinite(state.dockHeight)?+state.dockHeight:0};}
function getDefaultDockHeight(){var winH=window.innerHeight||800;var minDock=240;var base=Math.round((winH||800)*0.35)||minDock;if(!isFinite(base)||base<=0)base=320;var maxDock=Math.max(minDock,winH-96);if(!isFinite(maxDock)||maxDock<minDock)maxDock=Math.max(minDock,480);return Math.min(Math.max(minDock,base),maxDock);}
function defaultUiState(){var winW=window.innerWidth||1200;var winH=window.innerHeight||800;var width=Math.min(1100,Math.max(360,Math.round((winW||0)*0.9)||600));if(!isFinite(width)||width<=0)width=800;if(width>winW&&winW>0)width=winW;var height=Math.round((winH||0)*0.65)||520;height=Math.min(height,Math.round((winH||0)*0.8)||height);if(!isFinite(height)||height<=0)height=Math.min(winH||600,600);if(height>winH&&winH>0)height=winH;var maxX=Math.max(0,(winW||width)-width-32);var y=Math.min(64,Math.max(0,(winH||height)-height));return{x:maxX,y:y,w:width,h:height,minimized:false,full:false,docked:false,dockHeight:getDefaultDockHeight()};}
function normalizeUiState(state){var base=defaultUiState();state=state&&typeof state==='object'?state:{};var winW=window.innerWidth||base.w;var winH=window.innerHeight||base.h;var width=parseFloat(state.w);if(!isFinite(width)||width<320)width=base.w;width=Math.min(Math.max(320,width),winW||width);var height=parseFloat(state.h);if(!isFinite(height)||height<280)height=base.h;height=Math.min(Math.max(280,height),winH||height);var x=parseFloat(state.x);if(!isFinite(x))x=Math.max(0,(winW||width)-width-32);var y=parseFloat(state.y);if(!isFinite(y))y=base.y;var maxX=Math.max(0,(winW||width)-width);var maxY=Math.max(0,(winH||height)-height);x=Math.min(Math.max(0,x),maxX);y=Math.min(Math.max(0,y),maxY);var dockHeight=parseFloat(state.dockHeight);if(!isFinite(dockHeight)||dockHeight<240)dockHeight=base.dockHeight;var dockMax=Math.max(240,(winH||dockHeight)-96);dockHeight=Math.min(Math.max(240,dockHeight),dockMax);return{x:x,y:y,w:width,h:height,minimized:!!state.minimized,full:!!state.full,docked:!!state.docked,dockHeight:dockHeight};}
function loadUiState(){var stored=null;try{var raw=localStorage.getItem(UI_KEY);if(raw){var parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'){stored=parsed;}}}catch(e){}return normalizeUiState(stored);}
function rememberCurrentRect(){if(qbState&&(qbState.full||qbState.docked))return;lastFreeRect=cloneRect(qbState);}
function assignRect(rect){if(!rect)return;if(isFinite(rect.x))qbState.x=rect.x;if(isFinite(rect.y))qbState.y=rect.y;if(isFinite(rect.w)&&rect.w>0)qbState.w=rect.w;if(isFinite(rect.h)&&rect.h>0)qbState.h=rect.h;}
function applyQBState(skipSave){if(!qbWindow)return;var minimized=!!qbState.minimized;var full=!!qbState.full;var docked=!!qbState.docked&&!full;var winH=window.innerHeight||800;
  qbWindow.classList.toggle('qb-full',full);
  qbWindow.classList.toggle('qb-docked',docked);
  qbWindow.classList.toggle('qb-floating',!full&&!docked);
  if(full){qbWindow.style.top='';qbWindow.style.left='';qbWindow.style.right='';qbWindow.style.bottom='';qbWindow.style.width='';qbWindow.style.height='';}
  else if(docked){var minDock=240;var dockMax=Math.max(minDock,winH-96);var dockHeight=isFinite(qbState.dockHeight)?qbState.dockHeight:getDefaultDockHeight();dockHeight=Math.min(Math.max(minDock,dockHeight),dockMax);qbState.dockHeight=dockHeight;qbWindow.style.top='auto';qbWindow.style.left='16px';qbWindow.style.right='16px';qbWindow.style.bottom='16px';qbWindow.style.width='auto';qbWindow.style.height=dockHeight+'px';}
  else{qbWindow.style.width=qbState.w?qbState.w+'px':'';qbWindow.style.height=qbState.h?qbState.h+'px':'';qbWindow.style.top=(isFinite(qbState.y)?qbState.y:0)+'px';qbWindow.style.left=(isFinite(qbState.x)?qbState.x:0)+'px';qbWindow.style.right='auto';qbWindow.style.bottom='auto';}
  if(minimized){qbWindow.style.display='none';qbWindow.setAttribute('aria-hidden','true');if(qbDockIcon){qbDockIcon.style.display='inline-flex';}}
  else{qbWindow.style.display='flex';qbWindow.setAttribute('aria-hidden','false');if(qbDockIcon){qbDockIcon.style.display='none';}}
  if(!skipSave)saveUiState();}
function ensureWindowWithinViewport(skipSave){if(!qbWindow)return;if(qbState.docked){applyQBState(true);if(!skipSave)saveUiState();return;}if(qbState.full||qbState.minimized)return;var winW=window.innerWidth||qbState.w||800;var winH=window.innerHeight||qbState.h||600;qbState.w=Math.min(Math.max(320,qbState.w||320),winW);qbState.h=Math.min(Math.max(280,qbState.h||280),winH);var maxX=Math.max(0,winW-qbState.w);var maxY=Math.max(0,winH-qbState.h);if(qbState.x>maxX)qbState.x=maxX;if(qbState.y>maxY)qbState.y=maxY;applyQBState(true);if(!skipSave)saveUiState();}
function saveUiState(){if(!qbState)return;var payload={x:Math.round(isFinite(qbState.x)?qbState.x:0),y:Math.round(isFinite(qbState.y)?qbState.y:0),w:Math.round(isFinite(qbState.w)?qbState.w:0),h:Math.round(isFinite(qbState.h)?qbState.h:0),minimized:!!qbState.minimized,full:!!qbState.full,docked:!!qbState.docked,dockHeight:Math.round(isFinite(qbState.dockHeight)?qbState.dockHeight:getDefaultDockHeight())};try{localStorage.setItem(UI_KEY,JSON.stringify(payload));}catch(e){}}
function setMinimized(minimize){if(minimize){if(qbState.full){qbState.full=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);} }
    else if(!qbState.docked){rememberCurrentRect();}
    qbState.minimized=true;
  }else{qbState.minimized=false;}
  applyQBState();}
function focusSearchField(){if(qbState&&qbState.minimized){setMinimized(false);}if(currentSearchInput&&document.body.contains(currentSearchInput)){try{currentSearchInput.focus({preventScroll:true});}catch(e){currentSearchInput.focus();}currentSearchInput.select();}}
function restoreFromDock(){setMinimized(false);}
function toggleDock(){if(qbState.docked){qbState.docked=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);}else{assignRect(defaultUiState());}qbState.minimized=false;ensureWindowWithinViewport(true);applyQBState();saveUiState();return;}rememberCurrentRect();qbState.docked=true;qbState.full=false;qbState.minimized=false;if(!isFinite(qbState.dockHeight)||qbState.dockHeight<=0){qbState.dockHeight=getDefaultDockHeight();}applyQBState();saveUiState();}
function toggleFull(){if(qbState.full){qbState.full=false;if(lastFreeRect&&lastFreeRect.w){assignRect(lastFreeRect);}applyQBState();saveUiState();return;}rememberCurrentRect();qbState.full=true;qbState.docked=false;qbState.minimized=false;applyQBState();saveUiState();}
function getPointerCoords(ev){if(ev.touches&&ev.touches.length){return{clientX:ev.touches[0].clientX,clientY:ev.touches[0].clientY};}if(ev.changedTouches&&ev.changedTouches.length){return{clientX:ev.changedTouches[0].clientX,clientY:ev.changedTouches[0].clientY};}return{clientX:ev.clientX,clientY:ev.clientY};}
function isDragHandleTarget(target){if(!target)return true;var node=target;if(node.closest){if(node.closest('#catalogDots'))return false;}while(node&&node!==qbTitlebar){var tag=node.tagName;if(tag&&(tag==='BUTTON'||tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='LABEL'))return false;node=node.parentNode;}return true;}
function startDrag(ev){if(!qbWindow||qbState.full||qbState.minimized||qbState.docked)return;var target=ev.target||ev.srcElement;if(!isDragHandleTarget(target))return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();rememberCurrentRect();var rect=qbWindow.getBoundingClientRect();dragInfo={offsetX:coords.clientX-rect.left,offsetY:coords.clientY-rect.top,width:rect.width,height:rect.height};prevUserSelect=document.body.style.userSelect;document.body.style.userSelect='none';document.addEventListener('mousemove',handleDragMove);document.addEventListener('mouseup',endDrag);document.addEventListener('touchmove',handleDragMove,{passive:false});document.addEventListener('touchend',endDrag);document.addEventListener('touchcancel',endDrag);}
function handleDragMove(ev){if(!dragInfo)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();var winW=window.innerWidth||dragInfo.width||800;var winH=window.innerHeight||dragInfo.height||600;var width=Math.min(Math.max(320,dragInfo.width||320),winW);var height=Math.min(Math.max(280,dragInfo.height||280),winH);var x=coords.clientX-dragInfo.offsetX;var y=coords.clientY-dragInfo.offsetY;var maxX=Math.max(0,winW-width);var maxY=Math.max(0,winH-height);if(x<0)x=0;if(y<0)y=0;if(x>maxX)x=maxX;if(y>maxY)y=maxY;qbWindow.classList.remove('qb-full');qbWindow.classList.add('qb-floating');qbState.full=false;qbState.minimized=false;qbState.docked=false;qbState.x=x;qbState.y=y;qbState.w=width;qbState.h=height;qbWindow.style.left=x+'px';qbWindow.style.top=y+'px';qbWindow.style.right='auto';qbWindow.style.bottom='auto';qbWindow.style.display='flex';}
function endDrag(){if(!dragInfo)return;document.body.style.userSelect=prevUserSelect||'';document.removeEventListener('mousemove',handleDragMove);document.removeEventListener('mouseup',endDrag);document.removeEventListener('touchmove',handleDragMove);document.removeEventListener('touchend',endDrag);document.removeEventListener('touchcancel',endDrag);dragInfo=null;saveUiState();rememberCurrentRect();}
function startResize(ev){if(!qbWindow||qbState.full||qbState.minimized||qbState.docked)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();rememberCurrentRect();resizeInfo={startX:coords.clientX,startY:coords.clientY,startW:qbState.w||qbWindow.offsetWidth,startH:qbState.h||qbWindow.offsetHeight};qbState.full=false;qbState.minimized=false;qbState.docked=false;prevUserSelect=document.body.style.userSelect;document.body.style.userSelect='none';document.addEventListener('mousemove',handleResizeMove);document.addEventListener('mouseup',endResize);document.addEventListener('touchmove',handleResizeMove,{passive:false});document.addEventListener('touchend',endResize);document.addEventListener('touchcancel',endResize);}
function handleResizeMove(ev){if(!resizeInfo)return;var coords=getPointerCoords(ev);if(typeof coords.clientX==='undefined')return;if(ev.cancelable)ev.preventDefault();var winW=window.innerWidth||resizeInfo.startW||800;var winH=window.innerHeight||resizeInfo.startH||600;var deltaX=coords.clientX-resizeInfo.startX;var deltaY=coords.clientY-resizeInfo.startY;var minW=320;var minH=280;var maxW=winW-(isFinite(qbState.x)?qbState.x:0);var maxH=winH-(isFinite(qbState.y)?qbState.y:0);if(!isFinite(maxW)||maxW<minW)maxW=winW;if(!isFinite(maxH)||maxH<minH)maxH=winH;var newW=(resizeInfo.startW||minW)+deltaX;var newH=(resizeInfo.startH||minH)+deltaY;if(newW<minW)newW=minW;if(newH<minH)newH=minH;if(newW>maxW)newW=maxW;if(newH>maxH)newH=maxH;qbState.w=newW;qbState.h=newH;qbWindow.classList.add('qb-floating');qbWindow.classList.remove('qb-full');qbWindow.style.width=newW+'px';qbWindow.style.height=newH+'px';applyQBState(true);}
function endResize(){if(!resizeInfo)return;document.body.style.userSelect=prevUserSelect||'';document.removeEventListener('mousemove',handleResizeMove);document.removeEventListener('mouseup',endResize);document.removeEventListener('touchmove',handleResizeMove);document.removeEventListener('touchend',endResize);document.removeEventListener('touchcancel',endResize);resizeInfo=null;ensureWindowWithinViewport(true);saveUiState();rememberCurrentRect();}
function escapeHtml(s){s=String(s==null?'':s);return s.replace(/[&<>"']/g,function(m){switch(m){case'&':return'&amp;';case'<':return'&lt;';case'>':return'&gt;';case'"':return'&quot;';default:return'&#39;';}});}
function getDefaultSections(){return [{id:1,name:'Section 1',notes:''}];}
function ensureSectionState(){
  if(!Array.isArray(sections)||!sections.length){
    sections=getDefaultSections();
  }
  var seen={};
  sectionSeq=0;
  for(var i=0;i<sections.length;i++){
    var sec=sections[i];
    if(!sec||typeof sec!=='object'){
      sections.splice(i,1);i--;continue;
    }
    var sid=parseInt(sec.id,10);
    if(!isFinite(sid)||sid<=0||seen[sid]){
      sid=sectionSeq+1;
      sec.id=sid;
    }
    seen[sid]=true;
    if(sid>sectionSeq) sectionSeq=sid;
    if(typeof sec.name!=='string'||!sec.name.trim()){
      sec.name='Section '+sid;
    }else{
      sec.name=sec.name.trim();
    }
    if(typeof sec.notes!=='string'){
      sec.notes='';
    }
  }
  if(!sections.length){
    sections=getDefaultSections();
    sectionSeq=sections[0].id;
  }
  if(sectionSeq<=0){sectionSeq=sections[sections.length-1].id||1;}
  if(typeof activeSectionId==='undefined'||!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=sections[0].id;
  }
}
function normalizeBasketItems(){
  uid=0;
  var fallback=sections[0]?sections[0].id:1;
  var parentsById={};
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(!item||typeof item!=='object') continue;
    var iid=+item.id||0;
    if(iid>uid) uid=iid;
    if(!item.pid){
      if(!sections.some(function(sec){return sec.id===item.sectionId;})){
        item.sectionId=fallback;
      }
      if(typeof item.qty==='undefined'||!isFinite(item.qty)){item.qty=1;}
      if(typeof item.kind==='undefined') item.kind='line';
      if(typeof item.collapsed==='undefined') item.collapsed=false;
      parentsById[item.id]=item;
    }
  }
  for(var j=0;j<basket.length;j++){
    var child=basket[j];
    if(!child||typeof child!=='object') continue;
    if(child.pid){
      if(typeof child.qty==='undefined'||!isFinite(child.qty)){child.qty=1;}
      var parent=parentsById[child.pid];
      if(parent){
        child.sectionId=parent.sectionId;
      }else if(!sections.some(function(sec){return sec.id===child.sectionId;})){
        child.sectionId=fallback;
      }
    }else if(typeof child.qty==='undefined'||!isFinite(child.qty)){
      child.qty=1;
    }
  }
}
function buildReportModel(basket,sections){sections=(sections&&sections.length)?sections:getDefaultSections();var sectionsById={};for(var i=0;i<sections.length;i++){sectionsById[sections[i].id]=sections[i];}var childMap={};for(var i2=0;i2<basket.length;i2++){var it=basket[i2];if(it&&it.pid){(childMap[it.pid]||(childMap[it.pid]=[])).push(it);}}var secMap={};function ensureSec(id){var source=sectionsById[id];if(secMap[id]){secMap[id].notes=source&&typeof source.notes==='string'?source.notes:'';return secMap[id];}var name=source?source.name:('Section '+id);secMap[id]={id:id,name:name,items:[],subtotalEx:0,subtotalGst:0,subtotalTotal:0,notes:source&&typeof source.notes==='string'?source.notes:''};return secMap[id];}function addAmounts(obj,qty,ex){var le=isNaN(ex)?0:(qty||1)*ex;var gst=le*GST_RATE;obj.subtotalEx+=le;obj.subtotalGst+=gst;obj.subtotalTotal+=le+gst;}for(var i3=0;i3<basket.length;i3++){var it2=basket[i3];if(!it2||it2.pid)continue;var sid=it2.sectionId||sections[0].id;var sec=ensureSec(sid);var subs=childMap[it2.id]||[];sec.items.push({parent:it2,subs:subs});addAmounts(sec,it2.qty,it2.ex);for(var k=0;k<subs.length;k++){addAmounts(sec,subs[k].qty,subs[k].ex);}}var orderedSections=[];var seenSections={};for(var j=0;j<sections.length;j++){var entry=ensureSec(sections[j].id);orderedSections.push(entry);seenSections[entry.id]=true;}for(var id in secMap){if(secMap.hasOwnProperty(id)&&!seenSections[id]){orderedSections.push(secMap[id]);}}if(!orderedSections.length){var base=sections[0];orderedSections.push({id:base.id,name:base.name,items:[],subtotalEx:0,subtotalGst:0,subtotalTotal:0,notes:base&&typeof base.notes==='string'?base.notes:''});}var grandEx=0,grandGst=0,grandTotal=0;for(var s=0;s<orderedSections.length;s++){grandEx+=orderedSections[s].subtotalEx;grandGst+=orderedSections[s].subtotalGst;grandTotal+=orderedSections[s].subtotalTotal;}return{sections:orderedSections,grandEx:grandEx,grandGst:grandGst,grandTotal:grandTotal};}
function roundCurrency(val){if(!isFinite(val))return 0;return Math.round(val*100)/100;}
function formatCurrency(val){return roundCurrency(isFinite(val)?val:0).toFixed(2);}
function formatCurrencyWithSymbol(val){
  var safe=roundCurrency(isFinite(val)?val:0);
  if(currencyFormatter){
    try{return currencyFormatter.format(safe);}catch(e){}
  }
  var parts=safe.toFixed(2).split('.');
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return '$'+parts.join('.');
}
function formatPercent(val){return roundCurrency(isFinite(val)?val:0).toFixed(2);}
function recalcGrandTotal(base,discount){var b=isFinite(base)?base:0;var d=isFinite(discount)?discount:0;var computed=b*(1-d/100);if(!isFinite(computed))computed=0;return roundCurrency(computed<0?0:computed);}
function calculateGst(amount){var base=isFinite(amount)?amount:0;return roundCurrency(base*GST_RATE);}
function ensureGrandTotalsUi(){if(!grandTotalsEl||grandTotalsUi)return;if(!grandTotalsEl)return;grandTotalsEl.innerHTML='<table class="grand-totals-table" aria-label="Quote totals"><tbody><tr><th scope="row">Total</th><td class="totals-value" data-role="total-value">0.00</td></tr><tr><th scope="row">Discount (%)</th><td><div class="grand-totals-input"><input type="number" step="0.01" inputmode="decimal" aria-label="Discount percentage" data-role="discount-input"><span>%</span></div></td></tr><tr><th scope="row">Grand Total</th><td><div class="grand-totals-input"><input type="number" min="0" step="0.01" inputmode="decimal" aria-label="Grand total after discount" data-role="grand-total-input"></div></td></tr><tr><th scope="row">GST (10%)</th><td class="totals-value" data-role="gst-value">0.00</td></tr><tr><th scope="row">Grand Total (Incl. GST)</th><td class="totals-value" data-role="grand-incl-value">0.00</td></tr></tbody></table>';
  var discountInput=grandTotalsEl.querySelector('[data-role="discount-input"]');
  var grandTotalInput=grandTotalsEl.querySelector('[data-role="grand-total-input"]');
  grandTotalsUi={container:grandTotalsEl,totalValue:grandTotalsEl.querySelector('[data-role="total-value"]'),discountInput:discountInput,grandTotalInput:grandTotalInput,gstValue:grandTotalsEl.querySelector('[data-role="gst-value"]'),grandInclValue:grandTotalsEl.querySelector('[data-role="grand-incl-value"]')};
  if(discountInput){discountInput.addEventListener('input',handleDiscountChange);}
  if(grandTotalInput){grandTotalInput.addEventListener('input',handleGrandTotalChange);}
}
function handleDiscountChange(){if(!grandTotalsUi)return;var base=latestReport&&isFinite(latestReport.grandEx)?latestReport.grandEx:0;var raw=parseFloat(grandTotalsUi.discountInput.value);if(!isFinite(raw))raw=0;discountPercent=raw;currentGrandTotal=recalcGrandTotal(base,discountPercent);lastBaseTotal=base;updateGrandTotals(latestReport,{preserveGrandTotal:true});saveBasket();}
function handleGrandTotalChange(){if(!grandTotalsUi)return;var base=latestReport&&isFinite(latestReport.grandEx)?latestReport.grandEx:0;var raw=parseFloat(grandTotalsUi.grandTotalInput.value);if(!isFinite(raw))raw=0;raw=Math.max(0,raw);currentGrandTotal=roundCurrency(raw);if(base>0){discountPercent=(1-currentGrandTotal/(base||1))*100;}else{discountPercent=0;}lastBaseTotal=base;updateGrandTotals(latestReport,{preserveGrandTotal:true});saveBasket();}
function updateGrandTotals(report,opts){
  latestReport=report||null;
  if(!grandTotalsEl)return;
  ensureGrandTotalsUi();
  if(!grandTotalsUi)return;
  var hasItems=basket&&basket.length>0;
  var base=report&&isFinite(report.grandEx)?report.grandEx:0;
  if(!hasItems){
    if(grandTotalsWrap) grandTotalsWrap.style.display='none';
    grandTotalsEl.style.display='none';
    if(grandTotalsUi.totalValue)grandTotalsUi.totalValue.textContent=formatCurrency(0);
    if(grandTotalsUi.gstValue)grandTotalsUi.gstValue.textContent=formatCurrency(0);
    if(grandTotalsUi.grandInclValue)grandTotalsUi.grandInclValue.textContent=formatCurrency(0);
    if(grandTotalsUi.discountInput){
      grandTotalsUi.discountInput.disabled=true;
      if(document.activeElement!==grandTotalsUi.discountInput){
        grandTotalsUi.discountInput.value=formatPercent(discountPercent);
      }else{
        grandTotalsUi.discountInput.blur();
      }
    }
    if(grandTotalsUi.grandTotalInput){
      grandTotalsUi.grandTotalInput.disabled=true;
      grandTotalsUi.grandTotalInput.value=formatCurrency(0);
    }
    return;
  }
  if(grandTotalsWrap) grandTotalsWrap.style.display='flex';
  grandTotalsEl.style.display='block';
  if(!(opts&&opts.preserveGrandTotal)){
    if(Math.abs(base-lastBaseTotal)>0.005){
      currentGrandTotal=recalcGrandTotal(base,discountPercent);
    }
  }
  lastBaseTotal=base;
  if(grandTotalsUi.totalValue)grandTotalsUi.totalValue.textContent=formatCurrency(base);
  if(grandTotalsUi.discountInput){
    grandTotalsUi.discountInput.disabled=false;
    if(document.activeElement!==grandTotalsUi.discountInput){
      grandTotalsUi.discountInput.value=formatPercent(discountPercent);
    }
  }
  if(grandTotalsUi.grandTotalInput){
    grandTotalsUi.grandTotalInput.disabled=false;
    if(document.activeElement!==grandTotalsUi.grandTotalInput){
      grandTotalsUi.grandTotalInput.value=formatCurrency(currentGrandTotal);
    }
  }
  var gstAmount=calculateGst(currentGrandTotal);
  var incl=roundCurrency(currentGrandTotal+gstAmount);
  if(grandTotalsUi.gstValue)grandTotalsUi.gstValue.textContent=formatCurrency(gstAmount);
  if(grandTotalsUi.grandInclValue)grandTotalsUi.grandInclValue.textContent=formatCurrency(incl);
}
function getSectionById(id){
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===id) return sections[i];
  }
  return null;
}
function getSectionNameById(id){
  var sec=getSectionById(id);
  return sec?sec.name:('Section '+id);
}
function getSectionIndexById(id){
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===id) return i;
  }
  return sections.length;
}
function getParentItemById(id){
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(item && item.id===id && !item.pid){
      return item;
    }
  }
  return null;
}
function cascadeSectionToChildren(parentId,newSectionId){
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(item && item.pid===parentId){
      item.sectionId=newSectionId;
    }
  }
}
function moveParentGroupToSection(parentId,newSectionId){
  if(!basket||!basket.length) return;
  var group=[];
  var removeMap={};
  for(var i=0;i<basket.length;i++){
    var entry=basket[i];
    if(!entry) continue;
    if(entry.id===parentId||entry.pid===parentId){
      group.push(entry);
      removeMap[i]=true;
    }
  }
  if(!group.length) return;
  var remaining=[];
  for(var r=0;r<basket.length;r++){
    if(!removeMap[r]) remaining.push(basket[r]);
  }
  var targetOrder=getSectionIndexById(newSectionId);
  var insertIndex=remaining.length;
  for(var idx=0;idx<remaining.length;){
    var item=remaining[idx];
    if(!item){ idx++; continue; }
    if(!item.pid){
      var itemOrder=getSectionIndexById(item.sectionId);
      if(item.sectionId===newSectionId){
        var after=idx+1;
        while(after<remaining.length && remaining[after].pid===item.id){ after++; }
        insertIndex=after;
        idx=after;
        continue;
      }
      if(itemOrder>targetOrder){
        insertIndex=idx;
        break;
      }
      var skip=idx+1;
      while(skip<remaining.length && remaining[skip].pid===item.id){ skip++; }
      idx=skip;
      continue;
    }
    idx++;
  }
  basket=remaining.slice(0,insertIndex).concat(group,remaining.slice(insertIndex));
}
function setParentSection(parentItem,newSectionId){
  if(!parentItem||parentItem.pid) return;
  if(parentItem.sectionId===newSectionId) return;
  if(!sections.some(function(sec){return sec.id===newSectionId;})) return;
  parentItem.sectionId=newSectionId;
  cascadeSectionToChildren(parentItem.id,newSectionId);
  moveParentGroupToSection(parentItem.id,newSectionId);
  saveBasket();
}
function renderSectionTabs(){
  if(!sectionTabsEl) return;
  ensureSectionState();
  sectionTabsEl.innerHTML='';
  for(var i=0;i<sections.length;i++){
    (function(sec){
      var tab=document.createElement('div');
      tab.className='section-tab'+(sec.id===activeSectionId?' active':'');
      tab.onclick=function(){ if(activeSectionId!==sec.id){ activeSectionId=sec.id; captureParentId=null; renderBasket(); } };
      var nameSpan=document.createElement('span'); nameSpan.className='section-name'; nameSpan.textContent=sec.name; tab.appendChild(nameSpan);
      var renameBtn=document.createElement('button'); renameBtn.type='button'; renameBtn.textContent='✎'; renameBtn.title='Rename section';
      renameBtn.onclick=function(ev){ ev.stopPropagation(); var newName=prompt('Section name',sec.name); if(newName===null) return; newName=newName.trim(); if(!newName){ showToast('Section name is required'); return; } sec.name=newName; renderBasket(); showToast('Section renamed'); };
      tab.appendChild(renameBtn);
      if(sections.length>1){
        var delBtn=document.createElement('button'); delBtn.type='button'; delBtn.textContent='✕'; delBtn.title='Delete section';
        delBtn.onclick=function(ev){ ev.stopPropagation(); if(!confirm('Delete section "'+sec.name+'" and all of its items?')) return; removeSection(sec.id); };
        tab.appendChild(delBtn);
      }
      sectionTabsEl.appendChild(tab);
    })(sections[i]);
  }
}

function removeSection(sectionId){
  if(sections.length<=1){
    showToast('At least one section is required.');
    return;
  }
  var remaining=[];
  var deletedName='Section '+sectionId;
  for(var i=0;i<sections.length;i++){
    if(sections[i].id===sectionId){
      deletedName=sections[i].name;
      continue;
    }
    remaining.push(sections[i]);
  }
  sections=remaining;
  var removedParents={};
  for(var i2=0;i2<basket.length;i2++){
    var itm=basket[i2];
    if(itm&&!itm.pid&&itm.sectionId===sectionId){
      removedParents[itm.id]=true;
    }
  }
  var filtered=[];
  for(var j=0;j<basket.length;j++){
    var item=basket[j];
    if(!item) continue;
    if(item.pid){
      if(removedParents[item.pid]) continue;
      filtered.push(item);
      continue;
    }
    if(item.sectionId===sectionId) continue;
    filtered.push(item);
  }
  basket=filtered;
  if(captureParentId && removedParents[captureParentId]){
    captureParentId=null;
  }
  ensureSectionState();
  if(!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=sections[0].id;
  }
  normalizeBasketItems();
  renderBasket();
  showToast('Deleted '+deletedName);
}
loadBasket();
var darkModeToggle=document.getElementById('darkModeToggle');
if(darkModeToggle){
  darkModeToggle.addEventListener('click',function(){
    document.body.classList.toggle('dark-mode');
  });
}
var statusEl=document.getElementById('status');var pickerWrap=document.getElementById('manualLoad');var picker=document.getElementById('xlsxPicker');
function showStatus(html){if(statusEl){statusEl.innerHTML=html;}}
function showPicker(reason){showStatus('<span style="color:#b00">Couldn\'t load <code>Defender Price List.xlsx</code> ('+reason+').</span> You can upload the workbook manually below.');if(pickerWrap)pickerWrap.style.display='block';}
function whenXLSXReady(cb){if(window.XLSX){cb();return;}var s=document.querySelector('script[data-sheetjs]');if(!s){s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js';s.setAttribute('data-sheetjs','1');s.onload=function(){cb()};s.onerror=function(){showPicker('SheetJS failed to load')};document.head.appendChild(s);}else{var tries=0;var t=setInterval(function(){if(window.XLSX){clearInterval(t);cb();}else if(++tries>50){clearInterval(t);showPicker('SheetJS failed to load');}},100);}}
function parseAndBuild(buf){try{wb=XLSX.read(buf,{type:'array'});}catch(e){console.error(e);showPicker('invalid file');return;}var names=Object.keys(wb.Sheets||{});if(!names.length){showPicker('workbook has no sheets');return;}tabs.innerHTML='';container.innerHTML='';showStatus('');if(pickerWrap)pickerWrap.style.display='none';for(var i=0;i<names.length;i++){(function(name,idx){var b=document.createElement('button');b.textContent=name;b.dataset.sheet=name;b.onclick=function(){active(name);draw(name)};if(idx===0){b.classList.add('active');draw(name);}tabs.appendChild(b);})(names[i],i);} }
window.addEventListener('error',function(e){showStatus("<span style='color:#b00'>Error:</span> "+e.message)});
showStatus('Loading <code>Defender Price List.xlsx</code>…');
fetch('./Defender%20Price%20List.xlsx',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer();}).then(function(buf){whenXLSXReady(function(){parseAndBuild(buf);});}).catch(function(err){console.error(err);showPicker(err.message||'network error');});
if(picker){picker.addEventListener('change',function(e){var tgt=e&&e.target;var files=tgt&&tgt.files;var f=files&&files[0];if(!f)return;if(f.arrayBuffer){f.arrayBuffer().then(function(ab){whenXLSXReady(function(){parseAndBuild(ab);});});}else{var reader=new FileReader();reader.onload=function(ev){var ab=ev.target.result;whenXLSXReady(function(){parseAndBuild(ab);});};reader.readAsArrayBuffer(f);}});} 
function draw(name){if(!wb||!wb.Sheets||!wb.Sheets[name]){container.textContent='No such sheet.';return;}var rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:""});if(!rows.length){container.textContent='Empty sheet.';return;}var header=rows[0].map(function(h){return String(h).trim();});var catIdx=header.indexOf("Category");if(catIdx===-1){container.textContent='No "Category" column in this sheet.';return;}var body=rows.slice(1);container.innerHTML="";var sDiv=document.createElement("div");sDiv.className="search-container";var label=document.createElement("label");label.className="search-label";var searchId='catalogSearch_'+Date.now();label.setAttribute('for',searchId);label.textContent='Search items:';var control=document.createElement("div");control.className="search-control";var inp=document.createElement("input");inp.className="search-input";inp.type='search';inp.id=searchId;inp.placeholder='Type to filter...';var cancelBtn=document.createElement("button");cancelBtn.type='button';cancelBtn.className='search-cancel';cancelBtn.textContent='Cancel';control.appendChild(inp);control.appendChild(cancelBtn);sDiv.appendChild(label);sDiv.appendChild(control);container.appendChild(sDiv);var wrap=document.createElement("div");container.appendChild(wrap);currentSearchInput=inp;function updateCancel(){if(!cancelBtn)return;var hasValue=!!inp.value;cancelBtn.classList.toggle('visible',hasValue);}function handleInput(){updateCancel();render();}inp.addEventListener('input',handleInput);inp.addEventListener('keydown',function(e){if(e.key==='Escape'||e.key==='Esc'){if(inp.value){inp.value='';updateCancel();render();}e.stopPropagation();}});cancelBtn.addEventListener('click',function(){inp.value='';updateCancel();render();try{inp.focus({preventScroll:true});}catch(e){inp.focus();}});updateCancel();render();function render(){updateCancel();var term=(inp.value||"").toLowerCase();wrap.innerHTML="";var groups={};for(var i=0;i<body.length;i++){var r=body[i];if(term){var match=false;for(var j=0;j<r.length;j++){if(String(r[j]).toLowerCase().indexOf(term)>-1){match=true;break;}}if(!match)continue;}var cat=(r[catIdx]||"Uncategorised").toString().trim();if(!groups[cat])groups[cat]=[];groups[cat].push(r);}var cats=Object.keys(groups).sort(function(a,b){var A=(META[a.toLowerCase()]||FALL).idx;var B=(META[b.toLowerCase()]||FALL).idx;return A-B;});for(var c=0;c<cats.length;c++){(function(cat){var cls=(META[cat.toLowerCase()]||FALL).cls;var det=document.createElement("details");det.open=!!term;det.className=cls;var sum=document.createElement("summary");sum.textContent=cat;det.appendChild(sum);var tbl=document.createElement("table");var ths=header.filter(function(_,i){return i!==catIdx;}).map(function(h){return '<th>'+h+'</th>';}).join("");tbl.innerHTML='<thead><tr><th></th>'+ths+'</tr></thead>';var tbody=document.createElement("tbody");tbl.appendChild(tbody);var items=groups[cat];for(var r=0;r<items.length;r++){(function(row){var tr=document.createElement("tr");var tdAdd=document.createElement("td");var btn=document.createElement("button");btn.className="add-button";btn.textContent="+";btn.onclick=function(){addItem(row,header);};tdAdd.appendChild(btn);tr.appendChild(tdAdd);for(var i2=0;i2<row.length;i2++){if(i2===catIdx)continue;var td=document.createElement("td");var h=(header[i2]||"").toLowerCase();var txt=/price|gst|rate/.test(h)&&!isNaN(row[i2])?(+row[i2]).toFixed(2):row[i2];if(term){try{td.innerHTML=String(txt).replace(new RegExp('('+term+')','gi'),'<span class="highlight">$1</span>');}catch(e){td.textContent=String(txt);}}else{td.textContent=String(txt);}if(/price|gst|rate/.test(h))td.style.fontWeight="bold";td.onclick=function(e){if(e.target&&e.target.tagName==='BUTTON')return;var el=e.currentTarget;navigator.clipboard.writeText(el.textContent).then(function(){el.classList.add("copied-cell");void el.offsetWidth;setTimeout(function(){el.classList.remove("copied-cell");},150);}).catch(function(){});};tr.appendChild(td);}tbody.appendChild(tr);})(items[r]);}det.appendChild(tbl);wrap.appendChild(det);})(cats[c]);}}}
var bBody=document.querySelector('#basketTable tbody'),bFoot=document.querySelector('#basketTable tfoot');
if(bBody){
  bBody.addEventListener('click',function(e){
    var t=e.target; if(!t) return;
    if(/^(BUTTON|INPUT|TEXTAREA|SELECT|LABEL)$/i.test(t.tagName)) return;
    var td=t.closest ? t.closest('td') : (function(n){while(n&&n.tagName!=='TD'){n=n.parentNode;}return n;})(t);
    if(!td) return; var text=(td.textContent||'').trim(); if(!text) return;
    navigator.clipboard.writeText(text).then(function(){ td.classList.add('copied-cell'); void td.offsetWidth; setTimeout(function(){ td.classList.remove('copied-cell'); },150); }).catch(function(){});
  });
}
var bFootEl=document.querySelector('#basketTable tfoot');
if(bFootEl){
  bFootEl.addEventListener('click',function(e){
    var t=e.target; if(!t) return;
    if(/^(BUTTON|INPUT|TEXTAREA|SELECT|LABEL)$/i.test(t.tagName)) return;
    var td=t.closest ? t.closest('td') : (function(n){while(n&&n.tagName!=='TD'){n=n.parentNode;}return n;})(t);
    if(!td) return; var text=(td.textContent||'').trim(); if(!text) return;
    navigator.clipboard.writeText(text).then(function(){ td.classList.add('copied-cell'); void td.offsetWidth; setTimeout(function(){ td.classList.remove('copied-cell'); },150); }).catch(function(){});
  });
}
if(addSectionBtn){addSectionBtn.addEventListener('click',function(){ensureSectionState();var suggestion='Section '+(sectionSeq+1);var name=prompt('Section name',suggestion);if(name===null)return;name=name.trim();if(!name){showToast('Section name is required');return;}var newId=sectionSeq+1;sections.push({id:newId,name:name,notes:''});sectionSeq=newId;activeSectionId=newId;captureParentId=null;renderBasket();showToast('Section added');});}
if(importBtn&&importInput){
  importBtn.addEventListener('click',function(){
    importInput.value='';
    importInput.click();
  });
  importInput.addEventListener('change',handleImportInputChange);
}
var addCustomBtn=document.getElementById('addCustomBtn');
if(addCustomBtn){addCustomBtn.addEventListener('click',function(){var nl=null;if(captureParentId){var parent=getParentItemById(captureParentId);if(parent){var parentSection=sections.some(function(sec){return sec.id===parent.sectionId;})?parent.sectionId:activeSectionId;nl={id:++uid,pid:captureParentId,kind:'sub',sectionId:parentSection,item:'Sub item',qty:1,ex:0};}else{captureParentId=null;}}if(!nl){nl={id:++uid,pid:null,kind:'line',collapsed:false,sectionId:activeSectionId,item:'Custom item',qty:1,ex:0};}basket.push(nl);renderBasket();try{var rows=bBody.querySelectorAll('tr.main-row');if(rows.length){var last=rows[rows.length-1].querySelector('.item-input');if(last)last.focus();}}catch(_){}});}
function updateBasketHeaderOffset(){
  var cont=document.getElementById('basketContainer');
  var sticky=document.getElementById('basketSticky');
  if(!cont||!sticky) return;
  var h=(sticky.offsetHeight||0);
  cont.style.setProperty('--bh', h+'px');
}
window.addEventListener('resize',updateBasketHeaderOffset);
window.addEventListener('load',updateBasketHeaderOffset);
function addItem(row,header){
  var catIdx=header.indexOf("Category");
  var itemCol=-1;
  for(var i=0;i<header.length;i++){
    var key=String(header[i]).toLowerCase();
    if(key==='item'||key==='service / item'||key==='service'){itemCol=i;break;}
  }
  var exIdx=-1;
  for(var i2=0;i2<header.length;i2++){
    if(PRICE_EX.indexOf(header[i2])>-1){exIdx=i2;break;}
  }
  var firstNonEmpty='';
  for(var j=0;j<row.length;j++){
    if(j!==catIdx&&String(row[j]).trim()!==''){firstNonEmpty=row[j];break;}
  }
  var desc=itemCol!==-1?row[itemCol]:firstNonEmpty||'Unnamed Item';
  var exVal=exIdx===-1?NaN:+row[exIdx];
  var newItem=null;
  if(captureParentId){
    var parent=getParentItemById(captureParentId);
    if(parent){
      var parentSection=sections.some(function(sec){return sec.id===parent.sectionId;})?parent.sectionId:activeSectionId;
      newItem={id:++uid,pid:captureParentId,kind:'sub',sectionId:parentSection,item:desc,qty:1,ex:exVal};
    }else{
      captureParentId=null;
    }
  }
  if(!newItem){
    newItem={id:++uid,pid:null,kind:'line',collapsed:false,sectionId:activeSectionId,item:desc,qty:1,ex:exVal};
  }
  basket.push(newItem);
  renderBasket();
}

function renderBasket(){
  ensureSectionState();
  var cont=document.getElementById('basketContainer');
  if(!cont||!bBody||!bFoot){ saveBasket(); return; }
  if(qbDockIcon){ qbDockIcon.textContent='Catalogue'; }
  if(qbTitle){ qbTitle.textContent=basket.length?'Quote Builder ('+basket.length+')':'Quote Builder'; }
  renderSectionTabs();
  if(!basket.length){
    bBody.innerHTML='';
    bFoot.innerHTML='';
    if(grandTotalsEl){ updateGrandTotals(null,{preserveGrandTotal:true}); }
    saveBasket();
    updateBasketHeaderOffset();
    return;
  }
  var fallback=sections[0]?sections[0].id:1;
  if(!sections.some(function(sec){return sec.id===activeSectionId;})){
    activeSectionId=fallback;
  }
  bBody.innerHTML='';
  var childrenMap={};
  for(var i=0;i<basket.length;i++){
    var item=basket[i];
    if(item&&item.pid){
      (childrenMap[item.pid]||(childrenMap[item.pid]=[])).push(item);
    }
  }
  var captureFound=false;
  function renderParent(b){
    if(!sections.some(function(sec){return sec.id===b.sectionId;})){
      b.sectionId=fallback;
    }
    var parentSectionName=getSectionNameById(b.sectionId);
    if(captureParentId===b.id){ captureFound=true; }
    var tr=document.createElement('tr'); tr.className='main-row'; tr.dataset.id=String(b.id||'');
    var tdHandle=document.createElement('td'); tdHandle.className='sort-handle'; tdHandle.textContent='≡'; tr.appendChild(tdHandle);
    var tdSection=document.createElement('td'); tdSection.className='section-cell';
    var secSelect=document.createElement('select'); secSelect.className='section-select';
    for(var si=0;si<sections.length;si++){
      var opt=document.createElement('option');
      opt.value=String(sections[si].id);
      opt.textContent=sections[si].name;
      if(sections[si].id===b.sectionId) opt.selected=true;
      secSelect.appendChild(opt);
    }
    secSelect.value=String(b.sectionId);
    secSelect.onchange=function(){
      var newSectionId=parseInt(secSelect.value,10);
      captureParentId=null;
      setParentSection(b,newSectionId);
      renderBasket();
    };
    tdSection.appendChild(secSelect);
    tr.appendChild(tdSection);
    var tdItem=document.createElement('td');
    var ctrl=document.createElement('span'); ctrl.className='sub-controls';
    var cap=document.createElement('button'); cap.className='subbtn'+(captureParentId===b.id?' active':''); cap.title='Capture catalog adds as sub-items'; cap.textContent='⊞';
    cap.onclick=function(){ captureParentId=(captureParentId===b.id?null:b.id); renderBasket(); };
    var addS=document.createElement('button'); addS.className='subbtn'; addS.title='Add note sub-item'; addS.textContent='+';
    addS.onclick=function(){ basket.push({id:++uid,pid:b.id,kind:'sub',sectionId:b.sectionId,item:'',qty:1,ex:0}); renderBasket(); };
    var tog=document.createElement('button'); tog.className='subbtn'; tog.title='Collapse/expand sub-items'; tog.textContent=b.collapsed?'▸':'▾';
    tog.onclick=function(){ b.collapsed=!b.collapsed; renderBasket(); };
    ctrl.appendChild(cap); ctrl.appendChild(addS); ctrl.appendChild(tog); tdItem.appendChild(ctrl);
    var itemInput=document.createElement('textarea'); itemInput.rows=1; itemInput.value=b.item||''; itemInput.className='editable item-input';
    itemInput.oninput=function(){ b.item=itemInput.value; saveBasket(); };
    tdItem.appendChild(itemInput); tr.appendChild(tdItem);
    var tdQ=document.createElement('td'); var qc=document.createElement('div'); qc.className='qty-controls';
    var minus=document.createElement('button'); minus.textContent='-';
    var inp=document.createElement('input'); inp.type='number'; inp.step='0.1'; inp.className='qty-input'; inp.value=b.qty||1;
    var plus=document.createElement('button'); plus.textContent='+';
    minus.onclick=function(){ b.qty=Math.max(1,(b.qty||1)-1); renderBasket(); };
    plus.onclick=function(){ b.qty=(b.qty||1)+1; renderBasket(); };
    inp.onchange=function(){ b.qty=Math.max(1,parseFloat(inp.value)||1); renderBasket(); };
    qc.appendChild(minus); qc.appendChild(inp); qc.appendChild(plus); tdQ.appendChild(qc); tr.appendChild(tdQ);
    var tdEx=document.createElement('td'); var exInput=document.createElement('input'); exInput.type='number'; exInput.step='0.01'; exInput.className='editable price-input'; exInput.value=isNaN(b.ex)?'':Number(b.ex).toFixed(2);
    exInput.onchange=function(){ var v=parseFloat(exInput.value); b.ex=isFinite(v)?v:NaN; renderBasket(); };
    tdEx.appendChild(exInput); tr.appendChild(tdEx);
    var lineTotal=isNaN(b.ex)?NaN:(b.qty||1)*b.ex;
    var tdLi=document.createElement('td'); tdLi.textContent=isNaN(lineTotal)?'N/A':lineTotal.toFixed(2);
    tr.appendChild(tdLi);
    var tdRem=document.createElement('td'); var x=document.createElement('span'); x.className='remove-btn'; x.textContent='X';
    x.onclick=function(){ var id=b.id; var nb=[]; for(var r=0;r<basket.length;r++){ var it=basket[r]; if(!it) continue; if(it.id===id||it.pid===id) continue; nb.push(it);} basket=nb; if(captureParentId===id) captureParentId=null; renderBasket(); };
    tdRem.appendChild(x); tr.appendChild(tdRem);
    bBody.appendChild(tr);
    if(b.collapsed) return;
    var kids=childrenMap[b.id]||[];
    for(var k=0;k<kids.length;k++){
      (function(s){
        if(typeof s.qty==='undefined'||!isFinite(s.qty)) s.qty=1;
        s.sectionId=b.sectionId;
        var sr=document.createElement('tr'); sr.className='sub-row'; sr.dataset.id=String(s.id||'');
        var c1=document.createElement('td'); c1.textContent=''; sr.appendChild(c1);
        var sectionCell=document.createElement('td'); sectionCell.className='section-cell';
        var sectionLabel=document.createElement('span'); sectionLabel.className='section-readonly'; sectionLabel.textContent=parentSectionName;
        sectionCell.appendChild(sectionLabel); sr.appendChild(sectionCell);
        var c2=document.createElement('td'); c2.className='sub-item-cell'; var t=document.createElement('textarea'); t.rows=1; t.className='editable item-input'; t.value=s.item||''; t.oninput=function(){ s.item=t.value; saveBasket(); }; c2.appendChild(t); sr.appendChild(c2);
        var c3=document.createElement('td'); var qc=document.createElement('div'); qc.className='qty-controls';
        var minus=document.createElement('button'); minus.textContent='-';
        var inp=document.createElement('input'); inp.type='number'; inp.step='0.1'; inp.className='qty-input'; inp.value=s.qty||1;
        var plus=document.createElement('button'); plus.textContent='+';
        minus.onclick=function(){ s.qty=Math.max(1,(s.qty||1)-1); renderBasket(); };
        plus.onclick=function(){ s.qty=(s.qty||1)+1; renderBasket(); };
        inp.onchange=function(){ s.qty=Math.max(1,parseFloat(inp.value)||1); renderBasket(); };
        qc.appendChild(minus); qc.appendChild(inp); qc.appendChild(plus); c3.appendChild(qc); sr.appendChild(c3);
        var c4=document.createElement('td'); var exInput=document.createElement('input'); exInput.type='number'; exInput.step='0.01'; exInput.className='editable price-input'; exInput.value=isNaN(s.ex)?'':Number(s.ex).toFixed(2);
        exInput.onchange=function(){ var v=parseFloat(exInput.value); s.ex=isFinite(v)?v:NaN; renderBasket(); };
        c4.appendChild(exInput); sr.appendChild(c4);
        var lineSubTotal=isNaN(s.ex)?NaN:(s.qty||1)*s.ex;
        var c5=document.createElement('td'); c5.textContent=isNaN(lineSubTotal)?'N/A':lineSubTotal.toFixed(2); sr.appendChild(c5);
        var c6=document.createElement('td'); var rx=document.createElement('span'); rx.className='remove-btn'; rx.textContent='X';
        rx.onclick=function(){ for(var r=basket.length-1;r>=0;r--){ if(basket[r].id===s.id){ basket.splice(r,1); break; } } renderBasket(); };
        c6.appendChild(rx); sr.appendChild(c6);
        bBody.appendChild(sr);
      })(kids[k]);
    }
  }
  for(var i=0;i<basket.length;i++){
    var it=basket[i];
    if(it&&!it.pid){
      if(typeof it.kind==='undefined') it.kind='line';
      if(typeof it.collapsed==='undefined') it.collapsed=false;
      if(typeof it.qty==='undefined'||!isFinite(it.qty)) it.qty=1;
      if(!sections.some(function(sec){return sec.id===it.sectionId;})) it.sectionId=fallback;
      if(it.sectionId===activeSectionId){
        renderParent(it);
      }
    }
  }
  if(captureParentId&&!captureFound){
    captureParentId=null;
  }
  var report=buildReportModel(basket,sections);
  var sectionRef=getSectionById(activeSectionId);
  bFoot.innerHTML='';
  var notesRow=document.createElement('tr');
  var notesCell=document.createElement('td');
  notesCell.colSpan=7;
  notesCell.className='section-notes-cell';
  var wrapper=document.createElement('div'); wrapper.className='section-notes-wrapper';
  var notesId='section-notes-'+activeSectionId;
  var label=document.createElement('label'); label.setAttribute('for',notesId); label.textContent='Notes:';
  var textarea=document.createElement('textarea'); textarea.id=notesId; textarea.placeholder='Add notes for this section';
  textarea.value=sectionRef&&typeof sectionRef.notes==='string'?sectionRef.notes:'';
  textarea.oninput=function(){ if(sectionRef){ sectionRef.notes=textarea.value; saveBasket(); } };
  wrapper.appendChild(label);
  wrapper.appendChild(textarea);
  notesCell.appendChild(wrapper);
  notesRow.appendChild(notesCell);
  bFoot.appendChild(notesRow);
  updateGrandTotals(report);
  if(window.Sortable && !bBody.getAttribute('data-sortable')){
    Sortable.create(bBody,{handle:'.sort-handle',draggable:'tr.main-row',animation:150,onEnd:function(){
      var rows=bBody.querySelectorAll('tr.main-row');
      var order=[];
      for(var k=0;k<rows.length;k++){ order.push(+rows[k].dataset.id); }
      var childMap={};
      for(var t=0;t<basket.length;t++){
        var it=basket[t];
        if(it && it.pid){ (childMap[it.pid]||(childMap[it.pid]=[])).push(it); }
      }
      var parentsById={};
      for(var t2=0;t2<basket.length;t2++){
        var current=basket[t2];
        if(current&&!current.pid){ parentsById[current.id]=current; }
      }
      var sectionId=activeSectionId;
      var orderedParents=[];
      for(var o=0;o<order.length;o++){
        var pid=order[o];
        var parent=parentsById[pid];
        if(parent&&parent.sectionId===sectionId){ orderedParents.push(parent); }
      }
      var seen={};
      for(var op=0;op<orderedParents.length;op++){ seen[orderedParents[op].id]=true; }
      for(var bp=0;bp<basket.length;bp++){
        var candidate=basket[bp];
        if(candidate&&!candidate.pid&&candidate.sectionId===sectionId&&!seen[candidate.id]){
          orderedParents.push(candidate);
          seen[candidate.id]=true;
        }
      }
      var rest=[];
      var insertPos=null;
      var skipParents={};
      for(var idx=0;idx<basket.length;idx++){
        var item=basket[idx];
        if(!item) continue;
        if(item.pid){
          if(skipParents[item.pid]) continue;
          rest.push(item);
          continue;
        }
        if(item.sectionId===sectionId){
          skipParents[item.id]=true;
          if(insertPos===null) insertPos=rest.length;
          continue;
        }
        rest.push(item);
      }
      if(insertPos===null) insertPos=rest.length;
      var sectionBlock=[];
      for(var sp=0;sp<orderedParents.length;sp++){
        var parent=orderedParents[sp];
        sectionBlock.push(parent);
        var kids=childMap[parent.id]||[];
        for(var kc=0;kc<kids.length;kc++){ sectionBlock.push(kids[kc]); }
      }
      basket=rest.slice(0,insertPos).concat(sectionBlock,rest.slice(insertPos));
      saveBasket();
      renderBasket();
    }});
    bBody.setAttribute('data-sortable','1');
  }
  saveBasket();
  updateBasketHeaderOffset();
}
function exportBasketToCsv(opts){
  if(!basket.length) return false;
  var esc=function(v){return '"'+String(v).replace(/"/g,'""')+'"';};
  var report=buildReportModel(basket,sections);
  var lines=[["Section","Item","Quantity","Price","Line Total"]];
  for(var si=0;si<report.sections.length;si++){
    var sec=report.sections[si];
    for(var gi=0;gi<sec.items.length;gi++){
      var grp=sec.items[gi];
      var p=grp.parent; var le=isNaN(p.ex)?NaN:(p.qty||1)*p.ex;
      lines.push([sec.name,(p.item||''),(p.qty||1),isNaN(p.ex)?"N/A":Number(p.ex).toFixed(2),isNaN(le)?"N/A":le.toFixed(2)]);
      var subs=grp.subs||[];
      for(var sj=0;sj<subs.length;sj++){
        var s=subs[sj]; var sle=isNaN(s.ex)?NaN:(s.qty||1)*s.ex;
        lines.push([sec.name,' - '+(s.item||''),(s.qty||1),isNaN(s.ex)?"N/A":Number(s.ex).toFixed(2),isNaN(sle)?"N/A":sle.toFixed(2)]);
      }
    }
    var notes=(sec.notes||'').trim();
    if(notes){
      lines.push(['Section '+(si+1)+' Notes',notes,'','','']);
    }
  }
  var discountedEx=recalcGrandTotal(report.grandEx,discountPercent);
  var gstAfter=calculateGst(discountedEx);
  var grandIncl=roundCurrency(discountedEx+gstAfter);
  lines.push(["Total (Ex GST)","","","",formatCurrency(report.grandEx)]);
  lines.push(["Discount (%)","","","",formatPercent(discountPercent)]);
  lines.push(["Grand Total (Ex GST)","","","",formatCurrency(discountedEx)]);
  lines.push(["GST","","","",formatCurrency(gstAfter)]);
  lines.push(["Grand Total (Incl. GST)","","","",formatCurrency(grandIncl)]);
  var out=[]; for(var r=0;r<lines.length;r++){ var row=lines[r]; for(var c=0;c<row.length;c++){ row[c]=esc(row[c]); } out.push(row.join(',')); }
  var csv=out.join("\n"); var blob=new Blob([csv],{type:"text/csv"}); var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="quote_basket.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if(!(opts&&opts.silent)){ showToast('Quote CSV exported'); }
  return true;
}
function resetQuote(toastMessage){
  basket=[];
  captureParentId=null;
  sections=getDefaultSections();
  ensureSectionState();
  var first=sections[0];
  activeSectionId=first?first.id:1;
  sectionSeq=first?first.id:sectionSeq;
  discountPercent=0;
  currentGrandTotal=0;
  lastBaseTotal=0;
  renderBasket();
  if(toastMessage){ showToast(toastMessage); }
}
function showDeleteDialog(){
  if(document.querySelector('.qb-modal-backdrop')) return;
  var overlay=document.createElement('div'); overlay.className='qb-modal-backdrop';
  var modal=document.createElement('div'); modal.className='qb-modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','qbDeleteTitle');
  var title=document.createElement('h4'); title.id='qbDeleteTitle'; title.textContent='Delete quote?';
  var message=document.createElement('p'); message.textContent='Would you like to export the quote to CSV before deleting?';
  var buttons=document.createElement('div'); buttons.className='qb-modal-buttons';
  var saveBtn=document.createElement('button'); saveBtn.type='button'; saveBtn.textContent='Save CSV';
  var deleteBtn=document.createElement('button'); deleteBtn.type='button'; deleteBtn.textContent='Delete'; deleteBtn.classList.add('danger');
  var cancelBtn=document.createElement('button'); cancelBtn.type='button'; cancelBtn.textContent='Cancel'; cancelBtn.classList.add('neutral');
  buttons.appendChild(saveBtn); buttons.appendChild(deleteBtn); buttons.appendChild(cancelBtn);
  modal.appendChild(title); modal.appendChild(message); modal.appendChild(buttons); overlay.appendChild(modal);
  document.body.appendChild(overlay);
  function closeDialog(){ document.removeEventListener('keydown',handleKey,true); if(overlay&&overlay.parentNode){ overlay.parentNode.removeChild(overlay); } if(clearQuoteBtn){ try{clearQuoteBtn.focus();}catch(e){} } }
  function handleKey(ev){ if(ev.key==='Escape'||ev.key==='Esc'){ ev.preventDefault(); ev.stopPropagation(); closeDialog(); } }
  document.addEventListener('keydown',handleKey,true);
  overlay.addEventListener('click',function(ev){ if(ev.target===overlay){ closeDialog(); }});
  cancelBtn.addEventListener('click',closeDialog);
  saveBtn.addEventListener('click',function(){ var exported=exportBasketToCsv({silent:true}); resetQuote(exported?'Quote exported and deleted':'Quote deleted'); closeDialog(); });
  deleteBtn.addEventListener('click',function(){ resetQuote('Quote deleted'); closeDialog(); });
  setTimeout(function(){ try{saveBtn.focus();}catch(e){} },0);
}
var exportBtn=document.getElementById("exportCsvBtn");
if(exportBtn){
  exportBtn.onclick=function(){ exportBasketToCsv(); };
}
window.__wd_main_ok__=true;
})();

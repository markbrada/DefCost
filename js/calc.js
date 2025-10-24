const GST_RATE = 0.10;

const currencyFormatter = (() => {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (err) {
    return null;
  }
})();

export function lineTotal(qty, price) {
  let q = Number.isFinite(qty) ? qty : 0;
  if (q < 0) {
    q = 0;
  }
  const p = Number.isFinite(price) ? price : 0;
  return q * p;
}

export function roundCurrency(val) {
  if (!isFinite(val)) {
    return 0;
  }
  return Math.round(val * 100) / 100;
}

export function formatCurrency(val) {
  return roundCurrency(isFinite(val) ? val : 0).toFixed(2);
}

export function formatCurrencyWithSymbol(val) {
  const safe = roundCurrency(isFinite(val) ? val : 0);
  if (currencyFormatter) {
    try {
      return currencyFormatter.format(safe);
    } catch (err) {
      // fall through
    }
  }
  const parts = safe.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + parts.join('.');
}

export function formatPercent(val) {
  return roundCurrency(isFinite(val) ? val : 0).toFixed(2);
}

export function recalcGrandTotal(base, discount) {
  const b = isFinite(base) ? base : 0;
  const d = isFinite(discount) ? discount : 0;
  let computed = b * (1 - d / 100);
  if (!isFinite(computed)) {
    computed = 0;
  }
  return roundCurrency(computed < 0 ? 0 : computed);
}

export function calculateGst(amount) {
  const base = isFinite(amount) ? amount : 0;
  return roundCurrency(base * GST_RATE);
}

function clampPercentValue(value) {
  if (!isFinite(value)) {
    return 0;
  }
  let num = +value;
  if (num < 0) {
    num = 0;
  }
  if (num > 100) {
    num = 100;
  }
  return Math.round(num * 100) / 100;
}

function computeEffectivePercent(raw, discounted) {
  const safeRaw = isFinite(raw) ? raw : 0;
  const safeDiscounted = isFinite(discounted) ? discounted : 0;
  if (safeRaw <= 0) {
    return 0;
  }
  const pct = (1 - safeDiscounted / (safeRaw || 1)) * 100;
  if (!isFinite(pct)) {
    return 0;
  }
  return clampPercentValue(pct);
}

export function buildReportModel(basket, sections) {
  const safeSections = Array.isArray(sections) && sections.length
    ? sections
    : [{ id: 1, name: 'Section 1', notes: '' }];

  const sectionsById = {};
  for (let i = 0; i < safeSections.length; i++) {
    sectionsById[safeSections[i].id] = safeSections[i];
  }

  const childMap = {};
  for (let i = 0; i < (basket ? basket.length : 0); i++) {
    const entry = basket[i];
    if (entry && entry.pid) {
      (childMap[entry.pid] || (childMap[entry.pid] = [])).push(entry);
    }
  }

  const secMap = {};
  function ensureSection(id) {
    const source = sectionsById[id];
    if (secMap[id]) {
      secMap[id].notes = source && typeof source.notes === 'string' ? source.notes : '';
      return secMap[id];
    }
    const name = source ? source.name : 'Section ' + id;
    secMap[id] = {
      id: id,
      name: name,
      items: [],
      subtotalEx: 0,
      subtotalGst: 0,
      subtotalTotal: 0,
      notes: source && typeof source.notes === 'string' ? source.notes : ''
    };
    return secMap[id];
  }

  function addAmounts(obj, qty, ex) {
    const lineEx = lineTotal(qty, ex);
    const gst = lineEx * GST_RATE;
    obj.subtotalEx += lineEx;
    obj.subtotalGst += gst;
    obj.subtotalTotal += lineEx + gst;
  }

  for (let i = 0; i < (basket ? basket.length : 0); i++) {
    const item = basket[i];
    if (!item || item.pid) {
      continue;
    }
    const sectionId = item.sectionId || safeSections[0].id;
    const section = ensureSection(sectionId);
    const subs = childMap[item.id] || [];
    section.items.push({ parent: item, subs: subs });
    addAmounts(section, item.qty, item.ex);
    for (let k = 0; k < subs.length; k++) {
      addAmounts(section, subs[k].qty, subs[k].ex);
    }
  }

  const orderedSections = [];
  const seenSections = {};
  for (let i = 0; i < safeSections.length; i++) {
    const entry = ensureSection(safeSections[i].id);
    orderedSections.push(entry);
    seenSections[entry.id] = true;
  }

  for (const id in secMap) {
    if (Object.prototype.hasOwnProperty.call(secMap, id) && !seenSections[id]) {
      orderedSections.push(secMap[id]);
    }
  }

  if (!orderedSections.length) {
    const base = safeSections[0];
    orderedSections.push({
      id: base.id,
      name: base.name,
      items: [],
      subtotalEx: 0,
      subtotalGst: 0,
      subtotalTotal: 0,
      notes: base && typeof base.notes === 'string' ? base.notes : ''
    });
  }

  let totalRawEx = 0;
  let totalDiscountedEx = 0;
  let overrideFloor = 0;

  for (let s = 0; s < orderedSections.length; s++) {
    const section = orderedSections[s];
    const source = sectionsById[section.id];
    const rawEx = roundCurrency(isFinite(section.subtotalEx) ? section.subtotalEx : 0);
    let basePercent = source && isFinite(source.sectionDiscountPercent)
      ? clampPercentValue(source.sectionDiscountPercent)
      : 0;
    let overrideValue = source && source.sectionGrandTotalOverride;
    if (!isFinite(overrideValue)) {
      overrideValue = null;
    }
    if (overrideValue != null) {
      overrideValue = roundCurrency(overrideValue < 0 ? 0 : overrideValue);
      if (overrideValue > rawEx) {
        overrideValue = rawEx;
      }
    }
    let discountedEx;
    if (overrideValue != null) {
      discountedEx = overrideValue;
      basePercent = computeEffectivePercent(rawEx, discountedEx);
      overrideFloor += discountedEx;
    } else {
      discountedEx = roundCurrency(rawEx * (1 - basePercent / 100));
    }
    const gst = calculateGst(discountedEx);
    section.subtotalEx = rawEx;
    section.subtotalGst = gst;
    section.subtotalTotal = roundCurrency(discountedEx + gst);
    section.rawSectionEx = rawEx;
    section.sectionDiscountPercent = basePercent;
    section.sectionGrandTotalOverride = overrideValue;
    section.discountedSectionEx = discountedEx;
    section.effectiveDiscountPercent = computeEffectivePercent(rawEx, discountedEx);
    section.overrideActive = overrideValue != null;
    totalRawEx += rawEx;
    totalDiscountedEx += discountedEx;
  }

  const grandEx = roundCurrency(totalDiscountedEx);
  const grandGst = calculateGst(grandEx);
  const grandTotal = roundCurrency(grandEx + grandGst);
  const effectiveDiscountPercent = computeEffectivePercent(totalRawEx, grandEx);

  return {
    sections: orderedSections,
    grandEx: grandEx,
    grandGst: grandGst,
    grandTotal: grandTotal,
    totalRawEx: roundCurrency(totalRawEx),
    effectiveDiscountPercent: effectiveDiscountPercent,
    overrideFloor: roundCurrency(overrideFloor)
  };
}

export function computeGrandTotalsState({
  report,
  basketCount,
  discountPercent,
  currentGrandTotal,
  lastBaseTotal,
  preserveGrandTotal
}) {
  const totalRawEx = report && isFinite(report.totalRawEx) ? report.totalRawEx : 0;
  const discountedTotal = report && isFinite(report.grandEx) ? report.grandEx : 0;
  const effectiveDiscount = report && isFinite(report.effectiveDiscountPercent)
    ? report.effectiveDiscountPercent
    : computeEffectivePercent(totalRawEx, discountedTotal);
  const hasItems = basketCount > 0;
  const nextGrandTotal = roundCurrency(discountedTotal);
  const nextLastBase = totalRawEx;
  const gstAmount = calculateGst(nextGrandTotal);
  const grandIncl = roundCurrency(nextGrandTotal + gstAmount);

  if (!hasItems) {
    return {
      hasItems: false,
      base: totalRawEx,
      discountPercent: effectiveDiscount,
      currentGrandTotal: 0,
      lastBaseTotal: 0,
      gstAmount: 0,
      grandIncl: 0
    };
  }

  return {
    hasItems: true,
    base: totalRawEx,
    discountPercent: effectiveDiscount,
    currentGrandTotal: nextGrandTotal,
    lastBaseTotal: nextLastBase,
    gstAmount: gstAmount,
    grandIncl: grandIncl
  };
}

export { GST_RATE };

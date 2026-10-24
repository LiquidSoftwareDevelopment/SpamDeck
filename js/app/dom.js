/* SpamDeck — tiny DOM helpers. No framework, no build. */
(function (root) {
  'use strict';
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function hue(s) { var x = 0; String(s).split('').forEach(function (ch) { x = (x * 31 + ch.charCodeAt(0)) % 360; }); return x; }
  function initials(name) {
    var parts = String(name || '?').replace(/[^A-Za-z0-9 &]/g, '').split(/\s+/).filter(function (p) { return p && p !== '&'; });
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
  }
  // Initials on a colour disc. Decorative: the name is always printed beside it, so screen readers skip it.
  // Lightness 33% keeps white initials at 4.5:1 or better on every hue (40% fell to 3.3:1 on yellow-greens).
  function monogram(name) {
    return h('span', { class: 'monogram', style: { background: 'hsl(' + hue(name) + ' 42% 33%)' }, 'aria-hidden': 'true' }, initials(name));
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }
  function fmtTime(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  // Tie each .field's label to its control (for/id), so the label names the control for screen readers and a
  // click on the label focuses it. Labels that already wrap their control are left alone.
  var uid = 0;
  function linkLabels(scope) {
    if (!scope) return scope;
    Array.prototype.forEach.call(scope.querySelectorAll('.field'), function (f) {
      var label = f.querySelector('label');
      if (!label || label.control || label.querySelector('input, select, textarea')) return;
      var ctl = f.querySelector('input, select, textarea');
      if (!ctl) return;
      if (!ctl.id) ctl.id = 'fld-' + (++uid);
      label.htmlFor = ctl.id;
    });
    return scope;
  }
  root.SpamDeck = root.SpamDeck || {};
  root.SpamDeck.dom = { h: h, clear: clear, hue: hue, initials: initials, monogram: monogram, fmtDate: fmtDate, fmtTime: fmtTime, plural: plural, linkLabels: linkLabels };
})(window);

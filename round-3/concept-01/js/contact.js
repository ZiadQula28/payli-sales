/* Payli Concept 01: the enquiry letter. No backend: the form composes an email in the visitor's own mail app.
   Nothing is sent from this page. */
(function () {
  'use strict';
  var form = document.getElementById('hs-form');
  if (!form) return;
  var errors = document.getElementById('hs-form-errors');
  var after = document.getElementById('hs-form-after');
  var copyBtn = document.getElementById('hs-copy');
  var copySaid = document.getElementById('hs-copy-said');
  var TO = 'info@payli.io';

  function val(name) { var f = form.elements[name]; return f ? String(f.value || '').trim() : ''; }

  function check() {
    var list = [];
    if (!val('name')) list.push(['hs-f-name', 'Please tell us your name, so that we know whom to answer.']);
    if (!val('company')) list.push(['hs-f-company', 'Please name your restaurant or company.']);
    var email = val('email');
    if (!email) list.push(['hs-f-email', 'Please give an email address we can reply to.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) list.push(['hs-f-email', 'That email address looks incomplete. Please check it.']);
    return list;
  }

  function compose() {
    var interest = val('interest') || 'Both';
    var lines = [
      'Name: ' + val('name'),
      'Restaurant or company: ' + val('company'),
    ];
    if (val('role')) lines.push('Role: ' + val('role'));
    lines.push('Email: ' + val('email'));
    if (val('phone')) lines.push('Phone: ' + val('phone'));
    lines.push('Interested in: ' + interest);
    if (val('venues')) lines.push('Number of venues: ' + val('venues'));
    if (val('message')) { lines.push(''); lines.push(val('message')); }
    return {
      subject: 'Payli enquiry: ' + interest + ' — ' + val('company'),
      body: lines.join('\n'),
    };
  }

  function showErrors(list) {
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (f) { f.removeAttribute('aria-invalid'); });
    if (!list.length) { errors.hidden = true; errors.textContent = ''; return; }
    var ul = document.createElement('ul');
    list.forEach(function (pair) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + pair[0]; a.textContent = pair[1];
      a.addEventListener('click', function (e) { e.preventDefault(); document.getElementById(pair[0]).focus(); });
      li.appendChild(a); ul.appendChild(li);
      document.getElementById(pair[0]).setAttribute('aria-invalid', 'true');
    });
    errors.textContent = '';
    errors.appendChild(ul);
    errors.hidden = false;
    document.getElementById(list[0][0]).focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var list = check();
    showErrors(list);
    if (list.length) { after.hidden = true; return; }
    var mail = compose();
    after.hidden = false;
    copySaid.textContent = '';
    window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(mail.subject) + '&body=' + encodeURIComponent(mail.body);
  });

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true' && String(e.target.value).trim()) e.target.removeAttribute('aria-invalid');
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var done = false;
    try { done = document.execCommand('copy'); } catch (err) { done = false; }
    document.body.removeChild(ta);
    return done;
  }
  copyBtn.addEventListener('click', function () {
    var mail = compose();
    var text = 'To: ' + TO + '\nSubject: ' + mail.subject + '\n\n' + mail.body;
    function said(ok) { copySaid.textContent = ok ? 'Copied. Paste it into an email to ' + TO + '.' : 'Copying is not available here. Please write to ' + TO + '.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { said(true); }, function () { said(fallbackCopy(text)); });
    } else { said(fallbackCopy(text)); }
  });
})();

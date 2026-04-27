(function () {
  function $(id) { return document.getElementById(id); }

  const form = $('downloadGateForm');
  if (!form) return;

  const nameEl = $('name');
  const emailEl = $('email');
  const updatesEl = $('updates');
  const statusEl = $('status');


  const link = document.getElementById("downloadLink");
  const fileName = link?.dataset?.file || null;

  function showStatus(title, msg) {
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = `<strong>${title}</strong> <br>${msg}`;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  async function submitToServer(payload) {
    const res = await fetch('/api/download-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = (data && (data.error || data.message))
        ? (data.error || data.message)
        : 'Please try again.';
      throw new Error(msg);
    }
  }

  async function handleGate() {
    const nameVal = (nameEl.value || '').trim();
    const emailVal = (emailEl.value || '').trim();
    const updatesVal = !!updatesEl.checked;
  
    const linkWrap = $('downloadLinkWrap');
    const submitBtn = $('submitBtn');
	
    if (!nameVal) {
      linkWrap.classList.add('hidden');
      showStatus('Name required', 'Please enter your name to continue.');
      nameEl.focus();
      return;
    }

    if (emailVal && !validEmail(emailVal)) {
      linkWrap.classList.add('hidden');
      showStatus(
        'Check your email',
        'That email address doesn’t look valid. You can also leave it blank.'
      );
      emailEl.focus();
      return;
    }

    submitBtn.disabled = true;
    showStatus('Saving…', 'Please wait.');

    try {
      await submitToServer({
        name: nameVal,
        email: emailVal || null,
        updates: updatesVal,
        file_name: fileName
      });

      try {
        localStorage.setItem('mouseeyes_download_name', nameVal);
        localStorage.setItem('mouseeyes_download_email', emailVal);
        localStorage.setItem(
          'mouseeyes_download_updates',
          updatesVal ? 'yes' : 'no'
        );
      } catch (_) {}

      showStatus('Thanks!', 'Your download link is ready below.');
      linkWrap.classList.remove('hidden');

      const link = $('downloadLink');
      if (link) link.focus({ preventScroll: true });
    } catch (err) {
      linkWrap.classList.add('hidden');
      showStatus(
        'Could not save',
        err?.message || 'An unexpected error occurred.'
      );
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleGate();
  });

  emailEl.addEventListener('input', function () {
    if (!emailEl.value.trim()) {
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = !validEmail(emailEl.value);
  });
})();
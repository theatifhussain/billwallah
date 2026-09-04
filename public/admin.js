
let data = [];

const $ = (selector) => document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { error: text || 'Request failed' };
  }

  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return result;
}

async function boot() {
  try {
    const me = await api('/api/admin/me');

    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');

    const who = $('#adminEmail');
    if (who) who.textContent = me.email;

    await load();
  } catch {
    $('#login').classList.remove('hidden');
    $('#app').classList.add('hidden');
  }
}

async function load() {
  try {
    data = await api('/api/admin/submissions');
    render();
  } catch (error) {
    if (error.message === 'Unauthorized') {
      location.reload();
      return;
    }

    alert(error.message);
  }
}

function render() {
  const counts = {
    Total: data.length,
    Pending: data.filter(x => x.status === 'Pending').length,
    Approved: data.filter(x => x.status === 'Approved').length,
    Rejected: data.filter(x => x.status === 'Rejected').length,
    Paid: data.filter(x => x.paymentStatus === 'Paid').length,
    'Total Payout': data.filter(x => x.paymentStatus === 'Paid').length * 15
  };

  $('#cards').innerHTML = Object.entries(counts).map(([key, value]) => `
    <div class="card">
      <small>${esc(key)}</small>
      <b>${key === 'Total Payout' ? '₹' : ''}${value.toLocaleString('en-IN')}</b>
    </div>
  `).join('');

  drawRows();
}

function drawRows() {
  const query = $('#search').value.toLowerCase().trim();
  const filter = $('#filter').value;

  const rows = data.filter(item => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'Paid' && item.paymentStatus === 'Paid') ||
      item.status === filter;

    const searchable = [
      item.submissionId,
      item.mobileNumber,
      item.status,
      item.paymentStatus
    ].join(' ').toLowerCase();

    return matchesFilter && searchable.includes(query);
  });

  $('#rows').innerHTML = rows.map(item => `
    <tr>
      <td>
        <b>${esc(item.submissionId)}</b>
        <br>
        <span class="muted">${formatDate(item.submittedAt)}</span>
      </td>

      <td>
        <b>${esc(item.mobileNumber)}</b>
      </td>

      <td>
        <span class="pill ${
          item.status === 'Approved' ? 'green' :
          item.status === 'Rejected' ? 'red' : ''
        }">${esc(item.status)}</span>
      </td>

      <td>
        <span class="pill ${
          item.paymentStatus === 'Paid' ? 'green' : ''
        }">${esc(item.paymentStatus)}</span>
      </td>

      <td>
        ${item.approvalTimestamp ? formatDate(item.approvalTimestamp) : '—'}
      </td>

      <td>
        <button class="link-btn" onclick="openDetail('${esc(item.submissionId)}')">
          Open →
        </button>
      </td>
    </tr>
  `).join('') || `
    <tr>
      <td colspan="6" class="muted">No submissions found.</td>
    </tr>
  `;
}

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

async function openDetail(id) {
  try {
    const item = await api('/api/admin/submissions/' + encodeURIComponent(id));

    $('#modal').classList.remove('hidden');

    const canPay = item.status === 'Approved' && item.paymentStatus !== 'Paid';

    $('#detail').innerHTML = `
      <p class="eyebrow">Submission detail</p>
      <h2>${esc(item.submissionId)}</h2>

      <div class="detail-grid">
        <div class="detail-item">
          <small>Mobile Number</small>
          <b>${esc(item.mobileNumber)}</b>
        </div>

        <div class="detail-item">
          <small>Submitted</small>
          <b>${formatDate(item.submittedAt)}</b>
        </div>

        <div class="detail-item">
          <small>Status</small>
          <b>${esc(item.status)}</b>
        </div>

        <div class="detail-item">
          <small>Payout</small>
          <b>${esc(item.paymentStatus)}</b>
        </div>
      </div>

      <h3>Proof</h3>

      <div class="proofs">
        <div class="proof">
          <a href="/api/admin/proof/${encodeURIComponent(item.instagramScreenshot)}" target="_blank" rel="noopener">
            <img src="/api/admin/proof/${encodeURIComponent(item.instagramScreenshot)}" alt="Instagram proof">
          </a>
          <p>Instagram Proof · Open larger</p>
        </div>

        <div class="proof">
          <a href="/api/admin/proof/${encodeURIComponent(item.youtubeScreenshot)}" target="_blank" rel="noopener">
            <img src="/api/admin/proof/${encodeURIComponent(item.youtubeScreenshot)}" alt="YouTube proof">
          </a>
          <p>YouTube Proof · Open larger</p>
        </div>

        <div class="proof">
          <a href="/api/admin/proof/${encodeURIComponent(item.founderInstagramScreenshot)}" target="_blank" rel="noopener">
            <img src="/api/admin/proof/${encodeURIComponent(item.founderInstagramScreenshot)}" alt="Founder Instagram proof">
          </a>
          <p>Founder Instagram Proof · Open larger</p>
        </div>
      </div>

      <div class="actions">
        <button onclick="updateStatus('${esc(item.submissionId)}','Approved')" ${
          item.status === 'Approved' || item.status === 'Rejected' ? 'disabled' : ''
        }>Approve</button>

        <div>
          <textarea id="reason" placeholder="Rejection reason">${esc(item.rejectionReason)}</textarea>
          <button class="danger" onclick="updateStatus('${esc(item.submissionId)}','Rejected')" ${
            item.status === 'Approved' ? 'disabled' : ''
          }>Reject</button>
        </div>
      </div>

      <div class="pay">
        <h3>Payout — ₹15</h3>
        <p>
          Approved = user qualified.
          Paid = the team has actually sent ₹15.
        </p>

        <div class="pay-grid">
          <input id="utr" placeholder="Payment Reference / UTR" value="${esc(item.paymentReference)}">
          <input id="notes" placeholder="Admin note" value="${esc(item.adminNotes)}">

          <button onclick="markPaid('${esc(item.submissionId)}')" ${
            canPay ? '' : 'disabled'
          }>
            ${item.paymentStatus === 'Paid' ? 'Already Paid' : 'Mark as Paid'}
          </button>
        </div>
      </div>
    `;
  } catch (error) {
    alert(error.message);
  }
}

async function updateStatus(id, status) {
  const body = { status };

  if (status === 'Rejected') {
    body.rejectionReason = $('#reason')?.value.trim() || '';

    if (!body.rejectionReason) {
      alert('Please enter a rejection reason.');
      return;
    }
  }

  try {
    await api('/api/admin/submissions/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    closeModal();
    await load();
  } catch (error) {
    alert(error.message);
  }
}

async function markPaid(id) {
  const utr = $('#utr')?.value.trim() || '';
  const notes = $('#notes')?.value.trim() || '';

  if (!utr) {
    alert('Enter the Payment Reference / UTR before marking this as paid.');
    return;
  }

  try {
    await api('/api/admin/submissions/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentStatus: 'Paid',
        paymentReference: utr,
        adminNotes: notes
      })
    });

    closeModal();
    await load();
  } catch (error) {
    alert(error.message);
  }
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();

  const button = event.target.querySelector('button');
  const errorBox = $('#loginError');

  errorBox.textContent = '';
  button.disabled = true;
  button.textContent = 'Signing in…';

  try {
    await api('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.target))
      )
    });

    await boot();

  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST' });
  } finally {
    location.reload();
  }
});

$('#search').addEventListener('input', drawRows);
$('#filter').addEventListener('change', drawRows);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

boot();

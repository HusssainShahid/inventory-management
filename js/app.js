(function () {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
  const TABLE = 'items';

  let supabase = null;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_PROJECT')) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const els = {
    list: document.getElementById('itemList'),
    empty: document.getElementById('emptyState'),
    loading: document.getElementById('loading'),
    message: document.getElementById('message'),
    search: document.getElementById('searchInput'),
    form: document.getElementById('itemForm'),
    modal: document.getElementById('itemModal'),
    modalLabel: document.getElementById('itemModalLabel'),
    itemId: document.getElementById('itemId'),
    itemName: document.getElementById('itemName'),
    itemQuantity: document.getElementById('itemQuantity'),
    itemLocation: document.getElementById('itemLocation'),
    btnSubmit: document.getElementById('btnSubmit'),
  };

  let allItems = [];

  function showMessage(text, type) {
    els.message.textContent = text;
    els.message.className = 'alert alert-' + (type || 'info') + (type ? '' : '');
    els.message.classList.remove('d-none');
    setTimeout(function () {
      els.message.classList.add('d-none');
    }, 4000);
  }

  function showLoading(show) {
    els.loading.classList.toggle('d-none', !show);
    els.list.classList.toggle('d-none', show);
    els.empty.classList.add('d-none');
  }

  function formatUpdatedAt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + ' hr ago';
    if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderList(items) {
    if (!items.length) {
      els.list.classList.add('d-none');
      els.empty.classList.remove('d-none');
      return;
    }
    els.empty.classList.add('d-none');
    els.list.classList.remove('d-none');
    els.list.innerHTML = items.map(function (row) {
      return (
        '<li class="inv-item" data-id="' + escapeHtml(row.id) + '">' +
          '<span class="inv-item-name-qty">' + escapeHtml(row.item) + ' <span class="inv-item-paren">(' + escapeHtml(String(row.quantity)) + ')</span></span>' +
          '<span class="inv-item-loc-wrap">' +
            '<span class="inv-item-label">Location</span> ' +
            '<span class="inv-item-loc">' + (row.location ? escapeHtml(row.location) : '—') + '</span>' +
          '</span>' +
          '<div class="inv-item-actions">' +
            '<button type="button" class="btn btn-sm btn-edit" aria-label="Edit">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-delete" aria-label="Delete">Delete</button>' +
          '</div>' +
        '</li>'
      );
    }).join('');

    els.list.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const li = btn.closest('.inv-item');
        const id = li.getAttribute('data-id');
        const item = allItems.find(function (i) { return i.id === id; });
        if (item) {
          openEditModal(item);
          bootstrap.Modal.getOrCreateInstance(els.modal).show();
        }
      });
    });
    els.list.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const li = btn.closest('.inv-item');
        const id = li.getAttribute('data-id');
        if (id && confirm('Delete this item?')) deleteItem(id);
      });
    });
  }

  function applySearchAndFilter() {
    const q = (els.search.value || '').trim().toLowerCase();
    const filtered = allItems.filter(function (row) {
      return !q || (row.item && row.item.toLowerCase().includes(q)) || (row.location && row.location.toLowerCase().includes(q));
    });
    renderList(filtered);
  }

  function openAddModal() {
    els.itemId.value = '';
    els.modalLabel.textContent = 'Add item';
    els.btnSubmit.textContent = 'Save';
    els.form.reset();
    els.itemId.value = '';
    els.itemQuantity.value = '1';
  }

  function openEditModal(item) {
    els.itemId.value = item.id;
    els.itemName.value = item.item || '';
    els.itemQuantity.value = item.quantity != null ? item.quantity : 1;
    els.itemLocation.value = item.location || '';
    els.modalLabel.textContent = 'Edit item';
    els.btnSubmit.textContent = 'Update';
  }

  function loadItems() {
    if (!supabase) {
      showMessage('Configure Supabase URL and anon key in js/config.js', 'warning');
      showLoading(false);
      renderList([]);
      return;
    }
    showLoading(true);
    supabase.from(TABLE).select('id,item,quantity,location,updated_at').order('updated_at', { ascending: false })
      .then(function (res) {
        showLoading(false);
        if (res.error) {
          showMessage(res.error.message || 'Failed to load items', 'danger');
          allItems = [];
        } else {
          allItems = res.data || [];
          applySearchAndFilter();
        }
      })
      .catch(function (err) {
        showLoading(false);
        showMessage(err.message || 'Failed to load items', 'danger');
        allItems = [];
        renderList([]);
      });
  }

  function deleteItem(id) {
    if (!supabase) return;
    supabase.from(TABLE).delete().eq('id', id)
      .then(function (res) {
        if (res.error) {
          showMessage(res.error.message || 'Delete failed', 'danger');
        } else {
          allItems = allItems.filter(function (i) { return i.id !== id; });
          applySearchAndFilter();
          showMessage('Item deleted', 'success');
        }
      })
      .catch(function (err) {
        showMessage(err.message || 'Delete failed', 'danger');
      });
  }

  function submitForm(e) {
    e.preventDefault();
    if (!supabase) return;
    const id = els.itemId.value.trim();
    const payload = {
      item: els.itemName.value.trim(),
      quantity: parseInt(els.itemQuantity.value, 10) || 0,
      location: els.itemLocation.value.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      supabase.from(TABLE).update(payload).eq('id', id)
        .then(function (res) {
          if (res.error) {
            showMessage(res.error.message || 'Update failed', 'danger');
          } else {
            var idx = allItems.findIndex(function (i) { return i.id === id; });
            if (idx !== -1) allItems[idx] = Object.assign({ id: id }, payload);
            applySearchAndFilter();
            bootstrap.Modal.getInstance(els.modal).hide();
            showMessage('Item updated', 'success');
          }
        })
        .catch(function (err) {
          showMessage(err.message || 'Update failed', 'danger');
        });
    } else {
      supabase.from(TABLE).insert(payload).select().single()
        .then(function (res) {
          if (res.error) {
            showMessage(res.error.message || 'Add failed', 'danger');
          } else {
            var newRow = res.data;
            if (newRow) {
              allItems.unshift(newRow);
              applySearchAndFilter();
            }
            bootstrap.Modal.getInstance(els.modal).hide();
            showMessage('Item added', 'success');
          }
        })
        .catch(function (err) {
          showMessage(err.message || 'Add failed', 'danger');
        });
    }
  }

  els.search.addEventListener('input', applySearchAndFilter);

  document.getElementById('btnAdd').addEventListener('click', function () {
    openAddModal();
  });

  els.modal.addEventListener('show.bs.modal', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.classList.contains('btn-edit')) {
      openAddModal();
    }
  });

  els.form.addEventListener('submit', submitForm);

  loadItems();
})();

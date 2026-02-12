(function () {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
  const TABLE_ITEMS = 'items';
  const TABLE_ISSUED = 'issued';

  let supabase = null;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_PROJECT')) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const els = {
    list: document.getElementById('itemList'),
    empty: document.getElementById('emptyState'),
    loading: document.getElementById('loading'),
    search: document.getElementById('searchInput'),
    form: document.getElementById('itemForm'),
    modal: document.getElementById('itemModal'),
    modalLabel: document.getElementById('itemModalLabel'),
    itemId: document.getElementById('itemId'),
    itemName: document.getElementById('itemName'),
    itemQuantity: document.getElementById('itemQuantity'),
    itemLocation: document.getElementById('itemLocation'),
    btnSubmit: document.getElementById('btnSubmit'),
    issuedBody: document.getElementById('issuedBody'),
    issuedEmpty: document.getElementById('issuedEmpty'),
    issueLoading: document.getElementById('issueLoading'),
    issueForm: document.getElementById('issueForm'),
    issueModal: document.getElementById('issueModal'),
    issueModalLabel: document.getElementById('issueModalLabel'),
    issueId: document.getElementById('issueId'),
    issueItemId: document.getElementById('issueItemId'),
    issueIssuedTo: document.getElementById('issueIssuedTo'),
    issueIssuedAt: document.getElementById('issueIssuedAt'),
    issueQuantity: document.getElementById('issueQuantity'),
    issueReturnQty: document.getElementById('issueReturnQty'),
    issueReturnDate: document.getElementById('issueReturnDate'),
    issueBtnSubmit: document.getElementById('issueBtnSubmit'),
    issueSearch: document.getElementById('issueSearchInput'),
  };

  let allItems = [];
  let allIssued = [];
  let filteredIssued = [];
  let issuedSumsByItemId = {};
  let toastTimeout = null;

  function hideToast() {
    var toast = document.getElementById('toast');
    if (toast) toast.classList.remove('inv-toast-visible');
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }

  function showToast(text, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    var textEl = toast.querySelector('.inv-toast-text');
    var closeBtn = toast.querySelector('.inv-toast-close');
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.className = 'inv-toast inv-toast-' + (type || 'info');
    if (textEl) textEl.textContent = text;
    toast.classList.add('inv-toast-visible');
    closeBtn.onclick = hideToast;
    toastTimeout = setTimeout(hideToast, 5000);
  }

  function showMessage(text, type) {
    showToast(text, type);
  }

  function showIssueMessage(text, type) {
    showToast(text, type);
  }

  function showLoading(show) {
    els.loading.classList.toggle('d-none', !show);
    els.list.classList.toggle('d-none', show);
    els.empty.classList.add('d-none');
    document.getElementById('itemListHeader').classList.add('d-none');
  }

  function showIssueLoading(show) {
    els.issueLoading.classList.toggle('d-none', !show);
    document.getElementById('issuedTable').classList.toggle('d-none', show);
    els.issuedEmpty.classList.add('d-none');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toISOString().slice(0, 10);
  }

  /* Net issued = quantity still out (issued minus returned) per item */
  function computeIssuedSums() {
    var sums = {};
    allIssued.forEach(function (r) {
      var id = r.item_id;
      var issued = r.quantity_issued || 0;
      var returned = r.return_quantity != null ? r.return_quantity : 0;
      var netOut = Math.max(0, issued - returned);
      sums[id] = (sums[id] || 0) + netOut;
    });
    issuedSumsByItemId = sums;
  }

  function renderList(items) {
    if (!items.length) {
      els.list.classList.add('d-none');
      els.empty.classList.remove('d-none');
      document.getElementById('itemListHeader').classList.add('d-none');
      return;
    }
    els.empty.classList.add('d-none');
    document.getElementById('itemListHeader').classList.remove('d-none');
    els.list.classList.remove('d-none');
    els.list.innerHTML = items.map(function (row) {
      var total = row.quantity != null ? row.quantity : 0;
      var issued = issuedSumsByItemId[row.id] || 0;
      var hasIssued = issued > 0;
      var itemClass = hasIssued ? 'inv-item inv-item-has-issued' : 'inv-item';
      return (
        '<li class="' + itemClass + '" data-id="' + escapeHtml(row.id) + '">' +
          '<span class="inv-item-name-qty">' + escapeHtml(row.item) + '</span>' +
          '<span class="inv-item-total">' + total + '</span>' +
          '<span class="inv-item-issued">' + issued + '</span>' +
          '<span class="inv-item-loc-wrap"><span class="inv-item-loc">' + (row.location ? escapeHtml(row.location) : '—') + '</span></span>' +
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
        var li = btn.closest('.inv-item');
        var id = li.getAttribute('data-id');
        var item = allItems.find(function (i) { return i.id === id; });
        if (item) {
          openEditModal(item);
          bootstrap.Modal.getOrCreateInstance(els.modal).show();
        }
      });
    });
    els.list.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var li = btn.closest('.inv-item');
        var id = li.getAttribute('data-id');
        if (id && confirm('Delete this item?')) deleteItem(id);
      });
    });
  }

  function applySearchAndFilter() {
    var q = (els.search.value || '').trim().toLowerCase();
    var filtered = allItems.filter(function (row) {
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
    els.itemName.value = '';
    els.itemQuantity.value = '';
    els.itemLocation.value = '';
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
    Promise.all([
      supabase.from(TABLE_ITEMS).select('id,item,quantity,location,updated_at').order('updated_at', { ascending: false }),
      supabase.from(TABLE_ISSUED).select('id,item_id,issued_to,issued_at,quantity_issued,return_quantity,return_date').order('issued_at', { ascending: false })
    ]).then(function (results) {
      var itemsRes = results[0];
      var issuedRes = results[1];
      showLoading(false);
      if (itemsRes.error) {
        showMessage(itemsRes.error.message || 'Failed to load items', 'danger');
        allItems = [];
      } else {
        allItems = itemsRes.data || [];
      }
      if (!issuedRes.error && issuedRes.data) {
        allIssued = issuedRes.data;
        filteredIssued = allIssued;
      } else {
        allIssued = [];
        filteredIssued = [];
      }
      computeIssuedSums();
      applySearchAndFilter();
      refreshIssueItemDropdown();
      if (document.getElementById('tab-issued').classList.contains('active') || window.matchMedia('(min-width: 768px)').matches) {
        applyIssueSearchAndFilter();
      }
    }).catch(function (err) {
      showLoading(false);
      showMessage(err.message || 'Failed to load', 'danger');
      allItems = [];
      allIssued = [];
      issuedSumsByItemId = {};
      renderList([]);
    });
  }

  function loadIssued() {
    if (!supabase) {
      showIssueMessage('Configure Supabase in js/config.js', 'warning');
      showIssueLoading(false);
      renderIssuedTable([]);
      return;
    }
    showIssueLoading(true);
    supabase.from(TABLE_ISSUED).select('id,item_id,issued_to,issued_at,quantity_issued,return_quantity,return_date').order('issued_at', { ascending: false })
      .then(function (res) {
        showIssueLoading(false);
        if (res.error) {
          showIssueMessage(res.error.message || 'Failed to load issued', 'danger');
          allIssued = [];
        } else {
          allIssued = res.data || [];
          filteredIssued = allIssued;
        }
        applyIssueSearchAndFilter();
      })
      .catch(function (err) {
        showIssueLoading(false);
        showIssueMessage(err.message || 'Failed to load issued', 'danger');
        renderIssuedTable([]);
      });
  }

  function refreshIssueItemDropdown() {
    var sel = els.issueItemId;
    var current = sel.value;
    sel.innerHTML = '<option value="">Select item</option>' + (allItems || []).map(function (i) {
      return '<option value="' + escapeHtml(i.id) + '">' + escapeHtml(i.item) + '</option>';
    }).join('');
    if (current) sel.value = current;
  }

  function applyIssueSearchAndFilter() {
    var q = (els.issueSearch.value || '').trim().toLowerCase();
    var itemNameById = {};
    allItems.forEach(function (i) { itemNameById[i.id] = i.item; });
    filteredIssued = allIssued.filter(function (r) {
      if (!q) return true;
      var name = (itemNameById[r.item_id] || '').toLowerCase();
      var issuedTo = (r.issued_to || '').toLowerCase();
      return name.includes(q) || issuedTo.includes(q);
    });
    renderIssuedTable(filteredIssued);
  }

  function renderIssuedTable(rows) {
    var itemNameById = {};
    allItems.forEach(function (i) { itemNameById[i.id] = i.item; });
    if (!rows.length) {
      els.issuedBody.innerHTML = '';
      document.getElementById('issuedTable').classList.add('d-none');
      els.issuedEmpty.classList.remove('d-none');
      return;
    }
    els.issuedEmpty.classList.add('d-none');
    document.getElementById('issuedTable').classList.remove('d-none');
    els.issuedBody.innerHTML = rows.map(function (r) {
      var name = itemNameById[r.item_id] || '—';
      var returnQty = r.return_quantity != null ? r.return_quantity : 0;
      var qtyIssued = r.quantity_issued || 0;
      var isReturned = returnQty >= qtyIssued && qtyIssued > 0;
      var rowClass = isReturned ? 'table-success' : 'table-danger';
      return (
        '<tr class="' + rowClass + '" data-id="' + escapeHtml(r.id) + '">' +
          '<td>' + escapeHtml(name) + '</td>' +
          '<td>' + escapeHtml(r.issued_to || '') + '</td>' +
          '<td>' + formatDate(r.issued_at) + '</td>' +
          '<td>' + escapeHtml(String(qtyIssued)) + '</td>' +
          '<td>' + escapeHtml(String(returnQty)) + '</td>' +
          '<td>' + formatDate(r.return_date) + '</td>' +
          '<td class="inv-issued-actions">' +
            '<button type="button" class="btn btn-sm btn-edit-issue" aria-label="Edit">Edit</button> ' +
            '<button type="button" class="btn btn-sm btn-delete-issue" aria-label="Delete">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    els.issuedBody.querySelectorAll('.btn-edit-issue').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tr = btn.closest('tr');
        var id = tr.getAttribute('data-id');
        var rec = allIssued.find(function (r) { return r.id === id; });
        if (rec) {
          openEditIssueModal(rec);
          bootstrap.Modal.getOrCreateInstance(els.issueModal).show();
        }
      });
    });
    els.issuedBody.querySelectorAll('.btn-delete-issue').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var tr = btn.closest('tr');
        var id = tr.getAttribute('data-id');
        if (id && confirm('Delete this issue record?')) deleteIssue(id);
      });
    });
  }

  function openAddIssueModal() {
    els.issueId.value = '';
    els.issueModalLabel.textContent = 'Add issue record';
    els.issueBtnSubmit.textContent = 'Save';
    els.issueForm.reset();
    els.issueId.value = '';
    els.issueReturnQty.value = '0';
    els.issueReturnDate.value = '';
    els.issueQuantity.value = '1';
    var today = new Date().toISOString().slice(0, 10);
    els.issueIssuedAt.value = today;
    refreshIssueItemDropdown();
  }

  function openEditIssueModal(rec) {
    els.issueId.value = rec.id;
    els.issueItemId.value = rec.item_id || '';
    els.issueIssuedTo.value = rec.issued_to || '';
    els.issueIssuedAt.value = formatDate(rec.issued_at) || '';
    els.issueQuantity.value = rec.quantity_issued != null ? rec.quantity_issued : 1;
    els.issueReturnQty.value = rec.return_quantity != null ? rec.return_quantity : 0;
    els.issueReturnDate.value = formatDate(rec.return_date) || '';
    els.issueModalLabel.textContent = 'Edit issue record';
    els.issueBtnSubmit.textContent = 'Update';
    refreshIssueItemDropdown();
  }

  function deleteItem(id) {
    if (!supabase) return;
    supabase.from(TABLE_ITEMS).delete().eq('id', id)
      .then(function (res) {
        if (res.error) {
          showMessage(res.error.message || 'Delete failed', 'danger');
        } else {
          allItems = allItems.filter(function (i) { return i.id !== id; });
          loadIssuedForSums();
          applySearchAndFilter();
          showMessage('Item deleted', 'success');
        }
      })
      .catch(function (err) { showMessage(err.message || 'Delete failed', 'danger'); });
  }

  function loadIssuedForSums() {
    if (!supabase) return;
    supabase.from(TABLE_ISSUED).select('id,item_id,issued_to,issued_at,quantity_issued,return_quantity,return_date').order('issued_at', { ascending: false })
      .then(function (res) {
        allIssued = res.data || [];
        filteredIssued = allIssued;
        computeIssuedSums();
        applySearchAndFilter();
        if (document.getElementById('tab-issued').classList.contains('active')) {
          applyIssueSearchAndFilter();
        }
      });
  }

  function deleteIssue(id) {
    if (!supabase) return;
    supabase.from(TABLE_ISSUED).delete().eq('id', id)
      .then(function (res) {
        if (res.error) {
          showIssueMessage(res.error.message || 'Delete failed', 'danger');
        } else {
          allIssued = allIssued.filter(function (r) { return r.id !== id; });
          filteredIssued = allIssued;
          applyIssueSearchAndFilter();
          loadIssuedForSums();
          showIssueMessage('Issue record deleted', 'success');
        }
      })
      .catch(function (err) { showIssueMessage(err.message || 'Delete failed', 'danger'); });
  }

  function submitForm(e) {
    e.preventDefault();
    if (!supabase) return;
    var id = els.itemId.value.trim();
    var payload = {
      item: els.itemName.value.trim(),
      quantity: parseInt(els.itemQuantity.value, 10) || 0,
      location: els.itemLocation.value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      supabase.from(TABLE_ITEMS).update(payload).eq('id', id)
        .then(function (res) {
          if (res.error) {
            showMessage(res.error.message || 'Update failed', 'danger');
          } else {
            var idx = allItems.findIndex(function (i) { return i.id === id; });
            if (idx !== -1) allItems[idx] = Object.assign({ id: id }, payload);
            applySearchAndFilter();
            refreshIssueItemDropdown(); // Update issue modal dropdown after edit
            bootstrap.Modal.getInstance(els.modal).hide();
            showMessage('Item updated', 'success');
          }
        })
        .catch(function (err) { showMessage(err.message || 'Update failed', 'danger'); });
    } else {
      supabase.from(TABLE_ITEMS).insert(payload).select().single()
        .then(function (res) {
          if (res.error) {
            showMessage(res.error.message || 'Add failed', 'danger');
          } else {
            var newRow = res.data;
            if (newRow) {
              allItems.unshift(newRow);
              applySearchAndFilter();
              refreshIssueItemDropdown(); // Update issue modal dropdown with new item
            }
            bootstrap.Modal.getInstance(els.modal).hide();
            showMessage('Item added', 'success');
          }
        })
        .catch(function (err) { showMessage(err.message || 'Add failed', 'danger'); });
    }
  }

  function submitIssueForm(e) {
    e.preventDefault();
    if (!supabase) return;
    var id = els.issueId.value.trim();
    var payload = {
      item_id: els.issueItemId.value.trim(),
      issued_to: els.issueIssuedTo.value.trim(),
      issued_at: els.issueIssuedAt.value || null,
      quantity_issued: parseInt(els.issueQuantity.value, 10) || 0,
      return_quantity: parseInt(els.issueReturnQty.value, 10) || 0,
      return_date: els.issueReturnDate.value || null,
    };
    if (!payload.item_id || !payload.issued_to || !payload.issued_at) {
      showIssueMessage('Item, Issued to and Date of issue are required', 'warning');
      return;
    }
    if (payload.return_quantity > payload.quantity_issued) {
      showIssueMessage('Return quantity cannot exceed quantity issued', 'warning');
      return;
    }
    if (id) {
      supabase.from(TABLE_ISSUED).update(payload).eq('id', id)
        .then(function (res) {
          if (res.error) {
            showIssueMessage(res.error.message || 'Update failed', 'danger');
          } else {
            var idx = allIssued.findIndex(function (r) { return r.id === id; });
            if (idx !== -1) allIssued[idx] = Object.assign({ id: id }, payload);
            filteredIssued = allIssued;
            applyIssueSearchAndFilter();
            loadIssuedForSums();
            bootstrap.Modal.getInstance(els.issueModal).hide();
            showIssueMessage('Issue record updated', 'success');
          }
        })
        .catch(function (err) { showIssueMessage(err.message || 'Update failed', 'danger'); });
    } else {
      supabase.from(TABLE_ISSUED).insert(payload).select().single()
        .then(function (res) {
          if (res.error) {
            showIssueMessage(res.error.message || 'Add failed', 'danger');
          } else {
            var newRow = res.data;
            if (newRow) {
              allIssued.unshift(newRow);
              filteredIssued = allIssued;
              applyIssueSearchAndFilter();
              loadIssuedForSums();
            }
            bootstrap.Modal.getInstance(els.issueModal).hide();
            showIssueMessage('Issue record added', 'success');
          }
        })
        .catch(function (err) { showIssueMessage(err.message || 'Add failed', 'danger'); });
    }
  }

  els.search.addEventListener('input', applySearchAndFilter);
  if (els.issueSearch) {
    els.issueSearch.addEventListener('input', applyIssueSearchAndFilter);
  }
  document.getElementById('btnAdd').addEventListener('click', function () { openAddModal(); });
  els.modal.addEventListener('show.bs.modal', function (e) {
    /* Only reset to Add when opened by the Add item button; Edit opens programmatically so relatedTarget is null */
    if (e.relatedTarget && e.relatedTarget.id === 'btnAdd') {
      openAddModal();
    }
  });
  els.modal.addEventListener('hidden.bs.modal', function () {
    if (els.modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  });
  els.form.addEventListener('submit', submitForm);

  document.getElementById('btnAddIssue').addEventListener('click', function () { openAddIssueModal(); });
  els.issueModal.addEventListener('show.bs.modal', function (e) {
    refreshIssueItemDropdown(); // Always refresh dropdown when modal opens
    /* Only reset to Add when opened by the Add issue record button; Edit opens programmatically so relatedTarget is null */
    if (e.relatedTarget && e.relatedTarget.id === 'btnAddIssue') {
      openAddIssueModal();
    }
  });
  els.issueModal.addEventListener('hidden.bs.modal', function () {
    /* Move focus out of modal when closed to avoid aria-hidden + focus accessibility warning */
    if (els.issueModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  });
  els.issueForm.addEventListener('submit', submitIssueForm);

  document.getElementById('tab-issued-btn').addEventListener('shown.bs.tab', function () {
    applyIssueSearchAndFilter();
  });

  function applyDesktopLayout() {
    var isDesktop = window.matchMedia('(min-width: 768px)').matches;
    var tabItems = document.getElementById('tab-items');
    var tabIssued = document.getElementById('tab-issued');
    if (isDesktop && tabItems && tabIssued) {
      tabItems.style.display = 'block';
      tabIssued.style.display = 'block';
    } else if (tabItems && tabIssued) {
      tabItems.style.display = '';
      tabIssued.style.display = '';
    }
  }
  applyDesktopLayout();
  window.addEventListener('resize', applyDesktopLayout);

  loadItems();
})();

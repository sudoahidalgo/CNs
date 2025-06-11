let editingWeekId = null;

async function openEditWeek(weekId) {
  try {
    const [weekRes, barsRes, usersRes, attendsRes] = await Promise.all([
      supabase.from('semanas_cn').select('*').eq('id', weekId).single(),
      supabase.from('bares').select('nombre').order('nombre'),
      supabase.from('usuarios').select('id, nombre').order('nombre'),
      supabase.from('asistencias').select('user_id').eq('semana_id', weekId).eq('confirmado', true)
    ]);

    if (weekRes.error) throw weekRes.error;
    if (barsRes.error) throw barsRes.error;
    if (usersRes.error) throw usersRes.error;
    if (attendsRes.error) throw attendsRes.error;

    editingWeekId = weekId;

    const barSelect = document.getElementById('editWeekBar');
    barSelect.innerHTML = (barsRes.data || []).map(b => `<option value="${b.nombre}">${b.nombre}</option>`).join('');
    if (weekRes.data?.bar_ganador) {
      barSelect.value = weekRes.data.bar_ganador;
    }

    const attendees = new Set((attendsRes.data || []).map(a => a.user_id));
    const usersContainer = document.getElementById('editWeekUsers');
    usersContainer.innerHTML = (usersRes.data || []).map(u => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${u.id}" id="editUser-${u.id}" ${attendees.has(u.id) ? 'checked' : ''}>
        <label class="form-check-label" for="editUser-${u.id}">${u.nombre}</label>
      </div>
    `).join('');

    const modal = new bootstrap.Modal(document.getElementById('editWeekModal'));
    modal.show();
  } catch (error) {
    if (window.showAlert) {
      window.showAlert('Error cargando datos de la semana: ' + error.message, 'danger');
    } else {
      alert('Error cargando datos de la semana: ' + error.message);
    }
  }
}

async function saveWeekChanges() {
  if (!editingWeekId) return;

  const bar = document.getElementById('editWeekBar').value || null;
  const selected = Array.from(
    document.querySelectorAll('#editWeekUsers input:checked')
  ).map(el => el.value);

  if (typeof isAdmin !== 'undefined' && !isAdmin) {
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/updateAttendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekId: editingWeekId,
        bar,
        attendees: selected,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    const modal = bootstrap.Modal.getInstance(document.getElementById('editWeekModal'));
    modal.hide();

    if (window.showAlert) {
      window.showAlert('Semana actualizada exitosamente', 'success');
    } else {
      alert('Semana actualizada exitosamente');
    }

    if (typeof loadDashboard === 'function') {
      await loadDashboard();
    } else if (typeof loadDesktopStats === 'function') {
      await loadDesktopStats();
      if (typeof loadVotingData === 'function') {
        await loadVotingData();
      }
    }
  } catch (error) {
    if (window.showAlert) {
      window.showAlert('Error actualizando semana: ' + error.message, 'danger');
    } else {
      alert('Error actualizando semana: ' + error.message);
    }
  } finally {
    editingWeekId = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('saveWeekChanges');
  if (btn) btn.addEventListener('click', saveWeekChanges);
});

// Export for testing in Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openEditWeek,
    saveWeekChanges,
    _setEditingWeekId: (id) => { editingWeekId = id; },
    _getEditingWeekId: () => editingWeekId,
  };
}

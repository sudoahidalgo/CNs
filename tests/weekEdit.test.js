/** @jest-environment jsdom */
const { saveWeekChanges, _setEditingWeekId, _getEditingWeekId } = require('../weekEdit');

describe('saveWeekChanges', () => {
  let hideMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="editWeekModal" data-week-id="1" data-supports-bar-id="1">
        <select id="editBarSelect"><option value="3">Bar1</option></select>
        <div id="editWeekUsers">
          <input class="chk-usuario" type="checkbox" value="u1" checked>
          <input class="chk-usuario" type="checkbox" value="u2">
        </div>
      </div>
    `;

    hideMock = jest.fn();
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn(() => ({ hide: hideMock }))
      }
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      })
    );

    global.isAdmin = true;

    global.showAlert = jest.fn();

    _setEditingWeekId(1);
  });

  afterEach(() => {
    delete global.fetch;
    delete global.isAdmin;
    delete global.bootstrap;
    delete global.showAlert;
  });

  test('updates week and attendees then resets editingWeekId', async () => {
    await saveWeekChanges();

    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/updateAttendance',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String)
      })
    );

    const [, requestInit] = global.fetch.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      week_id: 1,
      set_user_ids: ['u1'],
      recompute_total: true,
      bar_id: 3,
      bar_nombre: 'Bar1'
    });

    expect(hideMock).toHaveBeenCalled();
    expect(_getEditingWeekId()).toBeNull();
  });

  test('falls back to bar_nombre when bar_id column is unavailable', async () => {
    document.getElementById('editWeekModal').dataset.supportsBarId = '0';

    await saveWeekChanges();

    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/updateAttendance',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String)
      })
    );

    const [, requestInit] = global.fetch.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      week_id: 1,
      set_user_ids: ['u1'],
      recompute_total: true,
      bar_nombre: 'Bar1'
    });
  });

  test('shows status code and error message when request fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    });

    await saveWeekChanges();

    expect(global.showAlert).toHaveBeenCalledWith(
      'Error actualizando semana: 400: Bad request',
      'danger'
    );
    expect(_getEditingWeekId()).toBeNull();
  });
});

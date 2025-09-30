/** @jest-environment jsdom */
const { saveWeekChanges, _setEditingWeekId, _getEditingWeekId } = require('../weekEdit');

describe('saveWeekChanges', () => {
  let hideMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="editWeekModal" data-week-id="1">
        <select id="editBarSelect"><option value="3">Bar1</option></select>
        <input id="editAsistentes" type="number" value="5" />
        <div id="editWeekUsers">
          <input type="checkbox" value="u1" checked>
          <input type="checkbox" value="u2">
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
        json: () => Promise.resolve({ success: true })
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
        body: JSON.stringify({
          week_id: 1,
          fields: {
            bar_id: 3,
            asistentes: 5,
            attendees: ['u1']
          }
        })
      })
    );

    expect(hideMock).toHaveBeenCalled();
    expect(_getEditingWeekId()).toBeNull();
  });

  test('shows status code and error message when request fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    await saveWeekChanges();

    expect(global.showAlert).toHaveBeenCalledWith(
      'Error actualizando semana: 400: Bad request',
      'danger'
    );
    expect(_getEditingWeekId()).toBeNull();
  });
});

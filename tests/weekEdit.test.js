/** @jest-environment jsdom */
const { saveWeekChanges, _setEditingWeekId, _getEditingWeekId } = require('../weekEdit');

describe('saveWeekChanges', () => {
  let hideMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="editWeekBar"><option value="Bar1">Bar1</option></select>
      <div id="editWeekUsers">
        <input type="checkbox" value="u1" checked>
        <input type="checkbox" value="u2">
      </div>
      <div id="editWeekModal"></div>
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
          weekId: 1,
          bar: 'Bar1',
          attendees: ['u1']
        })
      })
    );

    expect(hideMock).toHaveBeenCalled();
    expect(_getEditingWeekId()).toBeNull();
  });
});

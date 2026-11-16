import { createResetService } from './reset-service.js';

const service = createResetService({
  getJob: async () => (await chrome.storage.session.get('resetJob')).resetJob,
  setJob: job => chrome.storage.session.set({ resetJob: job }),
  getTab: tabId => chrome.tabs.get(tabId),
  reloadTab: tabId => chrome.tabs.reload(tabId, { bypassCache: true }),
  remove: (options, data) => chrome.browsingData.remove(options, data)
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  if (message?.type === 'GET_STATE') {
    service.ready.then(() => chrome.storage.session.get('resetJob'))
      .then(state => respond({ ok: true, job: state.resetJob }))
      .catch(error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'RESET_SITE') {
    service.start(message.payload ?? {})
      .then(job => respond({ ok: true, job }))
      .catch(error => respond({ ok: false, error: error.message }));
    return true;
  }
});

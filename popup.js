import { GUIDES, RENEW_COMMAND, jobForTarget, webTarget } from './core.js';

const $ = id => document.getElementById(id);
let tab;
let target;
let currentGuide;
let busy = false;

function showStatus(message, state = 'done') {
  $('status').textContent = message;
  $('status').dataset.state = state;
  $('status').hidden = false;
}
function updateJob(job) {
  busy = job?.status === 'running';
  $('clear-site').disabled = !target || busy;
  const relevant = jobForTarget(job, tab?.id, target?.origin);
  if (relevant) showStatus(relevant.message, relevant.status);
}
async function initialize() {
  if (!globalThis.chrome?.runtime?.id) {
    $('site-name').textContent = '크롬에 확장을 설치해 주세요';
    showStatus('이 HTML 파일을 직접 열면 실행되지 않습니다. README의 설치 방법을 확인하세요.', 'error');
    return;
  }
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    target = webTarget(tab?.url);
    $('site-name').textContent = target?.hostname ?? '일반 웹사이트에서 열어 주세요';
    $('site-name').title = target?.displayOrigin ?? 'chrome:// 페이지, 새 탭, 파일에서는 사이트 작업을 지원하지 않습니다.';
    $('reload-page').disabled = !target;
  } catch {
    $('site-name').textContent = '현재 탭을 확인할 수 없습니다';
    showStatus('확장을 닫고 웹사이트에서 다시 열어 주세요.', 'error');
    return;
  }
  // Job state is separate: if it fails, copy and reload still work.
  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (!state?.ok) throw new Error('작업 상태 확인 실패');
    updateJob(state.job);
  } catch {
    updateJob(undefined);
    showStatus('이전 작업 상태를 불러오지 못했습니다. 다른 기능은 그대로 사용할 수 있습니다.', 'error');
  }
}

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

$('clear-site').addEventListener('click', () => {
  if (!target || busy) return;
  $('clear-origin').textContent = target.displayOrigin;
  $('clear-error').hidden = true;
  $('clear-dialog').showModal();
  // Focus the non-destructive option before the user explicitly confirms.
  $('clear-dialog').querySelector('.secondary').focus();
});
$('confirm-clear').addEventListener('click', async () => {
  if (!target || busy) return;
  busy = true;
  $('clear-site').disabled = true;
  $('clear-dialog').close();
  showStatus('사이트 데이터를 삭제하고 있습니다…', 'running');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'RESET_SITE', payload: {
      tabId: tab.id, origin: target.origin, reload: $('reload-after').checked
    } });
    if (!response?.ok) throw new Error(response?.error ?? '삭제 결과를 확인하지 못했습니다. 사이트 상태를 확인해 주세요.');
    updateJob(response.job);
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    // A second popup may already have started another task; use shared state.
    try {
      const latest = (await chrome.storage.session.get('resetJob')).resetJob;
      busy = latest?.status === 'running';
      $('clear-site').disabled = !target || busy;
    }
    catch { busy = false; $('clear-site').disabled = !target; }
  }
});

async function reloadCurrent() {
  if (!target || !tab) throw new Error('일반 웹사이트에서 확장을 다시 열어 주세요.');
  const fresh = await chrome.tabs.get(tab.id);
  if (webTarget(fresh.url)?.origin !== target.origin) throw new Error('페이지가 바뀌었습니다. 확장을 다시 열어 주세요.');
  await chrome.tabs.reload(tab.id, { bypassCache: true });
}
$('reload-page').addEventListener('click', async () => {
  try { await reloadCurrent(); showStatus('현재 페이지에 새로고침을 요청했습니다.'); }
  catch (error) { showStatus(error.message, 'error'); }
});
$('open-settings').addEventListener('click', async () => {
  try { await chrome.tabs.create({ url: 'chrome://settings/clearBrowserData' }); }
  catch { showStatus('주소창에 chrome://settings/clearBrowserData를 입력해 주세요.', 'error'); }
});

document.querySelectorAll('[data-guide]').forEach(button => {
  button.addEventListener('click', () => {
    currentGuide = button.dataset.guide;
    const guide = GUIDES[currentGuide];
    $('guide-number').textContent = `${guide.number} / 연결 가이드`;
    $('guide-title').textContent = guide.title;
    $('guide-intro').textContent = guide.intro;
    $('guide-steps').replaceChildren(...guide.steps.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    $('guide-note').textContent = guide.note;
    const value = guide.command ?? (currentGuide === 'browser' ? target?.url : undefined);
    $('guide-value').hidden = !value;
    $('guide-value').textContent = value ?? '';
    $('guide-feedback').hidden = true;
    $('guide-action').textContent = guide.label;
    $('guide-action').disabled = currentGuide !== 'renew' && !target;
    if (!target && currentGuide !== 'renew') {
      $('guide-feedback').textContent = '일반 웹사이트에서 열면 주소 복사와 새로고침을 사용할 수 있습니다.';
      $('guide-feedback').dataset.error = 'false';
      $('guide-feedback').hidden = false;
    }
    $('guide-dialog').showModal();
  });
});
$('guide-action').addEventListener('click', async () => {
  const feedback = $('guide-feedback');
  try {
    if (currentGuide === 'browser' || currentGuide === 'renew') {
      await navigator.clipboard.writeText(currentGuide === 'renew' ? RENEW_COMMAND : target.url);
      feedback.textContent = currentGuide === 'renew' ? '명령어를 복사했습니다. Windows 명령 프롬프트에 붙여넣으세요.' : '주소를 복사했습니다. 다른 브라우저의 주소창에 붙여넣으세요.';
    } else {
      await reloadCurrent();
      feedback.textContent = '새로고침을 요청했습니다. 페이지에서 접속 결과를 확인하세요.';
    }
    feedback.dataset.error = 'false';
  } catch (error) {
    feedback.textContent = currentGuide === 'browser' || currentGuide === 'renew'
      ? '복사하지 못했습니다. 위에 표시된 텍스트를 선택해 직접 복사하세요.' : error.message;
    feedback.dataset.error = 'true';
  }
  feedback.hidden = false;
});

if (globalThis.chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.resetJob) updateJob(changes.resetJob.newValue);
  });
}
initialize();

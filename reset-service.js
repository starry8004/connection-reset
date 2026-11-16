import { removalRequest, webTarget } from './core.js';

// The Chrome adapter is injected so deletion boundaries can be tested without
// touching a real browser profile.
export function createResetService(api) {
  let busy = false;
  const ready = api.getJob().then(async previous => {
    if (previous?.status === 'running') {
      await api.setJob({ ...previous, status: 'interrupted',
        message: '이전 작업의 완료 여부를 확인할 수 없습니다. 사이트 상태를 먼저 확인하세요.' });
    }
  });

  async function start({ tabId, origin, reload = false }) {
    if (busy) throw new Error('데이터 삭제가 진행 중입니다. 완료될 때까지 기다려 주세요.');
    busy = true;
    let job;
    try {
      await ready;
      if (!Number.isInteger(tabId) || tabId < 0 || typeof origin !== 'string') {
        throw new Error('삭제할 탭을 확인할 수 없습니다. 확장을 다시 열어 주세요.');
      }
      const tab = await api.getTab(tabId);
      const target = webTarget(tab.url);
      if (!target || target.origin !== origin) {
        throw new Error('페이지 주소가 바뀌었습니다. 확장을 다시 열고 대상을 확인하세요.');
      }
      const request = removalRequest(target.url);
      job = { tabId, origin, status: 'running', startedAt: Date.now(), message: '사이트 데이터를 삭제하고 있습니다…' };
      await api.setJob(job);
      await api.remove(request.options, request.data);
      let message = '사이트 데이터 삭제가 완료되었습니다.';
      if (reload) {
        try {
          const current = await api.getTab(tabId);
          if (webTarget(current.url)?.origin === origin) {
            await api.reloadTab(tabId);
            message += ' 새로고침을 요청했습니다.';
          } else {
            message += ' 페이지가 바뀌어 새로고침은 생략했습니다.';
          }
        } catch {
          message += ' 새로고침은 직접 해 주세요.';
        }
      }
      job = { ...job, status: 'done', completedAt: Date.now(), message };
      await api.setJob(job);
      return job;
    } catch (error) {
      if (job) {
        await api.setJob({ ...job, status: 'error', message: `삭제를 완료하지 못했습니다. 일부 데이터는 이미 삭제되었을 수 있습니다. ${error.message}` });
      }
      throw error;
    } finally { busy = false; }
  }
  return { start, ready };
}

export const RENEW_COMMAND = 'ipconfig /renew';

export function webTarget(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return { origin: url.origin, hostname: url.hostname, url: url.href };
  } catch { return null; }
}

export function removalRequest(rawUrl) {
  const target = webTarget(rawUrl);
  if (!target) throw new Error('일반 웹사이트(http 또는 https)에서 실행해 주세요.');
  return {
    options: {
      since: 0,
      origins: [target.origin],
      originTypes: { unprotectedWeb: true, protectedWeb: false, extension: false }
    },
    data: {
      cookies: true, cache: true, cacheStorage: true,
      indexedDB: true, localStorage: true, serviceWorkers: true, fileSystems: true
    }
  };
}

export const GUIDES = {
  browser: {
    number: '02', title: '다른 브라우저로 열기', label: '주소 복사',
    intro: '같은 주소를 다른 브라우저에서 열어 접속 상태를 비교해 보세요.',
    steps: [
      '아래 버튼으로 현재 페이지 주소를 복사하세요.',
      '시작 메뉴나 앱 목록에서 Chrome, Edge, Whale 등 다른 브라우저를 직접 여세요.',
      '주소창에 붙여넣고 접속하세요. 필요한 경우 다시 로그인하세요.'
    ],
    note: '확장 프로그램은 다른 브라우저 앱을 직접 실행할 수 없습니다.'
  },
  hotspot: {
    number: '03', title: '스마트폰 핫스팟 연결', label: '현재 페이지 새로고침',
    intro: '스마트폰의 모바일 데이터로 연결 경로를 바꿔 보세요.',
    steps: [
      '스마트폰에서 모바일 데이터를 켜고, 설정의 개인용 핫스팟(iPhone) 또는 모바일 핫스팟(Android)을 켜세요.',
      '컴퓨터의 Wi-Fi 목록에서 스마트폰 이름을 선택하고 핫스팟 비밀번호를 입력하세요.',
      '유선 연결이 우선 사용 중이면 케이블을 분리하세요. 연결이 끝나면 현재 페이지를 새로고침하세요.'
    ],
    note: '모바일 데이터 요금이 발생할 수 있습니다. 핫스팟 연결과 공인 IP 변경 여부는 확장에서 확인하지 않습니다.'
  },
  wired: {
    number: '04', title: '유선 네트워크 직접 연결', label: '현재 페이지 새로고침',
    intro: '직접 연결을 지원하는 회선이라면 공유기를 거치지 않고 접속을 확인할 수 있습니다.',
    steps: [
      '진행 중인 다운로드나 통화를 마친 뒤, 컴퓨터의 방화벽이 켜져 있는지 확인하세요.',
      '회선이 지원하는 경우 공유기 대신 벽면 LAN 포트와 컴퓨터의 LAN 포트를 케이블로 연결하세요. Wi-Fi는 잠시 끄세요.',
      '연결되지 않으면 원래 구성으로 복구하세요. 회선 인증·모뎀 설정 또는 공인 IP 변경은 통신사에 문의하세요.'
    ],
    note: '모든 벽면 포트가 인터넷 직접 연결을 지원하는 것은 아닙니다. 직접 연결해도 공인 IP가 유지될 수 있습니다.'
  },
  renew: {
    number: '05', title: 'Windows IP 갱신', label: '명령어 복사',
    intro: '자동 IP 할당(DHCP)을 사용하는 Windows에서 임대 정보를 갱신합니다.',
    steps: [
      '아래 버튼으로 명령어를 복사하세요.',
      'Windows에서 Win + R을 누르고 cmd를 입력한 다음 Enter를 누르세요.',
      '명령 프롬프트에 붙여넣고 Enter를 누르세요. 완료되면 사이트에 다시 접속하세요. 권한 오류가 있으면 관리자 권한으로 다시 실행하세요.'
    ],
    note: '이 명령은 Windows 전용이며 공인 IP 변경을 보장하지 않습니다. 고정 IP 연결에는 적용되지 않습니다. 확장에서 명령을 자동 실행하지 않습니다.',
    command: RENEW_COMMAND
  }
};

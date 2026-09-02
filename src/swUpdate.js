// 이 페이지가 로드된 후 "새" 서비스워커가 제어권을 가져갔는지 추적한다.
// (자동 새로고침은 하지 않는다 — 퀴즈 도중 튕기지 않도록, 적용은 홈의 업데이트 버튼으로)

let controllerChanged = false

if ('serviceWorker' in navigator) {
  // 재방문이면 이미 controller가 있음(true), 첫 방문이면 없음(false)
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 첫 방문의 최초 클레임은 무시(불필요한 새로고침 방지), 실제 업데이트만 표시
    if (hadController) controllerChanged = true
  })
}

export function isControllerChanged() {
  return controllerChanged
}

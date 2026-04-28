# CODEX.md

이 프로젝트는 RollerCoaster Tycoon에서 영감을 받은 3D 놀이공원 시뮬레이션 프로토타입이다. 현재 방향은 직접 트랙을 조립하는 코스터 빌더가 아니라, 미리 만들어진 놀이기구 세트를 배치하고 길과 손님 동선을 관리하는 방식이다.

## Working Rules

- 기본 뷰는 Three.js orthographic isometric camera를 유지한다.
- 새 기능은 우선 `src/main.ts` 안에서 작은 프로토타입으로 검증한 뒤, 복잡해지면 모듈로 분리한다.
- 놀이기구는 prefab 단위로 추가한다. 사용자가 직접 롤러코스터 트랙 조각을 놓는 기능은 현재 범위에서 제외한다.
- 문서가 필요한 결정은 `docs/` 아래에 남긴다.
- 구현 후 `npm run build`로 TypeScript와 Vite 빌드를 확인한다.
- 원격 저장소가 없으므로 push는 하지 않는다. 중요한 변경은 로컬 Git commit과 `docs/development-log.md`로 추적한다.

## Current Gameplay Scope

- 타일 기반 지형
- 길 설치와 철거
- 대기줄 길 설치와 철거
- 회전목마 prefab 설치와 철거
- 회전목마 open/closed 상태
- 회전목마 입구와 출구 설치
- 회전목마 loading/running/unloading 운행 사이클
- 나무 배치와 철거
- 길 네트워크 위를 돌아다니는 손님
- 하단 debug 콘솔
- 휠 줌, Q/E 쿼터뷰 회전, 연속 Q/E 회전 옵션, WASD 카메라 이동
- 일시정지 가능한 간단한 시뮬레이션 루프

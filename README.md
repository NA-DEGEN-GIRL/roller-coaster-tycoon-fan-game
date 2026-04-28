# RCT Three.js Prototype

Three.js 기반의 RollerCoaster Tycoon 스타일 3D 프로토타입입니다. 직접 트랙을 조립하는 코스터 빌더보다, 만들어진 놀이기구 세트를 배치하고 길과 손님 동선을 관리하는 방향으로 잡았습니다.

## Run

```bash
npm install
npm run dev
```

## Current Scope

- Vite + TypeScript + Three.js 기본 구성
- Orthographic isometric camera
- 높낮이가 있는 타일형 지형
- 길 설치와 철거
- 대기줄 길 설치와 철거
- 방향성 있는 대기줄 설치와 손님 입장 방향 제한
- 회전목마 prefab 설치
- 회전목마 open/closed 상태
- 회전목마 입구/출구 설치
- 회전목마 로딩/운행/하차 상태
- 나무 배치
- 길 위를 이동하는 손님
- 하단 debug 콘솔
- 휠 확대/축소, Q/E 쿼터뷰 회전, 연속 Q/E 회전 옵션, WASD 카메라 이동
- 기본 선택/빌드 툴 패널과 하단 상태 바
- 모바일/데스크톱 반응형 레이아웃

## Docs

- `CODEX.md`: 프로젝트 작업 원칙과 현재 범위
- `docs/architecture.md`: 타일, prefab, 손님 시뮬레이션 구조

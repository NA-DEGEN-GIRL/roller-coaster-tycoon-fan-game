# Development Log

로컬 개발 진행 상황을 추적하는 로그다. 원격 저장소가 없으므로 push는 하지 않고, 중요한 변경 단위마다 로컬 Git commit을 남긴다.

## 2026-04-28

- Vite + TypeScript + Three.js 기본 프로젝트 구성
- isometric orthographic 카메라 기반 공원 화면 구현
- 전체 평지 타일맵으로 변경
- 일반 길, 대기줄 길, 회전목마 prefab, 입구, 출구, 나무, 철거 툴 추가
- 회전목마 open/closed 상태와 입구/출구 연결 조건 추가
- 회전목마 운행 사이클 초안 추가: `idle -> loading -> running -> unloading`
- 손님 상태 추가: `walking`, `waiting`, `riding`
- 대기줄 타일당 3명 슬롯 배치로 손님 겹침 방지
- 하단 debug 콘솔 추가
- 카메라 조작 추가: 휠 줌, Q/E 회전, 연속 회전 옵션, WASD 이동, 휠 클릭 드래그 이동

## 2026-04-29

- 기본 예시 배치를 RCT식 대기줄 구조가 보이도록 조정
- 회전목마를 메인 일반 길에서 떨어뜨리고, 대기줄 tail에서 입구까지 직선으로 연결
- 출구는 별도 일반 길로 메인 보도에 다시 합류하도록 구성

## Local Git Policy

- `main` 브랜치에서 로컬 commit으로 체크포인트를 남긴다.
- 원격이 없으므로 `git push`는 수행하지 않는다.
- 큰 기능 단위나 안정화가 끝날 때 `npm run build` 통과 후 commit한다.
- 진행 상황은 이 파일과 Git log를 함께 본다.

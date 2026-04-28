# Architecture

## Runtime Stack

- Vite
- TypeScript
- Three.js

현재는 빠른 프로토타입을 위해 단일 엔트리 파일인 `src/main.ts`에 씬, 상태, 입력, 시뮬레이션을 함께 둔다. 기능이 늘어나면 다음 단위로 나누는 것이 좋다.

- `scene/`: renderer, camera, lights, resize
- `map/`: tile grid, height sampling, placement validation
- `prefabs/`: carousel, food stalls, flat rides
- `simulation/`: guests, path graph, ride demand
- `ui/`: toolbar, stats, status messages

## Tile Model

맵은 정수 좌표 `(x, z)`를 기준으로 한 정사각형 타일이다. 키는 `"x,z"` 문자열을 사용한다. 현재 프로토타입은 배치와 동선 검증을 쉽게 하기 위해 전체 평지로 둔다.

- `paths`: 길이 설치된 타일
- `queuePaths`: 대기줄 길이 설치된 타일
- `trees`: 나무가 설치된 타일
- `occupied`: 놀이기구 prefab이 점유한 타일
- `entrances`: 놀이기구 입구가 설치된 타일
- `exits`: 놀이기구 출구가 설치된 타일
- `rides`: 설치된 놀이기구 인스턴스

배치 검증은 타일 단위로 처리한다. 길과 대기줄은 빈 타일에만 놓을 수 있고, 회전목마는 3x3 footprint가 모두 비어 있어야 설치된다. 길 메시는 타일보다 아주 조금 크게 만들어 인접 길과 시각적으로 이어지도록 한다.

## Ride Placement

회전목마는 설치 후 선택 상태가 된다. 선택된 회전목마에 대해 다음 작업을 할 수 있다.

- open/closed 토글
- 입구 설치
- 출구 설치
- 대기줄 연결
- 출구를 일반 길에 연결

회전목마가 실제로 동작하려면 open 상태이면서 입구, 출구, 입구와 연결된 대기줄, 출구와 연결된 일반 길이 모두 있어야 한다. 이 조건을 만족하지 않으면 상태 표시등은 closed 색으로 남고 회전 애니메이션도 멈춘다.

입구 타일은 대기줄 바닥 재질을, 출구 타일은 일반 길 바닥 재질을 사용한다. 둘 다 일반 길 타일과 같은 크기로 만들어 주변 동선과 시각적으로 이어지게 한다. 게이트는 배치된 타일에서 인접한 놀이기구 footprint 방향을 향하도록 자동 회전한다.

## Guest Simulation

손님은 일반 길과 대기줄 타일 위에서 이동한다. 각 손님은 `from`, `to`, `progress`, `speed`, `pause`, `state` 값을 가진다.

- 일반 이동은 일반 길 graph에서만 처리한다. 대기줄은 일반 길 graph와 섞지 않는다.
- 손님은 일반 길에서 대기줄 tail과 인접한 타일에 도착했을 때만 대기줄 입장을 시도한다.
- 대기줄 내부는 놀이기구 입구와 연결된 별도 graph로 관리한다.
- 대기줄 방향은 놀이기구 입구에서 BFS 거리로 계산한다. 입구에 가까운 칸이 front, 가장 먼 쪽이 tail이다.
- 일반 길에서 대기줄로 들어갈 수 있는 지점은 tail 쪽 대기줄 타일이다.
- 이전 타일로 바로 되돌아가는 경우를 가능한 줄인다.
- 길이 철거되어 목표가 사라지면 유효한 길 타일로 재배치한다.
- open 상태의 놀이기구 입구와 연결된 대기줄 tail에 도착하면 `queueing` 상태로 대기줄 안을 걸어 들어간다.
- 목표 queue 슬롯에 도착하면 `waiting` 상태로 멈춘다.
- 대기줄 타일은 현재 4명까지 수용하며, 타일 내부 슬롯은 앞뒤 타일과 같은 간격이 이어지도록 균등 배치한다.
- 탑승으로 앞쪽 슬롯이 비면 `waiting` 손님뿐 아니라 이미 줄로 걸어 들어가던 `queueing` 손님도 목표 슬롯을 다시 배정받고 앞 슬롯으로 걸어간다.
- 대기줄 슬롯이 모두 차 있으면 손님은 탑승하지 않고 다른 경로로 이동한다.
- 놀이기구가 `loading` 상태일 때 탑승 가능 인원만큼 대기 손님이 `boarding` 상태로 전환된다.
- `boarding` 손님은 일반 보행 속도로 입구를 지나 안쪽까지 걸어간 뒤 `riding` 상태가 되고 화면에서 숨겨진다.
- 운행 종료 후 `unloading` 상태가 끝나면 출구와 연결된 일반 길로 나온다.

아직 길찾기 알고리즘은 없다. 다음 단계에서 목적지 기반 이동을 넣을 때 BFS나 A*를 추가하면 된다.

## Camera Controls

카메라는 orthographic isometric view를 유지한다.

- 마우스 휠: 확대/축소
- `Q`: 왼쪽 쿼터뷰 회전
- `E`: 오른쪽 쿼터뷰 회전
- `WASD`: 현재 화면 방향 기준 카메라 이동

Camera 패널의 `Continuous QE` 옵션을 켜면 `Q/E`가 누르고 있는 동안 연속 회전한다. 옵션을 끄는 순간 현재 각도에서 가장 가까운 90도 쿼터뷰로 스냅한다.

## Prefab Rides

회전목마는 첫 prefab 구현이다.

- 3x3 footprint
- 고정 base와 회전하는 rotor 분리
- 말 좌석은 rotor의 자식으로 두고 애니메이션 루프에서 회전한다.
- 운행 상태는 `idle -> loading -> running -> unloading` 순서로 전환된다.
- `loading` 상태는 탑승 인원 선택과 탑승 보행 애니메이션을 함께 관리한다.
- `running` 상태에서만 rotor가 회전한다.

이 패턴을 유지하면 바이킹, 관람차, 푸드 스탠드 같은 다음 세트를 같은 방식으로 추가할 수 있다.

## Debug Console

화면 하단에는 개발용 콘솔을 둔다.

- 선택된 회전목마 phase
- 탑승 중 손님 수
- 대기 손님 수
- phase timer
- 최근 운행 이벤트 로그

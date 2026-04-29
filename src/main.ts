import * as THREE from 'three';
import './style.css';

type Tool = 'select' | 'path' | 'queue' | 'carousel' | 'entrance' | 'exit' | 'tree' | 'bulldoze';

type GridCoord = {
  x: number;
  z: number;
};

type QueueDirection = 'north' | 'east' | 'south' | 'west';
type QueueEdge = QueueDirection;
type BulldozeTarget = 'path' | 'queue' | 'entrance' | 'exit' | 'tree' | 'ride';
type Language = 'ko' | 'en';

type QueuePath = {
  group: THREE.Group;
  entryPreview: THREE.Group;
  entryGhost: THREE.Group;
  entryGhostMaterials: THREE.MeshStandardMaterial[];
  fences: THREE.Group;
  nextKey?: string;
  entryPathKey?: string;
};

type GateVisual = {
  mesh: THREE.Group;
  bar: THREE.Group;
  openAmount: number;
};

type RideGate = GateVisual & {
  rideId: string;
};

type Guest = {
  id: number;
  mesh: THREE.Group;
  from: string;
  to: string;
  progress: number;
  speed: number;
  pause: number;
  state: 'walking' | 'queueing' | 'waiting' | 'boarding' | 'riding' | 'exiting' | 'seeking';
  money: number;
  hunger: number;
  tiredness: number;
  happiness: number;
  nausea: number;
  rideId?: string;
  queueKey?: string;
  queueSlotIndex?: number;
  queueRoute?: string[];
  queueRouteIndex?: number;
  queueMoveStart?: THREE.Vector3;
  boardingTarget?: THREE.Vector3;
  wanderTarget?: THREE.Vector3;
  seekTimer?: number;
  rideTime: number;
};

type RidePhase = 'idle' | 'loading' | 'running' | 'unloading';
type CarouselMusicPreset = 'fairgroundOrgan' | 'waltzOrgan' | 'musicBox' | 'militaryBandOrgan';

type CarouselMusicState = {
  gain: GainNode;
  nextNoteTime: number;
  noteIndex: number;
  audio?: HTMLAudioElement;
};

type CrowdAudioState = {
  gain: GainNode;
  layers: {
    audio: HTMLAudioElement;
    gain: GainNode;
    minDensity: number;
    maxVolume: number;
    exponent: number;
  }[];
  effects: {
    audio: HTMLAudioElement;
    nextTime: number;
    minCrowd: number;
    stopAfter: number;
    minDelay: number;
    maxDelay: number;
    stopTime?: number;
  }[];
};

type AudioTestZone = {
  center: GridCoord;
  amount: number;
  radius: number;
  dummyGuests: number;
  color: number;
  labelKo: string;
  labelEn: string;
};

type Ride = {
  id: string;
  group: THREE.Group;
  rotor: THREE.Group;
  riderVisuals: THREE.Group[];
  occupiedSeatIndexes: Set<number>;
  footprint: string[];
  center: GridCoord;
  isOpen: boolean;
  musicEnabled: boolean;
  musicPreset: CarouselMusicPreset;
  music?: CarouselMusicState;
  entranceKey?: string;
  exitKey?: string;
  statusLight: THREE.Mesh;
  riders: number;
  phase: RidePhase;
  phaseTimer: number;
};

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button');
const statusText = document.querySelector<HTMLSpanElement>('#status-text');
const guestCount = document.querySelector<HTMLElement>('#guest-count');
const pathCount = document.querySelector<HTMLElement>('#path-count');
const queueCount = document.querySelector<HTMLElement>('#queue-count');
const rideCount = document.querySelector<HTMLElement>('#ride-count');
const ridePanel = document.querySelector<HTMLElement>('.ride-panel');
const selectedRideName = document.querySelector<HTMLElement>('#selected-ride-name');
const selectedRideStatus = document.querySelector<HTMLElement>('#selected-ride-status');
const rideOpenButton = document.querySelector<HTMLButtonElement>('#ride-open-button');
const rideCloseButton = document.querySelector<HTMLButtonElement>('#ride-close-button');
const rideMusicOnButton = document.querySelector<HTMLButtonElement>('#ride-music-on-button');
const rideMusicOffButton = document.querySelector<HTMLButtonElement>('#ride-music-off-button');
const rideMusicPresetSelect = document.querySelector<HTMLSelectElement>('#ride-music-preset-select');
const placeEntranceButton = document.querySelector<HTMLButtonElement>('#place-entrance-button');
const placeExitButton = document.querySelector<HTMLButtonElement>('#place-exit-button');
const continuousRotationToggle = document.querySelector<HTMLInputElement>('#continuous-rotation-toggle');
const languageSelect = document.querySelector<HTMLSelectElement>('#language-select');
const debugLog = document.querySelector<HTMLElement>('#debug-log');
const debugStatus = document.querySelector<HTMLElement>('#debug-status');
const guestWindow = document.querySelector<HTMLElement>('#guest-window');
const guestWindowTitle = document.querySelector<HTMLElement>('#guest-window-title');
const guestStatusText = document.querySelector<HTMLElement>('#guest-status-text');
const guestMoney = document.querySelector<HTMLElement>('#guest-money');
const guestHunger = document.querySelector<HTMLElement>('#guest-hunger');
const guestTiredness = document.querySelector<HTMLElement>('#guest-tiredness');
const guestHappiness = document.querySelector<HTMLElement>('#guest-happiness');
const guestNausea = document.querySelector<HTMLElement>('#guest-nausea');
const guestFollowButton = document.querySelector<HTMLButtonElement>('#guest-follow-button');
const guestCloseButton = document.querySelector<HTMLButtonElement>('#guest-close-button');
const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tool]'));
const rideToolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-ride-tool]'));
const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-speed]'));

if (
  !canvas ||
  !pauseButton ||
  !statusText ||
  !guestCount ||
  !pathCount ||
  !queueCount ||
  !rideCount ||
  !ridePanel ||
  !selectedRideName ||
  !selectedRideStatus ||
  !rideOpenButton ||
  !rideCloseButton ||
  !rideMusicOnButton ||
  !rideMusicOffButton ||
  !rideMusicPresetSelect ||
  !placeEntranceButton ||
  !placeExitButton ||
  !continuousRotationToggle ||
  !languageSelect ||
  !debugLog ||
  !debugStatus ||
  !guestWindow ||
  !guestWindowTitle ||
  !guestStatusText ||
  !guestMoney ||
  !guestHunger ||
  !guestTiredness ||
  !guestHappiness ||
  !guestNausea ||
  !guestFollowButton ||
  !guestCloseButton
) {
  throw new Error('Required UI elements were not found.');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xa7c9d4, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7c9d4);
scene.fog = new THREE.Fog(0xa7c9d4, 70, 120);

const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 180);
camera.position.set(30, 28, 30);
camera.lookAt(0, 0, 0);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(20, 32, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x6a8a55, 1.45));

const world = new THREE.Group();
scene.add(world);

const tileSize = 2;
const mapSize = 22;
const halfMap = mapSize / 2;
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const groundGroup = new THREE.Group();
const buildGroup = new THREE.Group();
const guestGroup = new THREE.Group();
const audioTestZoneGroup = new THREE.Group();
world.add(groundGroup, buildGroup, guestGroup, audioTestZoneGroup);

const groundMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x79b15f, roughness: 0.82 }),
  new THREE.MeshStandardMaterial({ color: 0x6aa957, roughness: 0.88 }),
  new THREE.MeshStandardMaterial({ color: 0x88bd65, roughness: 0.86 }),
];
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xc8ad7f, roughness: 0.78 });
const queueMaterial = new THREE.MeshStandardMaterial({ color: 0x8676c8, roughness: 0.72 });
const queuePreviewMaterial = new THREE.MeshStandardMaterial({ color: 0x8676c8, roughness: 0.72, transparent: true, opacity: 0.68 });
const queueEntryMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4d35e,
  roughness: 0.46,
  emissive: 0x443400,
  transparent: true,
  opacity: 0.72,
});
const queueFenceMaterial = new THREE.MeshStandardMaterial({ color: 0x453980, roughness: 0.48 });
const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.55 });
const exitMaterial = new THREE.MeshStandardMaterial({ color: 0xde5b42, roughness: 0.55 });
const rideFoundationMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c9b1, roughness: 0.8 });
const rideBoundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x4f6f8f, roughness: 0.62 });
const carouselCanopyRedMaterial = new THREE.MeshStandardMaterial({ color: 0xde5b42, roughness: 0.5, side: THREE.DoubleSide });
const carouselCanopyCreamMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1cf, roughness: 0.54, side: THREE.DoubleSide });
const openMaterial = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.45, emissive: 0x0b3a1c });
const closedMaterial = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.45, emissive: 0x3a0a0a });
const blockedMaterial = new THREE.MeshStandardMaterial({
  color: 0xe85d5d,
  roughness: 0.7,
  transparent: true,
  opacity: 0.48,
});
const selectionMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4d35e,
  roughness: 0.7,
  transparent: true,
  opacity: 0.58,
});
const guestSelectionMaterial = new THREE.MeshBasicMaterial({
  color: 0xfff1a8,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
});

const tileGeometry = new THREE.BoxGeometry(tileSize, 0.28, tileSize);
const pathGeometry = new THREE.BoxGeometry(tileSize * 1.02, 0.08, tileSize * 1.02);
const selectionGeometry = new THREE.BoxGeometry(tileSize * 0.96, 0.1, tileSize * 0.96);
const guestSelectionGeometry = new THREE.RingGeometry(0.24, 0.34, 28);
const rideFoundationGeometry = new THREE.BoxGeometry(tileSize * 0.98, 0.08, tileSize * 0.98);
const rideBoundaryLongGeometry = new THREE.BoxGeometry(tileSize * 3.02, 0.16, 0.12);
const rideBoundaryShortGeometry = new THREE.BoxGeometry(0.12, 0.16, tileSize * 3.02);
const queueFenceGeometry = new THREE.BoxGeometry(0.08, 0.32, tileSize * 0.76);
const queueFenceCrossGeometry = new THREE.BoxGeometry(tileSize * 0.76, 0.32, 0.08);
const queueArrowShape = new THREE.Shape();
queueArrowShape.moveTo(0, -0.42);
queueArrowShape.lineTo(-0.24, 0.08);
queueArrowShape.lineTo(-0.08, 0.08);
queueArrowShape.lineTo(-0.08, 0.38);
queueArrowShape.lineTo(0.08, 0.38);
queueArrowShape.lineTo(0.08, 0.08);
queueArrowShape.lineTo(0.24, 0.08);
queueArrowShape.closePath();
const queueArrowGeometry = new THREE.ShapeGeometry(queueArrowShape);
const queueTileCapacity = 4;
const queueSlotIndexes = Array.from({ length: queueTileCapacity }, (_, index) => index);
const carouselSeatCount = 8;

const tiles: THREE.Mesh[] = [];
const paths = new Map<string, THREE.Mesh>();
const queuePaths = new Map<string, QueuePath>();
const trees = new Map<string, THREE.Group>();
const rides = new Map<string, Ride>();
const occupied = new Map<string, string>();
const entrances = new Map<string, RideGate>();
const exits = new Map<string, RideGate>();
const guests: Guest[] = [];

let activeTool: Tool = 'select';
let hoveredTile: GridCoord | null = null;
let previousHoveredTile: GridCoord | null = null;
let selectedRideId: string | null = null;
let selectedGuestId: number | null = null;
let isPaused = false;
let simulationSpeed = 1;
let rideSerial = 0;
let guestSerial = 0;
const quarterYawStep = Math.PI / 2;
const baseCameraYaw = Math.PI / 4;
let cameraYaw = baseCameraYaw;
let cameraZoom = 1;
const cameraTarget = new THREE.Vector3(0, 0, 0);
let isMiddleDragging = false;
let isPathDragging = false;
let isBulldozeDragging = false;
let lastDraggedBuildKey: string | null = null;
let lastDraggedBulldozeKey: string | null = null;
let lastQueueBuildKey: string | null = null;
let bulldozeDragTarget: BulldozeTarget | null = null;
let lastDragX = 0;
let lastDragY = 0;
let followSelectedGuest = false;
const pressedMovementKeys = new Set<string>();
const pressedRotationKeys = new Set<string>();
let continuousRotationEnabled = false;
let audioContext: AudioContext | null = null;
let masterMusicGain: GainNode | null = null;
let crowdAudio: CrowdAudioState | null = null;

const keyOf = (x: number, z: number) => `${x},${z}`;

const parseKey = (key: string): GridCoord => {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
};

const inBounds = (x: number, z: number) => x >= -halfMap && x < halfMap && z >= -halfMap && z < halfMap;

const heightAt = (x: number, z: number) => {
  void x;
  void z;
  return 0;
};

const worldPos = (x: number, z: number, lift = 0) => new THREE.Vector3(x * tileSize, heightAt(x, z) + lift, z * tileSize);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const debugLines: string[] = [];
let language: Language = 'ko';

const audioTestZones: AudioTestZone[] = [
  { center: { x: -8, z: -8 }, amount: 1.4, radius: tileSize * 3.2, dummyGuests: 4, color: 0x68c7d9, labelKo: '군중 낮음', labelEn: 'Low Crowd' },
  { center: { x: -8, z: 8 }, amount: 3.2, radius: tileSize * 3.2, dummyGuests: 9, color: 0xf2c94c, labelKo: '군중 중간', labelEn: 'Mid Crowd' },
  { center: { x: 0, z: 8 }, amount: 6.5, radius: tileSize * 3.6, dummyGuests: 18, color: 0xeb5757, labelKo: '군중 높음', labelEn: 'High Crowd' },
  { center: { x: 8, z: 8 }, amount: 4.8, radius: tileSize * 3.4, dummyGuests: 12, color: 0xbb6bd9, labelKo: '리액션 테스트', labelEn: 'Reaction Test' },
];

const translations: Record<Language, Record<string, string>> = {
  ko: {
    'aria.parkTools': '놀이공원 도구',
    'aria.languageSelect': '언어 선택',
    'aria.buildTools': '건설 도구',
    'aria.rideState': '놀이기구 운영 상태',
    'aria.rideMusic': '놀이기구 음악 상태',
    'aria.rideMusicPreset': '회전목마 음악 선택',
    'aria.rideTools': '선택한 놀이기구 배치 도구',
    'aria.simulationSpeed': '시뮬레이션 속도',
    'aria.scene': '아이소메트릭 3D 놀이공원 빌더',
    'aria.selectedGuest': '선택한 손님',
    'aria.guestStatus': '손님 상태',
    'aria.debugConsole': '디버그 콘솔',
    'brand.title': '파크 빌더',
    'brand.subtitle': '프리팹 놀이공원 시뮬레이션',
    'language.label': '언어',
    'section.build': '건설',
    'section.selectedRide': '선택한 놀이기구',
    'section.camera': '카메라',
    'section.simulation': '시뮬레이션',
    'section.park': '공원',
    'tool.select': '선택',
    'tool.path': '길',
    'tool.queue': '대기줄 길',
    'tool.carousel': '회전목마 세트',
    'tool.tree': '나무',
    'tool.bulldoze': '철거',
    'tool.entrance': '입구',
    'tool.exit': '출구',
    'toolStatus.select': '선택 도구 선택됨',
    'toolStatus.path': '길 도구 선택됨',
    'toolStatus.queue': '대기줄 길 도구 선택됨',
    'toolStatus.carousel': '회전목마 프리팹 선택됨',
    'toolStatus.tree': '나무 도구 선택됨',
    'toolStatus.bulldoze': '철거 도구 선택됨',
    'toolStatus.entrance': '입구 도구 선택됨',
    'toolStatus.exit': '출구 도구 선택됨',
    'ride.open': '오픈',
    'ride.closed': '닫힘',
    'ride.musicOn': '음악 ON',
    'ride.musicOff': '음악 OFF',
    'ride.musicPreset': '음악',
    'ride.entrance': '입구',
    'ride.exit': '출구',
    'ride.placeEntrance': '입구 설치',
    'ride.placeExit': '출구 설치',
    'ride.none': '선택한 놀이기구 없음',
    'ride.prompt': '회전목마를 설치하거나 클릭하세요',
    'ride.closedStatus': '닫힘',
    'ride.needsEntrance': '입구 필요',
    'ride.connectEntrance': '입구를 대기줄과 연결하세요',
    'ride.connectQueueTail': '대기줄 끝을 일반 길과 연결하세요',
    'ride.needsExit': '출구 필요',
    'ride.connectExit': '출구를 일반 길과 연결하세요',
    'ride.riding': '탑승 중',
    'ride.carouselName': '회전목마',
    'music.fairgroundOrgan': '페어그라운드 오르간',
    'music.waltzOrgan': '왈츠 오르간',
    'music.musicBox': '오르골',
    'music.militaryBandOrgan': '밀리터리 밴드 오르간',
    'stats.guests': '손님',
    'stats.paths': '길',
    'stats.queues': '대기줄',
    'stats.rides': '놀이기구',
    'stats.rating': '평점',
    'camera.continuous': '연속 Q/E 회전',
    'guest.label': '손님',
    'guest.money': '돈',
    'guest.hunger': '배고픔',
    'guest.tiredness': '피곤함',
    'guest.happiness': '행복도',
    'guest.nausea': '멀미',
    'guest.closeWindow': '손님 창 닫기',
    'guest.follow': '카메라로 따라가기',
    'guest.following': '카메라 추적 중',
    'guest.walking': '공원을 걷는 중',
    'guest.queueing': '대기줄 안으로 이동 중',
    'guest.waiting': '줄에서 기다리는 중',
    'guest.boarding': '놀이기구에 탑승 중',
    'guest.riding': '놀이기구 탑승 중',
    'guest.exiting': '놀이기구에서 나오는 중',
    'guest.seeking': '길을 찾는 중',
    'pause.pause': '일시정지',
    'pause.resume': '재개',
    'debug.noRide': '손님 {guests}명 · 선택한 놀이기구 없음',
    'debug.status': '{ride} · {phase} · {speed}x · 탑승 {riders} · 탑승중 {boarding} · 하차중 {exiting} · 대기줄이동 {queueing} · 대기 {waiting} · 길찾기 {seeking} · 타이머 {timer}s',
    'debug.booting': '시뮬레이션 시작 중',
    'status.language': '언어: 한국어',
    'status.speed': '시뮬레이션 속도 {speed}x',
    'status.pathBuilt': '길 설치: {key}',
    'status.selectRideFirst': '먼저 놀이기구를 선택하세요',
    'status.entranceAlready': '입구가 이미 설치되어 있습니다',
    'status.exitAlready': '출구가 이미 설치되어 있습니다',
    'status.queueEntryConnected': '대기줄 진입 지점 연결: {key}',
    'status.queueBuilt': '대기줄 설치: {key}{hint}',
    'status.queueBuiltHint': ' · 인접한 길을 클릭해 진입 지점을 정하세요',
    'status.queueBuiltConnectEntrance': '대기줄 설치: {key} · 입구와 연결하세요',
    'status.entrancePlacedNextExit': '입구 설치됨 · {ride} 출구를 설치하세요',
    'status.gatePlaced': '{kind} 설치됨: {ride}',
    'status.treePlanted': '나무 심음: {key}',
    'status.carouselInstalled': '회전목마 세트 설치됨 · 입구를 설치하세요',
    'status.pathRemoved': '길 삭제: {key}',
    'status.queueRemoved': '대기줄 삭제: {key}',
    'status.entranceRemoved': '입구 삭제됨',
    'status.exitRemoved': '출구 삭제됨',
    'status.treeRemoved': '나무 삭제: {key}',
    'status.rideRemoved': '놀이기구 삭제됨',
    'status.nothingToRemove': '삭제할 대상 없음',
    'status.carouselSelected': '회전목마 선택됨',
    'status.selectionCleared': '선택 해제됨',
    'status.guestSelected': '{guest} 선택됨',
    'status.panCamera': '카메라 이동',
    'status.clickPathBesideQueue': '대기줄 끝 옆의 길을 클릭하세요',
    'status.rideOpened': '놀이기구 오픈',
    'status.rideClosed': '놀이기구 닫힘',
    'status.musicOn': '{ride} 음악 켜짐',
    'status.musicOff': '{ride} 음악 꺼짐',
    'status.musicPreset': '{ride} 음악: {preset}',
    'status.followOn': '{guest} 카메라 추적 중',
    'status.followOff': '{guest} 카메라 추적 끔',
    'status.guestWindowClosed': '손님 창 닫힘',
    'status.quarterRotation': '쿼터뷰 회전',
    'status.continuousRotation': '연속 Q/E 회전',
    'status.paused': '시뮬레이션 일시정지',
    'status.zoom': '확대 {zoom}%',
    'status.viewRotated': '{key} 방향으로 화면 회전',
    'debug.boarded': '{ride} 손님 탑승 완료 ({riders}/{capacity})',
    'debug.boarding': '{ride} 손님 탑승 중',
    'debug.queueFullLeft': '{ride} 대기줄 가득 참; 손님 이탈',
    'debug.waiting': '{ride} 줄에서 대기',
    'debug.queueMoved': '{ride} 대기줄 전진',
    'debug.queueFullWalking': '{ride} 대기줄 가득 참; 손님 계속 이동',
    'debug.walkingIntoQueue': '{ride} 대기줄로 이동 중',
    'debug.phase': '{ride} {phase}',
    'debug.unloaded': '{ride} 탑승객 하차 완료',
    'debug.reachedQueueSlot': '{ride} 대기 슬롯 도착',
    'phase.idle': '대기',
    'phase.loading': '탑승',
    'phase.running': '운행',
    'phase.unloading': '하차',
  },
  en: {
    'aria.parkTools': 'Park tools',
    'aria.languageSelect': 'Language selection',
    'aria.buildTools': 'Build tools',
    'aria.rideState': 'Ride operating state',
    'aria.rideMusic': 'Ride music state',
    'aria.rideMusicPreset': 'Carousel music selection',
    'aria.rideTools': 'Selected ride placement tools',
    'aria.simulationSpeed': 'Simulation speed',
    'aria.scene': 'Isometric 3D amusement park builder',
    'aria.selectedGuest': 'Selected guest',
    'aria.guestStatus': 'Guest status',
    'aria.debugConsole': 'Debug console',
    'brand.title': 'Park Builder',
    'brand.subtitle': 'Prefab park simulation',
    'language.label': 'Language',
    'section.build': 'Build',
    'section.selectedRide': 'Selected Ride',
    'section.camera': 'Camera',
    'section.simulation': 'Simulation',
    'section.park': 'Park',
    'tool.select': 'Select',
    'tool.path': 'Path',
    'tool.queue': 'Queue path',
    'tool.carousel': 'Carousel set',
    'tool.tree': 'Trees',
    'tool.bulldoze': 'Bulldoze',
    'tool.entrance': 'Entrance',
    'tool.exit': 'Exit',
    'toolStatus.select': 'Select tool selected',
    'toolStatus.path': 'Path tool selected',
    'toolStatus.queue': 'Queue path tool selected',
    'toolStatus.carousel': 'Carousel prefab selected',
    'toolStatus.tree': 'Tree tool selected',
    'toolStatus.bulldoze': 'Bulldoze tool selected',
    'toolStatus.entrance': 'Entrance tool selected',
    'toolStatus.exit': 'Exit tool selected',
    'ride.open': 'Open',
    'ride.closed': 'Closed',
    'ride.musicOn': 'Music On',
    'ride.musicOff': 'Music Off',
    'ride.musicPreset': 'Music',
    'ride.entrance': 'Entrance',
    'ride.exit': 'Exit',
    'ride.placeEntrance': 'Place entrance',
    'ride.placeExit': 'Place exit',
    'ride.none': 'No ride selected',
    'ride.prompt': 'Place or click a carousel',
    'ride.closedStatus': 'Closed',
    'ride.needsEntrance': 'Needs entrance',
    'ride.connectEntrance': 'Connect entrance to queue',
    'ride.connectQueueTail': 'Connect queue tail to path',
    'ride.needsExit': 'Needs exit',
    'ride.connectExit': 'Connect exit to path',
    'ride.riding': 'riding',
    'ride.carouselName': 'Carousel',
    'music.fairgroundOrgan': 'Fairground Organ',
    'music.waltzOrgan': 'Waltz Organ',
    'music.musicBox': 'Music Box',
    'music.militaryBandOrgan': 'Military Band Organ',
    'stats.guests': 'Guests',
    'stats.paths': 'Paths',
    'stats.queues': 'Queues',
    'stats.rides': 'Rides',
    'stats.rating': 'Rating',
    'camera.continuous': 'Continuous QE',
    'guest.label': 'Guest',
    'guest.money': 'Money',
    'guest.hunger': 'Hunger',
    'guest.tiredness': 'Tiredness',
    'guest.happiness': 'Happiness',
    'guest.nausea': 'Nausea',
    'guest.closeWindow': 'Close guest window',
    'guest.follow': 'Follow camera',
    'guest.following': 'Following camera',
    'guest.walking': 'Walking around the park',
    'guest.queueing': 'Walking through a queue',
    'guest.waiting': 'Waiting in line',
    'guest.boarding': 'Boarding a ride',
    'guest.riding': 'On a ride',
    'guest.exiting': 'Leaving a ride',
    'guest.seeking': 'Looking for a path',
    'pause.pause': 'Pause',
    'pause.resume': 'Resume',
    'debug.noRide': 'Guests {guests} · no ride selected',
    'debug.status': '{ride} · {phase} · {speed}x · riders {riders} · boarding {boarding} · exiting {exiting} · queueing {queueing} · waiting {waiting} · seeking {seeking} · timer {timer}s',
    'debug.booting': 'Simulation booting',
    'status.language': 'Language: English',
    'status.speed': 'Simulation speed {speed}x',
    'status.pathBuilt': 'Path built at {key}',
    'status.selectRideFirst': 'Select a ride first',
    'status.entranceAlready': 'Entrance already placed',
    'status.exitAlready': 'Exit already placed',
    'status.queueEntryConnected': 'Queue entry connected at {key}',
    'status.queueBuilt': 'Queue path built at {key}{hint}',
    'status.queueBuiltHint': ' · click adjacent path to set entry',
    'status.queueBuiltConnectEntrance': 'Queue path built at {key} · connect from entrance',
    'status.entrancePlacedNextExit': 'Entrance placed · place {ride} exit',
    'status.gatePlaced': '{kind} placed for {ride}',
    'status.treePlanted': 'Tree planted at {key}',
    'status.carouselInstalled': 'Carousel set installed · place entrance',
    'status.pathRemoved': 'Path removed at {key}',
    'status.queueRemoved': 'Queue path removed at {key}',
    'status.entranceRemoved': 'Entrance removed',
    'status.exitRemoved': 'Exit removed',
    'status.treeRemoved': 'Tree removed at {key}',
    'status.rideRemoved': 'Ride removed',
    'status.nothingToRemove': 'Nothing to remove',
    'status.carouselSelected': 'Carousel selected',
    'status.selectionCleared': 'Selection cleared',
    'status.guestSelected': '{guest} selected',
    'status.panCamera': 'Pan camera',
    'status.clickPathBesideQueue': 'Click a path beside the queue tail',
    'status.rideOpened': 'Ride opened',
    'status.rideClosed': 'Ride closed',
    'status.musicOn': '{ride} music on',
    'status.musicOff': '{ride} music off',
    'status.musicPreset': '{ride} music: {preset}',
    'status.followOn': 'Following {guest}',
    'status.followOff': '{guest} follow off',
    'status.guestWindowClosed': 'Guest window closed',
    'status.quarterRotation': 'Quarter view rotation',
    'status.continuousRotation': 'Continuous QE rotation',
    'status.paused': 'Simulation paused',
    'status.zoom': 'Zoom {zoom}%',
    'status.viewRotated': 'View rotated {key}',
    'debug.boarded': '{ride} boarded guest ({riders}/{capacity})',
    'debug.boarding': '{ride} boarding guest',
    'debug.queueFullLeft': '{ride} queue full; guest left',
    'debug.waiting': 'Guest waiting for {ride}',
    'debug.queueMoved': '{ride} queue moved forward',
    'debug.queueFullWalking': '{ride} queue full; guest kept walking',
    'debug.walkingIntoQueue': 'Guest walking into {ride} queue',
    'debug.phase': '{ride} {phase}',
    'debug.unloaded': '{ride} unloaded riders',
    'debug.reachedQueueSlot': 'Guest reached {ride} queue slot',
    'phase.idle': 'idle',
    'phase.loading': 'loading',
    'phase.running': 'running',
    'phase.unloading': 'unloading',
  },
};

const t = (key: string, replacements: Record<string, string | number> = {}) => {
  let text = translations[language][key] ?? translations.en[key] ?? key;
  Object.entries(replacements).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
};

const rideLabel = (rideOrId: Ride | string) => {
  const id = typeof rideOrId === 'string' ? rideOrId : rideOrId.id;
  return `${t('ride.carouselName')} ${id.split('-')[1]}`;
};

const guestLabel = (guest: Guest) => `${t('guest.label')} #${guest.id}`;

const phaseLabel = (phase: RidePhase) => t(`phase.${phase}`);

const musicPresetLabel = (preset: CarouselMusicPreset) => t(`music.${preset}`);

const carouselMusicPresets: Record<
  CarouselMusicPreset,
  {
    gain: number;
    audioSrc?: string;
    melody?: Array<{ midi: number; duration: number }>;
    voice?: OscillatorType;
    reed?: OscillatorType;
    bassEvery?: number;
    bassOffset?: number;
  }
> = {
  fairgroundOrgan: {
    gain: 0.34,
    voice: 'square',
    reed: 'sawtooth',
    bassEvery: 4,
    bassOffset: -24,
    melody: [
      { midi: 72, duration: 0.18 },
      { midi: 76, duration: 0.18 },
      { midi: 79, duration: 0.18 },
      { midi: 84, duration: 0.3 },
      { midi: 81, duration: 0.18 },
      { midi: 79, duration: 0.18 },
      { midi: 76, duration: 0.18 },
      { midi: 72, duration: 0.3 },
      { midi: 74, duration: 0.18 },
      { midi: 77, duration: 0.18 },
      { midi: 81, duration: 0.18 },
      { midi: 86, duration: 0.3 },
      { midi: 84, duration: 0.18 },
      { midi: 81, duration: 0.18 },
      { midi: 79, duration: 0.18 },
      { midi: 76, duration: 0.3 },
    ],
  },
  waltzOrgan: {
    gain: 0.29,
    voice: 'triangle',
    reed: 'square',
    bassEvery: 3,
    bassOffset: -19,
    melody: [
      { midi: 76, duration: 0.34 },
      { midi: 79, duration: 0.2 },
      { midi: 81, duration: 0.2 },
      { midi: 83, duration: 0.34 },
      { midi: 81, duration: 0.2 },
      { midi: 79, duration: 0.2 },
      { midi: 77, duration: 0.34 },
      { midi: 81, duration: 0.2 },
      { midi: 84, duration: 0.2 },
      { midi: 83, duration: 0.34 },
      { midi: 79, duration: 0.2 },
      { midi: 76, duration: 0.2 },
    ],
  },
  musicBox: {
    gain: 0.22,
    voice: 'triangle',
    reed: 'sine',
    bassEvery: 8,
    bassOffset: -12,
    melody: [
      { midi: 84, duration: 0.24 },
      { midi: 88, duration: 0.24 },
      { midi: 91, duration: 0.24 },
      { midi: 96, duration: 0.48 },
      { midi: 91, duration: 0.24 },
      { midi: 88, duration: 0.24 },
      { midi: 86, duration: 0.24 },
      { midi: 84, duration: 0.48 },
    ],
  },
  militaryBandOrgan: {
    gain: 0.83,
    audioSrc: '/audio/carousel/military-band-organ-game-mix.ogg',
  },
};
const carouselNearDistance = tileSize * 2.5;
const carouselFarDistance = tileSize * 12;
const crowdNearDistance = tileSize * 3.2;
const crowdFarDistance = tileSize * 16;

const ensureAudioContext = () => {
  if (audioContext && masterMusicGain) return audioContext;

  const AudioContextConstructor =
    window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  audioContext = new AudioContextConstructor();
  masterMusicGain = audioContext.createGain();
  masterMusicGain.gain.value = 0;
  masterMusicGain.connect(audioContext.destination);
  return audioContext;
};

const resumeAudioContext = () => {
  const context = ensureAudioContext();
  if (context?.state === 'suspended') void context.resume();
};

const zoomAudioFactor = () => clamp((cameraZoom - 0.55) / 1.2, 0.14, 1);

const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const createCarouselMusic = () => {
  const context = ensureAudioContext();
  if (!context || !masterMusicGain) return undefined;

  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterMusicGain);
  const melody = carouselMusicPresets.fairgroundOrgan.melody ?? [];
  return {
    gain,
    nextNoteTime: context.currentTime + 0.05,
    noteIndex: Math.floor(Math.random() * melody.length),
  } satisfies CarouselMusicState;
};

const scheduleOscillator = (
  context: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  frequency: number,
  time: number,
  duration: number,
  gainValue: number,
  detune = 0,
) => {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.detune.setValueAtTime(detune, time);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(gainValue, time + 0.018);
  envelope.gain.setTargetAtTime(gainValue * 0.72, time + duration * 0.18, duration * 0.4);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.04);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.08);
};

const scheduleCarouselNote = (ride: Ride, time: number, noteIndex: number, midi: number, duration: number) => {
  if (!audioContext || !ride.music) return;

  const preset = carouselMusicPresets[ride.musicPreset];
  if (preset.audioSrc || !preset.voice || !preset.reed || !preset.bassEvery || preset.bassOffset === undefined) return;

  const frequency = midiToFrequency(midi);
  scheduleOscillator(audioContext, ride.music.gain, preset.voice, frequency, time, duration, 0.46, -4);
  scheduleOscillator(audioContext, ride.music.gain, preset.reed, frequency * 2, time, duration * 0.82, 0.16, 5);
  scheduleOscillator(audioContext, ride.music.gain, 'sine', frequency * 0.5, time, duration, 0.1);

  if (noteIndex % preset.bassEvery === 0) {
    scheduleOscillator(audioContext, ride.music.gain, 'square', midiToFrequency(midi + preset.bassOffset), time, duration * 1.2, 0.2);
  }
};

const rideMusicVolume = (ride: Ride) => {
  const ridePosition = worldPos(ride.center.x, ride.center.z);
  const distance = Math.hypot(ridePosition.x - cameraTarget.x, ridePosition.z - cameraTarget.z);
  if (distance >= carouselFarDistance) return 0;
  const presetGain = carouselMusicPresets[ride.musicPreset].gain;
  if (distance <= carouselNearDistance) return presetGain * zoomAudioFactor();
  const fade = 1 - (distance - carouselNearDistance) / (carouselFarDistance - carouselNearDistance);
  return presetGain * fade * fade * zoomAudioFactor();
};

const stopRideMusic = (ride: Ride) => {
  if (!ride.music) return;
  ride.music.audio?.pause();
  ride.music.gain.disconnect();
  ride.music = undefined;
};

const syncCarouselAudioPreset = (ride: Ride) => {
  if (!audioContext || !ride.music) return;

  const preset = carouselMusicPresets[ride.musicPreset];
  if (!preset.audioSrc) {
    if (ride.music.audio) {
      ride.music.audio.pause();
      ride.music.audio = undefined;
    }
    return;
  }

  if (ride.music.audio?.src.endsWith(preset.audioSrc)) return;

  ride.music.audio?.pause();
  const audio = new Audio(preset.audioSrc);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 1;
  audio.playbackRate = 0.94;
  const source = audioContext.createMediaElementSource(audio);
  source.connect(ride.music.gain);
  ride.music.audio = audio;
};

const updateRideAudio = (delta: number) => {
  if (!audioContext || !masterMusicGain) return;

  const context = audioContext;
  const masterGain = masterMusicGain;
  const masterTarget = isPaused ? 0 : 1;
  masterGain.gain.setTargetAtTime(masterTarget, context.currentTime, 0.08);

  rides.forEach((ride) => {
    if (!ride.music) ride.music = createCarouselMusic();
    if (!ride.music) return;

    syncCarouselAudioPreset(ride);

    const targetGain = ride.isOpen && ride.musicEnabled && !isPaused ? rideMusicVolume(ride) : 0;
    ride.music.gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.18);
    if (ride.music.audio) {
      if (targetGain > 0.001 && ride.music.audio.paused) {
        void ride.music.audio.play().catch(() => undefined);
      }
      if (targetGain <= 0.001 && !ride.music.audio.paused) {
        ride.music.audio.pause();
      }
      return;
    }

    if (targetGain <= 0.001) {
      ride.music.nextNoteTime = Math.max(ride.music.nextNoteTime, context.currentTime + 0.05);
      return;
    }

    if (ride.music.nextNoteTime < context.currentTime) {
      ride.music.nextNoteTime = context.currentTime + 0.02;
    }

    const preset = carouselMusicPresets[ride.musicPreset];
    const melody = preset.melody ?? [];
    while (melody.length > 0 && ride.music.nextNoteTime < context.currentTime + Math.max(0.12, delta * 2)) {
      const note = melody[ride.music.noteIndex % melody.length];
      scheduleCarouselNote(ride, ride.music.nextNoteTime, ride.music.noteIndex, note.midi, note.duration);
      ride.music.nextNoteTime += note.duration;
      ride.music.noteIndex += 1;
    }
  });
};

const createCrowdAudio = () => {
  const context = ensureAudioContext();
  if (!context || !masterMusicGain) return null;

  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterMusicGain);

  const crowdLayerSources = [
    { src: '/audio/crowd/festival-crowd-walla.ogg', volume: 0.78, rate: 1, minDensity: 0.2, exponent: 0.66 },
    { src: '/audio/candidates/high-school-cafeteria.ogg', volume: 0.22, rate: 0.985, minDensity: 1.35, exponent: 1.05 },
    { src: '/audio/crowd/mall-less-crowded.ogg', volume: 0.22, rate: 0.97, minDensity: 0.75, exponent: 0.84 },
    { src: '/audio/crowd/mall-alexa-bed.ogg', volume: 0.15, rate: 1.01, minDensity: 2.35, exponent: 1.28 },
  ];

  const layers = crowdLayerSources.map(({ src, volume, rate, minDensity, exponent }, index) => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 1;
    audio.playbackRate = rate + index * 0.006;
    const source = context.createMediaElementSource(audio);
    const layerGain = context.createGain();
    layerGain.gain.value = 0;
    source.connect(layerGain);
    layerGain.connect(gain);
    return {
      audio,
      gain: layerGain,
      minDensity,
      maxVolume: volume,
      exponent,
    };
  });

  const effects = [
    { src: '/audio/crowd/baby-cry-2s-cc0.ogg', volume: 0.12, minCrowd: 2.2, stopAfter: 2.05, minDelay: 160, maxDelay: 350 },
    { src: '/audio/laughter-candidates/small-group-laughter.ogg', volume: 0.18, minCrowd: 1.8, stopAfter: 2.8, minDelay: 10, maxDelay: 50 },
    { src: '/audio/laughter-candidates/laughter-public-domain.ogg', volume: 0.14, minCrowd: 1.6, stopAfter: 1, minDelay: 10, maxDelay: 50 },
    { src: '/audio/ride-effects/stealth-launch-reaction-3-9s.ogg', volume: 0.16, minCrowd: 1.2, stopAfter: 6, minDelay: 10, maxDelay: 50 },
    { src: '/audio/ride-effects/oblivion-happy-squeal-3-4s.ogg', volume: 0.2, minCrowd: 1.2, stopAfter: 1.15, minDelay: 10, maxDelay: 50 },
  ].map(({ src, volume, minCrowd, stopAfter, minDelay, maxDelay }) => {
    const audio = new Audio(src);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = volume;
    const source = context.createMediaElementSource(audio);
    source.connect(gain);
    return {
      audio,
      minCrowd,
      stopAfter,
      minDelay,
      maxDelay,
      nextTime: context.currentTime + minDelay + Math.random() * maxDelay,
    };
  });

  return {
    gain,
    layers,
    effects,
  } satisfies CrowdAudioState;
};

const nearbyCrowdAmount = () => {
  let amount = 0;
  let visibleGuests = 0;
  guests.forEach((guest) => {
    if (!guest.mesh.visible || guest.state === 'riding') return;
    visibleGuests += 1;

    const distance = Math.hypot(guest.mesh.position.x - cameraTarget.x, guest.mesh.position.z - cameraTarget.z);
    if (distance >= crowdFarDistance) return;
    if (distance <= crowdNearDistance) {
      amount += 1;
      return;
    }

    const fade = 1 - (distance - crowdNearDistance) / (crowdFarDistance - crowdNearDistance);
    amount += fade * fade;
  });
  return amount + Math.min(visibleGuests * 0.08, 2.4) + audioTestZoneCrowdAmount();
};

const audioTestZoneCrowdAmount = () =>
  audioTestZones.reduce((amount, zone) => {
    const zonePosition = worldPos(zone.center.x, zone.center.z);
    const distance = Math.hypot(zonePosition.x - cameraTarget.x, zonePosition.z - cameraTarget.z);
    if (distance >= zone.radius) return amount;
    if (distance <= zone.radius * 0.45) return amount + zone.amount;

    const fade = 1 - (distance - zone.radius * 0.45) / (zone.radius * 0.55);
    return amount + zone.amount * fade * fade;
  }, 0);

const updateCrowdAudio = () => {
  if (!audioContext || !masterMusicGain) return;
  if (!crowdAudio) crowdAudio = createCrowdAudio();
  if (!crowdAudio) return;

  const context = audioContext;
  const crowdAmount = nearbyCrowdAmount();
  const density = clamp(crowdAmount / 7, 0, 1);
  const targetGain = isPaused ? 0 : clamp(0.035 + density * 0.68, 0, 0.72) * zoomAudioFactor();
  crowdAudio.gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.25);

  crowdAudio.layers.forEach((layer) => {
    const layerDensity = clamp((crowdAmount - layer.minDensity) / 5.2, 0, 1);
    const layerTarget = isPaused ? 0 : layer.maxVolume * layerDensity ** layer.exponent;
    layer.gain.gain.setTargetAtTime(layerTarget, context.currentTime, 0.35);

    if (targetGain <= 0.004) return;
    if (layer.audio.duration > 0 && layer.audio.currentTime === 0) {
      layer.audio.currentTime = Math.random() * Math.max(0, layer.audio.duration - 0.2);
    }
    if (layer.audio.paused) void layer.audio.play().catch(() => undefined);
  });

  crowdAudio.effects.forEach((effect) => {
    if (effect.stopTime && context.currentTime >= effect.stopTime) {
      effect.audio.pause();
      effect.audio.currentTime = 0;
      effect.stopTime = undefined;
    }

    if (targetGain <= 0.045 || crowdAmount < effect.minCrowd || context.currentTime < effect.nextTime || !effect.audio.paused) return;

    effect.audio.currentTime = 0;
    void effect.audio.play().catch(() => undefined);
    const denseCrowdFactor = clamp(crowdAmount / 7, 0.25, 1);
    effect.stopTime = context.currentTime + effect.stopAfter;
    effect.nextTime = context.currentTime + effect.minDelay / denseCrowdFactor + Math.random() * effect.maxDelay;
  });
};

const applyStaticTranslations = () => {
  document.documentElement.lang = language;
  document.title = language === 'ko' ? 'RCT Three.js 프로토타입' : 'RCT Three.js Prototype';
  languageSelect.value = language;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n ?? '');
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle ?? '');
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria ?? ''));
  });
  pauseButton.textContent = isPaused ? t('pause.resume') : t('pause.pause');
};

const setStatus = (message: string) => {
  statusText.textContent = message;
};

const debug = (message: string) => {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  debugLines.unshift(`[${time}] ${message}`);
  debugLines.length = Math.min(debugLines.length, 8);
  debugLog.textContent = debugLines.join('\n');
};

const refreshStats = () => {
  guestCount.textContent = String(guests.length);
  pathCount.textContent = String(paths.size);
  queueCount.textContent = String(queuePaths.size);
  rideCount.textContent = String(rides.size);
};

const selectedGuest = () => (selectedGuestId === null ? undefined : guests.find((guest) => guest.id === selectedGuestId));

const formatPercent = (value: number) => `${Math.round(clamp(value, 0, 100))}%`;

const formatGuestStatus = (guest: Guest) => {
  if (guest.state === 'walking') return t('guest.walking');
  if (guest.state === 'queueing') return t('guest.queueing');
  if (guest.state === 'waiting') return t('guest.waiting');
  if (guest.state === 'boarding') return t('guest.boarding');
  if (guest.state === 'riding') return t('guest.riding');
  if (guest.state === 'exiting') return t('guest.exiting');
  return t('guest.seeking');
};

const setGuestFollow = (enabled: boolean) => {
  followSelectedGuest = enabled && Boolean(selectedGuest());
  guestFollowButton.classList.toggle('is-active', followSelectedGuest);
  guestFollowButton.textContent = followSelectedGuest ? t('guest.following') : t('guest.follow');
};

const updateSelectedGuestWindow = () => {
  const guest = selectedGuest();
  if (!guest) {
    selectedGuestId = null;
    guestWindow.hidden = true;
    guestSelection.visible = false;
    setGuestFollow(false);
    return;
  }

  guestWindow.hidden = false;
  guestWindowTitle.textContent = guestLabel(guest);
  guestStatusText.textContent = formatGuestStatus(guest);
  guestMoney.textContent = `$${guest.money.toFixed(2)}`;
  guestHunger.textContent = formatPercent(guest.hunger);
  guestTiredness.textContent = formatPercent(guest.tiredness);
  guestHappiness.textContent = formatPercent(guest.happiness);
  guestNausea.textContent = formatPercent(guest.nausea);
  guestFollowButton.classList.toggle('is-active', followSelectedGuest);
  guestFollowButton.textContent = followSelectedGuest ? t('guest.following') : t('guest.follow');

  if (guest.mesh.visible) {
    guestSelection.visible = true;
    guestSelection.position.set(guest.mesh.position.x, 0.18, guest.mesh.position.z);
  } else {
    guestSelection.visible = false;
  }
};

const adjacentKeys = ({ x, z }: GridCoord) => [keyOf(x + 1, z), keyOf(x - 1, z), keyOf(x, z + 1), keyOf(x, z - 1)];

const isWalkway = (key: string) => paths.has(key);
const isAnyBuiltPath = (key: string) => paths.has(key) || queuePaths.has(key);

const queueDirectionOrder: QueueDirection[] = ['north', 'east', 'south', 'west'];
const queueDirectionVectors: Record<QueueDirection, GridCoord> = {
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
};
const oppositeQueueDirection: Record<QueueDirection, QueueDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};

const edgeFromDelta = (dx: number, dz: number): QueueEdge | null => {
  if (dx === 1 && dz === 0) return 'east';
  if (dx === -1 && dz === 0) return 'west';
  if (dx === 0 && dz === 1) return 'south';
  if (dx === 0 && dz === -1) return 'north';
  return null;
};

const directionBetweenKeys = (fromKey: string, toKey: string) => {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  return edgeFromDelta(to.x - from.x, to.z - from.z);
};

const keyInDirection = (key: string, direction: QueueDirection) => {
  const coord = parseKey(key);
  const vector = queueDirectionVectors[direction];
  return keyOf(coord.x + vector.x, coord.z + vector.z);
};

const queueForwardKey = (key: string) => {
  const queuePath = queuePaths.get(key);
  return queuePath?.nextKey ?? key;
};

const incomingQueueKeys = (key: string) =>
  adjacentKeys(parseKey(key)).filter((neighborKey) => queuePaths.has(neighborKey) && queueForwardKey(neighborKey) === key);

const queueEntryPathKeys = (key: string) => {
  const queuePath = queuePaths.get(key);
  if (!queuePath?.entryPathKey || !paths.has(queuePath.entryPathKey)) return [];
  return adjacentKeys(parseKey(key)).includes(queuePath.entryPathKey) ? [queuePath.entryPathKey] : [];
};

const previewQueueEntryPathKey = (key: string) => {
  if (activeTool !== 'queue' || !hoveredTile) return null;
  const pathKey = keyOf(hoveredTile.x, hoveredTile.z);
  if (queueEntryTargetForPath(pathKey) !== key) return null;
  return pathKey;
};

const rideConnectionStatus = (ride: Ride) => {
  const hasQueueConnection = ride.entranceKey
    ? adjacentKeys(parseKey(ride.entranceKey)).some((key) => queuePaths.has(key) && queueForwardKey(key) === ride.entranceKey)
    : false;
  const hasQueueEntryPath = ride.entranceKey ? queueTailKeysForRide(ride).some((key) => queueEntryPathKeys(key).length > 0) : false;
  const hasExitPath = ride.exitKey ? adjacentKeys(parseKey(ride.exitKey)).some((key) => paths.has(key)) : false;
  return {
    hasQueueConnection,
    hasQueueEntryPath,
    hasExitPath,
    ready: ride.isOpen && Boolean(ride.entranceKey) && Boolean(ride.exitKey) && hasQueueConnection && hasQueueEntryPath && hasExitPath,
  };
};

const directionToRide = (coord: GridCoord, ride: Ride) => {
  const neighborKey = adjacentKeys(coord).find((cellKey) => ride.footprint.includes(cellKey));
  if (!neighborKey) return new THREE.Vector2(0, -1);

  const neighbor = parseKey(neighborKey);
  const direction = new THREE.Vector2(neighbor.x - coord.x, neighbor.z - coord.z);
  if (direction.lengthSq() === 0) return new THREE.Vector2(0, -1);
  return direction.normalize();
};

const rotationYForDirection = (direction: THREE.Vector2) => Math.atan2(direction.x, direction.y);

const rotationYForQueueDirection = (direction: QueueDirection) => {
  const vector = queueDirectionVectors[direction];
  return rotationYForDirection(new THREE.Vector2(vector.x, vector.z));
};

const updateRideVisual = (ride: Ride) => {
  const connection = rideConnectionStatus(ride);
  ride.statusLight.material = connection.ready ? openMaterial : closedMaterial;
};

const updateRideToolButtons = (ride?: Ride) => {
  placeEntranceButton.disabled = !ride || Boolean(ride.entranceKey);
  placeExitButton.disabled = !ride || Boolean(ride.exitKey);
  rideToolButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.rideTool === activeTool);
  });
};

const updateSelectedRidePanel = () => {
  const ride = selectedRideId ? rides.get(selectedRideId) : undefined;
  if (!ride) {
    selectedRideId = null;
    ridePanel.hidden = true;
    selectedRideName.textContent = t('ride.none');
    selectedRideStatus.textContent = t('ride.prompt');
    rideOpenButton.disabled = true;
    rideCloseButton.disabled = true;
    rideMusicOnButton.disabled = true;
    rideMusicOffButton.disabled = true;
    rideMusicPresetSelect.disabled = true;
    rideOpenButton.classList.remove('is-active');
    rideCloseButton.classList.add('is-active');
    rideMusicOnButton.classList.remove('is-active');
    rideMusicOffButton.classList.add('is-active');
    updateRideToolButtons();
    return;
  }

  ridePanel.hidden = false;
  const connection = rideConnectionStatus(ride);
  selectedRideName.textContent = rideLabel(ride);
  rideOpenButton.disabled = false;
  rideCloseButton.disabled = false;
  rideMusicOnButton.disabled = false;
  rideMusicOffButton.disabled = false;
  rideMusicPresetSelect.disabled = false;
  rideMusicPresetSelect.value = ride.musicPreset;
  rideOpenButton.classList.toggle('is-active', ride.isOpen);
  rideCloseButton.classList.toggle('is-active', !ride.isOpen);
  rideMusicOnButton.classList.toggle('is-active', ride.musicEnabled);
  rideMusicOffButton.classList.toggle('is-active', !ride.musicEnabled);

  if (!ride.isOpen) {
    selectedRideStatus.textContent = t('ride.closedStatus');
  } else if (!ride.entranceKey) {
    selectedRideStatus.textContent = t('ride.needsEntrance');
  } else if (!connection.hasQueueConnection) {
    selectedRideStatus.textContent = t('ride.connectEntrance');
  } else if (!connection.hasQueueEntryPath) {
    selectedRideStatus.textContent = t('ride.connectQueueTail');
  } else if (!ride.exitKey) {
    selectedRideStatus.textContent = t('ride.needsExit');
  } else if (!connection.hasExitPath) {
    selectedRideStatus.textContent = t('ride.connectExit');
  } else {
    selectedRideStatus.textContent = `${phaseLabel(ride.phase).toUpperCase()} · ${ride.riders} ${t('ride.riding')}`;
  }
  updateRideToolButtons(ride);
  updateRideVisual(ride);
};

const updateDebugStatus = () => {
  const ride = selectedRideId ? rides.get(selectedRideId) : undefined;
  if (!ride) {
    debugStatus.textContent = t('debug.noRide', { guests: guests.length });
    return;
  }

  const waiting = guests.filter((guest) => guest.state === 'waiting' && guest.rideId === ride.id).length;
  const queueing = guests.filter((guest) => guest.state === 'queueing' && guest.rideId === ride.id).length;
  const boarding = guests.filter((guest) => guest.state === 'boarding' && guest.rideId === ride.id).length;
  const exiting = guests.filter((guest) => guest.state === 'exiting' && guest.rideId === ride.id).length;
  const seeking = guests.filter((guest) => guest.state === 'seeking').length;
  debugStatus.textContent = t('debug.status', {
    ride: rideLabel(ride),
    phase: phaseLabel(ride.phase),
    speed: simulationSpeed,
    riders: ride.riders,
    boarding,
    exiting,
    queueing,
    waiting,
    seeking,
    timer: ride.phaseTimer.toFixed(1),
  });
};

const setSimulationSpeed = (speed: number) => {
  simulationSpeed = speed;
  speedButtons.forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.speed) === simulationSpeed);
  });
  setStatus(t('status.speed', { speed: simulationSpeed }));
  updateDebugStatus();
};

const setTool = (tool: Tool) => {
  activeTool = tool;
  if (tool !== 'queue') lastQueueBuildKey = null;
  resetDragActions();
  toolButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === tool);
  });
  rideToolButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.rideTool === tool);
  });
  setStatus(toolStatusLabel(tool));
};

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool as Tool));
});

rideToolButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const tool = button.dataset.rideTool as 'entrance' | 'exit';
    const ride = selectedRide();
    if (!ride) {
      setStatus(t('status.selectRideFirst'));
      return;
    }
    if (tool === 'entrance' && ride.entranceKey) {
      setStatus(t('status.entranceAlready'));
      return;
    }
    if (tool === 'exit' && ride.exitKey) {
      setStatus(t('status.exitAlready'));
      return;
    }
    setTool(tool);
    updatePreview();
  });
});

speedButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSimulationSpeed(Number(button.dataset.speed));
  });
});

for (let x = -halfMap; x < halfMap; x += 1) {
  for (let z = -halfMap; z < halfMap; z += 1) {
    const material = groundMaterials[Math.abs(x + z) % groundMaterials.length];
    const tile = new THREE.Mesh(tileGeometry, material);
    const y = heightAt(x, z);
    tile.position.set(x * tileSize, y - 0.14, z * tileSize);
    tile.castShadow = true;
    tile.receiveShadow = true;
    tile.userData.coord = { x, z } satisfies GridCoord;
    groundGroup.add(tile);
    tiles.push(tile);
  }
}

const selection = new THREE.Mesh(selectionGeometry, selectionMaterial);
selection.visible = false;
world.add(selection);

const guestSelection = new THREE.Mesh(guestSelectionGeometry, guestSelectionMaterial);
guestSelection.rotation.x = -Math.PI / 2;
guestSelection.visible = false;
world.add(guestSelection);

const placementPreview = new THREE.Group();
world.add(placementPreview);

const clearPreview = () => {
  placementPreview.clear();
};

const footprintFor = (tool: Tool, coord: GridCoord) => {
  if (tool !== 'carousel') return [coord];

  const cells: GridCoord[] = [];
  for (let x = coord.x - 1; x <= coord.x + 1; x += 1) {
    for (let z = coord.z - 1; z <= coord.z + 1; z += 1) {
      cells.push({ x, z });
    }
  }
  return cells;
};

const selectedRide = () => (selectedRideId ? rides.get(selectedRideId) : undefined);

const rideIdAt = (key: string) => occupied.get(key) ?? entrances.get(key)?.rideId ?? exits.get(key)?.rideId ?? null;

const canSelectRideAt = (coord: GridCoord) => rideIdAt(keyOf(coord.x, coord.z)) !== null;

const isBlockedTile = (key: string) =>
  occupied.has(key) || paths.has(key) || queuePaths.has(key) || trees.has(key) || entrances.has(key) || exits.has(key);

const canPlacePath = ({ x, z }: GridCoord) => inBounds(x, z) && !isBlockedTile(keyOf(x, z));

const canPlaceQueue = ({ x, z }: GridCoord) => inBounds(x, z) && !isBlockedTile(keyOf(x, z));

const canPlaceTree = ({ x, z }: GridCoord) => {
  const key = keyOf(x, z);
  return inBounds(x, z) && !isBlockedTile(key);
};

const canPlaceCarousel = (coord: GridCoord) =>
  footprintFor('carousel', coord).every(({ x, z }) => {
    const key = keyOf(x, z);
    return inBounds(x, z) && !isBlockedTile(key);
  });

const canPlaceRideGate = (coord: GridCoord, kind: 'entrance' | 'exit') => {
  const ride = selectedRide();
  if (!ride) return false;

  const key = keyOf(coord.x, coord.z);
  const existingKey = kind === 'entrance' ? ride.entranceKey : ride.exitKey;
  return inBounds(coord.x, coord.z) && !isBlockedTile(key) && adjacentKeys(coord).some((cellKey) => ride.footprint.includes(cellKey)) && !existingKey;
};

const canPlace = (tool: Tool, coord: GridCoord) => {
  if (tool === 'select') return canSelectRideAt(coord);
  if (tool === 'path') return canPlacePath(coord);
  if (tool === 'queue') return canPlaceQueue(coord) || canConnectQueueEntryFromPath(keyOf(coord.x, coord.z));
  if (tool === 'tree') return canPlaceTree(coord);
  if (tool === 'carousel') return canPlaceCarousel(coord);
  if (tool === 'entrance') return canPlaceRideGate(coord, 'entrance');
  if (tool === 'exit') return canPlaceRideGate(coord, 'exit');

  const key = keyOf(coord.x, coord.z);
  return isAnyBuiltPath(key) || occupied.has(key) || trees.has(key) || entrances.has(key) || exits.has(key);
};

const bulldozeTargetAt = (coord: GridCoord): BulldozeTarget | null => {
  const key = keyOf(coord.x, coord.z);
  if (paths.has(key)) return 'path';
  if (queuePaths.has(key)) return 'queue';
  if (entrances.has(key)) return 'entrance';
  if (exits.has(key)) return 'exit';
  if (trees.has(key)) return 'tree';
  if (occupied.has(key)) return 'ride';
  return null;
};

const updatePreview = () => {
  clearPreview();
  if (!hoveredTile) {
    selection.visible = false;
    return;
  }

  if (activeTool === 'select') {
    selection.visible = canSelectRideAt(hoveredTile);
    selection.material = selectionMaterial;
    selection.position.copy(worldPos(hoveredTile.x, hoveredTile.z, 0.11));
    return;
  }

  const cells = footprintFor(activeTool, hoveredTile);
  const valid = canPlace(activeTool, hoveredTile);
  selection.visible = true;
  selection.material = valid || activeTool === 'bulldoze' ? selectionMaterial : blockedMaterial;
  selection.position.copy(worldPos(hoveredTile.x, hoveredTile.z, 0.11));

  if (activeTool === 'queue' && canPlaceQueue(hoveredTile)) {
    const preview = createQueuePath(true);
    preview.group.position.copy(worldPos(hoveredTile.x, hoveredTile.z, 0.02));
    placementPreview.add(preview.group);
    selection.visible = false;
  }

  if (cells.length > 1) {
    cells.forEach(({ x, z }) => {
      if (!inBounds(x, z)) return;
      const previewTile = new THREE.Mesh(selectionGeometry, valid ? selectionMaterial : blockedMaterial);
      previewTile.position.copy(worldPos(x, z, 0.12));
      placementPreview.add(previewTile);
    });
    selection.visible = false;
  }
};

const buildDraggedPathAt = (coord: GridCoord) => {
  if (activeTool === 'path') return addPath(coord);
  if (activeTool === 'queue') return addQueuePath(coord);
  return false;
};

const resetDragActions = () => {
  isPathDragging = false;
  isBulldozeDragging = false;
  lastDraggedBuildKey = null;
  lastDraggedBulldozeKey = null;
  bulldozeDragTarget = null;
};

const addPath = (coord: GridCoord, silent = false) => {
  if (!canPlacePath(coord)) return false;

  const key = keyOf(coord.x, coord.z);
  const path = new THREE.Mesh(pathGeometry, pathMaterial);
  path.position.copy(worldPos(coord.x, coord.z, 0.045));
  path.receiveShadow = true;
  buildGroup.add(path);
  paths.set(key, path);
  refreshQueueVisualsAround(coord);

  if (!silent) setStatus(t('status.pathBuilt', { key }));
  refreshStats();
  updateSelectedRidePanel();
  return true;
};

const createQueueFence = (edge: QueueEdge) => {
  const isHorizontal = edge === 'north' || edge === 'south';
  const fence = new THREE.Mesh(isHorizontal ? queueFenceCrossGeometry : queueFenceGeometry, queueFenceMaterial);
  const offset = tileSize * 0.39;
  if (edge === 'north') fence.position.set(0, 0.26, -offset);
  if (edge === 'south') fence.position.set(0, 0.26, offset);
  if (edge === 'east') fence.position.set(offset, 0.26, 0);
  if (edge === 'west') fence.position.set(-offset, 0.26, 0);
  fence.castShadow = true;
  fence.receiveShadow = true;
  return fence;
};

const createQueueEntryPreview = () => {
  const group = new THREE.Group();

  const arrow = new THREE.Mesh(queueArrowGeometry, queueEntryMaterial);
  arrow.position.y = 0.18;
  arrow.scale.setScalar(0.72);
  arrow.rotation.x = -Math.PI / 2;
  group.add(arrow);

  group.visible = false;
  return group;
};

const createQueueEntryGhost = () => {
  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];

  for (let i = 0; i < 3; i += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xf7f1ff,
      roughness: 0.62,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    materials.push(material);

    const ghost = new THREE.Group();
    ghost.userData.phaseOffset = i / 3;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.5, 10), material);
    body.position.y = 0.36;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), material);
    head.position.y = 0.74;
    ghost.add(body, head);
    group.add(ghost);
  }

  group.visible = false;
  return { group, materials };
};

const createQueuePath = (preview = false): QueuePath => {
  const group = new THREE.Group();

  const baseMaterial = preview ? queuePreviewMaterial : queueMaterial;
  const base = new THREE.Mesh(pathGeometry, baseMaterial);
  base.position.y = 0.05;
  base.receiveShadow = true;
  group.add(base);

  const entryPreview = createQueueEntryPreview();
  group.add(entryPreview);

  const { group: entryGhost, materials: entryGhostMaterials } = createQueueEntryGhost();
  group.add(entryGhost);

  const fences = new THREE.Group();
  group.add(fences);
  ['east', 'west'].forEach((edge) => fences.add(createQueueFence(edge as QueueEdge)));

  return { group, entryPreview, entryGhost, entryGhostMaterials, fences };
};

const refreshQueueVisualAt = (key: string) => {
  const queuePath = queuePaths.get(key);
  if (!queuePath) return;

  queuePath.entryPreview.visible = false;
  queuePath.entryGhost.visible = false;
  queuePath.fences.clear();

  const coord = parseKey(key);
  const openEdges = new Set<QueueEdge>();
  const nextKey = queuePath.nextKey;
  const nextEdge = nextKey ? directionBetweenKeys(key, nextKey) : null;
  if (nextEdge) openEdges.add(nextEdge);

  const incomingKeys = incomingQueueKeys(key);
  const previewEntryPathKey = incomingKeys.length === 0 ? previewQueueEntryPathKey(key) : null;
  const entryPathKeys = incomingKeys.length === 0 ? [previewEntryPathKey, ...queueEntryPathKeys(key)].filter((pathKey): pathKey is string => Boolean(pathKey)) : [];

  incomingKeys.forEach((neighborKey) => {
    const neighborCoord = parseKey(neighborKey);
    const edge = edgeFromDelta(neighborCoord.x - coord.x, neighborCoord.z - coord.z);
    if (edge) openEdges.add(edge);
  });

  entryPathKeys.forEach((pathKey) => {
    const pathCoord = parseKey(pathKey);
    const edge = edgeFromDelta(pathCoord.x - coord.x, pathCoord.z - coord.z);
    if (!edge) return;
    openEdges.add(edge);
    const vector = queueDirectionVectors[edge];
    queuePath.entryPreview.visible = true;
    queuePath.entryPreview.position.set(vector.x * tileSize * 0.44, 0, vector.z * tileSize * 0.44);
    queuePath.entryPreview.rotation.y = rotationYForQueueDirection(oppositeQueueDirection[edge]);
  });

  if (incomingKeys.length === 0 && entryPathKeys.length === 0 && nextEdge) openEdges.add(oppositeQueueDirection[nextEdge]);

  queueDirectionOrder.forEach((edge) => {
    if (!openEdges.has(edge)) queuePath.fences.add(createQueueFence(edge));
  });
};

const refreshQueueVisualsAround = (coord: GridCoord) => {
  [keyOf(coord.x, coord.z), ...adjacentKeys(coord)].forEach((key) => refreshQueueVisualAt(key));
};

const refreshQueueEntryPreviewAround = (...coords: Array<GridCoord | null>) => {
  if (activeTool !== 'queue') return;
  coords.forEach((coord) => {
    if (coord) refreshQueueVisualsAround(coord);
  });
};

const updateQueueEntryPreviews = () => {
  queuePaths.forEach((queuePath) => {
    queuePath.entryGhost.visible = false;
  });
  if (activeTool !== 'queue' || !hoveredTile) return;

  const pathKey = keyOf(hoveredTile.x, hoveredTile.z);
  const queueKey = queueEntryTargetForPath(pathKey);
  if (!queueKey) return;

  const queuePath = queuePaths.get(queueKey);
  if (!queuePath || queuePath.entryPathKey === pathKey) return;

  const edge = directionBetweenKeys(queueKey, pathKey);
  if (!edge) return;

  const elapsed = performance.now() * 0.001;
  const vector = queueDirectionVectors[edge];
  queuePath.entryGhost.visible = true;
  queuePath.entryGhost.rotation.y = 0;
  queuePath.entryGhost.children.forEach((ghost, index) => {
    const phaseOffset = Number(ghost.userData.phaseOffset ?? 0);
    const progress = (elapsed / 1.45 + phaseOffset) % 1;
    const distance = tileSize * (0.56 - progress * 0.44);
    ghost.position.set(vector.x * distance, 0, vector.z * distance);
    queuePath.entryGhostMaterials[index].opacity = 0.04 + progress * 0.3;
    ghost.scale.setScalar(0.78 + progress * 0.16);
  });
};

const isQueueTailForRide = (ride: Ride, key: string) => queueTailKeysForRide(ride).includes(key);

const connectedRideForQueueKey = (queueKey: string) =>
  Array.from(rides.values()).find((ride) => queueKeysForRide(ride).includes(queueKey));

const nextQueueKeyForPlacement = (key: string, preferredNextKey?: string) => {
  const ride = selectedRide();
  const neighbors = adjacentKeys(parseKey(key));
  if (ride?.entranceKey && neighbors.includes(ride.entranceKey)) return ride.entranceKey;

  if (preferredNextKey && neighbors.includes(preferredNextKey) && queuePaths.has(preferredNextKey)) {
    const preferredRide = connectedRideForQueueKey(preferredNextKey);
    if ((!ride && preferredRide) || (ride && preferredRide?.id === ride.id) || (!preferredRide && queuePaths.get(preferredNextKey)?.nextKey)) {
      return preferredNextKey;
    }
  }

  if (ride) {
    return neighbors.find((neighborKey) => queuePaths.has(neighborKey) && isQueueTailForRide(ride, neighborKey));
  }

  return neighbors.find((neighborKey) => {
    if (!queuePaths.has(neighborKey)) return false;
    const queueRide = connectedRideForQueueKey(neighborKey);
    return Boolean(queueRide && isQueueTailForRide(queueRide, neighborKey));
  });
};

const queueEntryTargetForPath = (pathKey: string) => {
  if (!paths.has(pathKey)) return null;

  const ride = selectedRide();
  return (
    adjacentKeys(parseKey(pathKey)).find((queueKey) => {
      if (!queuePaths.has(queueKey)) return false;
      const queueRide = connectedRideForQueueKey(queueKey);
      if (!queueRide || (ride && queueRide.id !== ride.id)) return false;
      return queueTailKeysForRide(queueRide).includes(queueKey);
    }) ?? null
  );
};

const canConnectQueueEntryFromPath = (pathKey: string) => Boolean(queueEntryTargetForPath(pathKey));

const connectQueueEntryToPath = (queueKey: string, pathKey: string, silent = false) => {
  const queuePath = queuePaths.get(queueKey);
  if (!queuePath || !paths.has(pathKey) || !adjacentKeys(parseKey(queueKey)).includes(pathKey)) return false;

  const ride = connectedRideForQueueKey(queueKey);
  if (!ride || !queueTailKeysForRide(ride).includes(queueKey)) return false;

  queuePath.entryPathKey = pathKey;
  refreshQueueVisualsAround(parseKey(queueKey));
  updateSelectedRidePanel();
  resetInvalidGuests();
  if (!silent) setStatus(t('status.queueEntryConnected', { key: pathKey }));
  return true;
};

const connectQueueEntryFromPath = (pathKey: string) => {
  const queueKey = queueEntryTargetForPath(pathKey);
  return queueKey ? connectQueueEntryToPath(queueKey, pathKey) : false;
};

const addQueuePath = (coord: GridCoord, silent = false) => {
  if (!canPlaceQueue(coord)) return false;

  const key = keyOf(coord.x, coord.z);
  const queuePath = createQueuePath();
  queuePath.nextKey = nextQueueKeyForPlacement(key, lastQueueBuildKey ?? undefined);
  const previousTail = queuePath.nextKey ? queuePaths.get(queuePath.nextKey) : undefined;
  if (previousTail) previousTail.entryPathKey = undefined;
  queuePath.group.position.copy(worldPos(coord.x, coord.z));
  buildGroup.add(queuePath.group);
  queuePaths.set(key, queuePath);
  refreshQueueVisualsAround(coord);
  if (queuePath.nextKey) refreshQueueVisualAt(queuePath.nextKey);

  if (!silent) {
    const hasAdjacentPath = adjacentKeys(coord).some((pathKey) => paths.has(pathKey));
    setStatus(
      queuePath.nextKey
        ? t('status.queueBuilt', { key, hint: hasAdjacentPath ? t('status.queueBuiltHint') : '' })
        : t('status.queueBuiltConnectEntrance', { key }),
    );
  }
  refreshStats();
  updateSelectedRidePanel();
  lastQueueBuildKey = queuePath.nextKey ? key : null;
  return true;
};

const createGate = (kind: 'entrance' | 'exit') => {
  const group = new THREE.Group();
  const material = kind === 'entrance' ? entranceMaterial : exitMaterial;
  const floorMaterial = kind === 'entrance' ? queueMaterial : pathMaterial;
  const barMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.42, metalness: 0.15 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(tileSize * 1.02, 0.08, tileSize * 1.02), floorMaterial);
  base.position.y = 0.05;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const booth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.5), material);
  booth.position.set(-0.42, 0.47, -0.1);
  booth.castShadow = true;
  booth.receiveShadow = true;
  group.add(booth);

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.25, 0.16), material);
  leftPost.position.set(-0.58, 0.74, 0.32);
  leftPost.castShadow = true;
  group.add(leftPost);

  const rightPost = leftPost.clone();
  rightPost.position.x = 0.58;
  group.add(rightPost);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.2, 0.2), material);
  lintel.position.set(0, 1.34, 0.32);
  lintel.castShadow = true;
  group.add(lintel);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.34, 0.12), material);
  sign.position.set(0, 1.58, 0.34);
  sign.castShadow = true;
  group.add(sign);

  const barPivot = new THREE.Group();
  barPivot.position.set(-0.58, 0.74, 0.32);
  group.add(barPivot);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.08), barMaterial);
  bar.position.x = 0.58;
  bar.castShadow = true;
  barPivot.add(bar);

  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 10), barMaterial);
  hinge.rotation.x = Math.PI / 2;
  hinge.castShadow = true;
  barPivot.add(hinge);

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.28, 3),
    new THREE.MeshStandardMaterial({ color: kind === 'entrance' ? 0xd9ffe2 : 0xffe1d8, roughness: 0.5 }),
  );
  marker.position.set(0, 1.84, 0.38);
  marker.rotation.x = Math.PI / 2;
  marker.castShadow = true;
  group.add(marker);

  return { mesh: group, bar: barPivot, openAmount: 0 };
};

const addRideGate = (coord: GridCoord, kind: 'entrance' | 'exit', silent = false) => {
  const ride = selectedRide();
  if (!ride || !canPlaceRideGate(coord, kind)) return false;

  const key = keyOf(coord.x, coord.z);
  const gate = createGate(kind);
  const direction = directionToRide(coord, ride);
  gate.mesh.position.copy(worldPos(coord.x, coord.z, 0.04));
  gate.mesh.rotation.y = rotationYForDirection(direction);
  buildGroup.add(gate.mesh);

  if (kind === 'entrance') {
    ride.entranceKey = key;
    entrances.set(key, { rideId: ride.id, ...gate });
  } else {
    ride.exitKey = key;
    exits.set(key, { rideId: ride.id, ...gate });
  }
  refreshQueueVisualsAround(coord);

  updateSelectedRidePanel();
  if (!silent) {
    if (kind === 'entrance' && !ride.exitKey) {
      setTool('exit');
      setStatus(t('status.entrancePlacedNextExit', { ride: rideLabel(ride) }));
    } else {
      setTool('select');
      setStatus(t('status.gatePlaced', { kind: t(`ride.${kind}`), ride: rideLabel(ride) }));
    }
  }
  return true;
};

const createTree = (coord: GridCoord) => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c35, roughness: 0.9 }),
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  group.add(trunk);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.78, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x2f7d4a : 0x3f9355, roughness: 0.82 }),
  );
  canopy.position.y = 1.4;
  canopy.castShadow = true;
  group.add(canopy);

  group.position.copy(worldPos(coord.x, coord.z));
  return group;
};

const addTree = (coord: GridCoord, silent = false) => {
  if (!canPlaceTree(coord)) return false;

  const key = keyOf(coord.x, coord.z);
  const tree = createTree(coord);
  buildGroup.add(tree);
  trees.set(key, tree);
  if (!silent) setStatus(t('status.treePlanted', { key }));
  return true;
};

const createCarouselRiderVisual = (seatIndex: number) => {
  const group = new THREE.Group();
  const shirtColors = [0x2d9cdb, 0xeb5757, 0x27ae60, 0xbb6bd9, 0xf2994a, 0xf2c94c];

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: shirtColors[seatIndex % shirtColors.length], roughness: 0.72 }),
  );
  body.position.set(-0.02, 1.28, 0);
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.62 }),
  );
  head.position.set(-0.02, 1.52, 0);
  head.castShadow = true;
  group.add(head);

  const armMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.62 });
  [-0.14, 0.14].forEach((z) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), armMaterial);
    arm.position.set(0.08, 1.31, z);
    arm.rotation.z = -0.35;
    arm.castShadow = true;
    group.add(arm);
  });

  group.visible = false;
  return group;
};

const createCarouselCanopy = () => {
  const canopy = new THREE.Group();
  const segmentCount = 16;
  const radius = 2.28;
  const height = 1.0;
  const topY = 3.78;
  const rimY = 2.78;

  for (let i = 0; i < segmentCount; i += 1) {
    const a0 = (i / segmentCount) * Math.PI * 2;
    const a1 = ((i + 1) / segmentCount) * Math.PI * 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0,
          topY,
          0,
          Math.cos(a0) * radius,
          rimY,
          Math.sin(a0) * radius,
          Math.cos(a1) * radius,
          rimY,
          Math.sin(a1) * radius,
        ],
        3,
      ),
    );
    geometry.computeVertexNormals();

    const panel = new THREE.Mesh(geometry, i % 2 === 0 ? carouselCanopyRedMaterial : carouselCanopyCreamMaterial);
    panel.castShadow = true;
    canopy.add(panel);
  }

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.98, 0.055, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.42 }),
  );
  rim.position.y = rimY;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  canopy.add(rim);

  return canopy;
};

const createCarousel = () => {
  const group = new THREE.Group();
  const rotor = new THREE.Group();
  const riderVisuals: THREE.Group[] = [];

  const foundation = new THREE.Group();
  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      const slab = new THREE.Mesh(rideFoundationGeometry, rideFoundationMaterial);
      slab.position.set(x * tileSize, 0.04, z * tileSize);
      slab.receiveShadow = true;
      foundation.add(slab);
    }
  }

  [
    { geometry: rideBoundaryLongGeometry, position: new THREE.Vector3(0, 0.13, -tileSize * 1.5) },
    { geometry: rideBoundaryLongGeometry, position: new THREE.Vector3(0, 0.13, tileSize * 1.5) },
    { geometry: rideBoundaryShortGeometry, position: new THREE.Vector3(-tileSize * 1.5, 0.13, 0) },
    { geometry: rideBoundaryShortGeometry, position: new THREE.Vector3(tileSize * 1.5, 0.13, 0) },
  ].forEach(({ geometry, position }) => {
    const boundary = new THREE.Mesh(geometry, rideBoundaryMaterial);
    boundary.position.copy(position);
    boundary.castShadow = true;
    boundary.receiveShadow = true;
    foundation.add(boundary);
  });
  group.add(foundation);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.35, 0.36, 32),
    new THREE.MeshStandardMaterial({ color: 0x4f6f8f, roughness: 0.62 }),
  );
  base.position.y = 0.22;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.05, 2.05, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0xf4d35e, roughness: 0.52 }),
  );
  platform.position.y = 0.48;
  platform.castShadow = true;
  rotor.add(platform);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 2.7, 16),
    new THREE.MeshStandardMaterial({ color: 0x30475e, roughness: 0.4, metalness: 0.1 }),
  );
  mast.position.y = 1.82;
  mast.castShadow = true;
  rotor.add(mast);

  rotor.add(createCarouselCanopy());

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.35 }),
  );
  cap.position.y = 3.9;
  cap.castShadow = true;
  rotor.add(cap);

  const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), closedMaterial);
  statusLight.position.set(0, 4.28, 0);
  statusLight.castShadow = true;
  group.add(statusLight);

  const horseColors = [0xf8f4e8, 0xbfd7ea, 0xffd6a5, 0xcddc8a];
  for (let i = 0; i < carouselSeatCount; i += 1) {
    const seat = new THREE.Group();
    const horseMount = new THREE.Group();
    const angle = (i / carouselSeatCount) * Math.PI * 2;
    const radius = 1.45;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.3, metalness: 0.3 }),
    );
    pole.position.y = 1.65;
    seat.add(pole);

    const horse = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.28, 0.28),
      new THREE.MeshStandardMaterial({ color: horseColors[i % horseColors.length], roughness: 0.55 }),
    );
    horse.position.y = 1.0;
    horse.castShadow = true;
    horseMount.add(horse);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.2),
      new THREE.MeshStandardMaterial({ color: horseColors[i % horseColors.length], roughness: 0.55 }),
    );
    head.position.set(0.36, 1.1, 0);
    head.castShadow = true;
    horseMount.add(head);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6d4c35, roughness: 0.7 }),
    );
    tail.position.set(-0.38, 1.05, 0);
    tail.rotation.z = -0.35;
    tail.castShadow = true;
    horseMount.add(tail);

    seat.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    seat.rotation.y = -angle + Math.PI / 2;
    horseMount.userData.bobPhase = i * 0.9;
    horseMount.userData.bobBaseY = 0;

    const riderVisual = createCarouselRiderVisual(i);
    horseMount.add(riderVisual);
    riderVisuals.push(riderVisual);

    seat.add(horseMount);
    rotor.add(seat);
  }

  group.add(rotor);
  return { group, rotor, statusLight, riderVisuals };
};

const addCarousel = (coord: GridCoord, silent = false) => {
  if (!canPlaceCarousel(coord)) return false;

  const id = `carousel-${rideSerial}`;
  rideSerial += 1;
  const { group, rotor, statusLight, riderVisuals } = createCarousel();
  group.position.copy(worldPos(coord.x, coord.z, 0.03));
  buildGroup.add(group);

  const footprint = footprintFor('carousel', coord).map(({ x, z }) => keyOf(x, z));
  footprint.forEach((key) => occupied.set(key, id));
  rides.set(id, {
    id,
    group,
    rotor,
    riderVisuals,
    occupiedSeatIndexes: new Set(),
    footprint,
    center: coord,
    isOpen: false,
    musicEnabled: true,
    musicPreset: 'fairgroundOrgan',
    statusLight,
    riders: 0,
    phase: 'idle',
    phaseTimer: 0,
  });

  selectedRideId = id;
  updateSelectedRidePanel();
  if (!silent) {
    setTool('entrance');
    setStatus(t('status.carouselInstalled'));
  }
  refreshStats();
  return true;
};

const removeAt = (coord: GridCoord, allowedTarget?: BulldozeTarget) => {
  const target = bulldozeTargetAt(coord);
  if (allowedTarget && target !== allowedTarget) return null;

  const key = keyOf(coord.x, coord.z);
  const path = paths.get(key);
  if (path) {
    buildGroup.remove(path);
    path.geometry.dispose();
    paths.delete(key);
    queuePaths.forEach((queuePath) => {
      if (queuePath.entryPathKey === key) queuePath.entryPathKey = undefined;
    });
    refreshQueueVisualsAround(coord);
    resetInvalidGuests();
    refreshStats();
    updateSelectedRidePanel();
    setStatus(t('status.pathRemoved', { key }));
    return 'path';
  }

  const queuePath = queuePaths.get(key);
  if (queuePath) {
    buildGroup.remove(queuePath.group);
    queuePaths.delete(key);
    if (lastQueueBuildKey === key) lastQueueBuildKey = null;
    queuePaths.forEach((candidate) => {
      if (candidate.nextKey === key) candidate.nextKey = undefined;
    });
    refreshQueueVisualsAround(coord);
    resetInvalidGuests();
    refreshStats();
    updateSelectedRidePanel();
    setStatus(t('status.queueRemoved', { key }));
    return 'queue';
  }

  const entrance = entrances.get(key);
  if (entrance) {
    const ride = rides.get(entrance.rideId);
    if (ride?.entranceKey === key) ride.entranceKey = undefined;
    queuePaths.forEach((queuePath) => {
      if (queuePath.nextKey === key) queuePath.nextKey = undefined;
    });
    buildGroup.remove(entrance.mesh);
    entrances.delete(key);
    refreshQueueVisualsAround(coord);
    resetInvalidGuests();
    updateSelectedRidePanel();
    setStatus(t('status.entranceRemoved'));
    return 'entrance';
  }

  const exit = exits.get(key);
  if (exit) {
    const ride = rides.get(exit.rideId);
    if (ride?.exitKey === key) ride.exitKey = undefined;
    buildGroup.remove(exit.mesh);
    exits.delete(key);
    updateSelectedRidePanel();
    setStatus(t('status.exitRemoved'));
    return 'exit';
  }

  const tree = trees.get(key);
  if (tree) {
    buildGroup.remove(tree);
    trees.delete(key);
    setStatus(t('status.treeRemoved', { key }));
    return 'tree';
  }

  const rideId = occupied.get(key);
  if (rideId) {
    const ride = rides.get(rideId);
    if (!ride) return null;
    stopRideMusic(ride);
    buildGroup.remove(ride.group);
    if (ride.entranceKey) {
      const entrance = entrances.get(ride.entranceKey);
      if (entrance) buildGroup.remove(entrance.mesh);
      queuePaths.forEach((queuePath) => {
        if (queuePath.nextKey === ride.entranceKey) queuePath.nextKey = undefined;
      });
      entrances.delete(ride.entranceKey);
    }
    if (ride.exitKey) {
      const exit = exits.get(ride.exitKey);
      if (exit) buildGroup.remove(exit.mesh);
      exits.delete(ride.exitKey);
    }
    ride.footprint.forEach((cellKey) => occupied.delete(cellKey));
    rides.delete(rideId);
    if (selectedRideId === rideId) selectedRideId = null;
    refreshStats();
    updateSelectedRidePanel();
    setStatus(t('status.rideRemoved'));
    return 'ride';
  }

  setStatus(t('status.nothingToRemove'));
  return null;
};

const neighborsOf = (key: string) => {
  const { x, z } = parseKey(key);
  return [
    keyOf(x + 1, z),
    keyOf(x - 1, z),
    keyOf(x, z + 1),
    keyOf(x, z - 1),
  ].filter((nextKey) => isWalkway(nextKey));
};

const queueNeighborsOf = (key: string) => {
  const { x, z } = parseKey(key);
  return [
    keyOf(x + 1, z),
    keyOf(x - 1, z),
    keyOf(x, z + 1),
    keyOf(x, z - 1),
  ].filter((nextKey) => queuePaths.has(nextKey) && queueForwardKey(nextKey) === key);
};

const randomPathKey = () => {
  const keys = [...paths.keys()];
  return keys[Math.floor(Math.random() * keys.length)] ?? '0,0';
};

const nearestPathKeyFromPosition = (position: THREE.Vector3) => {
  let nearestKey: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  paths.forEach((_path, key) => {
    const coord = parseKey(key);
    const dx = coord.x * tileSize - position.x;
    const dz = coord.z * tileSize - position.z;
    const distance = dx * dx + dz * dz;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestKey = key;
    }
  });
  return nearestKey;
};

const chooseNextPath = (from: string, previous?: string) => {
  const options = neighborsOf(from);
  if (options.length === 0) return randomPathKey();
  const forwardOptions = options.filter((option) => option !== previous);
  const pool = forwardOptions.length > 0 ? forwardOptions : options;
  return pool[Math.floor(Math.random() * pool.length)];
};

const exitPathForRide = (ride: Ride) => {
  if (!ride.exitKey) return randomPathKey();
  return adjacentKeys(parseKey(ride.exitKey)).find((key) => paths.has(key)) ?? randomPathKey();
};

const exitStartPositionForRide = (ride: Ride) => {
  if (!ride.exitKey) return worldPos(ride.center.x, ride.center.z, 0.12);

  const exitCoord = parseKey(ride.exitKey);
  const direction = directionToRide(exitCoord, ride);
  const start = worldPos(exitCoord.x, exitCoord.z, 0.12);
  start.x += direction.x * tileSize * 0.62;
  start.z += direction.y * tileSize * 0.62;
  return start;
};

const queueKeysForRide = (ride: Ride) => {
  if (!ride.entranceKey) return [];

  const visited = new Set<string>();
  const queue: Array<{ key: string; depth: number }> = adjacentKeys(parseKey(ride.entranceKey))
    .filter((key) => queuePaths.has(key) && queueForwardKey(key) === ride.entranceKey)
    .map((key) => ({ key, depth: 0 }));
  const result: Array<{ key: string; depth: number }> = [];

  queue.forEach(({ key }) => visited.add(key));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    result.push(current);
    queueNeighborsOf(current.key)
      .filter((key) => queuePaths.has(key) && !visited.has(key))
      .forEach((key) => {
        visited.add(key);
        queue.push({ key, depth: current.depth + 1 });
      });
  }

  return result.sort((a, b) => a.depth - b.depth).map(({ key }) => key);
};

const queueKeysFromTailToFront = (ride: Ride) => [...queueKeysForRide(ride)].reverse();

const queueTailKeysForRide = (ride: Ride) => {
  const queueKeys = queueKeysForRide(ride);
  const tails = queueKeys.filter((key) => !queueKeys.some((candidate) => queueForwardKey(candidate) === key));
  return tails.reverse();
};

const queueOccupantsAt = (key: string) =>
  guests.filter((guest) => (guest.state === 'queueing' || guest.state === 'waiting') && guest.queueKey === key);

const queueSlotForRide = (ride: Ride) => {
  for (const key of queueKeysForRide(ride)) {
    const usedSlots = new Set(queueOccupantsAt(key).map((guest) => guest.queueSlotIndex));
    for (const slotIndex of queueSlotIndexes) {
      if (!usedSlots.has(slotIndex)) return { key, slotIndex };
    }
  }
  return null;
};

const queueSlotsForRide = (ride: Ride) =>
  queueKeysForRide(ride).flatMap((key) =>
    queueSlotIndexes.map((slotIndex) => ({
      key,
      slotIndex,
    })),
  );

const randomFrom = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const syncCarouselRiderVisuals = (ride: Ride) => {
  const targetCount = clamp(Math.round(ride.riders), 0, ride.riderVisuals.length);

  if (targetCount === ride.riderVisuals.length) {
    ride.riderVisuals.forEach((visual, index) => {
      ride.occupiedSeatIndexes.add(index);
      visual.visible = true;
    });
    return;
  }

  while (ride.occupiedSeatIndexes.size > targetCount) {
    const occupied = [...ride.occupiedSeatIndexes];
    const index = randomFrom(occupied);
    ride.occupiedSeatIndexes.delete(index);
  }

  while (ride.occupiedSeatIndexes.size < targetCount) {
    const available = ride.riderVisuals.map((_, index) => index).filter((index) => !ride.occupiedSeatIndexes.has(index));
    const index = randomFrom(available);
    ride.occupiedSeatIndexes.add(index);
  }

  ride.riderVisuals.forEach((visual, index) => {
    visual.visible = ride.occupiedSeatIndexes.has(index);
  });
};

const finishRide = (guest: Guest) => {
  const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
  if (ride) {
    ride.riders = Math.max(0, ride.riders - 1);
    syncCarouselRiderVisuals(ride);
    updateSelectedRidePanel();
  }

  const exitPathKey = ride ? exitPathForRide(ride) : randomPathKey();
  const exitStartKey = ride?.exitKey ?? exitPathKey;
  const exitStart = ride ? exitStartPositionForRide(ride) : undefined;
  guest.state = ride ? 'exiting' : 'walking';
  guest.rideId = ride?.id;
  guest.queueKey = undefined;
  guest.queueSlotIndex = undefined;
  guest.queueRoute = undefined;
  guest.queueRouteIndex = undefined;
  guest.queueMoveStart = exitStart;
  guest.boardingTarget = undefined;
  guest.rideTime = 0;
  guest.from = exitStartKey;
  guest.to = exitPathKey;
  guest.progress = 0;
  guest.pause = 0.35 + Math.random() * 0.8;
  guest.mesh.visible = true;
  if (exitStart) {
    guest.mesh.position.copy(exitStart);
  } else {
    placeGuestAt(guest, exitPathKey);
  }
};

const completeBoardingGuest = (guest: Guest, ride: Ride) => {
  ride.riders += 1;
  syncCarouselRiderVisuals(ride);
  guest.state = 'riding';
  guest.rideId = ride.id;
  guest.queueKey = undefined;
  guest.queueSlotIndex = undefined;
  guest.queueRoute = undefined;
  guest.queueRouteIndex = undefined;
  guest.queueMoveStart = undefined;
  guest.boardingTarget = undefined;
  guest.rideTime = 0;
  guest.progress = 0;
  guest.pause = 0;
  guest.mesh.visible = false;
  updateSelectedRidePanel();
  debug(t('debug.boarded', { ride: rideLabel(ride), riders: ride.riders, capacity: carouselSeatCount }));
};

const boardingTargetForRide = (ride: Ride) => {
  if (!ride.entranceKey) return worldPos(ride.center.x, ride.center.z, 0.12);

  const entranceCoord = parseKey(ride.entranceKey);
  const direction = directionToRide(entranceCoord, ride);
  const target = worldPos(entranceCoord.x, entranceCoord.z, 0.12);
  target.x += direction.x * tileSize * 0.62;
  target.z += direction.y * tileSize * 0.62;
  return target;
};

const startBoardingGuest = (guest: Guest, ride: Ride) => {
  guest.state = 'boarding';
  guest.rideId = ride.id;
  guest.queueKey = undefined;
  guest.queueSlotIndex = undefined;
  guest.queueRoute = undefined;
  guest.queueRouteIndex = undefined;
  guest.queueMoveStart = guest.mesh.position.clone();
  guest.boardingTarget = boardingTargetForRide(ride);
  guest.progress = 0;
  guest.pause = 0;
  guest.mesh.visible = true;
  guest.money = Math.max(0, guest.money - 2.5);
  guest.happiness = clamp(guest.happiness + 4, 0, 100);
  debug(t('debug.boarding', { ride: rideLabel(ride) }));
};

const tryBoardRide = (guest: Guest, key: string) => {
  if (!queuePaths.has(key)) return false;

  const entrance = adjacentKeys(parseKey(key))
    .map((neighborKey) => entrances.get(neighborKey))
    .find((candidate) => {
      if (!candidate) return false;
      const ride = rides.get(candidate.rideId);
      return Boolean(ride && rideConnectionStatus(ride).ready && ride.riders < carouselSeatCount);
    });

  if (!entrance) return false;

  const ride = rides.get(entrance.rideId);
  if (!ride) return false;

  if (guest.state === 'waiting') {
    return true;
  }

  const queueSlot = queueSlotForRide(ride);
  if (!queueSlot) {
    debug(t('debug.queueFullLeft', { ride: rideLabel(ride) }));
    guest.pause = 0.6;
    guest.to = chooseNextPath(key);
    return false;
  }

  guest.from = queueSlot.key;
  guest.to = queueSlot.key;
  guest.queueKey = queueSlot.key;
  guest.queueSlotIndex = queueSlot.slotIndex;
  placeGuestInQueueSlot(guest, ride, queueSlot.key, queueSlot.slotIndex);

  guest.state = 'waiting';
  guest.rideId = ride.id;
  guest.progress = 0;
  guest.pause = 0;
  guest.mesh.visible = true;
  placeGuestInQueueSlot(guest, ride, queueSlot.key, queueSlot.slotIndex);
  updateSelectedRidePanel();
  debug(t('debug.waiting', { ride: rideLabel(ride) }));
  return true;
};

const queueRouteToSlot = (ride: Ride, tailKey: string, targetKey: string) => {
  const route = queueKeysFromTailToFront(ride);
  const startIndex = route.indexOf(tailKey);
  const targetIndex = route.indexOf(targetKey);
  if (startIndex === -1 || targetIndex === -1 || startIndex > targetIndex) return [targetKey];
  return route.slice(startIndex, targetIndex + 1);
};

const queueRouteStartKey = (guest: Guest, fallbackKey: string) => {
  if (guest.state === 'queueing' && queuePaths.has(guest.to)) return guest.to;
  if (guest.state === 'queueing' && queuePaths.has(guest.from)) return guest.from;
  if (guest.queueKey && queuePaths.has(guest.queueKey)) return guest.queueKey;
  return fallbackKey;
};

const sendGuestToQueueSlot = (guest: Guest, ride: Ride, key: string, slotIndex: number, startKey = queueRouteStartKey(guest, key)) => {
  const route = queueRouteToSlot(ride, startKey, key);
  guest.state = 'queueing';
  guest.rideId = ride.id;
  guest.from = startKey;
  guest.to = route[0];
  guest.queueKey = key;
  guest.queueSlotIndex = slotIndex;
  guest.queueRoute = route;
  guest.queueRouteIndex = 0;
  guest.queueMoveStart = guest.mesh.position.clone();
  guest.progress = 0;
  guest.pause = 0;
};

const compactQueueForRide = (ride: Ride) => {
  const order = queueKeysForRide(ride);
  const activeQueueGuests = guests
    .filter(
      (guest) =>
        (guest.state === 'queueing' || guest.state === 'waiting') &&
        guest.rideId === ride.id &&
        guest.queueKey &&
        guest.queueSlotIndex !== undefined,
    )
    .sort((a, b) => {
      const aIndex = a.queueKey ? order.indexOf(a.queueKey) : Number.MAX_SAFE_INTEGER;
      const bIndex = b.queueKey ? order.indexOf(b.queueKey) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || (a.queueSlotIndex ?? 0) - (b.queueSlotIndex ?? 0);
    });

  activeQueueGuests.forEach((guest, index) => {
    const slot = queueSlotsForRide(ride)[index];
    if (!slot || (guest.queueKey === slot.key && guest.queueSlotIndex === slot.slotIndex)) return;
    sendGuestToQueueSlot(guest, ride, slot.key, slot.slotIndex);
    debug(t('debug.queueMoved', { ride: rideLabel(ride) }));
  });
};

const waitingGuestsForRide = (ride: Ride) =>
  guests
    .filter((guest) => guest.state === 'waiting' && guest.rideId === ride.id && ride.riders < carouselSeatCount)
    .sort((a, b) => {
      const order = queueKeysForRide(ride);
      const aIndex = a.queueKey ? order.indexOf(a.queueKey) : Number.MAX_SAFE_INTEGER;
      const bIndex = b.queueKey ? order.indexOf(b.queueKey) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || (a.queueSlotIndex ?? 0) - (b.queueSlotIndex ?? 0);
    });

const boardingGuestsForRide = (ride: Ride) => guests.filter((guest) => guest.state === 'boarding' && guest.rideId === ride.id);

const exitingGuestsForRide = (ride: Ride) => guests.filter((guest) => guest.state === 'exiting' && guest.rideId === ride.id);

const rideForQueueKey = (queueKey: string) =>
  Array.from(rides.values()).find((ride) => rideConnectionStatus(ride).ready && queueKeysForRide(ride).includes(queueKey));

const tryEnterQueueFromPath = (guest: Guest, pathKey: string) => {
  if (!paths.has(pathKey)) return false;

  const queueKey = adjacentKeys(parseKey(pathKey)).find((candidate) => {
    const ride = rideForQueueKey(candidate);
    return Boolean(ride && queueTailKeysForRide(ride).includes(candidate) && queueEntryPathKeys(candidate).includes(pathKey));
  });
  if (!queueKey) return false;

  const ride = rideForQueueKey(queueKey);
  if (!ride) return false;

  const queueSlot = queueSlotForRide(ride);
  if (!queueSlot) {
    debug(t('debug.queueFullWalking', { ride: rideLabel(ride) }));
    guest.pause = 0.6;
    guest.to = chooseNextPath(pathKey);
    return false;
  }

  const queueRoute = queueRouteToSlot(ride, queueKey, queueSlot.key);
  sendGuestToQueueSlot(guest, ride, queueSlot.key, queueSlot.slotIndex, queueKey);
  guest.from = pathKey;
  guest.to = queueRoute[0];
  guest.queueRoute = queueRoute;
  updateSelectedRidePanel();
  compactQueueForRide(ride);
  debug(t('debug.walkingIntoQueue', { ride: rideLabel(ride) }));
  return true;
};

const rotateCarousel = (ride: Ride, delta: number) => {
  ride.rotor.rotation.y += delta * 1.05;
  ride.rotor.traverse((child) => {
    const phase = child.userData.bobPhase as number | undefined;
    if (phase === undefined) return;

    const baseY = (child.userData.bobBaseY as number | undefined) ?? 0;
    const bob = Math.sin(performance.now() * 0.0045 + phase);
    child.position.y = baseY + bob * 0.18;
    child.rotation.z = bob * 0.035;
  });
};

const settleCarouselHorses = (ride: Ride, delta: number) => {
  const settleRate = Math.min(1, delta * 4);
  ride.rotor.traverse((child) => {
    const phase = child.userData.bobPhase as number | undefined;
    if (phase === undefined) return;

    const baseY = (child.userData.bobBaseY as number | undefined) ?? 0;
    child.position.y += (baseY - child.position.y) * settleRate;
    child.rotation.z += (0 - child.rotation.z) * settleRate;
  });
};

const animateGate = (gate: RideGate | undefined, isOpen: boolean, delta: number) => {
  if (!gate) return;

  const target = isOpen ? 1 : 0;
  const step = delta * 5;
  gate.openAmount += clamp(target - gate.openAmount, -step, step);
  gate.bar.rotation.y = -gate.openAmount * (Math.PI / 2);
};

const updateGateAnimations = (delta: number) => {
  rides.forEach((ride) => {
    const entrance = ride.entranceKey ? entrances.get(ride.entranceKey) : undefined;
    const exit = ride.exitKey ? exits.get(ride.exitKey) : undefined;
    animateGate(entrance, boardingGuestsForRide(ride).length > 0, delta);
    animateGate(exit, ride.phase === 'unloading' || exitingGuestsForRide(ride).length > 0, delta);
  });
};

const setRidePhase = (ride: Ride, phase: RidePhase, timer: number) => {
  if (ride.phase !== phase) debug(t('debug.phase', { ride: rideLabel(ride), phase: phaseLabel(phase).toUpperCase() }));
  ride.phase = phase;
  ride.phaseTimer = timer;
  updateSelectedRidePanel();
};

const updateRideSystems = (delta: number) => {
  rides.forEach((ride) => {
    if (ride.phase !== 'running') settleCarouselHorses(ride, delta);

    const ready = rideConnectionStatus(ride).ready;
    if (!ready) {
      if (ride.phase !== 'idle') setRidePhase(ride, 'idle', 0);
      updateRideVisual(ride);
      return;
    }

    if (ride.phase === 'idle') {
      setRidePhase(ride, 'loading', 5);
      return;
    }

    if (ride.phase === 'loading') {
      const remainingSeats = carouselSeatCount - ride.riders - boardingGuestsForRide(ride).length;
      const boardedGuests = waitingGuestsForRide(ride).slice(0, remainingSeats);
      boardedGuests.forEach((guest) => startBoardingGuest(guest, ride));
      if (boardedGuests.length > 0) compactQueueForRide(ride);
      ride.phaseTimer -= delta;
      if (ride.phaseTimer <= 0) {
        if (boardingGuestsForRide(ride).length > 0) {
          ride.phaseTimer = 0.35;
        } else if (ride.riders > 0) {
          setRidePhase(ride, 'running', 8);
        } else {
          setRidePhase(ride, 'loading', 3);
        }
      }
      return;
    }

    if (ride.phase === 'running') {
      rotateCarousel(ride, delta);
      ride.phaseTimer -= delta;
      if (ride.phaseTimer <= 0) setRidePhase(ride, 'unloading', 2);
      return;
    }

    ride.phaseTimer -= delta;
    if (ride.phaseTimer <= 0) {
      guests
        .filter((guest) => guest.state === 'riding' && guest.rideId === ride.id)
        .forEach((guest) => finishRide(guest));
      setRidePhase(ride, 'idle', 0);
      debug(t('debug.unloaded', { ride: rideLabel(ride) }));
    }
  });
};

const createGuestMesh = (id: number) => {
  const group = new THREE.Group();
  group.userData.guestId = id;
  const shirtColors = [0x2d9cdb, 0xeb5757, 0x27ae60, 0xbb6bd9, 0xf2994a];
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.17, 0.48, 10),
    new THREE.MeshStandardMaterial({ color: shirtColors[Math.floor(Math.random() * shirtColors.length)], roughness: 0.72 }),
  );
  body.userData.guestId = id;
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.6 }),
  );
  head.userData.guestId = id;
  head.position.y = 0.72;
  head.castShadow = true;
  group.add(head);
  return group;
};

const createAudioZoneLabel = (zone: AudioTestZone) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.fillStyle = 'rgba(20, 24, 32, 0.78)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = '#ffffff';
  context.font = '700 48px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(language === 'ko' ? zone.labelKo : zone.labelEn, canvas.width / 2, 72);
  context.font = '500 30px sans-serif';
  context.fillText(`density +${zone.amount.toFixed(1)}`, canvas.width / 2, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.8, 1.42, 1);
  sprite.position.copy(worldPos(zone.center.x, zone.center.z, 2.1));
  return sprite;
};

const createAudioZoneDummyGuest = (color: number) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.42, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
  );
  body.position.y = 0.31;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.62 }),
  );
  head.position.y = 0.66;
  head.castShadow = true;
  group.add(head);
  return group;
};

const createAudioTestZones = () => {
  const padGeometry = new THREE.BoxGeometry(tileSize * 3.2, 0.06, tileSize * 3.2);

  audioTestZones.forEach((zone) => {
    const zoneGroup = new THREE.Group();
    const pad = new THREE.Mesh(
      padGeometry,
      new THREE.MeshStandardMaterial({
        color: zone.color,
        roughness: 0.62,
        transparent: true,
        opacity: 0.48,
        emissive: zone.color,
        emissiveIntensity: 0.08,
      }),
    );
    pad.position.copy(worldPos(zone.center.x, zone.center.z, 0.08));
    pad.receiveShadow = true;
    zoneGroup.add(pad);

    const label = createAudioZoneLabel(zone);
    if (label) zoneGroup.add(label);

    for (let index = 0; index < zone.dummyGuests; index += 1) {
      const angle = (index / zone.dummyGuests) * Math.PI * 2;
      const ring = Math.floor(index / 6);
      const radius = tileSize * (0.42 + ring * 0.28);
      const guest = createAudioZoneDummyGuest(zone.color);
      guest.position.copy(worldPos(zone.center.x, zone.center.z, 0.12));
      guest.position.x += Math.cos(angle) * radius;
      guest.position.z += Math.sin(angle) * radius;
      guest.rotation.y = -angle + Math.PI / 2;
      zoneGroup.add(guest);
    }

    audioTestZoneGroup.add(zoneGroup);
  });
};

const placeGuestAt = (guest: Guest, key: string) => {
  const { x, z } = parseKey(key);
  guest.mesh.position.copy(worldPos(x, z, 0.12));
};

const queueSlotPosition = (ride: Ride, key: string, slotIndex: number) => {
  const { x, z } = parseKey(key);
  const position = worldPos(x, z, 0.12);
  const slotSpacing = tileSize / queueTileCapacity;
  const frontOffset = tileSize / 2 - slotSpacing / 2;
  const offset = frontOffset - slotIndex * slotSpacing;
  const queueOrder = queueKeysForRide(ride);
  const index = queueOrder.indexOf(key);
  const frontKey = index > 0 ? queueOrder[index - 1] : ride.entranceKey;
  const front = frontKey ? parseKey(frontKey) : { x, z: z + 1 };
  const direction = new THREE.Vector2(front.x - x, front.z - z);
  const lineDirection = direction.lengthSq() > 0 ? direction.normalize() : new THREE.Vector2(0, 1);
  position.x += lineDirection.x * offset;
  position.z += lineDirection.y * offset;
  return position;
};

const placeGuestInQueueSlot = (guest: Guest, ride: Ride, key: string, slotIndex: number) => {
  guest.mesh.position.copy(queueSlotPosition(ride, key, slotIndex));
};

const clearGuestQueueState = (guest: Guest) => {
  guest.rideId = undefined;
  guest.queueKey = undefined;
  guest.queueSlotIndex = undefined;
  guest.queueRoute = undefined;
  guest.queueRouteIndex = undefined;
  guest.boardingTarget = undefined;
  guest.rideTime = 0;
};

const randomWanderTargetFrom = (position: THREE.Vector3) => {
  const angle = Math.random() * Math.PI * 2;
  const distance = tileSize * (0.35 + Math.random() * 0.45);
  return new THREE.Vector3(position.x + Math.cos(angle) * distance, 0.12, position.z + Math.sin(angle) * distance);
};

const sendGuestSeekingPath = (guest: Guest) => {
  clearGuestQueueState(guest);
  guest.state = 'seeking';
  guest.from = nearestPathKeyFromPosition(guest.mesh.position) ?? guest.from;
  guest.to = guest.from;
  guest.progress = 0;
  guest.pause = 0;
  guest.seekTimer = 0.7 + Math.random() * 1.2;
  guest.queueMoveStart = guest.mesh.position.clone();
  guest.wanderTarget = randomWanderTargetFrom(guest.mesh.position);
  guest.mesh.visible = true;
};

const spawnGuest = (startKey?: string) => {
  const from = startKey ?? randomPathKey();
  const to = chooseNextPath(from);
  const id = ++guestSerial;
  const mesh = createGuestMesh(id);
  const guest: Guest = {
    id,
    mesh,
    from,
    to,
    progress: startKey ? 0 : Math.random(),
    speed: 0.35 + Math.random() * 0.28,
    pause: startKey ? 0 : Math.random() * 0.8,
    state: 'walking',
    money: 32 + Math.random() * 68,
    hunger: 8 + Math.random() * 22,
    tiredness: 4 + Math.random() * 18,
    happiness: 66 + Math.random() * 26,
    nausea: Math.random() * 8,
    rideTime: 0,
  };
  placeGuestAt(guest, from);
  guestGroup.add(mesh);
  guests.push(guest);
};

const resetInvalidGuests = () => {
  guests.forEach((guest) => {
    if (guest.state === 'boarding' || guest.state === 'riding') return;
    if (guest.state === 'seeking') return;
    if ((guest.state === 'queueing' || guest.state === 'waiting') && guest.queueKey && queuePaths.has(guest.queueKey)) return;
    if (!isWalkway(guest.from) || !isWalkway(guest.to)) {
      sendGuestSeekingPath(guest);
    }
  });
};

const updateGuestNeeds = (guest: Guest, delta: number) => {
  const queueStress = guest.state === 'queueing' || guest.state === 'waiting' ? 1.35 : 1;
  const seekingStress = guest.state === 'seeking' ? 1.8 : 1;
  guest.hunger = clamp(guest.hunger + delta * 0.32, 0, 100);
  guest.tiredness = clamp(guest.tiredness + delta * 0.24 * queueStress * seekingStress, 0, 100);
  guest.nausea = clamp(guest.nausea - delta * 0.5, 0, 100);

  if (guest.state === 'riding') {
    guest.happiness = clamp(guest.happiness + delta * 1.2, 0, 100);
    guest.nausea = clamp(guest.nausea + delta * 1.6, 0, 100);
  } else if (guest.state === 'seeking') {
    guest.happiness = clamp(guest.happiness - delta * 1.4, 0, 100);
  } else {
    const comfortPenalty = Math.max(0, guest.hunger - 58) * 0.016 + Math.max(0, guest.tiredness - 64) * 0.014 + guest.nausea * 0.004;
    guest.happiness = clamp(guest.happiness - delta * comfortPenalty, 0, 100);
  }
};

const updateGuests = (delta: number) => {
  guests.forEach((guest) => {
    updateGuestNeeds(guest, delta);

    if (guest.state === 'boarding') {
      const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
      if (!ride || !guest.queueMoveStart || !guest.boardingTarget) {
        sendGuestSeekingPath(guest);
        return;
      }

      const boardingDistance = guest.queueMoveStart.distanceTo(guest.boardingTarget);
      const walkingSpeed = guest.speed * tileSize;
      guest.progress += (delta * walkingSpeed) / Math.max(boardingDistance, 0.001);
      guest.mesh.position.lerpVectors(guest.queueMoveStart, guest.boardingTarget, Math.min(guest.progress, 1));
      guest.mesh.rotation.y = Math.atan2(guest.boardingTarget.x - guest.queueMoveStart.x, guest.boardingTarget.z - guest.queueMoveStart.z);
      if (guest.progress >= 1) completeBoardingGuest(guest, ride);
      return;
    }

    if (guest.state === 'riding') {
      if (!guest.rideId || !rides.has(guest.rideId)) finishRide(guest);
      return;
    }

    if (guest.state === 'queueing') {
      const route = guest.queueRoute;
      if (!guest.rideId || !guest.queueKey || guest.queueSlotIndex === undefined || !route || route.length === 0) {
        sendGuestSeekingPath(guest);
        return;
      }

      guest.progress += delta * guest.speed;
      const ride = rides.get(guest.rideId);
      if (!ride) return;
      const from = parseKey(guest.from);
      const fromPos =
        guest.queueMoveStart ??
        (queuePaths.has(guest.from) ? queueSlotPosition(ride, guest.from, guest.queueSlotIndex) : worldPos(from.x, from.z, 0.12));
      const toPos = queuePaths.has(guest.to)
        ? queueSlotPosition(ride, guest.to, guest.queueSlotIndex)
        : worldPos(parseKey(guest.to).x, parseKey(guest.to).z, 0.12);
      guest.mesh.position.lerpVectors(fromPos, toPos, Math.min(guest.progress, 1));
      guest.mesh.rotation.y = Math.atan2(toPos.x - fromPos.x, toPos.z - fromPos.z);

      if (guest.progress < 1) return;

      const routeIndex = guest.queueRouteIndex ?? 0;
      if (routeIndex < route.length - 1) {
        guest.from = guest.to;
        guest.queueRouteIndex = routeIndex + 1;
        guest.to = route[guest.queueRouteIndex];
        guest.queueMoveStart = undefined;
        guest.progress = 0;
        return;
      }

      guest.state = 'waiting';
      guest.from = guest.queueKey;
      guest.to = guest.queueKey;
      guest.progress = 0;
      guest.queueRoute = undefined;
      guest.queueRouteIndex = undefined;
      guest.queueMoveStart = undefined;
      guest.boardingTarget = undefined;
      placeGuestInQueueSlot(guest, ride, guest.queueKey, guest.queueSlotIndex);
      debug(t('debug.reachedQueueSlot', { ride: rideLabel(guest.rideId) }));
      return;
    }

    if (guest.state === 'waiting') {
      const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
      if (ride && rideConnectionStatus(ride).ready && guest.queueKey && queuePaths.has(guest.queueKey)) return;

      sendGuestSeekingPath(guest);
      return;
    }

    if (guest.state === 'seeking') {
      if (!guest.queueMoveStart || !guest.wanderTarget) {
        guest.queueMoveStart = guest.mesh.position.clone();
        guest.wanderTarget = randomWanderTargetFrom(guest.mesh.position);
        guest.progress = 0;
      }

      const seekDistance = guest.queueMoveStart.distanceTo(guest.wanderTarget);
      const seekSpeed = guest.speed * tileSize * 0.72;
      guest.progress += (delta * seekSpeed) / Math.max(seekDistance, 0.001);
      guest.mesh.position.lerpVectors(guest.queueMoveStart, guest.wanderTarget, Math.min(guest.progress, 1));
      guest.mesh.rotation.y = Math.atan2(guest.wanderTarget.x - guest.queueMoveStart.x, guest.wanderTarget.z - guest.queueMoveStart.z);

      if (guest.progress < 1) return;

      const nearestPathKey = nearestPathKeyFromPosition(guest.mesh.position);
      if ((guest.seekTimer ?? 0) <= 0 && nearestPathKey) {
        guest.state = 'walking';
        guest.from = nearestPathKey;
        guest.to = chooseNextPath(nearestPathKey);
        guest.progress = 0;
        guest.pause = 0;
        guest.queueMoveStart = undefined;
        guest.wanderTarget = undefined;
        guest.seekTimer = undefined;
        placeGuestAt(guest, nearestPathKey);
        return;
      }

      guest.seekTimer = Math.max(0, (guest.seekTimer ?? 0) - 0.45);
      guest.queueMoveStart = guest.mesh.position.clone();
      guest.wanderTarget = (guest.seekTimer ?? 0) <= 0 && nearestPathKey ? worldPos(parseKey(nearestPathKey).x, parseKey(nearestPathKey).z, 0.12) : randomWanderTargetFrom(guest.mesh.position);
      guest.progress = 0;
      return;
    }

    if (guest.pause > 0) {
      guest.pause -= delta;
      return;
    }

    if (tryEnterQueueFromPath(guest, guest.from)) return;

    guest.progress += delta * guest.speed;
    const from = parseKey(guest.from);
    const to = parseKey(guest.to);
    const fromPos = guest.queueMoveStart ?? worldPos(from.x, from.z, 0.12);
    const toPos = worldPos(to.x, to.z, 0.12);
    guest.mesh.position.lerpVectors(fromPos, toPos, Math.min(guest.progress, 1));
    guest.mesh.rotation.y = Math.atan2(toPos.x - fromPos.x, toPos.z - fromPos.z);

    if (guest.progress >= 1) {
      const previous = guest.from;
      guest.from = guest.to;
      guest.queueMoveStart = undefined;
      placeGuestAt(guest, guest.from);
      if (guest.state === 'exiting') {
        guest.state = 'walking';
        guest.rideId = undefined;
      }
      if (tryEnterQueueFromPath(guest, guest.from)) return;
      guest.to = chooseNextPath(guest.from, previous);
      guest.progress = 0;
      guest.pause = Math.random() > 0.88 ? 0.8 + Math.random() * 1.6 : 0;
    }
  });
};

const seedPark = () => {
  [
    [-8, 2],
    [-7, 2],
    [-6, 2],
    [-5, 2],
    [-4, 2],
    [-3, 2],
    [-2, 2],
    [-1, 2],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 2],
    [-2, 1],
    [-2, 0],
    [-2, -1],
    [7, -5],
    [7, -4],
    [7, -3],
    [7, -2],
    [7, -1],
    [7, 0],
    [7, 1],
  ].forEach(([x, z]) => addPath({ x, z }, true));

  addCarousel({ x: 4, z: -5 }, true);
  addRideGate({ x: 4, z: -3 }, 'entrance', true);
  addRideGate({ x: 6, z: -5 }, 'exit', true);
  addQueuePath({ x: 4, z: -2 }, true);
  addQueuePath({ x: 4, z: -1 }, true);
  addQueuePath({ x: 4, z: 0 }, true);
  addQueuePath({ x: 4, z: 1 }, true);
  connectQueueEntryToPath('4,1', '4,2', true);
  const ride = selectedRide();
  if (ride) ride.isOpen = true;

  [
    [-7, -7],
    [-5, -4],
    [-1, -7],
    [6, -8],
    [8, -2],
    [7, 6],
    [0, 6],
    [-6, 5],
    [-9, 3],
    [6, 2],
  ].forEach(([x, z]) => addTree({ x, z }, true));

  createAudioTestZones();

  for (let i = 0; i < 24; i += 1) spawnGuest();
  for (let i = 0; i < 4; i += 1) spawnGuest('4,2');
  selectedRideId = null;
  refreshStats();
};

const selectRideAt = (coord: GridCoord) => {
  const rideId = rideIdAt(keyOf(coord.x, coord.z));
  selectedRideId = rideId;
  updateSelectedRidePanel();
  updateDebugStatus();

  if (rideId) {
    setStatus(t('status.carouselSelected'));
    return true;
  }

  setStatus(t('status.selectionCleared'));
  return false;
};

const selectGuest = (guest: Guest) => {
  selectedGuestId = guest.id;
  updateSelectedGuestWindow();
  setStatus(t('status.guestSelected', { guest: guestLabel(guest) }));
};

const updatePointerFromEvent = (event: PointerEvent) => {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
};

const guestAtPointer = (event: PointerEvent) => {
  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(guestGroup.children, true)[0];
  const guestId = hit?.object.userData.guestId as number | undefined;
  return guestId === undefined ? undefined : guests.find((guest) => guest.id === guestId);
};

const handlePointerMove = (event: PointerEvent) => {
  if (isMiddleDragging) {
    panCamera(event.clientX - lastDragX, event.clientY - lastDragY);
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    return;
  }

  updatePointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(tiles, false)[0];
  const nextHoveredTile = hit?.object.userData.coord ?? null;
  const previousHoverKey = previousHoveredTile ? keyOf(previousHoveredTile.x, previousHoveredTile.z) : null;
  const nextHoverKey = nextHoveredTile ? keyOf(nextHoveredTile.x, nextHoveredTile.z) : null;
  const hoverChanged = previousHoverKey !== nextHoverKey;
  hoveredTile = nextHoveredTile;
  updatePreview();
  if (hoverChanged) {
    refreshQueueEntryPreviewAround(previousHoveredTile, hoveredTile);
    previousHoveredTile = hoveredTile;
  }
  if (isPathDragging && hoveredTile) {
    const key = keyOf(hoveredTile.x, hoveredTile.z);
    if (key !== lastDraggedBuildKey) {
      buildDraggedPathAt(hoveredTile);
      lastDraggedBuildKey = key;
      updatePreview();
    }
  }
  if (isBulldozeDragging && hoveredTile && bulldozeDragTarget) {
    const key = keyOf(hoveredTile.x, hoveredTile.z);
    if (key !== lastDraggedBulldozeKey) {
      removeAt(hoveredTile, bulldozeDragTarget);
      lastDraggedBulldozeKey = key;
      updatePreview();
    }
  }
};

const handleBuild = (event: PointerEvent) => {
  if (event.button === 1) {
    event.preventDefault();
    isMiddleDragging = true;
    setGuestFollow(false);
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    setStatus(t('status.panCamera'));
    return;
  }

  if (event.button !== 0) return;
  const clickedGuest = activeTool !== 'bulldoze' ? guestAtPointer(event) : undefined;
  if (clickedGuest) {
    if (activeTool !== 'select') setTool('select');
    selectGuest(clickedGuest);
    updatePreview();
    return;
  }

  if (!hoveredTile) return;

  const hoverKey = keyOf(hoveredTile.x, hoveredTile.z);
  const clickedRideId = rideIdAt(hoverKey);
  if (activeTool !== 'bulldoze' && clickedRideId) {
    if (activeTool !== 'select') setTool('select');
    selectRideAt(hoveredTile);
    updatePreview();
    return;
  }

  if (activeTool === 'queue' && paths.has(hoverKey)) {
    if (!connectQueueEntryFromPath(hoverKey)) setStatus(t('status.clickPathBesideQueue'));
    updatePreview();
    return;
  }

  if (activeTool === 'bulldoze') {
    const removedTarget = removeAt(hoveredTile);
    if (removedTarget) {
      isBulldozeDragging = true;
      bulldozeDragTarget = removedTarget;
      lastDraggedBulldozeKey = hoverKey;
      canvas.setPointerCapture(event.pointerId);
    }
    updatePreview();
    return;
  }

  if (activeTool === 'path' || activeTool === 'queue') {
    isPathDragging = true;
    lastDraggedBuildKey = hoverKey;
    canvas.setPointerCapture(event.pointerId);
    buildDraggedPathAt(hoveredTile);
    updatePreview();
    return;
  }

  if (activeTool === 'select') {
    selectRideAt(hoveredTile);
    updatePreview();
    return;
  }

  if (activeTool === 'tree') addTree(hoveredTile);
  if (activeTool === 'carousel') addCarousel(hoveredTile);
  if (activeTool === 'entrance') addRideGate(hoveredTile, 'entrance');
  if (activeTool === 'exit') addRideGate(hoveredTile, 'exit');
  updatePreview();
};

canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerdown', handleBuild);
canvas.addEventListener('pointerup', (event) => {
  if (event.button === 0) resetDragActions();
  if (event.button === 1) isMiddleDragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('auxclick', (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener('pointerleave', () => {
  isMiddleDragging = false;
  resetDragActions();
  refreshQueueEntryPreviewAround(hoveredTile, previousHoveredTile);
  hoveredTile = null;
  previousHoveredTile = null;
  updatePreview();
});

const setSelectedRideOpen = (isOpen: boolean) => {
  const ride = selectedRide();
  if (!ride) return;
  resumeAudioContext();
  ride.isOpen = isOpen;
  updateSelectedRidePanel();
  setStatus(ride.isOpen ? t('status.rideOpened') : t('status.rideClosed'));
};

const setSelectedRideMusic = (enabled: boolean) => {
  const ride = selectedRide();
  if (!ride) return;
  resumeAudioContext();
  ride.musicEnabled = enabled;
  updateSelectedRidePanel();
  setStatus(t(enabled ? 'status.musicOn' : 'status.musicOff', { ride: rideLabel(ride) }));
};

const setSelectedRideMusicPreset = (preset: CarouselMusicPreset) => {
  const ride = selectedRide();
  if (!ride) return;
  resumeAudioContext();
  ride.musicPreset = preset;
  if (ride.music && audioContext) {
    ride.music.audio?.pause();
    ride.music.audio = undefined;
    ride.music.noteIndex = 0;
    ride.music.nextNoteTime = audioContext.currentTime + 0.05;
  }
  updateSelectedRidePanel();
  setStatus(t('status.musicPreset', { ride: rideLabel(ride), preset: musicPresetLabel(preset) }));
};

rideOpenButton.addEventListener('click', () => setSelectedRideOpen(true));
rideCloseButton.addEventListener('click', () => setSelectedRideOpen(false));
rideMusicOnButton.addEventListener('click', () => setSelectedRideMusic(true));
rideMusicOffButton.addEventListener('click', () => setSelectedRideMusic(false));
rideMusicPresetSelect.addEventListener('change', () => {
  const preset = rideMusicPresetSelect.value as CarouselMusicPreset;
  if (!carouselMusicPresets[preset]) return;
  setSelectedRideMusicPreset(preset);
});
window.addEventListener('pointerdown', resumeAudioContext);
window.addEventListener('keydown', resumeAudioContext);
guestFollowButton.addEventListener('click', () => {
  const guest = selectedGuest();
  if (!guest) return;
  setGuestFollow(!followSelectedGuest);
  setStatus(t(followSelectedGuest ? 'status.followOn' : 'status.followOff', { guest: guestLabel(guest) }));
});
guestCloseButton.addEventListener('click', () => {
  selectedGuestId = null;
  setGuestFollow(false);
  updateSelectedGuestWindow();
  setStatus(t('status.guestWindowClosed'));
});

languageSelect.addEventListener('change', () => {
  language = languageSelect.value === 'en' ? 'en' : 'ko';
  applyStaticTranslations();
  updateSelectedRidePanel();
  updateSelectedGuestWindow();
  updateDebugStatus();
  setStatus(t('status.language'));
});

continuousRotationToggle.addEventListener('change', () => {
  continuousRotationEnabled = continuousRotationToggle.checked;
  continuousRotationToggle.blur();
  if (!continuousRotationEnabled) {
    pressedRotationKeys.clear();
    snapCameraToNearestQuarter();
    setStatus(t('status.quarterRotation'));
    return;
  }

  setStatus(t('status.continuousRotation'));
});

const toolStatusLabel = (tool: Tool) => {
  return t(`toolStatus.${tool}`);
};

pauseButton.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? t('pause.resume') : t('pause.pause');
  setStatus(isPaused ? t('status.paused') : toolStatusLabel(activeTool));
});

const setViewport = () => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);

  const aspect = width / Math.max(height, 1);
  const frustum = (width < 720 ? 32 : 42) / cameraZoom;
  camera.left = (-frustum * aspect) / 2;
  camera.right = (frustum * aspect) / 2;
  camera.top = frustum / 2;
  camera.bottom = -frustum / 2;
  camera.updateProjectionMatrix();
};

const updateCameraAngle = () => {
  const distance = 42;
  camera.position.set(
    cameraTarget.x + Math.cos(cameraYaw) * distance,
    cameraTarget.y + 30,
    cameraTarget.z + Math.sin(cameraYaw) * distance,
  );
  camera.lookAt(cameraTarget);
};

const snapCameraToNearestQuarter = () => {
  const nearestQuarter = Math.round((cameraYaw - baseCameraYaw) / quarterYawStep);
  cameraYaw = baseCameraYaw + nearestQuarter * quarterYawStep;
  updateCameraAngle();
};

const panCamera = (screenDeltaX: number, screenDeltaY: number) => {
  const viewDirection = new THREE.Vector3();
  camera.getWorldDirection(viewDirection);
  viewDirection.y = 0;
  viewDirection.normalize();

  const right = new THREE.Vector3().crossVectors(viewDirection, new THREE.Vector3(0, 1, 0)).normalize();
  const dragScale = 0.045 / cameraZoom;
  cameraTarget.addScaledVector(right, -screenDeltaX * dragScale);
  cameraTarget.addScaledVector(viewDirection, screenDeltaY * dragScale);
  cameraTarget.x = clamp(cameraTarget.x, -18, 18);
  cameraTarget.z = clamp(cameraTarget.z, -18, 18);
  updateCameraAngle();
};

const moveCamera = (rightAmount: number, forwardAmount: number) => {
  const viewDirection = new THREE.Vector3();
  camera.getWorldDirection(viewDirection);
  viewDirection.y = 0;
  viewDirection.normalize();

  const right = new THREE.Vector3().crossVectors(viewDirection, new THREE.Vector3(0, 1, 0)).normalize();
  cameraTarget.addScaledVector(right, rightAmount);
  cameraTarget.addScaledVector(viewDirection, forwardAmount);
  cameraTarget.x = clamp(cameraTarget.x, -18, 18);
  cameraTarget.z = clamp(cameraTarget.z, -18, 18);
  updateCameraAngle();
};

const selectedGuestFocusPosition = () => {
  const guest = selectedGuest();
  if (!guest) return null;
  const ride = guest.state === 'riding' && guest.rideId ? rides.get(guest.rideId) : undefined;
  if (ride) return worldPos(ride.center.x, ride.center.z, 0.12);
  return guest.mesh.position;
};

const updateGuestFollowCamera = (delta: number) => {
  if (!followSelectedGuest) return;
  const focus = selectedGuestFocusPosition();
  if (!focus) {
    setGuestFollow(false);
    return;
  }

  const followRate = 1 - Math.exp(-delta * 7);
  cameraTarget.x = clamp(cameraTarget.x + (focus.x - cameraTarget.x) * followRate, -18, 18);
  cameraTarget.z = clamp(cameraTarget.z + (focus.z - cameraTarget.z) * followRate, -18, 18);
  updateCameraAngle();
};

const updateKeyboardCamera = (delta: number) => {
  let rightAmount = 0;
  let forwardAmount = 0;

  if (pressedMovementKeys.has('w')) forwardAmount += 1;
  if (pressedMovementKeys.has('s')) forwardAmount -= 1;
  if (pressedMovementKeys.has('a')) rightAmount -= 1;
  if (pressedMovementKeys.has('d')) rightAmount += 1;
  if (rightAmount === 0 && forwardAmount === 0) return;

  const length = Math.hypot(rightAmount, forwardAmount);
  const moveSpeed = 13 / Math.sqrt(cameraZoom);
  moveCamera((rightAmount / length) * moveSpeed * delta, (forwardAmount / length) * moveSpeed * delta);
};

const updateKeyboardRotation = (delta: number) => {
  if (!continuousRotationEnabled) return;

  let direction = 0;
  if (pressedRotationKeys.has('q')) direction += 1;
  if (pressedRotationKeys.has('e')) direction -= 1;
  if (direction === 0) return;

  cameraYaw += direction * 1.8 * delta;
  updateCameraAngle();
};

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    cameraZoom = clamp(cameraZoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.55, 2.4);
    setViewport();
    setStatus(t('status.zoom', { zoom: Math.round(cameraZoom * 100) }));
  },
  { passive: false },
);

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return;

  const key = event.key.toLowerCase();
  if (key !== 'q' && key !== 'e') return;
  event.preventDefault();

  if (continuousRotationEnabled) {
    pressedRotationKeys.add(key);
    return;
  }

  if (event.repeat) return;
  cameraYaw += key === 'q' ? quarterYawStep : -quarterYawStep;
  updateCameraAngle();
  setStatus(t('status.viewRotated', { key: key.toUpperCase() }));
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return;

  const key = event.key.toLowerCase();
  if (!['w', 'a', 's', 'd'].includes(key)) return;
  event.preventDefault();
  setGuestFollow(false);
  pressedMovementKeys.add(key);
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  pressedMovementKeys.delete(key);
  pressedRotationKeys.delete(key);
});

window.addEventListener('resize', setViewport);
updateCameraAngle();
setViewport();
applyStaticTranslations();
seedPark();
setTool('select');
updateSelectedRidePanel();

const clock = new THREE.Clock();

const animate = () => {
  const delta = clock.getDelta();
  const simulationDelta = Math.min(delta * simulationSpeed, 0.12);

  updateKeyboardCamera(delta);
  updateKeyboardRotation(delta);

  if (!isPaused) {
    updateRideSystems(simulationDelta);
    updateGateAnimations(simulationDelta);
    updateGuests(simulationDelta);
  }

  updateGuestFollowCamera(delta);
  updateRideAudio(delta);
  updateCrowdAudio();
  updateQueueEntryPreviews();
  updateSelectedGuestWindow();
  updateDebugStatus();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

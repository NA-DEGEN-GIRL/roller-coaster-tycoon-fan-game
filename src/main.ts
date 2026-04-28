import * as THREE from 'three';
import './style.css';

type Tool = 'select' | 'path' | 'queue' | 'carousel' | 'entrance' | 'exit' | 'tree' | 'bulldoze';

type GridCoord = {
  x: number;
  z: number;
};

type QueueDirection = 'north' | 'east' | 'south' | 'west';

type QueuePath = {
  group: THREE.Group;
  direction: QueueDirection;
};

type Guest = {
  mesh: THREE.Group;
  from: string;
  to: string;
  progress: number;
  speed: number;
  pause: number;
  state: 'walking' | 'queueing' | 'waiting' | 'boarding' | 'riding';
  rideId?: string;
  queueKey?: string;
  queueSlotIndex?: number;
  queueRoute?: string[];
  queueRouteIndex?: number;
  queueMoveStart?: THREE.Vector3;
  boardingTarget?: THREE.Vector3;
  rideTime: number;
};

type RidePhase = 'idle' | 'loading' | 'running' | 'unloading';

type Ride = {
  id: string;
  group: THREE.Group;
  rotor: THREE.Group;
  footprint: string[];
  center: GridCoord;
  isOpen: boolean;
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
const selectedRideName = document.querySelector<HTMLElement>('#selected-ride-name');
const selectedRideStatus = document.querySelector<HTMLElement>('#selected-ride-status');
const rideOpenToggle = document.querySelector<HTMLInputElement>('#ride-open-toggle');
const continuousRotationToggle = document.querySelector<HTMLInputElement>('#continuous-rotation-toggle');
const debugLog = document.querySelector<HTMLElement>('#debug-log');
const debugStatus = document.querySelector<HTMLElement>('#debug-status');
const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tool]'));

if (
  !canvas ||
  !pauseButton ||
  !statusText ||
  !guestCount ||
  !pathCount ||
  !queueCount ||
  !rideCount ||
  !selectedRideName ||
  !selectedRideStatus ||
  !rideOpenToggle ||
  !continuousRotationToggle ||
  !debugLog ||
  !debugStatus
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
world.add(groundGroup, buildGroup, guestGroup);

const groundMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x79b15f, roughness: 0.82 }),
  new THREE.MeshStandardMaterial({ color: 0x6aa957, roughness: 0.88 }),
  new THREE.MeshStandardMaterial({ color: 0x88bd65, roughness: 0.86 }),
];
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xc8ad7f, roughness: 0.78 });
const queueMaterial = new THREE.MeshStandardMaterial({ color: 0x8676c8, roughness: 0.72 });
const queuePreviewMaterial = new THREE.MeshStandardMaterial({ color: 0x8676c8, roughness: 0.72, transparent: true, opacity: 0.68 });
const queueArrowMaterial = new THREE.MeshStandardMaterial({ color: 0xf4e9ff, roughness: 0.5 });
const queueFenceMaterial = new THREE.MeshStandardMaterial({ color: 0x453980, roughness: 0.48 });
const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.55 });
const exitMaterial = new THREE.MeshStandardMaterial({ color: 0xde5b42, roughness: 0.55 });
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

const tileGeometry = new THREE.BoxGeometry(tileSize, 0.28, tileSize);
const pathGeometry = new THREE.BoxGeometry(tileSize * 1.02, 0.08, tileSize * 1.02);
const selectionGeometry = new THREE.BoxGeometry(tileSize * 0.96, 0.1, tileSize * 0.96);
const queueFenceGeometry = new THREE.BoxGeometry(0.08, 0.32, tileSize * 0.76);
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

const tiles: THREE.Mesh[] = [];
const paths = new Map<string, THREE.Mesh>();
const queuePaths = new Map<string, QueuePath>();
const trees = new Map<string, THREE.Group>();
const rides = new Map<string, Ride>();
const occupied = new Map<string, string>();
const entrances = new Map<string, { rideId: string; mesh: THREE.Group }>();
const exits = new Map<string, { rideId: string; mesh: THREE.Group }>();
const guests: Guest[] = [];

let activeTool: Tool = 'select';
let queueBuildDirection: QueueDirection = 'north';
let hoveredTile: GridCoord | null = null;
let selectedRideId: string | null = null;
let isPaused = false;
let rideSerial = 0;
const quarterYawStep = Math.PI / 2;
const baseCameraYaw = Math.PI / 4;
let cameraYaw = baseCameraYaw;
let cameraZoom = 1;
const cameraTarget = new THREE.Vector3(0, 0, 0);
let isMiddleDragging = false;
let lastDragX = 0;
let lastDragY = 0;
const pressedMovementKeys = new Set<string>();
const pressedRotationKeys = new Set<string>();
let continuousRotationEnabled = false;

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
const queueDirectionLabels: Record<QueueDirection, string> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'W',
};

const keyInDirection = (key: string, direction: QueueDirection) => {
  const coord = parseKey(key);
  const vector = queueDirectionVectors[direction];
  return keyOf(coord.x + vector.x, coord.z + vector.z);
};

const queueForwardKey = (key: string) => {
  const queuePath = queuePaths.get(key);
  return queuePath ? keyInDirection(key, queuePath.direction) : key;
};

const queueBackKey = (key: string) => {
  const queuePath = queuePaths.get(key);
  if (!queuePath) return key;
  const coord = parseKey(key);
  const vector = queueDirectionVectors[queuePath.direction];
  return keyOf(coord.x - vector.x, coord.z - vector.z);
};

const rideConnectionStatus = (ride: Ride) => {
  const hasQueueConnection = ride.entranceKey
    ? adjacentKeys(parseKey(ride.entranceKey)).some((key) => queuePaths.has(key) && queueForwardKey(key) === ride.entranceKey)
    : false;
  const hasExitPath = ride.exitKey ? adjacentKeys(parseKey(ride.exitKey)).some((key) => paths.has(key)) : false;
  return {
    hasQueueConnection,
    hasExitPath,
    ready: ride.isOpen && Boolean(ride.entranceKey) && Boolean(ride.exitKey) && hasQueueConnection && hasExitPath,
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

const rotateQueueBuildDirection = (step: 1 | -1 = 1) => {
  const currentIndex = queueDirectionOrder.indexOf(queueBuildDirection);
  const nextIndex = (currentIndex + step + queueDirectionOrder.length) % queueDirectionOrder.length;
  queueBuildDirection = queueDirectionOrder[nextIndex];
  setStatus(`Queue direction ${queueDirectionLabels[queueBuildDirection]} · R rotate`);
};

const updateRideVisual = (ride: Ride) => {
  const connection = rideConnectionStatus(ride);
  ride.statusLight.material = connection.ready ? openMaterial : closedMaterial;
};

const updateSelectedRidePanel = () => {
  const ride = selectedRideId ? rides.get(selectedRideId) : undefined;
  if (!ride) {
    selectedRideId = null;
    selectedRideName.textContent = 'No ride selected';
    selectedRideStatus.textContent = 'Place or click a carousel';
    rideOpenToggle.checked = false;
    rideOpenToggle.disabled = true;
    return;
  }

  const connection = rideConnectionStatus(ride);
  selectedRideName.textContent = `Carousel ${ride.id.split('-')[1]}`;
  rideOpenToggle.disabled = false;
  rideOpenToggle.checked = ride.isOpen;

  if (!ride.isOpen) {
    selectedRideStatus.textContent = 'Closed';
  } else if (!ride.entranceKey) {
    selectedRideStatus.textContent = 'Needs entrance';
  } else if (!connection.hasQueueConnection) {
    selectedRideStatus.textContent = 'Connect entrance to queue';
  } else if (!ride.exitKey) {
    selectedRideStatus.textContent = 'Needs exit';
  } else if (!connection.hasExitPath) {
    selectedRideStatus.textContent = 'Connect exit to path';
  } else {
    selectedRideStatus.textContent = `${ride.phase.toUpperCase()} · ${ride.riders} riding`;
  }
  updateRideVisual(ride);
};

const updateDebugStatus = () => {
  const ride = selectedRideId ? rides.get(selectedRideId) : undefined;
  if (!ride) {
    debugStatus.textContent = `Guests ${guests.length} · no ride selected`;
    return;
  }

  const waiting = guests.filter((guest) => guest.state === 'waiting' && guest.rideId === ride.id).length;
  const queueing = guests.filter((guest) => guest.state === 'queueing' && guest.rideId === ride.id).length;
  const boarding = guests.filter((guest) => guest.state === 'boarding' && guest.rideId === ride.id).length;
  debugStatus.textContent = `Carousel ${ride.id.split('-')[1]} · ${ride.phase} · riders ${ride.riders} · boarding ${boarding} · queueing ${queueing} · waiting ${waiting} · timer ${ride.phaseTimer.toFixed(1)}s`;
};

const setTool = (tool: Tool) => {
  activeTool = tool;
  toolButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === tool);
  });
  setStatus(toolStatusLabel(tool));
};

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool as Tool));
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
  if (tool === 'queue') return canPlaceQueue(coord);
  if (tool === 'tree') return canPlaceTree(coord);
  if (tool === 'carousel') return canPlaceCarousel(coord);
  if (tool === 'entrance') return canPlaceRideGate(coord, 'entrance');
  if (tool === 'exit') return canPlaceRideGate(coord, 'exit');

  const key = keyOf(coord.x, coord.z);
  return isAnyBuiltPath(key) || occupied.has(key) || trees.has(key) || entrances.has(key) || exits.has(key);
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

  if (activeTool === 'queue') {
    const preview = createQueuePath(queueBuildDirection, true);
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

const addPath = (coord: GridCoord, silent = false) => {
  if (!canPlacePath(coord)) return false;

  const key = keyOf(coord.x, coord.z);
  const path = new THREE.Mesh(pathGeometry, pathMaterial);
  path.position.copy(worldPos(coord.x, coord.z, 0.045));
  path.receiveShadow = true;
  buildGroup.add(path);
  paths.set(key, path);

  if (!silent) setStatus(`Path built at ${key}`);
  refreshStats();
  updateSelectedRidePanel();
  return true;
};

const createQueuePath = (direction: QueueDirection, preview = false): QueuePath => {
  const group = new THREE.Group();

  const baseMaterial = preview ? queuePreviewMaterial : queueMaterial;
  const base = new THREE.Mesh(pathGeometry, baseMaterial);
  base.position.y = 0.05;
  base.receiveShadow = true;
  group.add(base);

  const arrow = new THREE.Mesh(queueArrowGeometry, queueArrowMaterial);
  arrow.position.y = 0.115;
  arrow.rotation.x = -Math.PI / 2;
  group.add(arrow);

  [-0.78, 0.78].forEach((x) => {
    const fence = new THREE.Mesh(queueFenceGeometry, queueFenceMaterial);
    fence.position.set(x, 0.26, 0);
    fence.castShadow = true;
    fence.receiveShadow = true;
    group.add(fence);
  });

  group.rotation.y = rotationYForQueueDirection(direction);
  return { group, direction };
};

const addQueuePath = (coord: GridCoord, silent = false, direction = queueBuildDirection) => {
  if (!canPlaceQueue(coord)) return false;

  const key = keyOf(coord.x, coord.z);
  const queuePath = createQueuePath(direction);
  queuePath.group.position.copy(worldPos(coord.x, coord.z));
  buildGroup.add(queuePath.group);
  queuePaths.set(key, queuePath);

  if (!silent) setStatus(`Queue path built at ${key} · ${queueDirectionLabels[direction]}`);
  refreshStats();
  updateSelectedRidePanel();
  return true;
};

const createGate = (kind: 'entrance' | 'exit') => {
  const group = new THREE.Group();
  const material = kind === 'entrance' ? entranceMaterial : exitMaterial;
  const floorMaterial = kind === 'entrance' ? queueMaterial : pathMaterial;

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

  const turnstile = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.72, 10),
    new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.42, metalness: 0.2 }),
  );
  turnstile.position.set(0.36, 0.48, -0.1);
  turnstile.castShadow = true;
  group.add(turnstile);

  const armGeometry = new THREE.BoxGeometry(0.54, 0.06, 0.06);
  for (let i = 0; i < 3; i += 1) {
    const arm = new THREE.Mesh(
      armGeometry,
      new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.42, metalness: 0.2 }),
    );
    arm.position.set(0.36, 0.6, -0.1);
    arm.rotation.y = (i / 3) * Math.PI * 2;
    group.add(arm);
  }

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.28, 3),
    new THREE.MeshStandardMaterial({ color: kind === 'entrance' ? 0xd9ffe2 : 0xffe1d8, roughness: 0.5 }),
  );
  marker.position.set(0, 1.84, 0.38);
  marker.rotation.x = Math.PI / 2;
  marker.castShadow = true;
  group.add(marker);

  return group;
};

const addRideGate = (coord: GridCoord, kind: 'entrance' | 'exit', silent = false) => {
  const ride = selectedRide();
  if (!ride || !canPlaceRideGate(coord, kind)) return false;

  const key = keyOf(coord.x, coord.z);
  const gate = createGate(kind);
  const direction = directionToRide(coord, ride);
  gate.position.copy(worldPos(coord.x, coord.z, 0.04));
  gate.rotation.y = rotationYForDirection(direction);
  buildGroup.add(gate);

  if (kind === 'entrance') {
    ride.entranceKey = key;
    entrances.set(key, { rideId: ride.id, mesh: gate });
  } else {
    ride.exitKey = key;
    exits.set(key, { rideId: ride.id, mesh: gate });
  }

  if (!silent) setStatus(`${kind === 'entrance' ? 'Entrance' : 'Exit'} placed for Carousel ${ride.id.split('-')[1]}`);
  updateSelectedRidePanel();
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
  if (!silent) setStatus(`Tree planted at ${key}`);
  return true;
};

const createCarousel = () => {
  const group = new THREE.Group();
  const rotor = new THREE.Group();

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

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(2.28, 1.0, 24),
    new THREE.MeshStandardMaterial({ color: 0xde5b42, roughness: 0.5 }),
  );
  canopy.position.y = 3.28;
  canopy.castShadow = true;
  rotor.add(canopy);

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
  for (let i = 0; i < 8; i += 1) {
    const seat = new THREE.Group();
    const angle = (i / 8) * Math.PI * 2;
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
    seat.add(horse);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.2),
      new THREE.MeshStandardMaterial({ color: horseColors[i % horseColors.length], roughness: 0.55 }),
    );
    head.position.set(0.36, 1.1, 0);
    head.castShadow = true;
    seat.add(head);

    seat.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    seat.rotation.y = -angle + Math.PI / 2;
    seat.userData.phase = i * 0.8;
    rotor.add(seat);
  }

  group.add(rotor);
  return { group, rotor, statusLight };
};

const addCarousel = (coord: GridCoord, silent = false) => {
  if (!canPlaceCarousel(coord)) return false;

  const id = `carousel-${rideSerial}`;
  rideSerial += 1;
  const { group, rotor, statusLight } = createCarousel();
  group.position.copy(worldPos(coord.x, coord.z, 0.03));
  buildGroup.add(group);

  const footprint = footprintFor('carousel', coord).map(({ x, z }) => keyOf(x, z));
  footprint.forEach((key) => occupied.set(key, id));
  rides.set(id, {
    id,
    group,
    rotor,
    footprint,
    center: coord,
    isOpen: false,
    statusLight,
    riders: 0,
    phase: 'idle',
    phaseTimer: 0,
  });

  selectedRideId = id;
  updateSelectedRidePanel();
  if (!silent) setStatus(`Carousel set installed at ${keyOf(coord.x, coord.z)}`);
  refreshStats();
  return true;
};

const removeAt = (coord: GridCoord) => {
  const key = keyOf(coord.x, coord.z);
  const path = paths.get(key);
  if (path) {
    buildGroup.remove(path);
    path.geometry.dispose();
    paths.delete(key);
    resetInvalidGuests();
    refreshStats();
    updateSelectedRidePanel();
    setStatus(`Path removed at ${key}`);
    return true;
  }

  const queuePath = queuePaths.get(key);
  if (queuePath) {
    buildGroup.remove(queuePath.group);
    queuePaths.delete(key);
    resetInvalidGuests();
    refreshStats();
    updateSelectedRidePanel();
    setStatus(`Queue path removed at ${key}`);
    return true;
  }

  const entrance = entrances.get(key);
  if (entrance) {
    const ride = rides.get(entrance.rideId);
    if (ride?.entranceKey === key) ride.entranceKey = undefined;
    buildGroup.remove(entrance.mesh);
    entrances.delete(key);
    updateSelectedRidePanel();
    setStatus('Entrance removed');
    return true;
  }

  const exit = exits.get(key);
  if (exit) {
    const ride = rides.get(exit.rideId);
    if (ride?.exitKey === key) ride.exitKey = undefined;
    buildGroup.remove(exit.mesh);
    exits.delete(key);
    updateSelectedRidePanel();
    setStatus('Exit removed');
    return true;
  }

  const tree = trees.get(key);
  if (tree) {
    buildGroup.remove(tree);
    trees.delete(key);
    setStatus(`Tree removed at ${key}`);
    return true;
  }

  const rideId = occupied.get(key);
  if (rideId) {
    const ride = rides.get(rideId);
    if (!ride) return false;
    buildGroup.remove(ride.group);
    if (ride.entranceKey) {
      const entrance = entrances.get(ride.entranceKey);
      if (entrance) buildGroup.remove(entrance.mesh);
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
    setStatus('Ride removed');
    return true;
  }

  setStatus('Nothing to remove');
  return false;
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

const finishRide = (guest: Guest) => {
  const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
  if (ride) {
    ride.riders = Math.max(0, ride.riders - 1);
    updateSelectedRidePanel();
  }

  const exitKey = ride ? exitPathForRide(ride) : randomPathKey();
  guest.state = 'walking';
  guest.rideId = undefined;
  guest.queueKey = undefined;
  guest.queueSlotIndex = undefined;
  guest.queueRoute = undefined;
  guest.queueRouteIndex = undefined;
  guest.queueMoveStart = undefined;
  guest.boardingTarget = undefined;
  guest.rideTime = 0;
  guest.from = exitKey;
  guest.to = chooseNextPath(exitKey);
  guest.progress = 0;
  guest.pause = 0.35 + Math.random() * 0.8;
  guest.mesh.visible = true;
  placeGuestAt(guest, exitKey);
};

const completeBoardingGuest = (guest: Guest, ride: Ride) => {
  ride.riders += 1;
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
  debug(`Carousel ${ride.id.split('-')[1]} boarded guest (${ride.riders}/8)`);
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
  debug(`Carousel ${ride.id.split('-')[1]} boarding guest`);
};

const tryBoardRide = (guest: Guest, key: string) => {
  if (!queuePaths.has(key)) return false;

  const entrance = adjacentKeys(parseKey(key))
    .map((neighborKey) => entrances.get(neighborKey))
    .find((candidate) => {
      if (!candidate) return false;
      const ride = rides.get(candidate.rideId);
      return Boolean(ride && rideConnectionStatus(ride).ready && ride.riders < 8);
    });

  if (!entrance) return false;

  const ride = rides.get(entrance.rideId);
  if (!ride) return false;

  if (guest.state === 'waiting') {
    return true;
  }

  const queueSlot = queueSlotForRide(ride);
  if (!queueSlot) {
    debug(`Carousel ${ride.id.split('-')[1]} queue full; guest left`);
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
  debug(`Guest waiting for Carousel ${ride.id.split('-')[1]}`);
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
    debug(`Carousel ${ride.id.split('-')[1]} queue moved forward`);
  });
};

const waitingGuestsForRide = (ride: Ride) =>
  guests
    .filter((guest) => guest.state === 'waiting' && guest.rideId === ride.id && ride.riders < 8)
    .sort((a, b) => {
      const order = queueKeysForRide(ride);
      const aIndex = a.queueKey ? order.indexOf(a.queueKey) : Number.MAX_SAFE_INTEGER;
      const bIndex = b.queueKey ? order.indexOf(b.queueKey) : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || (a.queueSlotIndex ?? 0) - (b.queueSlotIndex ?? 0);
    });

const boardingGuestsForRide = (ride: Ride) => guests.filter((guest) => guest.state === 'boarding' && guest.rideId === ride.id);

const rideForQueueKey = (queueKey: string) =>
  Array.from(rides.values()).find((ride) => rideConnectionStatus(ride).ready && queueKeysForRide(ride).includes(queueKey));

const tryEnterQueueFromPath = (guest: Guest, pathKey: string) => {
  if (!paths.has(pathKey)) return false;

  const queueKey = adjacentKeys(parseKey(pathKey)).find((candidate) => {
    const ride = rideForQueueKey(candidate);
    return Boolean(ride && queueTailKeysForRide(ride).includes(candidate) && queueBackKey(candidate) === pathKey);
  });
  if (!queueKey) return false;

  const ride = rideForQueueKey(queueKey);
  if (!ride) return false;

  const queueSlot = queueSlotForRide(ride);
  if (!queueSlot) {
    debug(`Carousel ${ride.id.split('-')[1]} queue full; guest kept walking`);
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
  debug(`Guest walking into Carousel ${ride.id.split('-')[1]} queue`);
  return true;
};

const rotateCarousel = (ride: Ride, delta: number) => {
  ride.rotor.rotation.y += delta * 1.05;
  ride.rotor.children.forEach((child) => {
    const phase = child.userData.phase as number | undefined;
    if (phase !== undefined) child.position.y = Math.sin(performance.now() * 0.0025 + phase) * 0.08;
  });
};

const setRidePhase = (ride: Ride, phase: RidePhase, timer: number) => {
  if (ride.phase !== phase) debug(`Carousel ${ride.id.split('-')[1]} ${phase.toUpperCase()}`);
  ride.phase = phase;
  ride.phaseTimer = timer;
  updateSelectedRidePanel();
};

const updateRideSystems = (delta: number) => {
  rides.forEach((ride) => {
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
      const remainingSeats = 8 - ride.riders - boardingGuestsForRide(ride).length;
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
      debug(`Carousel ${ride.id.split('-')[1]} unloaded riders`);
    }
  });
};

const createGuestMesh = () => {
  const group = new THREE.Group();
  const shirtColors = [0x2d9cdb, 0xeb5757, 0x27ae60, 0xbb6bd9, 0xf2994a];
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.17, 0.48, 10),
    new THREE.MeshStandardMaterial({ color: shirtColors[Math.floor(Math.random() * shirtColors.length)], roughness: 0.72 }),
  );
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.6 }),
  );
  head.position.y = 0.72;
  head.castShadow = true;
  group.add(head);
  return group;
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

const spawnGuest = (startKey?: string) => {
  const from = startKey ?? randomPathKey();
  const to = chooseNextPath(from);
  const mesh = createGuestMesh();
  const guest: Guest = {
    mesh,
    from,
    to,
    progress: startKey ? 0 : Math.random(),
    speed: 0.35 + Math.random() * 0.28,
    pause: startKey ? 0 : Math.random() * 0.8,
    state: 'walking',
    rideTime: 0,
  };
  placeGuestAt(guest, from);
  guestGroup.add(mesh);
  guests.push(guest);
};

const resetInvalidGuests = () => {
  if (paths.size === 0) return;
  guests.forEach((guest) => {
    if (guest.state === 'boarding' || guest.state === 'riding') return;
    if ((guest.state === 'queueing' || guest.state === 'waiting') && guest.queueKey && queuePaths.has(guest.queueKey)) return;
    if (!isWalkway(guest.from) || !isWalkway(guest.to)) {
      guest.state = 'walking';
      guest.rideId = undefined;
      guest.queueKey = undefined;
      guest.queueSlotIndex = undefined;
      guest.queueRoute = undefined;
      guest.queueRouteIndex = undefined;
      guest.queueMoveStart = undefined;
      guest.from = randomPathKey();
      guest.to = chooseNextPath(guest.from);
      guest.progress = 0;
      placeGuestAt(guest, guest.from);
    }
  });
};

const updateGuests = (delta: number) => {
  guests.forEach((guest) => {
    if (guest.state === 'boarding') {
      const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
      if (!ride || !guest.queueMoveStart || !guest.boardingTarget) {
        guest.state = 'walking';
        guest.rideId = undefined;
        guest.queueMoveStart = undefined;
        guest.boardingTarget = undefined;
        guest.from = randomPathKey();
        guest.to = chooseNextPath(guest.from);
        placeGuestAt(guest, guest.from);
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
        guest.state = 'walking';
        guest.rideId = undefined;
        guest.queueKey = undefined;
        guest.queueSlotIndex = undefined;
        guest.queueRoute = undefined;
        guest.queueRouteIndex = undefined;
        guest.queueMoveStart = undefined;
        guest.boardingTarget = undefined;
        guest.from = randomPathKey();
        guest.to = chooseNextPath(guest.from);
        placeGuestAt(guest, guest.from);
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
      debug(`Guest reached Carousel ${guest.rideId.split('-')[1]} queue slot`);
      return;
    }

    if (guest.state === 'waiting') {
      const ride = guest.rideId ? rides.get(guest.rideId) : undefined;
      if (ride && rideConnectionStatus(ride).ready && guest.queueKey && queuePaths.has(guest.queueKey)) return;

      guest.state = 'walking';
      guest.rideId = undefined;
      guest.queueKey = undefined;
      guest.queueSlotIndex = undefined;
      guest.queueRoute = undefined;
      guest.queueRouteIndex = undefined;
      guest.queueMoveStart = undefined;
      guest.boardingTarget = undefined;
      guest.from = randomPathKey();
      guest.to = chooseNextPath(guest.from);
      placeGuestAt(guest, guest.from);
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
    const fromPos = worldPos(from.x, from.z, 0.12);
    const toPos = worldPos(to.x, to.z, 0.12);
    guest.mesh.position.lerpVectors(fromPos, toPos, Math.min(guest.progress, 1));
    guest.mesh.rotation.y = Math.atan2(toPos.x - fromPos.x, toPos.z - fromPos.z);

    if (guest.progress >= 1) {
      const previous = guest.from;
      guest.from = guest.to;
      placeGuestAt(guest, guest.from);
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

  for (let i = 0; i < 24; i += 1) spawnGuest();
  for (let i = 0; i < 4; i += 1) spawnGuest('4,2');
  refreshStats();
};

const selectRideAt = (coord: GridCoord) => {
  const rideId = rideIdAt(keyOf(coord.x, coord.z));
  selectedRideId = rideId;
  updateSelectedRidePanel();
  updateDebugStatus();

  if (rideId) {
    setStatus('Carousel selected');
    return true;
  }

  setStatus('Selection cleared');
  return false;
};

const handlePointerMove = (event: PointerEvent) => {
  if (isMiddleDragging) {
    panCamera(event.clientX - lastDragX, event.clientY - lastDragY);
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(tiles, false)[0];
  hoveredTile = hit?.object.userData.coord ?? null;
  updatePreview();
};

const handleBuild = (event: PointerEvent) => {
  if (event.button === 1) {
    event.preventDefault();
    isMiddleDragging = true;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    setStatus('Pan camera');
    return;
  }

  if (event.button !== 0) return;
  if (!hoveredTile) return;

  const hoverKey = keyOf(hoveredTile.x, hoveredTile.z);
  const clickedRideId = rideIdAt(hoverKey);
  if (activeTool !== 'bulldoze' && clickedRideId) {
    if (activeTool !== 'select') setTool('select');
    selectRideAt(hoveredTile);
    updatePreview();
    return;
  }

  if (activeTool === 'select') {
    selectRideAt(hoveredTile);
    updatePreview();
    return;
  }

  if (activeTool === 'path') addPath(hoveredTile);
  if (activeTool === 'queue') addQueuePath(hoveredTile);
  if (activeTool === 'tree') addTree(hoveredTile);
  if (activeTool === 'carousel') addCarousel(hoveredTile);
  if (activeTool === 'entrance') addRideGate(hoveredTile, 'entrance');
  if (activeTool === 'exit') addRideGate(hoveredTile, 'exit');
  if (activeTool === 'bulldoze') removeAt(hoveredTile);

  updatePreview();
};

canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerdown', handleBuild);
canvas.addEventListener('pointerup', (event) => {
  if (event.button !== 1) return;
  isMiddleDragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('auxclick', (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener('pointerleave', () => {
  isMiddleDragging = false;
  hoveredTile = null;
  updatePreview();
});

rideOpenToggle.addEventListener('change', () => {
  const ride = selectedRide();
  if (!ride) return;
  ride.isOpen = rideOpenToggle.checked;
  updateSelectedRidePanel();
  setStatus(ride.isOpen ? 'Ride opened' : 'Ride closed');
});

continuousRotationToggle.addEventListener('change', () => {
  continuousRotationEnabled = continuousRotationToggle.checked;
  continuousRotationToggle.blur();
  if (!continuousRotationEnabled) {
    pressedRotationKeys.clear();
    snapCameraToNearestQuarter();
    setStatus('Quarter view rotation');
    return;
  }

  setStatus('Continuous QE rotation');
});

const toolStatusLabel = (tool: Tool) => {
  const labels: Record<Tool, string> = {
    select: 'Select tool selected',
    path: 'Path tool selected',
    queue: `Queue path tool selected · ${queueDirectionLabels[queueBuildDirection]} · R rotate`,
    carousel: 'Carousel prefab selected',
    entrance: 'Entrance tool selected',
    exit: 'Exit tool selected',
    tree: 'Tree tool selected',
    bulldoze: 'Bulldoze tool selected',
  };
  return labels[tool];
};

pauseButton.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
  setStatus(isPaused ? 'Simulation paused' : toolStatusLabel(activeTool));
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
    setStatus(`Zoom ${Math.round(cameraZoom * 100)}%`);
  },
  { passive: false },
);

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return;

  const key = event.key.toLowerCase();
  if (key !== 'r' || activeTool !== 'queue') return;
  event.preventDefault();
  if (event.repeat) return;
  rotateQueueBuildDirection(event.shiftKey ? -1 : 1);
  updatePreview();
});

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
  setStatus(`View rotated ${key.toUpperCase()}`);
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return;

  const key = event.key.toLowerCase();
  if (!['w', 'a', 's', 'd'].includes(key)) return;
  event.preventDefault();
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
seedPark();
setTool('select');
updateSelectedRidePanel();

const clock = new THREE.Clock();

const animate = () => {
  const delta = clock.getDelta();

  updateKeyboardCamera(delta);
  updateKeyboardRotation(delta);

  if (!isPaused) {
    updateRideSystems(delta);
    updateGuests(delta);
  }

  updateDebugStatus();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

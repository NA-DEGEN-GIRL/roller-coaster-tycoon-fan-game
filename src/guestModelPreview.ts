import * as THREE from 'three';
import { createGuestMesh, setGuestPose } from './guestModel';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('Missing #app container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd7e6ea);

const camera = new THREE.OrthographicCamera(-3.9, 3.9, 2.8, -1.6, 0.1, 100);
camera.position.set(4.2, 3.4, 5.2);
camera.lookAt(0, 0.35, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x7e8d76, 2.2));

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(8.4, 0.12, 2.8),
  new THREE.MeshStandardMaterial({ color: 0xc8ad7f, roughness: 0.8 }),
);
floor.position.y = -0.08;
floor.receiveShadow = true;
scene.add(floor);

const createBench = () => {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb8793f, roughness: 0.66 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x5d3d2a, roughness: 0.7 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.34), wood);
  seat.position.y = 0.36;
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.34, 0.08), wood);
  back.position.set(0, 0.58, -0.22);
  back.rotation.x = -0.12;
  back.castShadow = true;
  group.add(back);

  [-0.46, 0.46].forEach((x) => {
    [-0.12, 0.16].forEach((z) => {
      const benchLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), leg);
      benchLeg.position.set(x, 0.18, z);
      benchLeg.castShadow = true;
      group.add(benchLeg);
    });
  });

  return group;
};

const standing = createGuestMesh(1, 0x27ae60);
standing.position.set(-2.4, 0, 0);
setGuestPose(standing, 0);
scene.add(standing);

const walking = createGuestMesh(2, 0x2d9cdb);
walking.position.set(0, 0, 0);
setGuestPose(walking, 0, Math.PI / 2);
scene.add(walking);

const bench = createBench();
bench.position.set(2.4, 0, 0.02);
scene.add(bench);

const sitting = createGuestMesh(3, 0xeb5757);
sitting.position.set(2.4, 0.18, 0);
setGuestPose(sitting, 1);
scene.add(sitting);

const resize = () => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / Math.max(height, 1);
  const viewHeight = 4.4;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
};

window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const animate = () => {
  const elapsed = clock.getElapsedTime();
  setGuestPose(walking, 0, elapsed * 6);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

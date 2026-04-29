import * as THREE from 'three';

export type GuestMeshParts = {
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftShoulder: THREE.Mesh;
  rightShoulder: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
};

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const createGuestMesh = (id: number, shirtColor?: number) => {
  const group = new THREE.Group();
  group.userData.guestId = id;
  const shirtColors = [0x2d9cdb, 0xeb5757, 0x27ae60, 0xbb6bd9, 0xf2994a];
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirtColor ?? shirtColors[Math.floor(Math.random() * shirtColors.length)], roughness: 0.72 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c6a0, roughness: 0.6 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x31515c, roughness: 0.72 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x24353a, roughness: 0.78 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.48, 10), shirtMaterial);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), skinMaterial);
  head.position.y = 0.72;
  head.castShadow = true;
  group.add(head);

  const createShoulder = (x: number) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), shirtMaterial);
    shoulder.position.set(x, 0.55, 0);
    shoulder.castShadow = true;
    group.add(shoulder);
    return shoulder;
  };

  const createArm = (x: number) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8), shirtMaterial);
    arm.position.set(x, 0.4, 0.015);
    arm.rotation.z = x > 0 ? -0.16 : 0.16;
    arm.castShadow = true;
    group.add(arm);
    return arm;
  };

  const createLeg = (x: number) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.34, 8), pantsMaterial);
    leg.position.set(x, 0.16, 0.03);
    leg.castShadow = true;
    group.add(leg);
    return leg;
  };

  const createFoot = (x: number) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.16), shoeMaterial);
    foot.position.set(x, 0.015, 0.1);
    foot.castShadow = true;
    group.add(foot);
    return foot;
  };

  const parts: GuestMeshParts = {
    body,
    head,
    leftShoulder: createShoulder(-0.17),
    rightShoulder: createShoulder(0.17),
    leftArm: createArm(-0.2),
    rightArm: createArm(0.2),
    leftLeg: createLeg(-0.075),
    rightLeg: createLeg(0.075),
    leftFoot: createFoot(-0.075),
    rightFoot: createFoot(0.075),
  };

  group.userData.parts = parts;
  group.traverse((child) => {
    child.userData.guestId = id;
  });
  return group;
};

export const guestMeshParts = (mesh: THREE.Group) => mesh.userData.parts as GuestMeshParts | undefined;

export const setGuestPose = (mesh: THREE.Group, seatedAmount: number, walkAmount = 0) => {
  const parts = guestMeshParts(mesh);
  if (!parts) return;

  const seated = clamp01(seatedAmount);
  const walk = walkAmount * (1 - seated);
  const legSwing = Math.sin(walk) * 0.32;
  const armSwing = Math.sin(walk + Math.PI) * 0.24;

  parts.body.position.set(0, lerp(0.35, 0.38, seated), lerp(0, -0.04, seated));
  parts.body.rotation.x = lerp(0, -0.08, seated);
  parts.body.scale.y = lerp(1, 0.84, seated);

  parts.head.position.set(0, lerp(0.72, 0.66, seated), lerp(0, -0.03, seated));

  parts.leftShoulder.position.set(-0.17, lerp(0.55, 0.51, seated), lerp(0, 0.04, seated));
  parts.rightShoulder.position.set(0.17, lerp(0.55, 0.51, seated), lerp(0, 0.04, seated));

  [
    { part: parts.leftLeg, foot: parts.leftFoot, x: -0.075, swing: legSwing },
    { part: parts.rightLeg, foot: parts.rightFoot, x: 0.075, swing: -legSwing },
  ].forEach(({ part, foot, x, swing }) => {
    part.position.set(x, lerp(0.16, 0.32, seated), lerp(0.03 + swing * 0.05, 0.24, seated));
    part.rotation.x = lerp(swing, Math.PI / 2, seated);
    part.rotation.z = 0;
    foot.position.set(x, lerp(0.015, 0.3, seated), lerp(0.1 + swing * 0.14, 0.43, seated));
    foot.rotation.x = lerp(swing * 0.35, Math.PI / 2, seated);
  });

  [
    { part: parts.leftArm, x: -0.2, standingZ: 0.12 + armSwing, seatedZ: 0.24 },
    { part: parts.rightArm, x: 0.2, standingZ: -0.12 - armSwing, seatedZ: -0.24 },
  ].forEach(({ part, x, standingZ, seatedZ }) => {
    part.position.set(x, lerp(0.4, 0.47, seated), lerp(0.015, 0.12, seated));
    part.rotation.x = lerp(standingZ, Math.PI / 2.8, seated);
    part.rotation.z = lerp(x > 0 ? -0.16 : 0.16, x > 0 ? -0.54 : 0.54, seated);
  });
};

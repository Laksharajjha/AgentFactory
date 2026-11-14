import * as THREE from 'three';

// Shared Physically Based Architectural Materials (Singletons — Zero per-render allocation)
export const SHARED_MATERIALS = {
  // Glass & Partitions (No expensive FBO transmission pass)
  glassPartition: new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    transparent: true,
    opacity: 0.22,
    roughness: 0.12,
    metalness: 0.2,
    depthWrite: false,
  }),
  windowGlass: new THREE.MeshStandardMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.2,
    roughness: 0.08,
    metalness: 0.25,
    depthWrite: false,
  }),
  balustradeGlass: new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    transparent: true,
    opacity: 0.24,
    roughness: 0.12,
    metalness: 0.15,
    depthWrite: false,
  }),

  // Structural & Metals
  darkSteel: new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.38,
    metalness: 0.65,
  }),
  brushedSteel: new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.35,
    metalness: 0.65,
  }),
  aluminumStand: new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.3,
    metalness: 0.7,
  }),
  monitorBezel: new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.55,
  }),

  // Woods (Scandinavian Oak & Walnut)
  warmOak: new THREE.MeshStandardMaterial({
    color: '#c69968',
    roughness: 0.48,
    metalness: 0.04,
  }),
  executiveWalnut: new THREE.MeshStandardMaterial({
    color: '#9a6b3e',
    roughness: 0.45,
    metalness: 0.05,
  }),
  fasciaWood: new THREE.MeshStandardMaterial({
    color: '#b48352',
    roughness: 0.48,
    metalness: 0.04,
  }),

  // Concrete & Walls
  concreteSlab: new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    roughness: 0.68,
    metalness: 0.04,
  }),
  corridorTerrazzo: new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.58,
    metalness: 0.04,
  }),
  galleryWall: new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.62,
    metalness: 0.02,
  }),

  // Furniture & Foliage
  whiteCounter: new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.45,
  }),
  ceramicPlanter: new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    roughness: 0.5,
  }),
  plantSoil: new THREE.MeshStandardMaterial({
    color: '#5c4033',
    roughness: 0.9,
  }),
  foliageDark: new THREE.MeshStandardMaterial({
    color: '#2e6f40',
    roughness: 0.65,
  }),
  foliageMid: new THREE.MeshStandardMaterial({
    color: '#3b874e',
    roughness: 0.6,
  }),
  foliageBright: new THREE.MeshStandardMaterial({
    color: '#4da162',
    roughness: 0.55,
  }),
};

// Shared Reusable Geometries for Repeated Furniture & Architectural Elements
export const SHARED_GEOMETRIES = {
  monitorBezelDual: new THREE.BoxGeometry(0.88, 0.52, 0.03),
  monitorScreenDual: new THREE.PlaneGeometry(0.83, 0.47),
  monitorBezelSingle: new THREE.BoxGeometry(1.02, 0.58, 0.03),
  monitorScreenSingle: new THREE.PlaneGeometry(0.96, 0.52),
  monitorBase: new THREE.BoxGeometry(0.28, 0.02, 0.2),
  monitorArm: new THREE.BoxGeometry(0.045, 0.36, 0.045),
  keyboard: new THREE.BoxGeometry(0.38, 0.014, 0.14),
  deskMat: new THREE.BoxGeometry(0.72, 0.004, 0.28),
  mouse: new THREE.BoxGeometry(0.06, 0.02, 0.1),
  column: new THREE.BoxGeometry(0.26, 4.0, 0.26),
  stairStep: new THREE.BoxGeometry(0.34, 0.08, 1.15),
};

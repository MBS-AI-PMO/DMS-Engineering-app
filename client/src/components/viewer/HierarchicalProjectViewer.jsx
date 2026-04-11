import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const HierarchicalProjectViewer = ({
  bendTree,
  faceMeshes,
  selectedBends = {},
  activeBendId = null,
  onBendClick = null
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const groupsRef = useRef({});

  // ── Initialize Scene ──────────────────────────────────────────
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, currentMount.clientWidth / currentMount.clientHeight, 0.1, 10000);
    camera.position.set(200, 200, 200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Interactive Click
    const handleClick = (event) => {
      if (!onBendClick) return;

      const rect = currentMount.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x, y }, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      const mesh = intersects.find(i => i.object.isMesh);

      if (mesh) {
        let curr = mesh.object.parent;
        while (curr && !curr.name.startsWith('bend_')) {
          curr = curr.parent;
        }
        if (curr) {
          const id = curr.name.replace('bend_', '');
          onBendClick(id);
        }
      }
    };
    currentMount.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('click', handleClick);
      renderer.dispose();
      currentMount.removeChild(renderer.domElement);
    };
  }, [onBendClick]);

  // ── Rebuild Hierarchy and Highlight ────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !bendTree || !faceMeshes) return;

    // Clear previous model
    Object.values(groupsRef.current).forEach(g => scene.remove(g));
    groupsRef.current = {};

    const buildNode = (node, parentGroup) => {
      const faceId = node.id;
      const meshData = faceMeshes[faceId];
      if (!meshData) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geometry.setIndex(meshData.indices);
      geometry.computeVertexNormals();

      const isActive = String(faceId) === String(activeBendId);
      const material = new THREE.MeshStandardMaterial({
        color: isActive ? 0x3b82f6 : 0xdde1e7,
        emissive: isActive ? 0x3b82f6 : 0x000000,
        emissiveIntensity: isActive ? 0.3 : 0,
        roughness: 0.4,
        metalness: 0.6,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);

      const jointGroup = new THREE.Group();
      jointGroup.name = `bend_${faceId}`;

      if (node.bendAxis) {
        const p0 = new THREE.Vector3(...node.bendAxis.p0);
        const p1 = new THREE.Vector3(...node.bendAxis.p1);
        const axis = new THREE.Vector3().subVectors(p1, p0).normalize();

        jointGroup.position.copy(p0);
        mesh.position.sub(p0);

        jointGroup.userData = {
          axis: axis,
          initialAngle: node.initialAngle || 0,
          faceId: faceId,
          parentId: node.parentId
        };
      }

      jointGroup.add(mesh);
      parentGroup.add(jointGroup);
      groupsRef.current[faceId] = jointGroup;

      if (node.children) {
        node.children.forEach(child => buildNode(child, jointGroup));
      }
    };

    const rootContainer = new THREE.Group();
    buildNode(bendTree, rootContainer);
    scene.add(rootContainer);

    const box = new THREE.Box3().setFromObject(rootContainer);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    if (controlsRef.current) controlsRef.current.target.copy(center);
    if (cameraRef.current) {
      cameraRef.current.position.copy(center).add(new THREE.Vector3(size, size, size));
      cameraRef.current.updateProjectionMatrix();
    }

  }, [bendTree, faceMeshes, activeBendId]);

  // ── Update Rotations Live ─────────────────────────────────────
  useEffect(() => {
    Object.entries(selectedBends).forEach(([id, config]) => {
      const group = groupsRef.current[id];
      if (!group || !group.userData.axis) return;

      const axis = group.userData.axis;
      const sign = config.direction === 'down' ? -1 : 1;
      const angleRad = sign * (config.angle - (group.userData.initialAngle || 0)) * (Math.PI / 180);

      group.setRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, angleRad));
    });
  }, [selectedBends]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* HUD Overlay could go here */}
    </div>
  );
};

export default HierarchicalProjectViewer;

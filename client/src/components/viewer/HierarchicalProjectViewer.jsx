import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const HierarchicalProjectViewer = ({
  bendTree,
  faceMeshes,
  selectedBends = {},
  activeBendId = null,
  onBendClick = null,
  detectedHoles = [],
  onHoleClick = null,
  activeHoleId = null,
  isTappingActive = false,
  isHardwareActive = false,
  isCountersinkingActive = false,
  selectedTaps = {},
  selectedHardware = {},
  selectedCountersinks = {},
  activeFinishColor = null,
  isFinishPowderCoating = false,
  backendData = null
}) => {
  const [rebuildId, setRebuildId] = React.useState(0);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const groupsRef = useRef({});
  const modelGroupRef = useRef(null);
  const matCache = useRef(new Map());

  // Use refs for callbacks to avoid re-initializing the entire three.js engine on every handle update
  const onBendClickRef = useRef(onBendClick);
  const onHoleClickRef = useRef(onHoleClick);
  useEffect(() => { onBendClickRef.current = onBendClick; }, [onBendClick]);
  useEffect(() => { onHoleClickRef.current = onHoleClick; }, [onHoleClick]);

  // ── Initialize Scene ──────────────────────────────────────────
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, currentMount.clientWidth / currentMount.clientHeight, 1, 20000);
    camera.position.set(500, 500, 500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0xffffff, 1);
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.82;
    controls.panSpeed = 0.82;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controlsRef.current = controls;
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(500, 1000, 500);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    dirLight2.position.set(-500, 300, -500);
    scene.add(dirLight2);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.5);
    scene.add(hemi);

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

    const handleClick = (event) => {
      const rect = currentMount.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x, y }, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      // 1. Check for Marker Clicks First (Tapping/Hardware)
      const markerHit = intersects.find(i => i.object.isHardwareMarker);
      if (markerHit && onHoleClickRef.current) {
        onHoleClickRef.current(markerHit.object.userData.hole);
        return;
      }

      // 2. Check for Face Clicks (Bending)
      const mesh = intersects.find(i => i.object.isMesh && !i.object.isHardwareMarker);
      if (mesh && onBendClickRef.current) {
        let curr = mesh.object.parent;
        while (curr && !curr.name.startsWith('bend_')) { curr = curr.parent; }
        if (curr) { onBendClickRef.current(curr.name.replace('bend_', '')); }
      }
    };
    currentMount.addEventListener('click', handleClick);
    const handlePointerDown = () => { renderer.domElement.style.cursor = 'grabbing'; };
    const handlePointerUp = () => { renderer.domElement.style.cursor = 'grab'; };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      renderer.dispose();
      currentMount.removeChild(renderer.domElement);
    };
  }, []); // Only run once on mount

  // ── Rebuild Hierarchy and Markers ────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !faceMeshes) return;
    // Note: bendTree may be null for flat parts, that's fine.

    if (modelGroupRef.current && scene.children.includes(modelGroupRef.current)) {
      scene.remove(modelGroupRef.current);
    }

    modelGroupRef.current = null;
    groupsRef.current = {};
    const isActive = (id) => String(id) === String(activeBendId);

    // Finishing Color - robustly handle string or object format including .color
    const colorStr = (typeof activeFinishColor === 'string')
      ? activeFinishColor
      : (activeFinishColor?.color || activeFinishColor?.hex || '');
    const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : 0xc8cdd6;

    const makeMesh = (faceId, pivot) => {
      const meshData = faceMeshes[String(faceId)];
      if (!meshData) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geometry.setIndex(meshData.indices);
      geometry.computeVertexNormals();
      const active = isActive(faceId);
      const material = new THREE.MeshStandardMaterial({
        color: active ? 0x3b82f6 : finishHex,
        emissive: active ? 0x1d4ed8 : 0x000000,
        emissiveIntensity: active ? 0.15 : 0,
        roughness: isFinishPowderCoating ? 0.7 : 0.35,
        metalness: isFinishPowderCoating ? 0.1 : 0.65,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      if (pivot) mesh.position.sub(pivot);
      return mesh;
    };

    // --- Marker Helpers ---
    const getMarkersForFace = (faceId, pivot) => {
      const markers = [];
      const holes = detectedHoles.filter(h => String(h.face_id) === String(faceId));
      if (!holes.length) return markers;

      const origT = (backendData?.thickness || 2.0);
      const hwThicknessVec = new THREE.Vector3(0, 1, 0); // Default for sheet
      const getLocalHoleDepthMm = (hole) => {
        const rawDepthMm = Number(hole?.depthMm ?? hole?.depth_mm ?? NaN);
        const rawDepthInches = Number(hole?.depthInches);
        const depthMm = Number.isFinite(rawDepthMm) && rawDepthMm > 0
          ? rawDepthMm
          : (Number.isFinite(rawDepthInches) && rawDepthInches > 0 ? rawDepthInches * 25.4 : NaN);
        const fallback = origT > 0 ? origT : 2.0;
        if (!Number.isFinite(depthMm) || depthMm <= 0) return fallback;
        const suspiciousLimit = Math.max(fallback * 2.25, fallback + 1.0, 4.0);
        return depthMm > suspiciousLimit ? fallback : depthMm;
      };

      const getMarkerMat = (key, creator) => {
        if (!matCache.current.has(key)) matCache.current.set(key, creator());
        return matCache.current.get(key);
      };

      const makeRing = (iR, oR, h) => new THREE.LatheGeometry([new THREE.Vector2(iR, h / 2), new THREE.Vector2(iR, -h / 2), new THREE.Vector2(oR, -h / 2), new THREE.Vector2(oR, h / 2), new THREE.Vector2(iR, h / 2)], 32);

      holes.forEach(hole => {
        const dia = hole.diameter_mm || 3.0;
        const mmDia = dia;
        const pos = new THREE.Vector3(...hole.position).sub(pivot);
        const axis = hole.axis ? new THREE.Vector3(...hole.axis) : hwThicknessVec;

        // Visual state for Tapping
        const isTapped = !!selectedTaps[hole.id];
        const isActive = String(activeHoleId) === String(hole.id);

        if (isTappingActive || isTapped) {
          const color = isTapped ? 0x4169e1 : (isActive ? 0xe31b23 : 0x10b981);
          const mat = getMarkerMat(`tap_${color}_${isActive}`, () => new THREE.MeshPhongMaterial({
            color, emissive: color, emissiveIntensity: (isActive || isTapped) ? 10.0 : 1.5,
            shininess: 150, side: THREE.DoubleSide
          }));
          // Make markers 20% taller than thickness to "punch through" surfaces and avoid z-fighting
          const r = (mmDia / 2) * 1.05;
          const h = origT * 1.2;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
          m.position.copy(pos); m.lookAt(pos.clone().add(axis)); m.rotateX(Math.PI / 2);
          m.isHardwareMarker = true; m.userData.hole = hole; markers.push(m);
        }

        // Visual state for Hardware
        if (isHardwareActive && selectedHardware[hole.id]) {
          const { item, typeId, face } = selectedHardware[hole.id];
          const type = typeId || 3;
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };
          const color = HW_COLORS[typeId] || 0xB8860B;
          const mat = getMarkerMat(`hw_${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
          const faceSign = face === 'down' ? -1 : 1;
          const placementDepthMm = getLocalHoleDepthMm(hole);
          const placementHalfDepth = Number.isFinite(placementDepthMm) && placementDepthMm > 0.1
            ? placementDepthMm * 0.5
            : 0;
          const basePos = pos.clone().add(axis.clone().multiplyScalar(faceSign * placementHalfDepth));
          const hR = mmDia / 2;
          const hwOuterR = hR * 1.5; const hwBoreR = hR * 0.9;

          if (type === 3) {
            const h_nut = item?.length ? parseFloat(item.length) * 25.4 : 3;
            const m = new THREE.Mesh(makeRing(hwBoreR, hwOuterR, h_nut), mat);
            m.position.copy(basePos.clone().add(axis.clone().multiplyScalar(faceSign * h_nut / 2)));
            m.lookAt(m.position.clone().add(axis)); m.rotateX(Math.PI / 2);
            m.isHardwareMarker = true; m.userData.hole = hole; markers.push(m);
          } else if (type === 1) {
            const studH = item?.length ? parseFloat(item.length) * 25.4 : origT * 2;
            const m = new THREE.Mesh(new THREE.CylinderGeometry(hR, hR * 0.8, studH, 32), mat);
            m.position.copy(basePos.clone().add(axis.clone().multiplyScalar(faceSign * studH / 2)));
            m.lookAt(m.position.clone().add(axis)); m.rotateX(Math.PI / 2);
            m.isHardwareMarker = true; markers.push(m);
          }
        }

        // Countersinks
        if (selectedCountersinks[hole.id]) {
          const cs = selectedCountersinks[hole.id];
          const faceSign = cs.face === 'down' ? -1 : 1;
          const coneH = Math.min(4.0, origT * 0.7); // Increased depth for visibility
          const mat = getMarkerMat('cs_cone', () => new THREE.MeshStandardMaterial({
            color: 0x7c3aed, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide,
            emissive: 0x7c3aed, emissiveIntensity: 2.5 // Increased glow
          }));
          const m = new THREE.Mesh(new THREE.CylinderGeometry(mmDia / 2 * 1.5, mmDia / 2, coneH, 32, 1, true), mat);
          const csPos = pos.clone().add(axis.clone().multiplyScalar(faceSign * (origT * 0.5)));
          m.position.copy(csPos.clone().add(axis.clone().multiplyScalar(-faceSign * coneH / 2)));
          m.lookAt(m.position.clone().add(axis)); m.rotateX(Math.PI / 2);
          m.isHardwareMarker = true; markers.push(m);
        }
      });
      return markers;
    };

    const buildNode = (node, parentGroup, parentWorldP0 = new THREE.Vector3(0, 0, 0)) => {
      const faceId = node.id;
      const jointGroup = new THREE.Group();
      jointGroup.name = `bend_${faceId}`;
      let currentWorldP0 = parentWorldP0;

      if (node.bendAxis) {
        const p0 = new THREE.Vector3(...node.bendAxis.p0);
        const p1 = new THREE.Vector3(...node.bendAxis.p1);
        const axis = new THREE.Vector3().subVectors(p1, p0).normalize();
        jointGroup.position.copy(p0).sub(parentWorldP0);
        currentWorldP0 = p0;
        jointGroup.userData = { axis, initialAngle: node.initialAngle || 0, faceId, parentId: node.parentId };
        const mesh = makeMesh(faceId, p0);
        if (mesh) jointGroup.add(mesh);
        (node.extraFaceIds || []).forEach(eid => { const em = makeMesh(eid, p0); if (em) jointGroup.add(em); });

        // Add Markers
        getMarkersForFace(faceId, p0).forEach(m => jointGroup.add(m));
      } else {
        jointGroup.position.set(0, 0, 0);
        const mesh = makeMesh(faceId, parentWorldP0);
        if (mesh) jointGroup.add(mesh);
        (node.extraFaceIds || []).forEach(eid => { const em = makeMesh(eid, parentWorldP0); if (em) jointGroup.add(em); });

        // Add Markers
        getMarkersForFace(faceId, parentWorldP0).forEach(m => jointGroup.add(m));
      }

      parentGroup.add(jointGroup);
      groupsRef.current[faceId] = jointGroup;
      if (node.children) { node.children.forEach(child => buildNode(child, jointGroup, currentWorldP0)); }
    };

    const rootContainer = new THREE.Group();
    if (bendTree) {
      buildNode(bendTree, rootContainer, new THREE.Vector3(0, 0, 0));
    } else if (faceMeshes) {
      // Fallback: Just render all faces if no tree is provided (flat parts)
      Object.keys(faceMeshes).forEach(faceId => {
        const mesh = makeMesh(faceId, new THREE.Vector3(0, 0, 0));
        if (mesh) {
          const jointGroup = new THREE.Group();
          jointGroup.name = `bend_${faceId}`;
          jointGroup.add(mesh);
          rootContainer.add(jointGroup);
          groupsRef.current[faceId] = jointGroup;
          getMarkersForFace(faceId, new THREE.Vector3(0, 0, 0)).forEach(m => jointGroup.add(m));
        }
      });
    }
    modelGroupRef.current = rootContainer;
    scene.add(rootContainer);

    const box = new THREE.Box3().setFromObject(rootContainer);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const center = box.getCenter(new THREE.Vector3());
      const dist = maxDim * 1.5;
      if (cameraRef.current) {
        cameraRef.current.position.set(center.x + dist, center.y + dist, center.z + dist);
        cameraRef.current.lookAt(center);
        cameraRef.current.updateProjectionMatrix();
      }
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
      setRebuildId(prev => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bendTree, faceMeshes, detectedHoles, onHoleClick, isTappingActive, isHardwareActive, isCountersinkingActive, selectedTaps, selectedHardware, selectedCountersinks, backendData]);

  // ── Update Highlights ────────────────────────────
  useEffect(() => {
    const colorStr = (typeof activeFinishColor === 'string') ? activeFinishColor : (activeFinishColor?.hex || '');
    const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : 0xc8cdd6;
    Object.entries(groupsRef.current).forEach(([faceId, group]) => {
      const active = String(faceId) === String(activeBendId);
      group.traverse(obj => {
        if (obj.isMesh && !obj.isHardwareMarker) {
          obj.material.color.set(active ? 0x3b82f6 : finishHex);
          obj.material.emissive.set(active ? 0x1d4ed8 : 0x000000);
          obj.material.roughness = isFinishPowderCoating ? 0.7 : 0.35;
          obj.material.metalness = isFinishPowderCoating ? 0.1 : 0.65;
        }
      });
    });
  }, [activeBendId, activeFinishColor, isFinishPowderCoating, rebuildId]);

  // ── Update Rotations Live ─────────────────────────────────────
  useEffect(() => {
    Object.entries(selectedBends).forEach(([id, config]) => {
      const group = groupsRef.current[id];
      if (!group || !group.userData.axis) return;
      const axis = group.userData.axis;
      const initialRad = (group.userData.initialAngle || 0) * (Math.PI / 180);
      const targetRad = config.angle * (Math.PI / 180);
      const sign = config.direction === 'down' ? -1 : 1;
      const angleRad = sign * targetRad - initialRad;
      group.setRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, angleRad));
    });
  }, [selectedBends, rebuildId]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export default React.memo(HierarchicalProjectViewer);

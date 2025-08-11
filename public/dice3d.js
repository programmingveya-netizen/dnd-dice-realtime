// Lightweight 3D kostky (Three.js + Tween.js), bez fyziky – ideální pro free hosting
// Podporované tvary: d4, d6, d8, d10 (přiblížení), d12, d20, d100 (přiblížení)
window.Dice3D = (() => {
  let scene, camera, renderer, container;
  const active = [];

  function init(containerId = 'dice3d') {
    container = document.getElementById(containerId);
    if (!container || !window.THREE) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); // šetrné k výkonu
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.2, 4.2);

    // světla
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.0); d1.position.set(4, 6, 5); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.35); d2.position.set(-3, 3, -2); scene.add(d2);

    // „podlaha“
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10),
      new THREE.MeshStandardMaterial({ color: 0x0e141b, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    window.addEventListener('resize', resize);
    resize();
    animate();
  }

  function resize() {
    if (!renderer || !camera || !container) return;
    const w = container.clientWidth || 300;
    const h = container.clientHeight || Math.round(w * 9 / 16);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function palette(sides) {
    return ({
      4: 0x6b8cff, 6: 0x7bf1a8, 8: 0xffcf6e,
      10: 0xff8db7, 12: 0x9aa4ff, 20: 0x3aa2ff, 100: 0xeb9fff
    })[sides] || 0xbad7ff;
  }

  function geometryForSides(sides) {
    const r = 0.6;
    switch (sides) {
      case 4:  return new THREE.TetrahedronGeometry(r, 0);
      case 6:  return new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2);
      case 8:  return new THREE.OctahedronGeometry(r, 0);
      case 10: return new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.2, 10, 1, true); // přiblížení
      case 12: return new THREE.DodecahedronGeometry(r, 0);
      case 20: return new THREE.IcosahedronGeometry(r, 0);
      case 100:return new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.2, 10, 1, true); /*

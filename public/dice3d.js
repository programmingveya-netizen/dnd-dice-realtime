// Lightweight 3D kostky (Three.js + Tween.js), bez fyziky – ideální pro free hosting
// Podporované tvary: d4, d6, d8, d10 (přiblížení), d12, d20, d100 (přiblížení)
window.Dice3D = (() => {
  let scene, camera, renderer, container;
  const active = [];

  function init(containerId = 'dice3d') {
    container = document.getElementById(containerId);
    if (!container || !window.THREE) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x0b0f14, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
// o něco výš a dál, ať není spodek oříznutý
camera.position.set(0, 3.2, 5.2);
camera.lookAt(0, 0.8, 0);


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
floor.position.y = -0.10;  // NOVÉ – lehce sníží stůl, ať je víc místa dole
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
      case 100:return new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.2, 10, 1, true); // přiblížení
      default: return new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2);
    }
  }

  function createTextSprite(text) {
    const size = 128;
    const cnv = document.createElement('canvas'); cnv.width = size; cnv.height = size;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(size/2, size/2, size/2-6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(text), size/2, size/2);
    const tex = new THREE.CanvasTexture(cnv); tex.anisotropy = 2;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(0.6, 0.6, 1);
    return spr;
  }

  function spawnDie(sides, value, i, total) {
    const geom = geometryForSides(sides);
    const mat = new THREE.MeshStandardMaterial({
      color: palette(sides), roughness: 0.5, metalness: 0.25, envMapIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geom, mat);

    // rozložení do mřížky
    const cols = Math.min(3, total), rows = Math.ceil(total / cols);
    const col = i % cols, row = Math.floor(i / cols);
    const spreadX = 1.1, spreadZ = 1.1;
    const x = (col - (cols - 1)/2) * spreadX + (Math.random() - .5) * .1;
    const z = (row - (rows - 1)/2) * spreadZ + (Math.random() - .5) * .1;

    mesh.position.set(x, 2 + Math.random() * 0.6, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    // číslo jako lehký „badge“
    const label = createTextSprite(value);
    label.position.set(0, 0.9, 0);
    mesh.add(label);
    mesh.userData.label = label;

    scene.add(mesh);
    active.push(mesh);
    // udržuj scénu lehkou
    if (active.length > 18) {
      const old = active.shift();
      scene.remove(old);
      old.traverse(o => {
        if (o.isSprite && o.material && o.material.map) o.material.map.dispose();
        if (o.material && o.material.map) o.material.map.dispose();
        if (o.material) o.material.dispose();
        if (o.geometry) o.geometry.dispose();
      });
    }

    // jednoduchý pád + rotace (Tween.js)
    if (window.TWEEN) {
      const duration = 900 + Math.random() * 300;
      const st = { y: mesh.position.y, r1: mesh.rotation.x, r2: mesh.rotation.y, r3: mesh.rotation.z };
      const ed = { y: 0.65 + Math.random() * 0.06, r1: st.r1 + Math.PI * 2, r2: st.r2 + Math.PI * 2, r3: st.r3 + Math.PI * 2 };

      new TWEEN.Tween(st)
        .to(ed, duration)
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
          mesh.position.y = st.y;
          mesh.rotation.set(st.r1, st.r2, st.r3);
        })
        .onComplete(() => {
          const bounce = { y: mesh.position.y };
          new TWEEN.Tween(bounce).to({ y: ed.y - 0.05 }, 200)
            .yoyo(true).repeat(1).easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => { mesh.position.y = bounce.y; })
            .start();

          if (label.material.opacity !== undefined) {
            label.material.opacity = 0;
            new TWEEN.Tween(label.material).to({ opacity: 1 }, 220).start();
          }
        })
        .start();
    }

    // po 5 s vyfadeovat, ať scéna nezarůstá
    setTimeout(() => {
      if (!mesh.parent) return;
      if (window.TWEEN) {
        new TWEEN.Tween(mesh.scale)
          .to({ x: 0.001, y: 0.001, z: 0.001 }, 300)
          .onComplete(() => { if (mesh.parent) scene.remove(mesh); })
          .start();
      } else {
        scene.remove(mesh);
      }
    }, 5000);
  }

  function roll(sides, values) {
    if (!renderer || !scene) return;
    const count = Math.min(values.length, 10);
    for (let i = 0; i < count; i++) spawnDie(sides, values[i], i, count);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (window.TWEEN) TWEEN.update();
    // labely vždy směrem ke kameře
    active.forEach(m => { if (m.userData.label) m.userData.label.lookAt(camera.position); });
    renderer.render(scene, camera);
  }

  return { init, roll };
})();

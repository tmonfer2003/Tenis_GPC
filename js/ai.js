/**
 * IA fiable: golpea más y en el saque no toca la red.
 * Lado IA: Z negativo → golpea hacia +Z.
 */
class Ai {
  constructor () {
    this.speed = 7.8;

    this.mesh = new THREE.Group();
    this.racket = null;

    this.homePosition = new THREE.Vector3(0, 0, -court.length / 2 - 0.8);
    this.guardLineZ  = -court.length / 2;

    this.state = 'idle';
    this._thinkCooldown = 0;
    this._thinkEvery = 0.08;

    this._targetX = 0;
    this._targetZ = this.guardLineZ;

    // ventana de impacto
    this._hitRadius = 2.6;
    this._hitMinY   = 0.35;
    this._hitMaxY   = 3.2;

    // tiro
    this.BASE_SPEED   = 15.2;
    this.MAX_SPEED    = 23.2;
    this.JITTER_DIR   = 0.06;
    this.JITTER_SPEED = 0.06;
    this.CORNER_BIAS  = 0.58;

    // colchón sobre la red
    this.NET_MARGIN = 0.60;
  }

  load (scene) {
  // Coloca el contenedor de la IA en su posición y añádelo a escena
  this.mesh.position.copy(this.homePosition);
  scene.add(this.mesh);

  const loader = new THREE.GLTFLoader();
  loader.load('assets/models/Matt_Ra.glb', (gltf) => {
    const model = gltf.scene;
    this._model = model;

    // Sombras y materiales OK
    model.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    // (Opcional) Auto-escalar a ~1.75 m y apoyar pies en y=0
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const height = Math.max(size.y || 1, 1e-3);
    const scale = 2.25 / height; // ajusta si lo ves grande/pequeño
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;

    // Orientación: si mira al revés, prueba 0 o ±Math.PI/2
    model.rotation.y = -Math.PI/2;

    this.mesh.add(model);

    // Si el GLB trae animaciones (idle, etc.)
    if (gltf.animations && gltf.animations.length) {
      this._mixer = new THREE.AnimationMixer(model);
      const idle = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || gltf.animations[0];
      if (idle) this._mixer.clipAction(idle).play();
    }

    // === Localiza el nodo de la raqueta dentro del GLB ===
    // 1) intenta por nombre
    let racket =
      model.getObjectByName('Racket') ||
      model.getObjectByName('raqueta') ||
      model.getObjectByProperty('name', 'racket');

    // 2) si no lo encuentra por nombre, heurística por forma/nombre
    if (!racket) {
      model.traverse(o => {
        if (o.isMesh && /racket|raqueta|tennis/i.test(o.name)) racket = o;
      });
    }
    // 3) si aún no, elige la malla más "alargada" (suele ser la raqueta)
    if (!racket) {
      let best = null, bestRatio = 0;
      model.traverse(o => {
        if (!o.isMesh) return;
        const b = new THREE.Box3().setFromObject(o);
        const s = new THREE.Vector3(); b.getSize(s);
        const ratio = Math.max(s.x, s.y, s.z) / Math.max(0.0001, Math.min(s.x, s.y, s.z));
        if (ratio > bestRatio) { bestRatio = ratio; best = o; }
      });
      racket = best;
    }

    // Si no pudo encontrarla, crea un ancla en la "mano" como fallback
    if (!racket) {
      const anchor = new THREE.Object3D();
      anchor.position.set(0.30, 1.05, 0.20); // ajusta fino si hiciera falta
      this.mesh.add(anchor);
      this.racket = anchor;
    } else {
      // Usar la raqueta real del GLB como referencia de impacto
      this.racket = racket;
    }
  });
}

  // predicción simple para llegar bien al impacto
  _think(ball) {
    if (!ball?.mesh) {
      this._targetX = 0;
      this._targetZ = this.guardLineZ;
      this.state = 'idle';
      return;
    }

    const v = ball.velocity;
    if (v.z < 0) {
      const zPlane = this.guardLineZ + 1.0;
      const dz = zPlane - ball.mesh.position.z;
      const vz = v.z;

      if (vz !== 0) {
        const t = dz / vz;
        if (t > 0 && t < 2.8) {
          const xPred = ball.mesh.position.x + v.x * t;
          const yPred = ball.mesh.position.y + v.y * t + 0.5 * ball.gravity * t * t;

          if (yPred > this._hitMinY && yPred < this._hitMaxY) {
            this._targetX = THREE.MathUtils.clamp(xPred, -court.width * 0.45, court.width * 0.45);
            this._targetZ = this.guardLineZ;
            this.state = 'tracking';
            return;
          }
        }
      }
    }

    this._targetX = THREE.MathUtils.clamp(ball.mesh.position.x * 0.5, -1.5, 1.5);
    this._targetZ = this.guardLineZ;
    this.state = 'idle';
  }

  update(deltaTime, ball, gameState) {
    this._thinkCooldown -= deltaTime;
    if (this._thinkCooldown <= 0) {
      this._think(ball);
      this._thinkCooldown = this._thinkEvery;
    }

    const toTarget = new THREE.Vector3(this._targetX - this.mesh.position.x, 0, this._targetZ - this.mesh.position.z);
    const dist = toTarget.length();
    if (dist > 0.001) {
      toTarget.normalize().multiplyScalar(this.speed * deltaTime);
      if (toTarget.length() > dist) toTarget.setLength(dist);
      this.mesh.position.add(toTarget);
    }

    if (ball?.mesh && gameState === 'RALLY') {
      const d = this.mesh.position.distanceTo(ball.mesh.position);
      const y = ball.mesh.position.y;
      const vaHaciaIA = ball.velocity.z < 0;

      // doy margen para no “perder” golpes por milímetros
      if (vaHaciaIA && d < this._hitRadius && y > this._hitMinY * 0.9 && y < this._hitMaxY * 1.05) {
        this.swing(ball);
      }
    }

    if (this.state === 'recovering') {
      this._targetZ = this.guardLineZ;
    }
  }

  // tiro balístico con doble comprobación de altura en la red
  swing(ball) {
    this.state = 'recovering';

    const singlesHalf = 8.23 * 0.5;
    const side = Math.random() < 0.5 ? -1 : 1;
    const wantCorner = Math.random() < this.CORNER_BIAS;

    let aimX = wantCorner
      ? side * THREE.MathUtils.randFloat(singlesHalf * 0.55, singlesHalf * 0.95)
      : THREE.MathUtils.randFloatSpread(singlesHalf * 0.95);

    let aimZ = THREE.MathUtils.randFloat(6.5, court.length * 0.5 - 2.0);

    const from = this.racket
      ? this.racket.localToWorld(new THREE.Vector3(0, 0, 0.55))
      : ball.mesh.position.clone();

    const target = new THREE.Vector3(aimX, 0.06, Math.abs(aimZ));
    const dir = target.clone().sub(from);
    const horiz = new THREE.Vector3(dir.x, 0, dir.z);
    const dist = horiz.length();
    if (dist < 1e-3) return;

    let vxz = THREE.MathUtils.clamp(this.BASE_SPEED + 0.6 * dist, this.BASE_SPEED, this.MAX_SPEED);
    vxz *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_SPEED);

    const dirH = horiz.normalize();
    let vx = dirH.x * vxz;
    let vz = dirH.z * vxz;
    vx *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_DIR);
    vz *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_DIR);
    if (vz <= 0) vz = Math.abs(vz) + 0.3;

    const g = ball.gravity;
    const T = dist / vxz;

    let vy = (target.y - from.y - 0.5 * g * T * T) / T;

    const tNet = (0 - from.z) / vz;
    if (tNet > 0 && isFinite(tNet)) {
      const yNeeded = court.netHeight + this.NET_MARGIN;
      const vy_net = (yNeeded - from.y - 0.5 * g * tNet * tNet) / tNet + 0.14;
      vy = Math.max(vy, vy_net, 3.3);

      // segunda comprobación por si el jitter deja corto
      const yNetCheck = from.y + vy * tNet + 0.5 * g * tNet * tNet;
      if (yNetCheck < yNeeded) {
        vy += (yNeeded - yNetCheck) / tNet + 0.06;
      }
    } else {
      vy = Math.max(vy, 3.3);
    }

    ball.velocity.set(vx, vy, vz);
    ball.lastHitBy = 'ai';
    ball.bounceCount = 0;

    const initialZ = this.mesh.position.z;
    const backOffset = -0.28;
    const duration = 0.16;
    let elapsed = 0;
    const animateBack = () => {
      const t = Math.min((elapsed += 0.016) / duration, 1);
      this.mesh.position.z = THREE.MathUtils.lerp(initialZ, initialZ + backOffset, t);
      if (t < 1) requestAnimationFrame(animateBack);
    };
    requestAnimationFrame(animateBack);
  }

  // saque con garantía fuerte de pasar la red
  serve(ball) {
    const lateral = Math.random() < 0.5 ? -2.0 : 2.0;
    this.mesh.position.set(lateral, 0, this.homePosition.z);

    // lanzo un poco más alto y delante
    ball.mesh.position.set(this.mesh.position.x + 0.25, 1.20, this.mesh.position.z + 0.65);
    ball.velocity.set(0, 7.1, 0);
    ball.lastHitBy = 'ai';
    ball.bounceCount = 0;

    setTimeout(() => {
      const g = ball.gravity;

      // cuadro de saque del jugador
      const targetZ = court.length / 2 - 5.2;
      const targetX = (lateral < 0) ? 2.1 : -2.1;

      const start = ball.mesh.position.clone();
      const toTarget = new THREE.Vector3(targetX - start.x, 0, targetZ - start.z);
      const distH = toTarget.length();
      const dirH  = toTarget.normalize();

      // más velocidad horizontal → menos tiempo a la red
      const vxz = Math.max(19.5, Math.min(21.5, distH / 1.0));
      let vx = dirH.x * vxz;
      let vz = dirH.z * vxz;

      // tiempo al plano de red
      const tNet = (0 - start.z) / vz;

      // altura objetivo en la red (colchón alto)
      const yNeeded = court.netHeight + 0.90;

      // vy para (1) pasar net y (2) caer dentro ~tiempo de vuelo T
      const T = distH / vxz;
      let vy_land = (0.06 - start.y - 0.5 * g * T * T) / T;
      let vy = vy_land;

      if (tNet > 0 && isFinite(tNet)) {
        const vy_net = (yNeeded - start.y - 0.5 * g * tNet * tNet) / tNet + 0.18;
        vy = Math.max(vy, vy_net, 3.8);
        // verificación inmediata
        const yNetCheck = start.y + vy * tNet + 0.5 * g * tNet * tNet;
        if (yNetCheck < yNeeded) vy += (yNeeded - yNetCheck) / tNet + 0.10;
      } else {
        vy = Math.max(vy, 3.8);
      }

      // jitter leve (no tocamos la vertical)
      vx *= 1 + THREE.MathUtils.randFloatSpread(0.02);
      vz *= 1 + THREE.MathUtils.randFloatSpread(0.02);

      ball.velocity.set(vx, vy, vz);
      ball.lastHitBy = 'ai';
      ball.bounceCount = 0;

      // “guardia” 1 frame: recalculo y subo vy si hiciera falta
      setTimeout(() => {
        const pos = ball.mesh.position.clone();
        const vz2 = ball.velocity.z;
        const tNet2 = (0 - pos.z) / vz2;
        if (tNet2 > 0 && isFinite(tNet2)) {
          const yNeed2 = court.netHeight + 0.85;
          const yPred2 = pos.y + ball.velocity.y * tNet2 + 0.5 * g * tNet2 * tNet2;
          if (yPred2 < yNeed2) {
            ball.velocity.y += (yNeed2 - yPred2) / tNet2 + 0.08; // pequeño empuje extra
          }
        }
      }, 0);
    }, 480);
  }
}

const ai = new Ai();

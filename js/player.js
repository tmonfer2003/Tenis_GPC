class Player {
  constructor() {
    this.racket = null;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.speed = 8.0;
    this.move = { forward: false, backward: false, left: false, right: false };

    // ventana de golpeo (las uso en la detección)
    this.HIT_RADIUS = 2.6;
    this.HIT_MIN_Y  = 0.15;
    this.HIT_MAX_Y  = 3.0;
    this.LOOKAHEAD  = 0.18;

    // Asistencia de puntería (0 = sin ayuda, 1 = muy guiado)
    this.AIM_ASSIST = 0.20;
    // Probabilidad de que el tiro se vaya fuera a propósito
    this.OUT_PROB = 0.10;
    // Cuánto puede pasarse de la línea de individuales cuando toca irse fuera
    this.OUT_EXCESS = 0.20;
    this.INVERT_LR = false;

    this.isAnimating = false;

    // postura natural de la raqueta
    this.originalRacketPos = new THREE.Vector3(0, -0.2, -0.65);
    this.originalRacketRot = new THREE.Euler(0, Math.PI, 0.4);

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup',  this.onKeyUp.bind(this));

    window.player = this;
  }

  setRacket(racket) {
    this.racket = racket;
    this.racket.position.copy(this.originalRacketPos);
    this.racket.rotation.copy(this.originalRacketRot);
  }

  onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.move.forward  = true; break;
      case 'KeyA': this.move.left     = true; break;
      case 'KeyS': this.move.backward = true; break;
      case 'KeyD': this.move.right    = true; break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.move.forward  = false; break;
      case 'KeyA': this.move.left     = false; break;
      case 'KeyS': this.move.backward = false; break;
      case 'KeyD': this.move.right    = false; break;
    }
  }

  update(deltaTime) {

    this.velocity.x -= this.velocity.x * 10.0 * deltaTime;
    this.velocity.z -= this.velocity.z * 10.0 * deltaTime;
    this.direction.z = Number(this.move.forward) - Number(this.move.backward);
    this.direction.x = Number(this.move.right)   - Number(this.move.left);
    this.direction.normalize();

    if (this.move.forward || this.move.backward)
      this.velocity.z -= this.direction.z * this.speed * 10.0 * deltaTime;
    if (this.move.left || this.move.right)
      this.velocity.x -= this.direction.x * this.speed * 10.0 * deltaTime;

    controls.moveRight(-this.velocity.x * deltaTime);
    controls.moveForward(-this.velocity.z * deltaTime);

    const limit = 25;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limit, limit);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 0.5, limit);
  }

  tossBall(ball, camera) {
    const tossPosition = new THREE.Vector3(0.2, 0.5, -0.8);
    tossPosition.applyMatrix4(camera.matrixWorld);
    ball.mesh.position.copy(tossPosition);
    ball.velocity.set(0, 8, 0);
  }

  swing(ball, camera, isServe) {
    if (this.isAnimating || !this.racket || !ball?.mesh) return;
    this.isAnimating = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        gsap.to(this.racket.position, {
          duration: 0.4,
          x: this.originalRacketPos.x,
          y: this.originalRacketPos.y,
          z: this.originalRacketPos.z
        });
        gsap.to(this.racket.rotation, {
          duration: 0.4,
          x: this.originalRacketRot.x,
          y: this.originalRacketRot.y,
          z: this.originalRacketRot.z
        });
      }
    });

    tl.to(this.racket.position, { duration: 0.15, x: 0.6, y: -0.3, z: -0.5 })
      .to(this.racket.rotation, { duration: 0.2, y: Math.PI * 1.5, z: -0.2 }, '<');

    tl.to(this.racket.position, { duration: 0.15, x: 0, y: -0.2, z: -0.9 })
      .to(this.racket.rotation, { duration: 0.15, y: Math.PI * 0.9, z: 0.4 }, '<')
      .call(() => {
        const WINDOW_MS = 160;
        let hit = false;
        const t0 = performance.now();

        const tryHit = () => {
          if (hit) return;
          const now = performance.now();
          if (now - t0 > WINDOW_MS) return;
          const impact = this.racket.localToWorld(new THREE.Vector3(0, 0, 0.55));
          const bNow  = ball.mesh.position.clone();
          const bPred = bNow.clone().addScaledVector(ball.velocity, this.LOOKAHEAD);

          const yOK     = bPred.y > this.HIT_MIN_Y && bPred.y < this.HIT_MAX_Y;
          const dNow    = bNow.distanceTo(impact);
          const dPred   = bPred.distanceTo(impact);
          const inRange = dNow < this.HIT_RADIUS || dPred < this.HIT_RADIUS;

          if (yOK && inRange) {
          
            const from = impact.clone();
            ball.mesh.position.lerp(from, 0.4);
            const singlesHalf = (court.singlesHalf ?? 8.23 * 0.5);
            const fwd = new THREE.Vector3();
            camera.getWorldDirection(fwd);
            fwd.y = 0;
            if (this.INVERT_LR) fwd.x = -fwd.x;
            const len2 = fwd.lengthSq();
            if (len2 < 1e-6) {
              fwd.set(0, 0, -1);
            } else {
              fwd.normalize();
            }

            if (fwd.z > -0.05) {
              const x = THREE.MathUtils.clamp(fwd.x, -0.99, 0.99);
              const z = -Math.sqrt(1 - x * x);
              fwd.set(x, 0, z);
            }

            const minDepth = 6.0;
            const maxDepth = Math.max(8.0, court.length * 0.5 - 2.5);
            let aimZ;
            if (isServe) {

              aimZ = -THREE.MathUtils.randFloat(5.3, 7.4);
            } else {
              const centrality = 1 - Math.abs(fwd.x);
              const depthBias = THREE.MathUtils.clamp(0.6 + 0.35 * centrality, 0, 1);
              aimZ = -THREE.MathUtils.lerp(minDepth, maxDepth, depthBias);
              aimZ += THREE.MathUtils.randFloatSpread(0.6);
            }

            const denom = fwd.z;
            let tRay = (aimZ - from.z) / denom;
            if (!isFinite(tRay) || tRay < 0.2) tRay = 6.0;
            let aimX = from.x + fwd.x * tRay;

            aimX += THREE.MathUtils.randFloatSpread(singlesHalf * 0.12);
            aimX = THREE.MathUtils.lerp(aimX, 0, this.AIM_ASSIST);

            if (Math.random() < this.OUT_PROB) {
              const s = Math.sign(aimX) || (Math.random() < 0.5 ? 1 : -1);
              const over = THREE.MathUtils.randFloat(
                singlesHalf * 1.01,
                singlesHalf * (1.00 + this.OUT_EXCESS)
              );
              aimX = s * over;
            }


            aimX = THREE.MathUtils.clamp(
              aimX,
              -singlesHalf * (1.00 + this.OUT_EXCESS),
              +singlesHalf * (1.00 + this.OUT_EXCESS)
            );


            const target = new THREE.Vector3(aimX, 0.06, aimZ);
            const dir    = target.clone().sub(from);
            const horiz  = new THREE.Vector3(dir.x, 0, dir.z);
            const dist   = horiz.length();
            if (dist < 1e-3) return;

            let BASE_SPEED = 14.5;
            let MAX_SPEED  = 22.5;
            let vxz = THREE.MathUtils.clamp(BASE_SPEED + 0.58 * dist, BASE_SPEED, MAX_SPEED);
            vxz *= 1 + THREE.MathUtils.randFloatSpread(0.08);

            const dirH = horiz.normalize();
            let vx = dirH.x * vxz;
            let vz = dirH.z * vxz;
            if (vz >= 0) vz = -Math.abs(vz) - 0.2;

            const g = ball.gravity;
            const T = dist / vxz;

            let vy_land = (target.y - from.y - 0.5 * g * T * T) / T;

            const NET_CLEAR = court.netHeight + 0.55;
            const tNet = (0 - from.z) / vz;
            let vy = vy_land;
            if (tNet > 0 && isFinite(tNet)) {
              const vy_net = (NET_CLEAR - from.y - 0.5 * g * tNet * tNet) / tNet + 0.10;
              vy = Math.max(vy_land, vy_net, isServe ? 2.4 : 3.2);

              const yNetCheck = from.y + vy * tNet + 0.5 * g * tNet * tNet;
              if (yNetCheck < NET_CLEAR) {
                vy += (NET_CLEAR - yNetCheck) / tNet + 0.05;
              }
            } else {
              vy = Math.max(vy_land, isServe ? 2.4 : 3.2);
            }

            ball.velocity.set(vx, vy, vz);
            ball.lastHitBy = 'player';
            ball.bounceCount = 0;

            hit = true;
            return;
          }

          requestAnimationFrame(tryHit);
        };

        requestAnimationFrame(tryHit);
      }, null, '-=0.08');

    tl.to(this.racket.position, { duration: 0.3, x: -0.4, y: -0.1, z: -0.5 })
      .to(this.racket.rotation, { duration: 0.3, y: Math.PI * 0.6, z: 1.0 }, '<');
  }
}

const player = new Player();

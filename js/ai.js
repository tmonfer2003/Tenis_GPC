class Ai {
  constructor () {

    this.speed = 7.8;
    this.mesh = new THREE.Group();
    this.racket = null;

    // Posición inicial
    this.homePosition = new THREE.Vector3(0, 0, -court.length / 2 - 0.8);
    this.guardLineZ  = -court.length / 2;

    //Estado y pensamiento 
    this.state = 'idle'; //'idle', 'tracking', 'recovering'
    this._thinkCooldown = 0;
    this._thinkEvery = 0.08;

    this._targetX = 0;
    this._targetZ = this.guardLineZ;

    //Ventana de golpeo que acepta como golpe
    this._hitRadius = 2.6;
    this._hitMinY   = 0.35;
    this._hitMaxY   = 3.2;

    //Parámetros de golpeo
    this.BASE_SPEED   = 15.2;
    this.MAX_SPEED    = 23.2;
    this.JITTER_DIR   = 0.06;
    this.JITTER_SPEED = 0.06;
    this.CORNER_BIAS  = 0.58;

    //Margen extra para que supere la red
    this.NET_MARGIN = 0.60;

    this.MISS_PROB = 0.15;
    this.NET_ERROR_PROB = 0.06;
  }

  load (scene) {
    this.mesh.position.copy(this.homePosition);
    scene.add(this.mesh);
    //Carga del modelo Matt
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/Matt_Ra.glb', (gltf) => {
      const model = gltf.scene;
      this._model = model;

      // Sombreado
      model.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      // Escalar y colocar el modelo de Matt
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const height = Math.max(size.y || 1, 1e-3);
      const scale = 2.25 / height;
      model.scale.setScalar(scale);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y -= box2.min.y;
      model.rotation.y = -Math.PI/2;

      this.mesh.add(model);

      //De momento no he conseguido ponerle animaciones porque al usar el modelo con la raqueta y el mii juntos me da error al animar
      //Pendiente de mejorar
    
      if (gltf.animations && gltf.animations.length) {
        this._mixer = new THREE.AnimationMixer(model);
        const idle = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || gltf.animations[0];
        if (idle) this._mixer.clipAction(idle).play();
      }

      const racket = model.getObjectByName('racket');
      if (racket) this.racket = racket;
    });
  }

  //Pensamiento de la IA
  _think(ball) {
    //Si no hay pelota, vuelve a la posición de guardia
    if (!ball?.mesh) {
      this._targetX = 0;
      this._targetZ = this.guardLineZ;
      this.state = 'idle';
      return;
    }

    //Si la pelota va hacia el jugador, intenta predecir el punto 
    const v = ball.velocity;
    if (v.z < 0) {
      const zPlane = this.guardLineZ + 1.0;
      const dz = zPlane - ball.mesh.position.z;
      const vz = v.z;

      if (vz !== 0) {
        const t = dz / vz;
        if (t > 0 && t < 2.8) { //Solo si esta cerca
          const xPred = ball.mesh.position.x + v.x * t;
          const yPred = ball.mesh.position.y + v.y * t + 0.5 * ball.gravity * t * t;
          
          //Si la altura prevista es golpeable va hacia allí
          if (yPred > this._hitMinY && yPred < this._hitMaxY) {
            this._targetX = THREE.MathUtils.clamp(xPred, -court.width * 0.45, court.width * 0.45);
            this._targetZ = this.guardLineZ;
            this.state = 'tracking';
            return;
          }
        }
      }
    }
    //Si no hay tiro inminente, vuelve a la posición de guardia
    this._targetX = THREE.MathUtils.clamp(ball.mesh.position.x * 0.5, -1.5, 1.5);
    this._targetZ = this.guardLineZ;
    this.state = 'idle';
  }
 
  //Actualizacion por frame
  update(deltaTime, ball, gameState) {
    this._thinkCooldown -= deltaTime;
    if (this._thinkCooldown <= 0) {
      this._think(ball);
      this._thinkCooldown = this._thinkEvery;
    }
    // Se mueve hacia el objetivo con velocidad limitad ay sin sobrepasarse
    const toTarget = new THREE.Vector3(this._targetX - this.mesh.position.x, 0, this._targetZ - this.mesh.position.z);
    const dist = toTarget.length();
    if (dist > 0.001) {
      toTarget.normalize().multiplyScalar(this.speed * deltaTime);
      if (toTarget.length() > dist) toTarget.setLength(dist);
      this.mesh.position.add(toTarget);
    }

    // Intenta golpear si la bola entra en su campo
    if (ball?.mesh && gameState === 'RALLY') {
      const d = this.mesh.position.distanceTo(ball.mesh.position);
      const y = ball.mesh.position.y;
      const vaHaciaIA = ball.velocity.z < 0;

      if (vaHaciaIA && d < this._hitRadius && y > this._hitMinY * 0.9 && y < this._hitMaxY * 1.05) {
        if (Math.random() < this.MISS_PROB) {
          this.state = 'recovering';
        } else {
          this.swing(ball);
        }
      }
    }

    //Tras golpear, vuelve
    if (this.state === 'recovering') {
      this._targetZ = this.guardLineZ;
    }
  }

  _applyNetClearance(from, vz, vyDesired, g, extraMargin, forceNetError = false) {
    const tNet = (0 - from.z) / vz;
    if (!(tNet > 0) || !isFinite(tNet)) return Math.max(vyDesired, 3.3);
    const yNeeded = court.netHeight + extraMargin;
    const vy_min = (yNeeded - from.y - 0.5 * g * tNet * tNet) / tNet;
    if (forceNetError) return vy_min - 0.12;
    return Math.max(vyDesired, vy_min + 0.12, 3.3);
  }

  // Golpe de la IA: calcula una dirección/velocidad para mandar la bola
  swing(ball) {
    this.state = 'recovering';

    // Mitad del ancho para individuales y decisión de apuntar a esquina
    const singlesHalf = 8.23 * 0.5;
    const side = Math.random() < 0.5 ? -1 : 1;
    const wantCorner = Math.random() < this.CORNER_BIAS;

    // X objetivo (más agresivo si busca esquina)
    let aimX = wantCorner
      ? side * THREE.MathUtils.randFloat(singlesHalf * 0.55, singlesHalf * 0.95)
      : THREE.MathUtils.randFloatSpread(singlesHalf * 0.95);

    // Z objetivo (profundidad en campo rival)
    let aimZ = THREE.MathUtils.randFloat(6.5, court.length * 0.5 - 2.0);

    // Punto de salida del tiro
    const from = this.racket
      ? this.racket.localToWorld(new THREE.Vector3(0, 0, 0.55))
      : ball.mesh.position.clone();

    // Objetivo bajo (para que bote cerca) con Z positiva (lado rival)
    const target = new THREE.Vector3(aimX, 0.06, Math.abs(aimZ));
    const dir = target.clone().sub(from);
    const horiz = new THREE.Vector3(dir.x, 0, dir.z);
    const dist = horiz.length();
    if (dist < 1e-3) return;

    // Magnitud horizontal según distancia, acotada y con un poco de ruido
    let vxz = THREE.MathUtils.clamp(this.BASE_SPEED + 0.6 * dist, this.BASE_SPEED, this.MAX_SPEED);
    vxz *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_SPEED);

    // Descompongo a X/Z y meto jitter direccional
    const dirH = horiz.normalize();
    let vx = dirH.x * vxz;
    let vz = dirH.z * vxz;
    vx *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_DIR);
    vz *= 1 + THREE.MathUtils.randFloatSpread(this.JITTER_DIR);
    if (vz <= 0) vz = Math.abs(vz) + 0.3; // me aseguro de que vaya hacia delante

    //Tiempo de vuelo horizontal y la vy para caer en el objetivo
    const g = ball.gravity;
    const T = dist / vxz;

    let vy = (target.y - from.y - 0.5 * g * T * T) / T;

    // Chequeo contra la red: sube vy si hace falta para superarla con margen (chocaba demasiado a menudo contra la red)
    vy = this._applyNetClearance(from, vz, vy, g, this.NET_MARGIN, Math.random() < this.NET_ERROR_PROB);

    ball.velocity.set(vx, vy, vz);
    ball.lastHitBy = 'ai';
    ball.bounceCount = 0;

    // Animación simple de retroceso al golpear
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

  //Saque de la IA
  serve(ball) {
    //Decidir lado del servicio
    const lateral = Math.random() < 0.5 ? -2.0 : 2.0;
    this.mesh.position.set(lateral, 0, this.homePosition.z);

    //Bola en la raqueta y lanzar hacia arriba
    ball.mesh.position.set(this.mesh.position.x + 0.25, 1.20, this.mesh.position.z + 0.65);
    ball.velocity.set(0, 7.1, 0);
    ball.lastHitBy = 'ai';
    ball.bounceCount = 0;

    //Tras un delay, golpea hacia el lado contrarip
    setTimeout(() => {
      const g = ball.gravity;

      //Objetivo del servicio
      const targetZ = court.length / 2 - 5.2;
      const targetX = (lateral < 0) ? 2.1 : -2.1;

      // Cálculo horizontal
      const start = ball.mesh.position.clone();
      const toTarget = new THREE.Vector3(targetX - start.x, 0, targetZ - start.z);
      const distH = toTarget.length();
      const dirH  = toTarget.normalize();
      const vxz = Math.max(19.5, Math.min(21.5, distH / 1.0));
      let vx = dirH.x * vxz;
      let vz = dirH.z * vxz;

      const T = distH / vxz;
      let vy = (0.06 - start.y - 0.5 * g * T * T) / T;

      //Variacion para que los saques sean diferentes
      vx *= 1 + THREE.MathUtils.randFloatSpread(0.02);
      vz *= 1 + THREE.MathUtils.randFloatSpread(0.02);

      vy = this._applyNetClearance(start, vz, vy, g, 0.90, Math.random() < this.NET_ERROR_PROB);

      ball.velocity.set(vx, vy, vz);
      ball.lastHitBy = 'ai';
      ball.bounceCount = 0;
    }, 480);
  }
}

const ai = new Ai();

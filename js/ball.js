/**
 * Pelota con física estable. Sin paredes.
 * Reglas:
 *  - Punto si cruza la red por debajo de su altura.
 *  - Punto si primer bote es fuera.
 *  - Punto si bota dos veces.
 */
class Ball {
  constructor () {
    this.radius = 0.08;
    this.gravity = -25;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.mesh = null;
    this.onPointScored = null;
    this.lastHitBy = null;     // 'player' | 'ai'
    this.bounceCount = 0;

    // nota: límite lateral para evitar derrapes
    this.maxSideSpeed = 16.0;
    // nota: en difícil, el tiro de la IA se atenúa menos (se siente más “pesado”)
    this.aiDragPerSec = () => (window.gameDifficulty === 'high' ? 0.93 : 0.85);
  }

  load (scene) {
    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update (deltaTime, player, ai, court, gameState, servingPlayer) {
    if (!this.mesh || gameState === 'POINT_OVER') return;

    // preparación de saque
    if (gameState === 'READY_TO_SERVE') {
      this.velocity.set(0, 0, 0);
      this.lastHitBy = servingPlayer;
      this.bounceCount = 0;

      if (servingPlayer === 'player') {
        const ballPosition = new THREE.Vector3(0.3, -0.5, 0.5);
        ballPosition.applyMatrix4(camera.matrixWorld);
        this.mesh.position.copy(ballPosition);
      } else {
        this.mesh.position.set(ai.mesh.position.x, 1.2, ai.mesh.position.z + 0.6);
      }
      return;
    }

    // estado previo (para cruzar plano de red con precisión subframe)
    const prevPos = this.mesh.position.clone();
    const vyPrev  = this.velocity.y;

    // gravedad
    this.velocity.y += this.gravity * deltaTime;

    // ligera atenuación de los tiros de la IA (más marcada en fácil)
    if (this.lastHitBy === 'ai') {
      const slow = Math.pow(this.aiDragPerSec(), deltaTime);
      this.velocity.x *= slow;
      this.velocity.z *= slow;
    }

    // integrar
    this.mesh.position.addScaledVector(this.velocity, deltaTime);

    // cruce de red (plano Z=0): si cruza por debajo → punto del rival
    const cruzoPlanoNet = prevPos.z * this.mesh.position.z < 0;
    if ((gameState === 'RALLY' || gameState === 'SERVING_TOSS' || gameState === 'AI_SERVING') && cruzoPlanoNet) {
      const alpha = Math.abs(prevPos.z) / Math.abs(this.mesh.position.z - prevPos.z); // fracción del frame
      const tNet  = THREE.MathUtils.clamp(alpha * deltaTime, 0, deltaTime);
      // y en el instante exacto de cruce (usando vy previo)
      const yNet  = prevPos.y + vyPrev * tNet + 0.5 * this.gravity * tNet * tNet;

      if (yNet < court.netHeight) {
        const winner = (this.lastHitBy === 'player') ? 'ai' : 'player';
        if (this.onPointScored) this.onPointScored(winner);
        return;
      }
    }

    // bote en el suelo
    if (this.mesh.position.y <= this.radius) {
      this.mesh.position.y = this.radius;
      this.velocity.y *= -0.82;     // coeficiente de restitución
      this.bounceCount++;

      // fuera (individuales) en el primer bote
      const singlesWidth = court.singlesWidth ?? 8.23;
      const halfLen      = court.length * 0.5;
      const outX         = Math.abs(this.mesh.position.x) > singlesWidth * 0.5;
      const outZ         = Math.abs(this.mesh.position.z) > halfLen;
      const fuera        = outX || outZ;

      if (fuera && this.bounceCount === 1) {
        const winner = (this.lastHitBy === 'player') ? 'ai' : 'player';
        if (this.onPointScored) this.onPointScored(winner);
        return;
      }

      // doble bote → punto para quien está al otro lado
      if (this.bounceCount >= 2) {
        const winner = (this.mesh.position.z > 0) ? 'ai' : 'player';
        if (this.onPointScored) this.onPointScored(winner);
        return;
      }
    }

    // límites de velocidad lateral
    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -this.maxSideSpeed, this.maxSideSpeed);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -this.maxSideSpeed, this.maxSideSpeed);
  }
}

const ball = new Ball();

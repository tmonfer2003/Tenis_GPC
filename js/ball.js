class Ball {
  constructor () {
    this.radius = 0.08;
    this.gravity = -25;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.mesh = null;
    this.onPointScored = null;
    this.lastHitBy = null;
    this.bounceCount = 0;
    this.maxSideSpeed = 16.0;
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

    // Cambio de color según quién golpeó por última vez
    this.mesh.material.color.set(this.lastHitBy === 'ai' ? 0xff0000 : 0xffff00);

    if (gameState === 'READY_TO_SERVE') {
      this.velocity.set(0, 0, 0);
      this.lastHitBy = servingPlayer;
      // Cambio de color según quien saca 
      this.mesh.material.color.set(servingPlayer === 'ai' ? 0xff0000 : 0xffff00);
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

    const prevPos = this.mesh.position.clone();
    const vyPrev  = this.velocity.y;

    this.velocity.y += this.gravity * deltaTime;

    if (this.lastHitBy === 'ai') {
      const slow = Math.pow(this.aiDragPerSec(), deltaTime);
      this.velocity.x *= slow;
      this.velocity.z *= slow;
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);

    const cruzoPlanoNet = prevPos.z * this.mesh.position.z < 0;
    if ((gameState === 'RALLY' || gameState === 'SERVING_TOSS' || gameState === 'AI_SERVING') && cruzoPlanoNet) {
      const alpha = Math.abs(prevPos.z) / Math.abs(this.mesh.position.z - prevPos.z);
      const tNet  = THREE.MathUtils.clamp(alpha * deltaTime, 0, deltaTime);
      const yNet  = prevPos.y + vyPrev * tNet + 0.5 * this.gravity * tNet * tNet;

      if (yNet < court.netHeight) {
        const winner = (this.lastHitBy === 'player') ? 'ai' : 'player';
        if (this.onPointScored) this.onPointScored(winner);
        return;
      }
    }

    if (this.mesh.position.y <= this.radius) {
      this.mesh.position.y = this.radius;
      this.velocity.y *= -0.82;
      this.bounceCount++;

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

      if (this.bounceCount >= 2) {
        const winner = (this.mesh.position.z > 0) ? 'ai' : 'player';
        if (this.onPointScored) this.onPointScored(winner);
        return;
      }
    }

    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -this.maxSideSpeed, this.maxSideSpeed);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -this.maxSideSpeed, this.maxSideSpeed);
  }
}

const ball = new Ball();

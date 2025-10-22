
class Umpire {
  constructor () {
    this.group = new THREE.Group ();
    this.head = null;
    this.body = null;
    
    this.initialY = 1.6;
    this.state = 'tracking';
    this.animationTimer = 0;
    this.lookTarget = new THREE.Vector3 ();
  }
  
  load (scene) {
    const darkMaterial = new THREE.MeshStandardMaterial ({color: 0x333333, roughness: 0.8});
    const bodyMaterial = new THREE.MeshStandardMaterial ({color: 0xADD8E6, roughness: 0.7});
    const headMaterial = new THREE.MeshStandardMaterial ({color: 0xFFE4C4, roughness: 0.7});
    
    //Silla del juez
    const chairSeat = new THREE.Mesh (new THREE.BoxGeometry (0.8, 0.2, 0.8), darkMaterial);
    chairSeat.position.set (0, 1.2, 0);
    chairSeat.castShadow = true;
    chairSeat.receiveShadow = true;
    
    const chairBack = new THREE.Mesh (new THREE.BoxGeometry (0.8, 0.8, 0.1), darkMaterial);
    chairBack.position.set (0, 1.8, - 0.35);
    chairBack.castShadow = true;
    chairBack.receiveShadow = true;
    
    const chairBase = new THREE.Mesh (new THREE.BoxGeometry (0.2, 1.2, 0.2), darkMaterial);
    chairBase.position.set (0, 0.6, 0);
    chairBase.castShadow = true;
    chairBase.receiveShadow = true;
    
    this.group.add (chairSeat, chairBack, chairBase);
    
    //Juez
    // Cuerpo
    this.body = new THREE.Mesh (new THREE.CylinderGeometry (0.25, 0.25, 0.8, 16), bodyMaterial);
    this.body.position.y = this.initialY;
    this.body.castShadow = true;
    
    // Cabeza
    this.head = new THREE.Mesh (new THREE.SphereGeometry (0.2, 32, 16), headMaterial);
    this.head.position.y = 0.6;
    this.head.castShadow = true;
    this.body.add (this.head);
    
    this.group.add (this.body);

    this.group.position.set (- court.width / 2 - 1.2, 0, 0);
    this.group.rotation.y = Math.PI / 2;
    scene.add (this.group);
  }
  
  celebratePoint (winnerPosition) {
    this.state = 'celebrating';
    this.animationTimer = 0;
    this.lookTarget.copy (winnerPosition);
  }
  
  update (deltaTime, ball, gameState) {
    if ( ! this.head || ! this.body) return;
    
    if (this.state === 'celebrating') {
      this.animationTimer += deltaTime;
      const jumpSpeed = 8;
      const jumpHeight = 0.15;
      this.body.position.y = this.initialY + Math.abs (Math.sin (this.animationTimer * jumpSpeed)) * jumpHeight;
      this.head.lookAt (this.lookTarget);

      if (this.animationTimer > 2) {
        this.state = 'tracking';
        this.body.position.y = this.initialY;
      }
    }
    else if (gameState === 'RALLY' || gameState === 'SERVING_TOSS' || gameState === 'AI_SERVING') {
      this.lookTarget.copy (ball.mesh.position);
      this.lookTarget.y = this.head.getWorldPosition (new THREE.Vector3 ()).y;
      this.head.lookAt (this.lookTarget);
    }
  }
}

const umpire = new Umpire();
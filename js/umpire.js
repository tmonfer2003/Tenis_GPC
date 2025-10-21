
class Umpire {
  constructor () {
    this.group = new THREE.Group (); // Grupo para contener al juez y la silla
    this.head = null; // Referencia a la cabeza para poder girarla
    this.body = null; // Referencia al cuerpo para la animación de salto
    
    this.initialY = 1.6; // Altura inicial del cuerpo del juez
    this.state = 'tracking'; // 'tracking', 'celebrating'
    this.animationTimer = 0;
    this.lookTarget = new THREE.Vector3 ();
  }
  
  load (scene) {
    const darkMaterial = new THREE.MeshStandardMaterial ({color: 0x333333, roughness: 0.8});
    const bodyMaterial = new THREE.MeshStandardMaterial ({color: 0xADD8E6, roughness: 0.7});
    const headMaterial = new THREE.MeshStandardMaterial ({color: 0xFFE4C4, roughness: 0.7});
    
    // --- Silla del Juez ---
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
    
    // --- Juez (Formas Simples Estilo Mii) ---
    // Cuerpo
    this.body = new THREE.Mesh (new THREE.CylinderGeometry (0.25, 0.25, 0.8, 16), bodyMaterial);
    this.body.position.y = this.initialY;
    this.body.castShadow = true;
    
    // Cabeza
    this.head = new THREE.Mesh (new THREE.SphereGeometry (0.2, 32, 16), headMaterial);
    this.head.position.y = 0.6; // Posición relativa al centro del cuerpo
    this.head.castShadow = true;
    this.body.add (this.head); // La cabeza es hija del cuerpo
    
    this.group.add (this.body);
    
    // Posicionamos y rotamos el conjunto
    this.group.position.set (- court.width / 2 - 1.2, 0, 0);
    this.group.rotation.y = Math.PI / 2; // Mirando hacia la pista
    
    scene.add (this.group);
  }
  
  /**
   * Inicia la animación de celebración del punto.
   * @param {THREE.Vector3} winnerPosition - La posición del jugador que ha ganado.
   */
  celebratePoint (winnerPosition) {
    this.state = 'celebrating';
    this.animationTimer = 0;
    this.lookTarget.copy (winnerPosition); // Guardamos la posición del ganador
  }
  
  update (deltaTime, ball, gameState) {
    if ( ! this.head || ! this.body) return;
    
    // --- Lógica de Animación ---
    if (this.state === 'celebrating') {
      this.animationTimer += deltaTime;
      const jumpSpeed = 8;
      const jumpHeight = 0.15;
      
      // Animación de salto
      this.body.position.y = this.initialY + Math.abs (Math.sin (this.animationTimer * jumpSpeed)) * jumpHeight;
      
      // La cabeza mira hacia el ganador
      this.head.lookAt (this.lookTarget);
      
      // La celebración dura 2 segundos
      if (this.animationTimer > 2) {
        this.state = 'tracking';
        this.body.position.y = this.initialY; // Vuelve a la posición inicial
      }
    }
    else if (gameState === 'RALLY' || gameState === 'SERVING_TOSS' || gameState === 'AI_SERVING') {
      // Sigue la pelota con la cabeza
      this.lookTarget.copy (ball.mesh.position);
      // Limitamos la mirada para que no rote en ejes no deseados
      this.lookTarget.y = this.head.getWorldPosition (new THREE.Vector3 ()).y;
      this.head.lookAt (this.lookTarget);
    }
  }
}

const umpire = new Umpire();
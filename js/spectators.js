
class Spectators {
  constructor () {
    this.spectators = []; // Array para guardar cada espectador
    this.group = new THREE.Group (); // Grupo que contiene a todos los espectadores
    this.state = 'tracking'; // 'tracking' o 'celebrating'
    this.animationTimer = 0;
  }
  
  /**
   * Crea un único espectador con estilo Mii (cuerpo y cabeza).
   * @returns {THREE.Group} - El grupo que representa a un espectador.
   */
  _createMii () {
    const miiGroup = new THREE.Group ();
    
    // Colores aleatorios para dar variedad a la ropa
    const bodyColor = new THREE.Color (Math.random () * 0xffffff);
    const headColor = 0xFFE4C4; // Color de piel constante
    
    const bodyMaterial = new THREE.MeshStandardMaterial ({color: bodyColor, roughness: 0.8});
    const headMaterial = new THREE.MeshStandardMaterial ({color: headColor, roughness: 0.7});
    
    // Cuerpo (Cilindro)
    const body = new THREE.Mesh (new THREE.CylinderGeometry (0.2, 0.2, 0.6, 8), bodyMaterial);
    body.castShadow = true;
    
    // Cabeza (Esfera)
    const head = new THREE.Mesh (new THREE.SphereGeometry (0.2, 16, 8), headMaterial);
    head.position.y = 0.5; // La coloca encima del cuerpo
    head.castShadow = true;
    
    miiGroup.add (body);
    miiGroup.add (head);
    
    // Guardamos la referencia para poder animarlo individualmente
    this.spectators.push (miiGroup);
    return miiGroup;
  }
  
  load (scene) {
    // Parámetros de las gradas (deben coincidir con los de court.js)
    const tiers = 10;
    const tierHeight = 0.5;
    const tierDepth = 1.0;
    const standsWidth = 80;
    const distanceFromCourt = 15;
    const courtLength = 23.77;
    const courtWidth = 10.97;
    
    /**
     * Rellena una sección de grada con espectadores.
     */
    const populateStand = (width, position, rotation) => {
      const standGroup = new THREE.Group ();
      
      // Colocamos espectadores en filas alternas para que no se tapen
      for (let i = 0; i < tiers; i += 2) {
        const y = tierHeight * (i + 1);
        const z = - tierDepth * i;
        
        const numSpectatorsInRow = Math.floor (width / 2.5); // Espacio entre espectadores
        for (let j = 0; j < numSpectatorsInRow; j ++) {
          const spectator = this._createMii ();
          // Posición en la fila con una pequeña variación aleatoria
          const x = - width / 2 + j * 2.5 + (Math.random () - 0.5);
          spectator.position.set (x, y + 0.4, z); // Los elevamos para que estén sentados
          standGroup.add (spectator);
        }
      }
      standGroup.position.copy (position);
      standGroup.rotation.copy (rotation);
      this.group.add (standGroup);
    };
    
    // Rellenamos las cuatro gradas
    populateStand (standsWidth, new THREE.Vector3 (0, 0, courtLength / 2 + distanceFromCourt), new THREE.Euler (0, Math.PI, 0));
    populateStand (standsWidth, new THREE.Vector3 (0, 0, - courtLength / 2 - distanceFromCourt), new THREE.Euler (0, 0, 0));
    populateStand (standsWidth, new THREE.Vector3 (courtWidth / 2 + distanceFromCourt, 0, 0), new THREE.Euler (0, - Math.PI / 2, 0));
    populateStand (standsWidth, new THREE.Vector3 (- courtWidth / 2 - distanceFromCourt, 0, 0), new THREE.Euler (0, Math.PI / 2, 0));
    
    scene.add (this.group);
  }
  
  /**
   * Activa la animación de celebración de todos los espectadores.
   */
  celebratePoint () {
    this.state = 'celebrating';
    this.animationTimer = 0;
  }
  
  update (deltaTime, ball) {
    if (this.spectators.length === 0) return;
    
    if (this.state === 'celebrating') {
      this.animationTimer += deltaTime;
      const jumpSpeed = 8;
      const jumpHeight = 0.2;
      
      // Hacemos que cada espectador salte.
      this.spectators.forEach ((spectator, index) => {
        // Añadimos un desfase para que los saltos no sean todos a la vez
        const timeOffset = (index % 10) * 0.1;
        spectator.position.y += Math.sin ((this.animationTimer + timeOffset) * jumpSpeed) * jumpHeight * deltaTime;
      });
      
      // La celebración dura 2 segundos
      if (this.animationTimer > 2) {
        this.state = 'tracking';
      }
    }
    else {
      const ballPosition = ball.mesh.position;
      // Hacemos que todos los espectadores miren la pelota
      this.spectators.forEach (spectator => {
        spectator.lookAt (ballPosition);
      });
    }
  }
}
const spectators = new Spectators();

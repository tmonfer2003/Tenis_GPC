
class Spectators {
  constructor () {
    this.spectators = [];
    this.group = new THREE.Group ();
    this.state = 'tracking'; //tracking o celebrating
    this.animationTimer = 0;
  }
  
  
  _createMii () {
    const miiGroup = new THREE.Group ();
    
    //Colores aleatorios
    const bodyColor = new THREE.Color (Math.random () * 0xffffff);
    const headColor = 0xFFE4C4;
    
    const bodyMaterial = new THREE.MeshStandardMaterial ({color: bodyColor, roughness: 0.8});
    const headMaterial = new THREE.MeshStandardMaterial ({color: headColor, roughness: 0.7});
    
    // Cuerpo (Cilindro)
    const body = new THREE.Mesh (new THREE.CylinderGeometry (0.2, 0.2, 0.6, 8), bodyMaterial);
    body.castShadow = true;
    
    // Cabeza (Esfera)
    const head = new THREE.Mesh (new THREE.SphereGeometry (0.2, 16, 8), headMaterial);
    head.position.y = 0.5;
    head.castShadow = true;
    
    miiGroup.add (body);
    miiGroup.add (head);
    
    this.spectators.push (miiGroup);
    return miiGroup;
  }
  
  load (scene) {
    const tiers = 10;
    const tierHeight = 0.5;
    const tierDepth = 1.0;
    const standsWidth = 80;
    const distanceFromCourt = 15;
    const courtLength = 23.77;
    const courtWidth = 10.97;
    
    const populateStand = (width, position, rotation) => {
      const standGroup = new THREE.Group ();

      for (let i = 0; i < tiers; i += 2) {
        const y = tierHeight * (i + 1);
        const z = - tierDepth * i;
        
        const numSpectatorsInRow = Math.floor (width / 2.5);
        for (let j = 0; j < numSpectatorsInRow; j ++) {
          const spectator = this._createMii ();
          const x = - width / 2 + j * 2.5 + (Math.random () - 0.5);
          spectator.position.set (x, y + 0.4, z);
          standGroup.add (spectator);
        }
      }
      standGroup.position.copy (position);
      standGroup.rotation.copy (rotation);
      this.group.add (standGroup);
    };
    
    //Rellenar las 4 gradas
    populateStand (standsWidth, new THREE.Vector3 (0, 0, courtLength / 2 + distanceFromCourt), new THREE.Euler (0, Math.PI, 0));
    populateStand (standsWidth, new THREE.Vector3 (0, 0, - courtLength / 2 - distanceFromCourt), new THREE.Euler (0, 0, 0));
    populateStand (standsWidth, new THREE.Vector3 (courtWidth / 2 + distanceFromCourt, 0, 0), new THREE.Euler (0, - Math.PI / 2, 0));
    populateStand (standsWidth, new THREE.Vector3 (- courtWidth / 2 - distanceFromCourt, 0, 0), new THREE.Euler (0, Math.PI / 2, 0));
    
    scene.add (this.group);
  }
  

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
      // Salto de los espectadores
      this.spectators.forEach ((spectator, index) => {
        const timeOffset = (index % 10) * 0.1;
        spectator.position.y += Math.sin ((this.animationTimer + timeOffset) * jumpSpeed) * jumpHeight * deltaTime;
      });
      
      if (this.animationTimer > 2) {
        this.state = 'tracking';
      }
    }
    else {
      const ballPosition = ball.mesh.position;
      this.spectators.forEach (spectator => {
        spectator.lookAt (ballPosition);
      });
    }
  }
}
const spectators = new Spectators();

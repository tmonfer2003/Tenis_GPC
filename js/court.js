class Court {
  constructor () {
    // medidas oficiales (m)
    this.width = 10.97;
    this.length = 23.77;
    this.singlesWidth = 8.23;
    this.singlesHalf  = this.singlesWidth * 0.5;

    // red
    this.netHeight = 0.914;
    this.netPositionZ = 0;

    // nota: guardo refs útiles
    this.group = new THREE.Group();
    this.netMesh = null;
  }

  load (scene) {
    const textureLoader = new THREE.TextureLoader();

    // suelo
    const groundSize = 70;
    const grassTexture = textureLoader.load('assets/textures/grass.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(20, 20);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ map: grassTexture })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // líneas
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const yPos = 0.01;
    const createLine = (w, h, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      m.position.set(x, yPos, z);
      m.rotation.x = -Math.PI / 2;
      this.group.add(m);
      return m;
    };

    // fondo / fondo
    createLine(this.width, 0.05, 0,  this.length * 0.5);
    createLine(this.width, 0.05, 0, -this.length * 0.5);
    // laterales dobles
    createLine(0.05, this.length,  this.width * 0.5, 0);
    createLine(0.05, this.length, -this.width * 0.5, 0);
    // laterales individuales
    createLine(0.05, this.length,  this.singlesHalf, 0);
    createLine(0.05, this.length, -this.singlesHalf, 0);
    // líneas de saque
    const serviceLineDist = 6.4;
    createLine(this.singlesWidth, 0.05, 0,  serviceLineDist);
    createLine(this.singlesWidth, 0.05, 0, -serviceLineDist);
    // línea central de saque
    createLine(0.05, serviceLineDist * 2, 0, 0);

    // red
    const netTexture = textureLoader.load('assets/textures/tennis_net.png');
    netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping;
    netTexture.repeat.set(10, 1);

    this.netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width, this.netHeight),
      new THREE.MeshBasicMaterial({ map: netTexture, transparent: true, side: THREE.DoubleSide })
    );
    this.netMesh.position.set(0, this.netHeight / 2, this.netPositionZ);
    this.group.add(this.netMesh);

    // postes
    const postGeom = new THREE.CylinderGeometry(0.05, 0.05, this.netHeight + 0.1);
    const postMat  = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const postL = new THREE.Mesh(postGeom, postMat);
    postL.position.set(-this.width * 0.5, (this.netHeight + 0.1) * 0.5, 0);
    const postR = postL.clone();
    postR.position.x = this.width * 0.5;
    this.group.add(postL, postR);

    // gradas simples (hormigón)
    const concreteTexture = textureLoader.load('assets/textures/concrete.jpg');
    concreteTexture.wrapS = concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(5, 5);
    const standsMat = new THREE.MeshStandardMaterial({ map: concreteTexture });

    const createTieredStands = (width, tiers, tierHeight, tierDepth) => {
      const g = new THREE.Group();
      for (let i = 0; i < tiers; i++) {
        const h = tierHeight * (i + 1);
        const step = new THREE.Mesh(new THREE.BoxGeometry(width, h, tierDepth), standsMat);
        step.position.set(0, h / 2, -tierDepth * i - tierDepth / 2);
        g.add(step);
      }
      return g;
    };

    const tiers = 10;
    const tierH = 0.5;
    const tierD = 1.0;
    const standsBackFrontW = 80;
    const standsSideW = 80;
    const dist = 15;

    const back = createTieredStands(standsBackFrontW, tiers, tierH, tierD);
    back.position.set(0, 0,  this.length * 0.5 + dist);
    back.rotation.y = Math.PI;

    const front = createTieredStands(standsBackFrontW, tiers, tierH, tierD);
    front.position.set(0, 0, -this.length * 0.5 - dist);

    const rightS = createTieredStands(standsSideW, tiers, tierH, tierD);
    rightS.position.set(this.width * 0.5 + dist, 0, 0);
    rightS.rotation.y = -Math.PI / 2;

    const leftS = createTieredStands(standsSideW, tiers, tierH, tierD);
    leftS.position.set(-this.width * 0.5 - dist, 0, 0);
    leftS.rotation.y =  Math.PI / 2;

    this.group.add(back, front, rightS, leftS);

    scene.add(this.group);
  }

  // uso esta para comprobaciones rápidas de límites completos
  isBallIn (ballPosition) {
    const inX = Math.abs(ballPosition.x) < this.width * 0.5;
    const inZ = Math.abs(ballPosition.z) < this.length * 0.5;
    return inX && inZ;
  }

  // y esta cuando el juego es a individuales
  isBallInSingles (ballPosition) {
    const inX = Math.abs(ballPosition.x) <= this.singlesHalf;
    const inZ = Math.abs(ballPosition.z) <= this.length * 0.5;
    return inX && inZ;
  }
}

const court = new Court();
window.court = court;

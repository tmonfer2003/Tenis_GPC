//STATS (FPS)
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);
stats.dom.style.position = 'fixed';
stats.dom.style.left = '0px';
stats.dom.style.top = '0px';
stats.dom.style.zIndex = '9999';


//ESCENA Y CÁMARA 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 10);

const renderer = new THREE.WebGLRenderer ({antialias: true});
renderer.setSize (window.innerWidth, window.innerHeight);
renderer.setPixelRatio (window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild (renderer.domElement);

const swing = { active: false, phase: 'idle', t: 0, hasHit: false, lastRotX: 0, rotSpeed: 0 };

//CONTROLES
const controls = new THREE.PointerLockControls(camera, renderer.domElement);
const blocker = document.getElementById('blocker');
const startButton = document.getElementById('startButton');

startButton.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => blocker.style.display = 'none');
controls.addEventListener('unlock', () => blocker.style.display = 'flex');

//ILUMINACIÓN
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const dirLight = new THREE.DirectionalLight(0xfff0b0, 1.05);
dirLight.position.set(15, 30, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
scene.add(dirLight);
const skyLight = new THREE.HemisphereLight(0xbfdfff, 0x88aa88, 0.4);
scene.add(skyLight);
const fillLight = new THREE.PointLight(0xffffff, 0.25);
fillLight.position.set(0, 10, 0);
scene.add(fillLight);

const textureLoader = new THREE.TextureLoader();
textureLoader.load('assets/textures/sky.png', tex => {
  tex.encoding = THREE.sRGBEncoding;
  scene.background = tex;
  scene.environment = null;
});

court.load(scene);
ball.load(scene);
ai.load(scene);
umpire.load(scene);
spectators.load(scene);

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.load('assets/models/wilson_tennis_racket/scene.gltf', gltf => {
  const racket = gltf.scene;
  racket.scale.set(0.08, 0.08, 0.08);
  camera.add(racket);
  player.setRacket(racket);

  const handGeo = new THREE.SphereGeometry(0.1, 16, 8);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xFFE4C4, roughness: 0.7 });

  const racketHand = new THREE.Mesh(handGeo, handMat);
  racketHand.castShadow = true;
  racketHand.position.set(-0.45, -0.35, -0.6);
  camera.add(racketHand);

  const freeHand = new THREE.Mesh(handGeo, handMat);
  freeHand.castShadow = true;
  freeHand.position.set(0.2, -0.3, -0.6);
  camera.add(freeHand);

  scene.add(camera);
});

//LOGICA DE PUNTUACION
let score = {
  player: { points: 0, games: 0, sets: 0 },
  ai: { points: 0, games: 0, sets: 0 }
};
let servingPlayer = 'player';
let gameState = 'READY_TO_SERVE';
window.gameState = gameState;
window.servingPlayer = servingPlayer;
window.ball = ball;

function resetAfterPoint(pointWinner) {
  if (gameState === 'POINT_OVER') return;
  gameState = 'POINT_OVER';
  score[pointWinner].points++;
  const winnerObj = (pointWinner === 'player') ? camera : ai.mesh;
  umpire.celebratePoint(winnerObj.position);
  spectators.celebratePoint();

  const pPts = score.player.points;
  const aiPts = score.ai.points;
  let gameWinner = null;

  if (pPts >= 4 && pPts >= aiPts + 2) gameWinner = 'player';
  if (aiPts >= 4 && aiPts >= pPts + 2) gameWinner = 'ai';

  if (gameWinner) {
    score[gameWinner].games++;
    score.player.points = 0;
    score.ai.points = 0;
    servingPlayer = (servingPlayer === 'player') ? 'ai' : 'player';

    const pGames = score.player.games;
    const aiGames = score.ai.games;
    let setWinner = null;
    if (pGames >= 6 && pGames >= aiGames + 2) setWinner = 'player';
    if (aiGames >= 6 && aiGames >= pGames + 2) setWinner = 'ai';

    if (setWinner) {
      score[setWinner].sets++;
      score.player.games = 0;
      score.ai.games = 0;
    }
  }

  scoreboard.update(score);

  setTimeout(() => {
    gameState = 'READY_TO_SERVE';
    window.gameState = gameState;
    window.servingPlayer = servingPlayer;

    if (servingPlayer === 'ai') {
      setTimeout(() => {
        if (gameState === 'READY_TO_SERVE') {
          ai.serve(ball);
          gameState = 'AI_SERVING';
          window.gameState = gameState;
        }
      }, 500);
    }
  }, 2000);
}

ball.onPointScored = resetAfterPoint;
scoreboard.update(score);

//CONTROLES DE JUGADOR
function handlePlayerAction() {
  if (!controls.isLocked) return;
  if (gameState === 'READY_TO_SERVE' && servingPlayer === 'player') {
    player.tossBall(ball, camera);
    gameState = 'SERVING_TOSS';
    window.gameState = gameState;
  }
  else if (gameState === 'SERVING_TOSS' && servingPlayer === 'player') {
    player.swing(ball, camera, true);
    gameState = 'RALLY';
    window.gameState = gameState;
  }
  else if (
    gameState === 'RALLY' ||
    gameState === 'AI_SERVING' ||
    gameState === 'POINT_OVER' ||
    gameState === 'SERVING_TOSS'
  ) {
    player.swing(ball, camera, false);
  }
}

window.addEventListener('mousedown', e => {
  if (e.button === 0) {
    e.preventDefault();
    handlePlayerAction();
  }
});

window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    handlePlayerAction();
  }
});

const clock = new THREE.Clock();

function animate() {
  stats.begin();
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (controls.isLocked) {
    player.update(delta);
    ball.update(delta, player, ai, court, gameState, servingPlayer);
    ai.update(delta, ball, gameState, camera);
    umpire.update(delta, ball, gameState);
    spectators.update(delta, ball);

    if (gameState === 'AI_SERVING' && ball.mesh) {
      const passedNet = ball.mesh.position.z > 0;
      const goingDown = ball.velocity.y < 0;

      if (passedNet && goingDown) {
        gameState = 'RALLY';
        window.gameState = gameState;
      }
    }
  }

  renderer.render(scene, camera);
  stats.end();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

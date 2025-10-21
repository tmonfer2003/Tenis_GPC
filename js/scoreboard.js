

const tennisPoints = {0: '0', 1: '15', 2: '30', 3: '40'};

class Scoreboard {
  constructor () {
    this.playerPointsEl = document.getElementById ('player-points');
    this.aiPointsEl = document.getElementById ('ai-points');
    this.playerGamesEl = document.getElementById ('player-games');
    this.aiGamesEl = document.getElementById ('ai-games');
    this.playerSetsEl = document.getElementById ('player-sets');
    this.aiSetsEl = document.getElementById ('ai-sets');
  }
  
  update (score) {
    const playerPts = score.player.points;
    const aiPts = score.ai.points;
    
    // --- Lógica de Puntos Mejorada ---
    if (playerPts >= 3 && aiPts >= 3) {
      if (playerPts === aiPts) {
        // Estado de Deuce
        this.playerPointsEl.textContent = '40';
        this.aiPointsEl.textContent = '40';
      }
      else if (playerPts > aiPts) {
        // Ventaja para el Jugador
        this.playerPointsEl.textContent = 'Adv';
        this.aiPointsEl.textContent = '40';
      }
      else {
        // Ventaja para la IA
        this.playerPointsEl.textContent = '40';
        this.aiPointsEl.textContent = 'Adv';
      }
    }
    else {
      // Puntuación normal (0, 15, 30, 40)
      this.playerPointsEl.textContent = tennisPoints[playerPts] || '0';
      this.aiPointsEl.textContent = tennisPoints[aiPts] || '0';
    }
    
    // Actualizar Juegos y Sets
    this.playerGamesEl.textContent = score.player.games;
    this.aiGamesEl.textContent = score.ai.games;
    this.playerSetsEl.textContent = score.player.sets;
    this.aiSetsEl.textContent = score.ai.sets;
  }
}

const scoreboard = new Scoreboard();
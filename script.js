document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du DOM ---
    const gameContainer = document.getElementById('game-container');
    const uiBar = document.getElementById('ui-bar');
    const modeDisplay = document.getElementById('mode-display');
    const distanceDisplay = document.getElementById('distance-display');
    const timerDisplay = document.getElementById('timer-display');
    const gameArea = document.getElementById('game-area');
    const background = document.getElementById('background');
    const playableArea = document.getElementById('playable-area'); // La zone 75% du bas
    const player = document.getElementById('player');
    const obstaclesContainer = document.getElementById('obstacles-container'); // Est dans playableArea
    // SUPPRIMÉ : const controlLeft = document.getElementById('control-left');
    // SUPPRIMÉ : const controlRight = document.getElementById('control-right');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalTimeDisplay = document.getElementById('final-time');
    const restartButton = document.getElementById('restart-button');

    // --- Configuration du Jeu ---
    const TOTAL_GAME_DISTANCE = 15000;
    const LANES = [15, 50, 85];
    const ROAD_POSITIONS_HORIZONTAL = [50, 75, 90];
    const GLOBAL_SCALE = 1.3;
    const GLOBAL_OBSTACLE_DENSITY_FACTOR = 0.5;
    const INITIAL_START_SPEED = 10;
    const GLOBAL_DISTANCE_FACTOR = 0.8;

    const PHASES = [
        {
            name: "Natation", distanceThreshold: 1300, baseSpeed: 100,
            minSpeedFactor: 0.05, maxSpeedFactor: 1.8,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #4682B4)',
            playableAreaStyle: 'darkcyan', obstacleTypes: ['peniche', 'dechet'],
            baseObstacleFrequency: 2000
        },
        {
            name: "Vélo", distanceThreshold: 11500, baseSpeed: 200,
            minSpeedFactor: 0.1, maxSpeedFactor: 3.5,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #A9A9A9)',
            playableAreaStyle: '#666', obstacleTypes: ['voiture', 'egout', 'poubelle', 'voiture-statique', 'voiture-verticale'],
            baseObstacleFrequency: 2000
        },
        {
            name: "Course", distanceThreshold: TOTAL_GAME_DISTANCE, baseSpeed: 100,
            minSpeedFactor: 0.1, maxSpeedFactor: 2.5,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #7CFC00)',
            playableAreaStyle: '#aaa', obstacleTypes: ['pieton', 'egout', 'poubelle', 'voiture', 'pieton-sens-inverse', 'voiture-statique', 'voiture-verticale', 'pieton-verticale'],
            baseObstacleFrequency: 1500
        }
    ];

    const OBSTACLE_CONFIG = {
        'peniche': { className: 'peniche', width: 120, height: 60, speedFactor: 1.0, isVertical: false },
        'dechet': { className: 'dechet', width: 30, height: 30, speedFactor: 1.0, isVertical: false },
        'voiture': { className: 'voiture', width: 45, height: 80, speedFactor: 1.0, isVertical: false },
        'voiture-statique': { className: 'voiture-statique', width: 85, height: 45, speedFactor: 1.0, isVertical: false },
        'pieton': { className: 'pieton', width: 35, height: 35, speedFactor: 0.8, isVertical: false },
        'pieton-sens-inverse': { className: 'pieton-sens-inverse', width: 35, height: 35, speedFactor: 1.5, isVertical: false },
        'poubelle': { className: 'poubelle', width: 40, height: 50, speedFactor: 1.0, isVertical: false },
        'egout': { className: 'egout', width: 45, height: 15, speedFactor: 1.0, isVertical: false },
        'voiture-verticale': { className: 'voiture-verticale', width: 45, height: 85, verticalSpeed: 250, speedFactor: 1.0, isVertical: true },
        'pieton-verticale': { className: 'pieton', width: 35, height: 35, verticalSpeed: 50, speedFactor: 1.5, isVertical: true },
     };


    // --- État du Jeu ---
    let gameState = 'initial';
    let currentPhaseIndex = 0;
    let distanceCovered = 0;
    let gameTime = 0;
    let playerLane = 1;
    let currentSpeed = 0;
    let targetSpeed = 0;
    let minSpeed = 0;
    let maxSpeed = 0;
    let lastTimestamp = 0;
    let timerInterval = null;
    let gameLoopId = null;
    let obstacles = [];
    let lastObstacleSpawnTime = 0;
    let backgroundOffset = 0;
    let playableAreaOffset = 0;

    // --- Fonctions Principales (Identiques - updateUI, formatTime, getPhaseDurationSeconds, getMetersPerPixelAtBaseSpeed, setPhase, movePlayerToLane, spawnObstacle, updateObstacles, checkCollisions, increaseDifficulty, updateBackground, gameLoop) ---
    // ... (Toutes les fonctions de updateUI à updateBackground restent exactement les mêmes) ...
    // --- Collez ici toutes les fonctions de updateUI à updateBackground depuis votre code original ---
    function updateUI() {
        const currentPhase = PHASES[currentPhaseIndex];
        modeDisplay.textContent = `Étape : ${currentPhase.name}`;
        const distanceRemaining = Math.max(0, (TOTAL_GAME_DISTANCE - distanceCovered) / 1000);
        distanceDisplay.textContent = `Distance jusqu'à Bobigny : ${distanceRemaining.toFixed(2)} km`;
        timerDisplay.textContent = `Heures passées: ${formatTime(gameTime)}`;

        const startMessageElement = document.getElementById('start-message');
        if (gameState === 'running' && currentSpeed < PHASES[currentPhaseIndex].baseSpeed * 0.2 && gameTime < 5) {
             if (!startMessageElement) {
                 const msg = document.createElement('div');
                 msg.id = 'start-message';
                 // MODIFIÉ : Texte du message pour inclure swipe
                 msg.textContent = "Swipe Droite / Flèche Droite pour Accélérer !";
                 msg.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: yellow;
                    font-size: 1.5em;
                    font-weight: bold;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    z-index: 60;
                 `;
                 gameArea.appendChild(msg);
             }
        } else {
             if (startMessageElement) {
                 startMessageElement.remove();
             }
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

     function getPhaseDurationSeconds(phase) {
         if (phase.name === "Natation") return 20;
         if (phase.name === "Vélo") return 60;
         if (phase.name === "Course") return 30;
         return 1;
     }

     function getMetersPerPixelAtBaseSpeed(phase) {
        const duration = getPhaseDurationSeconds(phase);
        if (duration <= 0 || phase.baseSpeed <= 0) return 0;
        const startDistance = (currentPhaseIndex === 0) ? 0 : PHASES[currentPhaseIndex - 1].distanceThreshold;
        const phaseDistance = phase.distanceThreshold - startDistance;
        const mpp = phaseDistance / (phase.baseSpeed * duration);
        return mpp * GLOBAL_DISTANCE_FACTOR;
    }

    function setPhase(phaseIndex) {
        currentPhaseIndex = phaseIndex;
        const phase = PHASES[phaseIndex];
        minSpeed = phase.baseSpeed * phase.minSpeedFactor;
        maxSpeed = phase.baseSpeed * phase.maxSpeedFactor; // sera ajusté par increaseDifficulty

        background.style.backgroundColor = '';
        if (phase.backgroundStyle.startsWith('linear-gradient')) {
            background.style.backgroundImage = phase.backgroundStyle;
        } else {
            background.style.backgroundImage = `url(${phase.backgroundStyle})`;
        }
        background.style.backgroundSize = 'auto 100%';
        background.style.backgroundRepeat = 'repeat-x';
        background.style.backgroundPositionX = '0px';
        backgroundOffset = 0;

        playableArea.style.backgroundColor = '';
         if (phase.playableAreaStyle.startsWith('#') || phase.playableAreaStyle.startsWith('rgba') || phase.playableAreaStyle === '') {
              playableArea.style.backgroundColor = phase.playableAreaStyle;
              playableArea.style.backgroundImage = '';
         } else {
              playableArea.style.backgroundImage = `url(${phase.playableAreaStyle})`;
         }
        playableArea.style.backgroundSize = 'auto 100%';
        playableArea.style.backgroundRepeat = 'repeat-x';
        playableArea.style.backgroundPositionX = '0px';
        playableAreaOffset = 0;

        movePlayerToLane(playerLane);
        updateUI();
        console.log(`Phase changed to: ${phase.name}`);
        console.log(`Speed range: ${minSpeed.toFixed(1)} - ${maxSpeed.toFixed(1)} px/s (base: ${phase.baseSpeed.toFixed(1)})`);
    }

    function movePlayerToLane(laneIndex) {
        playerLane = Math.max(0, Math.min(LANES.length - 1, laneIndex));
        const targetBottomPercent = LANES[playerLane];
        player.style.bottom = `${targetBottomPercent}%`;
    }

    function spawnObstacle() {
        const now = performance.now();
        const phase = PHASES[currentPhaseIndex];
        const obstacleConfig = OBSTACLE_CONFIG;
        const speedRatio = currentSpeed / (phase.baseSpeed || 1);
        const currentObstacleFrequency = (phase.baseObstacleFrequency / (speedRatio || 1)) / GLOBAL_OBSTACLE_DENSITY_FACTOR;

        if (now - lastObstacleSpawnTime < currentObstacleFrequency) return;
        lastObstacleSpawnTime = now;

        const type = phase.obstacleTypes[Math.floor(Math.random() * phase.obstacleTypes.length)];
        const config = obstacleConfig[type];
        if (!config) {
             console.warn(`Configuration missing for obstacle type: ${type}`); return;
        }

        let initialX, initialY;
        let laneIndex = -1;
        const playableAreaWidth = playableArea.offsetWidth;
        const playableAreaHeight = playableArea.offsetHeight;
        const obstacleElement = document.createElement('div');
        obstacleElement.classList.add('obstacle', config.className);
        const w = config.width  * GLOBAL_SCALE;
        const h = config.height * GLOBAL_SCALE;
        obstacleElement.style.width  = `${w}px`;
        obstacleElement.style.height = `${h}px`;

        if (config.isVertical) {
            const roadPercent = ROAD_POSITIONS_HORIZONTAL[Math.floor(Math.random() * ROAD_POSITIONS_HORIZONTAL.length)];
            initialX = (roadPercent / 100) * playableAreaWidth - w / 2;
            initialY = -h;
            initialX += (Math.random() - 0.5) * 15;
        } else {
            initialX = playableAreaWidth + 50;
            laneIndex = Math.floor(Math.random() * LANES.length); // Assign laneIndex here
            const laneBottomPercent = LANES[laneIndex];
            // Calculate top based on lane bottom % and obstacle height
            initialY = playableAreaHeight * (1 - (laneBottomPercent / 100)) - h / 2;
            initialY += (Math.random() - 0.5) * 10;
        }

        obstacleElement.style.left = `${initialX}px`;
        obstacleElement.style.top = `${initialY}px`; // Use top for positioning

        obstaclesContainer.appendChild(obstacleElement);
        obstacles.push({
            element: obstacleElement, type: type, config: config,
            x: initialX, y: initialY, laneIndex: laneIndex
        });
    }

    function updateObstacles(deltaTime) {
        const playableAreaWidth = playableArea.offsetWidth;
        const playableAreaHeight = playableArea.offsetHeight;

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            const element = obstacle.element;
            const config = obstacle.config;

            if (config.isVertical) {
                obstacle.x -= (currentSpeed * (config.speedFactor || 1.0)) * deltaTime;
                obstacle.y += config.verticalSpeed * deltaTime;
            } else {
                obstacle.x -= (currentSpeed * (config.speedFactor || 1.0)) * deltaTime;
                // y is constant for horizontal obstacles, set during spawn based on lane
            }

            element.style.left = `${obstacle.x}px`;
            element.style.top = `${obstacle.y}px`; // Always use top

            const obstacleWidth = config.width * GLOBAL_SCALE;
            const obstacleHeight = config.height * GLOBAL_SCALE;
            let shouldRemove = false;

            if (config.isVertical) {
                shouldRemove = obstacle.y > playableAreaHeight;
            } else {
                shouldRemove = obstacle.x + obstacleWidth < 0;
            }
             if (!shouldRemove && (obstacle.x > playableAreaWidth + 100 || obstacle.y + obstacleHeight < -100)) {
                 shouldRemove = true;
             }

            if (shouldRemove) {
                obstaclesContainer.removeChild(element);
                obstacles.splice(i, 1);
            }
        }
    }


    function checkCollisions() {
        const playerRect = player.getBoundingClientRect();
        for (const obstacle of obstacles) {
            const obstacleRect = obstacle.element.getBoundingClientRect();
            if ( playerRect.left < obstacleRect.right && playerRect.right > obstacleRect.left &&
                 playerRect.top < obstacleRect.bottom && playerRect.bottom > obstacleRect.top ) {
                return true;
            }
        }
        return false;
    }

    function increaseDifficulty() {
        const distanceMilestone = 1500;
        const speedIncreaseFactor = 1.02;
        const milestonesReached = Math.floor(distanceCovered / distanceMilestone);
        const basePhase = PHASES[currentPhaseIndex];
        const effectiveMaxSpeedFactor = basePhase.maxSpeedFactor * Math.pow(speedIncreaseFactor, milestonesReached);
        maxSpeed = basePhase.baseSpeed * effectiveMaxSpeedFactor;
    }

    function updateBackground(deltaTime) {
        const backgroundWidth = background.offsetWidth / 2;
        backgroundOffset -= currentSpeed * deltaTime * 0.5;
        background.style.backgroundPositionX = `${backgroundOffset % backgroundWidth}px`;

        if (playableArea.style.backgroundImage && playableArea.style.backgroundImage !== 'none') {
             const playableAreaRepetitionWidth = playableArea.offsetWidth; // Assumes repeat-x and covers full width
             playableAreaOffset -= currentSpeed * deltaTime * 1.0;
             playableArea.style.backgroundPositionX = `${playableAreaOffset % playableAreaRepetitionWidth}px`;
        }
    }

    function gameLoop(timestamp) {
        if (gameState !== 'running') return;

        const deltaTime = (timestamp - (lastTimestamp || performance.now())) / 1000;
        lastTimestamp = timestamp;

        // 1. Vitesse
        const acceleration = 1000;
        const deceleration = 1000;
        if (currentSpeed < targetSpeed) {
            currentSpeed = Math.min(targetSpeed, currentSpeed + acceleration * deltaTime);
        } else if (currentSpeed > targetSpeed) {
            currentSpeed = Math.max(targetSpeed, currentSpeed - deceleration * deltaTime);
        }
        currentSpeed = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed));

        // 2. Distance
        const basePhase = PHASES[currentPhaseIndex];
        const metersPerPixel = getMetersPerPixelAtBaseSpeed(basePhase);
        const currentMetersPerSecond = currentSpeed * metersPerPixel;
        distanceCovered += currentMetersPerSecond * deltaTime;

        // 3. Background
        updateBackground(deltaTime);

        // 4. Obstacles
        spawnObstacle();
        updateObstacles(deltaTime);

        // 5. Collisions
        if (checkCollisions()) {
            gameOver(); return;
        }

        // 6. Phase/Win Check
        if (currentPhaseIndex < PHASES.length - 1 && distanceCovered >= PHASES[currentPhaseIndex].distanceThreshold) {
            setPhase(currentPhaseIndex + 1);
             obstaclesContainer.innerHTML = '';
             obstacles = [];
        } else if (currentPhaseIndex === PHASES.length - 1 && distanceCovered >= TOTAL_GAME_DISTANCE) {
             gameWon(); return;
        }

        // 7. Difficulté
        increaseDifficulty();

        // 8. UI
        updateUI();

        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        // ... (Fonction startGame reste identique sauf pour le message console) ...
        if (gameState === 'running') return;
        const startMessageElement = document.getElementById('start-message');
        if (startMessageElement) startMessageElement.remove();
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        obstaclesContainer.innerHTML = '';
        obstacles = [];
        distanceCovered = 0;
        gameTime = 0;
        playerLane = 1;
        currentPhaseIndex = -1; // Sera mis à 0 par setPhase
        lastTimestamp = 0;
        lastObstacleSpawnTime = 0;
        backgroundOffset = 0;
        playableAreaOffset = 0;
        background.style.backgroundPositionX = '0px';
        playableArea.style.backgroundPositionX = '0px';

        setPhase(0); // Initialise la phase 0
        currentSpeed = INITIAL_START_SPEED;
        targetSpeed = INITIAL_START_SPEED;
        // minSpeed et maxSpeed sont définis dans setPhase

        gameState = 'running';

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (gameState === 'running') gameTime++;
        }, 1000);

        cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);

        console.log("Game Started! Swipe left/right for speed, up/down for lanes."); // Message modifié
        console.log(`Initial Speed: ${currentSpeed.toFixed(1)} px/s. Min Speed: ${minSpeed.toFixed(1)} px/s. Max Speed: ${maxSpeed.toFixed(1)} px/s.`);
    }

    function gameOver() {
        // ... (Fonction gameOver reste identique) ...
        if (gameState === 'gameOver') return;
        console.log("Game Over!");
        gameState = 'gameOver';
        clearInterval(timerInterval);
        cancelAnimationFrame(gameLoopId);
        finalTimeDisplay.textContent = `Malheureusement vous n'êtes pas arrivé au travail en bon état aujourd'hui...`;
        gameOverScreen.querySelector('h2').textContent = "Game Over !";
        gameOverScreen.style.display = 'flex';
    }

    function gameWon() {
        // ... (Fonction gameWon reste identique) ...
        if (gameState === 'gameOver') return;
        console.log("You Win!");
        gameState = 'gameOver';
        clearInterval(timerInterval);
        cancelAnimationFrame(gameLoopId);
        finalTimeDisplay.textContent = `Bravo vous avez seulement mis ${formatTime(gameTime)} heures pour arriver au travail`;
        gameOverScreen.querySelector('h2').textContent = "Arrivé à Bobigny !";
        gameOverScreen.style.display = 'flex';
    }

    // --- Gestion des Contrôles (Swipe & Clavier) ---

    // Fonctions pour les actions (inchangées)
    function handleSpeedUp() {
        if (gameState !== 'running') return;
        const increment = Math.max(5, targetSpeed * 0.1);
        targetSpeed = Math.min(maxSpeed, targetSpeed + increment);
         // console.log("Speed Up - Target Speed:", targetSpeed.toFixed(1));
    }

    function handleSlowDown() {
        if (gameState !== 'running') return;
        const decrement = Math.max(5, targetSpeed * 0.3);
        targetSpeed = Math.max(minSpeed, targetSpeed - decrement);
         // console.log("Slow Down - Target Speed:", targetSpeed.toFixed(1));
    }

    function handleChangeLane(direction) {
        if (gameState !== 'running') return;
        if (direction === 'down') {
            movePlayerToLane(playerLane - 1); // Bas de l'écran = index inférieur
        } else if (direction === 'up') {
            movePlayerToLane(playerLane + 1); // Haut de l'écran = index supérieur
        }
        // console.log("Change Lane:", direction, "New Lane Index:", playerLane);
    }


    // --- Écouteurs d'Événements ---

    // 1. Contrôles Touch (Swipe sur la zone jouable)
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    const swipeThreshold = 30; // Pixels minimum pour détecter un swipe (un peu augmenté pour éviter déclenchement accidentel)

    // SUPPRIMÉ : Event listeners pour controlLeft et controlRight

    // NOUVEAU / MODIFIÉ : Gestion du swipe sur playableArea
    playableArea.addEventListener('pointerdown', (e) => {
        // Ignorer si on clique sur un bouton dans un overlay (start/gameover)
        if (e.target.tagName === 'BUTTON' || gameState !== 'running') {
            isSwiping = false;
            return;
        }
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        isSwiping = true;
        // e.preventDefault(); // Important pour éviter le scroll/zoom sur mobile
        // console.log("Pointer Down on Playable Area");
    }, { passive: true }); // passive: true si on n'appelle PAS preventDefault ici

    playableArea.addEventListener('pointermove', (e) => {
        if (!isSwiping || gameState !== 'running') {
            return;
        }
        // console.log("Pointer Move");

        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;

        // Déterminer si le swipe est principalement horizontal ou vertical
        if (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold) {

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Swipe Horizontal détecté
                if (deltaX > 0) {
                    handleSpeedUp();
                    // console.log("Swipe Right -> Speed Up");
                } else {
                    handleSlowDown();
                    // console.log("Swipe Left -> Slow Down");
                }
                // On considère le swipe comme traité pour cette direction
                isSwiping = false;
                // Il faut preventDefault ici pour éviter le scroll horizontal du navigateur si applicable
                // Mais comme on utilise déjà touch-action: none en CSS, ce n'est pas strictement nécessaire
                // e.preventDefault();

            } else {
                // Swipe Vertical détecté
                handleChangeLane(deltaY < 0 ? 'up' : 'down'); // Swipe vers le haut = 'up', vers le bas = 'down'
                 // console.log("Swipe Vertical -> Change Lane");
                // On considère le swipe comme traité pour cette direction
                isSwiping = false;
                 // Il faut preventDefault ici pour éviter le scroll vertical du navigateur
                 // Mais comme on utilise déjà touch-action: none en CSS, ce n'est pas strictement nécessaire
                 // e.preventDefault();
            }
            // Réinitialiser pour le prochain potentiel swipe distinct même si le doigt reste appuyé
             touchStartX = e.clientX;
             touchStartY = e.clientY;
             // isSwiping reste false jusqu'au prochain pointerdown ou si le mouvement s'arrête puis reprend
        }

    }, { passive: false }); // passive: false car on pourrait vouloir appeler preventDefault

    playableArea.addEventListener('pointerup', (e) => {
        if (isSwiping) {
            // console.log("Pointer Up");
            isSwiping = false;
            touchStartX = 0;
            touchStartY = 0;
        }
    }, { passive: true });

    playableArea.addEventListener('pointercancel', (e) => {
        if (isSwiping) {
            // console.log("Pointer Cancel");
            isSwiping = false;
            touchStartX = 0;
            touchStartY = 0;
        }
    }, { passive: true });


    // 2. Contrôles Clavier (Inchangés)
    document.addEventListener('keydown', (event) => {
        if (gameState !== 'running') {
             if (event.key === 'Enter') {
                  if (gameOverScreen.style.display !== 'none') { startGame(); event.preventDefault(); }
                  else if (startScreen.style.display !== 'none') { startGame(); event.preventDefault(); }
             }
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                handleSlowDown(); event.preventDefault(); break;
            case 'ArrowRight':
                handleSpeedUp(); event.preventDefault(); break;
            case 'ArrowUp':
                handleChangeLane('up'); event.preventDefault(); break; // Monter ligne = index +1
            case 'ArrowDown':
                handleChangeLane('down'); event.preventDefault(); break; // Descendre ligne = index -1
        }
    });


    // 3. Boutons Start/Restart (Inchangés)
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // --- Initialisation (Inchangée) ---
    function initializeApp() {
        startScreen.style.display = 'flex';
        gameOverScreen.style.display = 'none';
        movePlayerToLane(playerLane);
        modeDisplay.textContent = `Étape : Prêt`;
        distanceDisplay.textContent = `Distance jusqu'à Bobigny : ${TOTAL_GAME_DISTANCE / 1000} km`;
        timerDisplay.textContent = `Heures passées : 00:00`;
        // Appliquer le scale global au joueur une fois au début
        const playerElement = document.getElementById('player'); // S'assurer qu'on a l'élément
        if(playerElement) {
            const initialWidth = parseFloat(getComputedStyle(playerElement).width);
            const initialHeight = parseFloat(getComputedStyle(playerElement).height);
            playerElement.style.width  = `${initialWidth  * GLOBAL_SCALE}px`;
            playerElement.style.height = `${initialHeight * GLOBAL_SCALE}px`;
        } else {
            console.error("Player element not found during initialization!");
        }
    }

    initializeApp();

});
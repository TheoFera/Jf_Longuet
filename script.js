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
    const controlLeft = document.getElementById('control-left');
    const controlRight = document.getElementById('control-right');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalTimeDisplay = document.getElementById('final-time');
    const restartButton = document.getElementById('restart-button');

    // --- Configuration du Jeu ---
    const TOTAL_GAME_DISTANCE = 15000; // Distance totale en mètres (1 + 11 + 3 km)
    // Positions verticales des lignes en % du bas de playableArea (du bas vers le haut)
    const LANES = [15, 50, 85]; // Index 0=bas, 1=milieu, 2=haut
    // Positions horizontales des "routes" où les voitures peuvent traverser (en % de la largeur de playableArea)
    const ROAD_POSITIONS_HORIZONTAL = [50, 75, 90]; // Exemple : 3 routes
    const GLOBAL_SCALE = 1.3;

    // NOUVEAU : Paramètre global pour la densité/fréquence des obstacles
    // Une valeur de 1.0 correspond à la baseObstacleFrequency définie dans chaque phase.
    // Une valeur plus élevée (ex: 1.5) rend les obstacles 50% plus fréquents.
    // Une valeur plus basse (ex: 0.5) rend les obstacles 50% moins fréquents.
    const GLOBAL_OBSTACLE_DENSITY_FACTOR = 0.5; // Ajuste cette valeur pour changer la difficulté

    // NOUVEAU : Paramètre pour la vitesse de démarrage initiale (très lente)
    const INITIAL_START_SPEED = 10; // pixels par seconde (une valeur très basse)

    const PHASES = [
        {
            name: "Natation",
            distanceThreshold: 1300, // Fin de la natation à 1km
            baseSpeed: 100, // px/s (vitesse "normale" de la phase - ajuster pour ~20s à vitesse base)
            minSpeedFactor: 0.05, // <-- Changement : Permet d'aller très très lent (5% de la baseSpeed)
            maxSpeedFactor: 1.8,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #4682B4)', // Ciel + Eau lointaine
            playableAreaStyle: 'darkcyan', // Eau proche
            obstacleTypes: ['peniche', 'dechet'],
            baseObstacleFrequency: 2000 // ms entre obstacles (à vitesse de base de cette phase)
        },
        {
            name: "Vélo",
            distanceThreshold: 11500, // Fin du vélo à 12km
            baseSpeed: 200, // px/s (ajuster pour ~60s à vitesse base)
            minSpeedFactor: 0.1, // <-- Changement : Permet de ralentir beaucoup à vélo
            maxSpeedFactor: 3.5,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #A9A9A9)', // Ciel + Bâtiments lointains
            playableAreaStyle: '#666', // Route
            obstacleTypes: ['voiture', 'egout', 'poubelle', 'voiture-statique', 'voiture-verticale'],
            baseObstacleFrequency: 2000
        },
        {
            name: "Course",
            distanceThreshold: TOTAL_GAME_DISTANCE, // Fin du jeu à 15km
            baseSpeed: 100, // px/s (ajuster pour ~30s à vitesse base)
            minSpeedFactor: 0.1, // <-- Changement : Permet de ralentir beaucoup en courant
            maxSpeedFactor: 2.5,
            backgroundStyle: 'linear-gradient(to bottom, #87CEEB, #7CFC00)', // Ciel + Parc/Ville
            playableAreaStyle: '#aaa', // Trottoir/Passages piétons
            obstacleTypes: ['pieton', 'egout', 'poubelle', 'voiture', 'pieton-sens-inverse', 'voiture-statique', 'voiture-verticale', 'pieton-verticale'],
            baseObstacleFrequency: 1500
        }
    ];

     // Configuration détaillée de chaque type d'obstacle (pour dimensions, classes, comportement)
     const OBSTACLE_CONFIG = {
        'peniche': { className: 'peniche', width: 120, height: 60, speedFactor: 1.0, isVertical: false },
        'dechet': { className: 'dechet', width: 30, height: 30, speedFactor: 1.0, isVertical: false },
        'voiture': { className: 'voiture', width: 45, height: 80, speedFactor: 1.0, isVertical: false }, // Voiture horizontale "immobile"
        'voiture-statique': { className: 'voiture-statique', width: 85, height: 45, speedFactor: 1.0, isVertical: false }, // Voiture stationnée
        'pieton': { className: 'pieton', width: 35, height: 35, speedFactor: 0.8, isVertical: false }, // Piéton même sens (plus lent que le joueur)
        'pieton-sens-inverse': { className: 'pieton-sens-inverse', width: 35, height: 35, speedFactor: 1.5, isVertical: false }, // Piéton sens inverse (plus rapide horiz.)
        'poubelle': { className: 'poubelle', width: 40, height: 50, speedFactor: 1.0, isVertical: false },
        'egout': { className: 'egout', width: 45, height: 15, speedFactor: 1.0, isVertical: false },

        'voiture-verticale': { className: 'voiture-verticale', width: 45, height: 85, verticalSpeed: 250, speedFactor: 1.0, isVertical: true }, // Vitesse verticale fixe, speedFactor horiz.
        'pieton-verticale': { className: 'pieton', width: 35, height: 35, verticalSpeed: 50, speedFactor: 1.5, isVertical: true }, // Piéton verticales
     };


    // --- État du Jeu ---
    let gameState = 'initial'; // 'initial', 'running', 'gameOver'
    let currentPhaseIndex = 0;
    let distanceCovered = 0; // en mètres (cumulé sur tout le trajet)
    let gameTime = 0; // en secondes
    let playerLane = 1; // 0, 1, 2 (index de LANES)
    let currentSpeed = 0; // pixels par seconde (vitesse horizontale du joueur)
    let targetSpeed = 0; // pixels par seconde (vitesse horizontale visée par les contrôles)
    let minSpeed = 0;
    let maxSpeed = 0;
    let lastTimestamp = 0;
    let timerInterval = null; // Pour le chrono UI
    let gameLoopId = null; // Pour requestAnimationFrame
    // Tableau d'objets obstacles { element: DOM_Element, type: string, config: object, x: number, y: number, ... autres propriétés si besoin}
    let obstacles = [];
    let lastObstacleSpawnTime = 0;
    let backgroundOffset = 0; // Pour le défilement manuel du fond lointain
    let playableAreaOffset = 0; // Pour le défilement manuel de l'avant-plan

    // Facteur global pour réduire la distance parcourue
    // 1.0 = distance normale, 0.5 = moitié de la distance, 2.0 = double distance   
    const GLOBAL_DISTANCE_FACTOR = 0.8;

    // --- Fonctions Principales ---

    function updateUI() {
        const currentPhase = PHASES[currentPhaseIndex];
        modeDisplay.textContent = `Étape : ${currentPhase.name}`;
        const distanceRemaining = Math.max(0, (TOTAL_GAME_DISTANCE - distanceCovered) / 1000);
        distanceDisplay.textContent = `Distance jusqu'à Bobigny : ${distanceRemaining.toFixed(2)} km`;
        timerDisplay.textContent = `Heures passées: ${formatTime(gameTime)}`;

        // NOUVEAU : Message "Accélérer" au début de chaque phase si la vitesse est très basse
        const startMessageElement = document.getElementById('start-message');
        if (gameState === 'running' && currentSpeed < PHASES[currentPhaseIndex].baseSpeed * 0.2 && gameTime < 5) { // Moins de 20% de baseSpeed et dans les 5 premières secondes
             if (!startMessageElement) {
                 const msg = document.createElement('div');
                 msg.id = 'start-message';
                 msg.textContent = "Tap / Flèche Droite pour Accélérer !";
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
                 startMessageElement.remove(); // Supprimer le message
             }
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

     // Helper pour obtenir la durée cible en secondes pour une phase
     function getPhaseDurationSeconds(phase) {
         if (phase.name === "Natation") return 20;
         if (phase.name === "Vélo") return 60; // 1 minute
         if (phase.name === "Course") return 30;
         return 1; // Fallback
     }

     // Calcule les mètres parcourus par pixel de défilement à la vitesse de base de la phase
     function getMetersPerPixelAtBaseSpeed(phase) {
        const duration = getPhaseDurationSeconds(phase);
        if (duration <= 0 || phase.baseSpeed <= 0) return 0;
        const startDistance = (currentPhaseIndex === 0)
            ? 0
            : PHASES[currentPhaseIndex - 1].distanceThreshold;
        const phaseDistance = phase.distanceThreshold - startDistance;
        // distance / (pixels totaux) = mètre par pixel
        const mpp = phaseDistance / (phase.baseSpeed * duration);
        // ← ON MULTIPLIE PAR LE FACTEUR GLOBAL
        return mpp * GLOBAL_DISTANCE_FACTOR;
    }


    function setPhase(phaseIndex) {
        currentPhaseIndex = phaseIndex;
        const phase = PHASES[phaseIndex];

        // Définir les limites de vitesse pour la nouvelle phase
        // La vitesse cible *initiale* sera INITIAL_START_SPEED, pas phase.baseSpeed ici.
        minSpeed = phase.baseSpeed * phase.minSpeedFactor; // Vitesse minimale basée sur la config de la phase
        // La maxSpeed est initialisée ici, mais sera ensuite modifiée par increaseDifficulty
        maxSpeed = phase.baseSpeed * phase.maxSpeedFactor;


        // Styles (couleurs/dégradés ou images)
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


        // Réajuster la position du joueur si nécessaire
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

        // Calcul de la fréquence d'apparition : inversement proportionnelle à la vitesse horizontale du joueur
        // * ET * ajustée par le facteur global de densité d'obstacles.
        const speedRatio = currentSpeed / (phase.baseSpeed || 1);
        const currentObstacleFrequency = (phase.baseObstacleFrequency / (speedRatio || 1)) / GLOBAL_OBSTACLE_DENSITY_FACTOR;

        if (now - lastObstacleSpawnTime < currentObstacleFrequency) {
            return; // Pas encore le moment de faire apparaître un nouvel obstacle
        }
        lastObstacleSpawnTime = now;

        const type = phase.obstacleTypes[Math.floor(Math.random() * phase.obstacleTypes.length)];
        const config = obstacleConfig[type];
        if (!config) {
             console.warn(`Configuration missing for obstacle type: ${type}`);
             return;
        }

        let initialX, initialY;
        let laneIndex = -1;
        const playableAreaWidth = playableArea.offsetWidth;
        const playableAreaHeight = playableArea.offsetHeight;

                // création de l’élément
        const obstacleElement = document.createElement('div');
        obstacleElement.classList.add('obstacle', config.className);

        // *ici* on applique le scale global*
        const w = config.width  * GLOBAL_SCALE;
        const h = config.height * GLOBAL_SCALE;
        obstacleElement.style.width  = `${w}px`;
        obstacleElement.style.height = `${h}px`;


 

        if (config.isVertical) {
            // choix de la route
            const roadPercent = ROAD_POSITIONS_HORIZONTAL[
              Math.floor(Math.random() * ROAD_POSITIONS_HORIZONTAL.length)
            ];
            initialX = (roadPercent / 100) * playableAreaWidth - w / 2;
            initialY = -h;
            initialX += (Math.random() - 0.5) * 15;
          } else {
            initialX = playableAreaWidth + 50;
            const laneIndex = Math.floor(Math.random() * LANES.length);
            const laneBottomPercent = LANES[laneIndex];
            initialY = (100 - laneBottomPercent) / 100 * playableAreaHeight - h / 2;
            initialY += (Math.random() - 0.5) * 10;
          }

        obstacleElement.style.left = `${initialX}px`;
        obstacleElement.style.top = `${initialY}px`;

        obstaclesContainer.appendChild(obstacleElement);
        obstacles.push({
            element: obstacleElement,
            type: type,
            config: config,
            x: initialX,
            y: initialY,
            laneIndex: laneIndex // Utile pour debug ou logique future
        });

        // console.log(`Spawned obstacle: ${type} at [${initialX.toFixed(1)}, ${initialY.toFixed(1)}]`);
    }

    function updateObstacles(deltaTime) {
        const playableAreaWidth = playableArea.offsetWidth;
        const playableAreaHeight = playableArea.offsetHeight;

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            const element = obstacle.element;
            const config = obstacle.config;

            // --- Mise à jour de la position (en pixels) ---

            if (config.isVertical) {
                // Obstacle vertical (voiture qui traverse)
                // Mouvement horizontal : défile avec le décor (currentSpeed * speedFactor)
                obstacle.x -= (currentSpeed * (config.speedFactor || 1.0)) * deltaTime; // Utilise config.speedFactor si défini, sinon 1.0

                // Mouvement vertical : descend à sa vitesse verticale fixe
                obstacle.y += config.verticalSpeed * deltaTime;

            } else {
                // Obstacle horizontal
                // Mouvement horizontal : défile à une vitesse relative au joueur
                obstacle.x -= (currentSpeed * (config.speedFactor || 1.0)) * deltaTime; // Utilise config.speedFactor si défini, sinon 1.0

                // Mouvement vertical : reste sur sa ligne (fixé par Y)
            }

            // Appliquer la nouvelle position à l'élément DOM
            element.style.left = `${obstacle.x}px`;
            element.style.top = `${obstacle.y}px`;

            // --- Vérification de suppression (hors écran) ---
            const obstacleWidth = config.width * GLOBAL_SCALE;
            const obstacleHeight = config.height * GLOBAL_SCALE;

            let shouldRemove = false;

            if (config.isVertical) {
                // Supprimer si sorti en bas (y > hauteur zone jouable)
                shouldRemove = obstacle.y > playableAreaHeight;
            } else {
                // Supprimer si sorti à gauche (x + largeur < 0)
                shouldRemove = obstacle.x + obstacleWidth < 0;
            }

            // Supprimer aussi si sorti très loin à droite ou en haut (marge de sécurité)
             if (!shouldRemove && (obstacle.x > playableAreaWidth + 100 || obstacle.y + obstacleHeight < -100)) {
                 shouldRemove = true;
             }


            if (shouldRemove) {
                obstaclesContainer.removeChild(element);
                obstacles.splice(i, 1);
                 // console.log(`Removed obstacle: ${obstacle.type} (out of bounds)`);
            }
        }
    }

    function checkCollisions() {
        const playerRect = player.getBoundingClientRect();

        for (const obstacle of obstacles) {
            const obstacleRect = obstacle.element.getBoundingClientRect();

            // Collision AABB simple
            if (
                playerRect.left < obstacleRect.right &&
                playerRect.right > obstacleRect.left &&
                playerRect.top < obstacleRect.bottom &&
                playerRect.bottom > obstacleRect.top
            ) {
                // Collision détectée
                // console.log("Collision detected with", obstacle.type);
                return true;
            }
        }
        return false; // Pas de collision
    }

    function increaseDifficulty() {
        // Augmenter la vitesse max légèrement tous les X mètres
        const distanceMilestone = 1500; // Tous les 1 km
        const speedIncreaseFactor = 1.02; // +2% vitesse max par palier

        // Calcul basé sur la distance parcourue totale
        const milestonesReached = Math.floor(distanceCovered / distanceMilestone);

        // Réappliquer le facteur d'augmentation à la vitesse maximale de base de la phase actuelle
        const basePhase = PHASES[currentPhaseIndex];
        const effectiveMaxSpeedFactor = basePhase.maxSpeedFactor * Math.pow(speedIncreaseFactor, milestonesReached);
        maxSpeed = basePhase.baseSpeed * effectiveMaxSpeedFactor;

        // La fréquence des obstacles augmente déjà avec la vitesse du joueur.
        // Le GLOBAL_OBSTACLE_DENSITY_FACTOR ajuste la fréquence globale.
        // On pourrait rendre GLOBAL_OBSTACLE_DENSITY_FACTOR dépendante de milestonesReached ici
        // pour augmenter aussi la DENSITÉ des obstacles au fil du jeu, en plus de leur vitesse relative.
        // Ex: GLOBAL_OBSTACLE_DENSITY_FACTOR = 1.0 + milestonesReached * 0.1; // Augmente de 10% par km
        // (Mais attention, si tu fais ça, il faudrait la recalculer à chaque game loop ou dans setPhase)
    }

    function updateBackground(deltaTime) {
        // Défilement manuel basé sur la vitesse actuelle du joueur
        const backgroundWidth = background.offsetWidth / 2; // Largeur d'une répétition

        // L'arrière-plan lointain défile plus lentement (effet parallaxe)
        backgroundOffset -= currentSpeed * deltaTime * 0.5; // 50% de la vitesse du joueur
        background.style.backgroundPositionX = `${backgroundOffset % backgroundWidth}px`;

        // Défilement de la zone jouable (avant-plan, sol/eau)
        // Elle défile à la même vitesse que le joueur (vitesse relative 1.0)
        if (playableArea.style.backgroundImage && playableArea.style.backgroundImage !== 'none') {
             // Calculer la largeur de répétition si backgroundSize est 'auto 100%' et repeat-x
             // Il faut connaître la largeur intrinsèque de l'image ou la largeur de playableArea
             const playableAreaRepetitionWidth = playableArea.offsetWidth / (playableArea.style.backgroundRepeat === 'repeat-x' ? 1 : 2);
             playableAreaOffset -= currentSpeed * deltaTime * 1.0; // 100% de la vitesse du joueur
             playableArea.style.backgroundPositionX = `${playableAreaOffset % playableAreaRepetitionWidth}px`;
        }
    }


    function gameLoop(timestamp) {
        if (gameState !== 'running') return;

        const deltaTime = (timestamp - (lastTimestamp || performance.now())) / 1000; // en secondes
        lastTimestamp = timestamp;

        // --- Mises à jour ---

        // 1. Vitesse du joueur (interpolation douce)
        const acceleration = 1000; // px/s²
        const deceleration = 1000; // px/s²
        if (currentSpeed < targetSpeed) {
            currentSpeed = Math.min(targetSpeed, currentSpeed + acceleration * deltaTime);
        } else if (currentSpeed > targetSpeed) {
            currentSpeed = Math.max(targetSpeed, currentSpeed - deceleration * deltaTime);
        }
        // Clamp la vitesse ACTUELLE entre min et max
        currentSpeed = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed));


        // 2. Distance parcourue (basée sur la vitesse actuelle et la calibration de la phase)
        const basePhase = PHASES[currentPhaseIndex];
        const metersPerPixel = getMetersPerPixelAtBaseSpeed(basePhase);
        const currentMetersPerSecond = currentSpeed * metersPerPixel;
        distanceCovered += currentMetersPerSecond * deltaTime;


        // 3. Défilement arrière-plan et avant-plan
        updateBackground(deltaTime);

        // 4. Gestion des obstacles
        spawnObstacle(); // Crée de nouveaux obstacles (horizontaux ou verticaux)
        updateObstacles(deltaTime); // Déplace et supprime les obstacles

        // 5. Vérification des collisions
        if (checkCollisions()) {
            gameOver();
            return; // Sortir de la boucle dès la collision
        }

        // 6. Vérification changement de phase
        if (currentPhaseIndex < PHASES.length - 1 && distanceCovered >= PHASES[currentPhaseIndex].distanceThreshold) {
            // Passage à la phase suivante
            setPhase(currentPhaseIndex + 1);
             // Effacer les obstacles de la phase précédente
             obstaclesContainer.innerHTML = '';
             obstacles = [];
        } else if (currentPhaseIndex === PHASES.length - 1 && distanceCovered >= TOTAL_GAME_DISTANCE) {
             // Fin du jeu - Victoire ! (atteint la distance totale dans la dernière phase)
             gameWon();
             return; // Sortir de la boucle
        }


        // 7. Augmenter la difficulté (basé sur la distance parcourue totale)
        increaseDifficulty();


        // 8. Mise à jour UI
        updateUI(); // Mettre à jour l'UI inclut maintenant le message "Accélérer"


        // --- Prochain tour ---
        gameLoopId = requestAnimationFrame(gameLoop);
    }


    function startGame() {
        if (gameState === 'running') return;

        // Supprimer le message "Accélérer" s'il était là
        const startMessageElement = document.getElementById('start-message');
        if (startMessageElement) {
            startMessageElement.remove();
        }

        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        obstaclesContainer.innerHTML = ''; // Vider les anciens obstacles
        obstacles = []; // Vider le tableau d'obstacles

        distanceCovered = 0;
        gameTime = 0;
        playerLane = 1; // Revenir à la ligne du milieu (index 1)
        currentPhaseIndex = -1; // Force le setPhase initial dans la ligne suivante
        lastTimestamp = 0;
        lastObstacleSpawnTime = 0;
        backgroundOffset = 0;
        playableAreaOffset = 0; // Réinitialiser les offsets de fond
        background.style.backgroundPositionX = '0px';
        playableArea.style.backgroundPositionX = '0px';

        // Démarrer à la première phase
        setPhase(0);
        // --- NOUVEAU : Démarrer à une vitesse très lente ---
        currentSpeed = INITIAL_START_SPEED; // Vitesse actuelle très basse au démarrage
        targetSpeed = INITIAL_START_SPEED; // Vitesse cible = vitesse actuelle (pour commencer sans accélérer tout de suite)
        // Les limites minSpeed/maxSpeed sont définies dans setPhase(0)


        gameState = 'running';

        // Démarrer le chrono UI
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (gameState === 'running') {
                gameTime++;
                // updateUI(); // Appelé dans gameLoop, pas besoin ici sauf pour débug/robustesse
            }
        }, 1000); // Mise à jour toutes les secondes

        // Démarrer la boucle de jeu
        cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);

        console.log("Game Started!");
        console.log(`Initial Speed: ${currentSpeed.toFixed(1)} px/s. Min Speed: ${minSpeed.toFixed(1)} px/s. Max Speed: ${maxSpeed.toFixed(1)} px/s.`);
    }

    function gameOver() {
        if (gameState === 'gameOver') return;
        console.log("Game Over!");
        gameState = 'gameOver';
        clearInterval(timerInterval); // Arrêter le chrono
        cancelAnimationFrame(gameLoopId); // Arrêter la boucle de jeu
        finalTimeDisplay.textContent = `Malheureusement vous n'êtes pas arrivé au travail vivant aujourd'hui...`;
        gameOverScreen.querySelector('h2').textContent = "Game Over !";
        // Changer l'image si tu as un sprite spécifique pour la défaite
        // document.getElementById('victory-image').src = 'path/to/gameover.png';
        gameOverScreen.style.display = 'flex'; // Afficher l'écran
    }

    function gameWon() {
        if (gameState === 'gameOver') return;
        console.log("You Win!");
        gameState = 'gameOver'; // Met fin à la boucle
        clearInterval(timerInterval); // Arrêter le chrono
        cancelAnimationFrame(gameLoopId); // Arrêter la boucle de jeu

        finalTimeDisplay.textContent = `Bravo vous avez seulement mis ${formatTime(gameTime)} heures pour arriver au travail`;
        gameOverScreen.querySelector('h2').textContent = "Arrivé à Bobigny !";
        // Afficher l'image de victoire (celle définie dans l'HTML par défaut ou changer ici)
        // document.getElementById('victory-image').src = 'path/to/victory.png';
        gameOverScreen.style.display = 'flex'; // Afficher l'écran
    }

    // --- Gestion des Contrôles (Touch & Clavier) ---

    // Fonctions pour les actions (réutilisées par touch et clavier)
    function handleSpeedUp() {
        if (gameState !== 'running') return;
        // Augmente la vitesse cible vers la maxSpeed
        // Utilise une valeur ajoutée plutôt qu'un multiplicateur quand la vitesse est très faible
        // pour rendre l'accélération initiale plus sensible
        const increment = Math.max(5, targetSpeed * 0.1); // Augmente d'au moins 5 px/s ou 10% de la cible
        targetSpeed = Math.min(maxSpeed, targetSpeed + increment);
         // console.log("Speed Up - Target Speed:", targetSpeed.toFixed(1));
    }

    function handleSlowDown() {
        if (gameState !== 'running') return;
        // Réduit la vitesse cible vers la minSpeed
        // Utilise une valeur soustraite plutôt qu'un multiplicateur quand la vitesse est très faible
         const decrement = Math.max(5, targetSpeed * 0.3); // Réduit d'au moins 5 px/s ou 10% de la cible
        targetSpeed = Math.max(minSpeed, targetSpeed - decrement);
         // console.log("Slow Down - Target Speed:", targetSpeed.toFixed(1));
    }

    function handleChangeLane(direction) {
        if (gameState !== 'running') return;
        if (direction === 'up') {
            movePlayerToLane(playerLane - 1); // Essayer d'aller à la ligne supérieure
        } else if (direction === 'down') {
            movePlayerToLane(playerLane + 1); // Essayer d'aller à la ligne inférieure
        }
        // movePlayerToLane gère déjà le clamping aux limites
        // console.log("Change Lane:", direction, "New Lane Index:", playerLane);
    }


    // --- Écouteurs d'Événements ---

    // 1. Contrôles Touch
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    const swipeThreshold = 20; // Pixels minimum pour détecter un swipe
    let isPointerDownOnControl = false; // Pour distinguer tap sur zones de vitesse vs swipe

    // Tap gauche -> Ralentir
    controlLeft.addEventListener('pointerdown', (e) => {
         if (gameState !== 'running') return;
         isPointerDownOnControl = true;
         handleSlowDown();
         e.preventDefault();
    }, { passive: false });

    // Tap droite -> Accélérer
    controlRight.addEventListener('pointerdown', (e) => {
         if (gameState !== 'running') return;
         isPointerDownOnControl = true;
         handleSpeedUp();
         e.preventDefault();
    }, { passive: false });

     controlLeft.addEventListener('pointerup', () => { isPointerDownOnControl = false; });
     controlLeft.addEventListener('pointerleave', () => { isPointerDownOnControl = false; });
     controlRight.addEventListener('pointerup', () => { isPointerDownOnControl = false; });
     controlRight.addEventListener('pointerleave', () => { isPointerDownOnControl = false; });

    // Swipe (sur le conteneur principal qui couvre tout sauf l'UI bar)
    playableArea.addEventListener('pointerdown', (e) => {
        if (e.target === uiBar || e.target.tagName === 'BUTTON' || e.target.closest('#controls')) {
            return;
        }
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        isSwiping = true;
    });

    playableArea.addEventListener('pointermove', (e) => {
        if (!isSwiping || gameState !== 'running' || isPointerDownOnControl) {
            return;
        }
        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;

        if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
            if (deltaY < 0) { handleChangeLane('up'); } else { handleChangeLane('down'); }
            isSwiping = false;
             e.preventDefault();
        }
    });

    playableArea.addEventListener('pointerup', (e) => {
        isSwiping = false;
        isPointerDownOnControl = false;
        touchStartX = 0;
        touchStartY = 0;
    });

    playableArea.addEventListener('pointercancel', (e) => {
        isSwiping = false;
        isPointerDownOnControl = false;
        touchStartX = 0;
        touchStartY = 0;
    });


    // 2. Contrôles Clavier
    document.addEventListener('keydown', (event) => {
        if (gameState !== 'running') {
             if (event.key === 'Enter') {
                  if (gameOverScreen.style.display !== 'none') { startGame(); event.preventDefault(); }
                  else if (startScreen.style.display !== 'none') { startGame(); event.preventDefault(); }
             }
            return;
        }

        switch (event.key) {
            case 'ArrowLeft': // Flèche gauche pour ralentir
                handleSlowDown();
                event.preventDefault();
                break;
            case 'ArrowRight': // Flèche droite pour accélérer
                handleSpeedUp();
                event.preventDefault();
                break;
            case 'ArrowUp': // Flèche haut pour monter de ligne
                handleChangeLane('down');
                event.preventDefault();
                break;
            case 'ArrowDown': // Flèche bas pour descendre de ligne
                handleChangeLane('up');
                event.preventDefault();
                break;
            // Add other keys if needed
        }
    });


    // 3. Boutons Start/Restart (existants)
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // --- Initialisation ---
    function initializeApp() {
        startScreen.style.display = 'flex';
        gameOverScreen.style.display = 'none';
        movePlayerToLane(playerLane);
        // Set initial UI text before game starts
         modeDisplay.textContent = `Étape : Prêt`;
         distanceDisplay.textContent = `Distance jusqu'à Bobigny : ${TOTAL_GAME_DISTANCE / 1000} km`;
         timerDisplay.textContent = `Heures passées : 00:00`;

         const playerRect = player.getBoundingClientRect();
        player.style.width  = `${playerRect.width  * GLOBAL_SCALE}px`;
        player.style.height = `${playerRect.height * GLOBAL_SCALE}px`;
    }

    initializeApp();

});
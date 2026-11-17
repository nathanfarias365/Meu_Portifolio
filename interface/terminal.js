(() => {
    const form = document.querySelector('.terminal-form');
    const input = document.querySelector('.terminal-input');
    const output = document.querySelector('.terminal-output');
    const gamePanel = document.querySelector('.game-panel');
    const gameCanvas = document.querySelector('.game-canvas');
    const gameStatus = document.querySelector('.game-status');
    const context = gameCanvas.getContext('2d');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const soundToggle = document.querySelector('.sound-toggle');
    const gameKeys = new Set();
    const canvasWidth = gameCanvas.width;
    const canvasHeight = gameCanvas.height;
    const cellSize = 20;

    let gameMode = null;
    let gameState = null;
    let gameFrame = 0;
    let previousFrameTime = 0;
    let gameAccumulator = 0;
    let audioContext = null;
    let cuteSoundsEnabled = true;
    let audioWarningShown = false;

    const writeLine = (text, className = 'terminal-response') => {
        const line = document.createElement('p');
        line.className = className;
        line.textContent = text;
        output.append(line);
        output.scrollTop = output.scrollHeight;
    };

    const setTheme = (theme) => {
        document.body.classList.remove('theme-light', 'theme-retro', 'theme-mono', 'theme-kawaii', 'theme-anime');

        if (theme) document.body.classList.add(theme);

        const themeColors = {
            'theme-light': '#edf2f5',
            'theme-retro': '#080e08',
            'theme-mono': '#070b13',
            'theme-kawaii': '#fff0f6',
            'theme-anime': '#f4f4f1'
        };
        themeMeta.content = themeColors[theme] || '#070b13';
        soundToggle.hidden = theme !== 'theme-kawaii';
        soundToggle.setAttribute('aria-pressed', String(cuteSoundsEnabled));
        soundToggle.textContent = cuteSoundsEnabled ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
        soundToggle.setAttribute('aria-label', cuteSoundsEnabled ? 'Desativar sons kawaii' : 'Ativar sons kawaii');

        if (theme === 'theme-kawaii') {
            if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
                cuteSoundsEnabled = false;
                soundToggle.setAttribute('aria-pressed', 'false');
                soundToggle.textContent = 'SOM INDISPONÍVEL';
                soundToggle.setAttribute('aria-label', 'Sons indisponíveis neste navegador');
                if (!audioWarningShown) {
                    writeLine('Este navegador não oferece áudio; o tema kawaii foi aplicado sem sons.');
                    audioWarningShown = true;
                }
            } else {
                playCuteSound();
            }
        }
    };

    const themeCommands = [
        '/claro — aplica a variação mais clara da página.',
        '/escuro — restaura o tema escuro original da página.',
        '/retro — ativa o visual retrô verde.',
        '/preto e branco — ativa o modo monocromático.',
        '/kawai — ativa o tema rosa pastel com gatinho, laços, corações e sons.',
        '/anime — ativa um layout original em preto e branco, inspirado em páginas de mangá.'
    ];

    const helpLines = [
        'Terminal interativo: digite um comando e pressione Enter ou EXECUTAR.',
        '/help — mostra esta ajuda.',
        '/games — lista os jogos disponíveis.',
        '/tema — lista os temas. Digite o comando do tema para aplicá-lo.',
        '/stop — encerra o jogo atual. /clear — limpa a saída do terminal.',
        'Os jogos também aceitam teclado (setas/WASD) e botões na tela.'
    ];

    const gameLines = [
        'Jogos disponíveis:',
        '/snake — Snake: coma os itens sem bater nas paredes ou em si mesmo.',
        '/spaceship — Galaxy Space: mova a nave e atire nos invasores.',
        '/tetris — Tetris: organize as peças e complete linhas.'
    ];

    const playCuteSound = () => {
        if (!cuteSoundsEnabled || !document.body.classList.contains('theme-kawaii')) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioContext ||= new AudioContextClass();
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(playCuteSound).catch(() => {
                cuteSoundsEnabled = false;
                soundToggle.setAttribute('aria-pressed', 'false');
                soundToggle.textContent = 'SOM: DESLIGADO';
                soundToggle.setAttribute('aria-label', 'Ativar sons kawaii');
                if (!audioWarningShown) {
                    writeLine('Não foi possível iniciar o áudio. O tema continua ativo sem sons.');
                    audioWarningShown = true;
                }
            });
            return;
        }

        [740, 990].forEach((frequency, index) => {
            const start = audioContext.currentTime + index * 0.055;
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.16, start + 0.09);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.13);
        });
    };

    const setGameStatus = () => {
        if (!gameState) return;
        const name = gameMode === 'snake' ? 'SNAKE' : gameMode === 'spaceship' ? 'GALAXY SPACE' : 'TETRIS';
        gameStatus.textContent = gameState.over
            ? `${name} • FIM DE JOGO • PONTOS: ${gameState.score}`
            : `${name} • PONTOS: ${gameState.score}${gameState.paused ? ' • PAUSADO' : ''}`;
        if (gameMode === 'snake') {
            const pauseButton = gamePanel.querySelector('[data-game-action="action"]');
            if (pauseButton) pauseButton.textContent = gameState.paused ? 'RETOMAR' : 'PAUSAR';
        }
    };

    const drawBackground = () => {
        context.fillStyle = '#050a11';
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.strokeStyle = 'rgba(69, 231, 226, 0.07)';
        context.lineWidth = 1;
        for (let x = 0; x <= canvasWidth; x += cellSize) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvasHeight);
            context.stroke();
        }
        for (let y = 0; y <= canvasHeight; y += cellSize) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(canvasWidth, y);
            context.stroke();
        }
    };

    const drawGameMessage = (title, subtitle) => {
        drawBackground();
        context.textAlign = 'center';
        context.fillStyle = '#45e7e2';
        context.font = 'bold 24px Consolas, monospace';
        context.fillText(title, canvasWidth / 2, canvasHeight / 2 - 8);
        context.fillStyle = '#a0b0bb';
        context.font = '12px Consolas, monospace';
        context.fillText(subtitle, canvasWidth / 2, canvasHeight / 2 + 20);
    };

    const randomFood = (body) => {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * (canvasWidth / cellSize)),
                y: Math.floor(Math.random() * (canvasHeight / cellSize))
            };
        } while (body.some((part) => part.x === food.x && part.y === food.y));
        return food;
    };

    const tetrisShapes = [
        { color: '#45e7e2', shape: [[1, 1, 1, 1]] },
        { color: '#42a8ff', shape: [[1, 0, 0], [1, 1, 1]] },
        { color: '#e85bd7', shape: [[0, 0, 1], [1, 1, 1]] },
        { color: '#f4d35e', shape: [[1, 1], [1, 1]] },
        { color: '#61e9a1', shape: [[0, 1, 1], [1, 1, 0]] },
        { color: '#ff8b67', shape: [[0, 1, 0], [1, 1, 1]] },
        { color: '#a78bfa', shape: [[1, 1, 0], [0, 1, 1]] }
    ];

    const makeTetrisPiece = () => {
        const definition = tetrisShapes[Math.floor(Math.random() * tetrisShapes.length)];
        return {
            shape: definition.shape.map((row) => [...row]),
            color: definition.color,
            x: Math.floor((10 - definition.shape[0].length) / 2),
            y: 0
        };
    };

    const startGame = (mode) => {
        stopGame(false);
        gameMode = mode;
        gamePanel.hidden = false;
        gameKeys.clear();
        previousFrameTime = 0;
        gameAccumulator = 0;

        if (mode === 'snake') {
            const body = [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }];
            gameState = {
                body,
                direction: { x: 1, y: 0 },
                nextDirection: { x: 1, y: 0 },
                food: randomFood(body),
                score: 0,
                over: false,
                paused: false
            };
        } else if (mode === 'spaceship') {
            gameState = {
                playerX: canvasWidth / 2,
                bullets: [],
                enemies: [],
                score: 0,
                lives: 3,
                spawnTimer: 0,
                shootTimer: 0,
                over: false,
                paused: false
            };
        } else {
            gameState = {
                board: Array.from({ length: 16 }, () => Array(10).fill(null)),
                piece: null,
                score: 0,
                lines: 0,
                over: false,
                paused: false
            };
            gameState.piece = makeTetrisPiece();
        }

        const controls = gamePanel.querySelectorAll('.game-controls button');
        controls.forEach((button) => {
            const action = button.dataset.gameAction;
            button.hidden = mode === 'spaceship' && ['up', 'down'].includes(action);
            button.hidden = button.hidden || mode === 'tetris' && action === 'up';
            button.textContent = action === 'action'
                ? mode === 'snake' ? 'PAUSAR' : mode === 'spaceship' ? 'ATIRAR' : 'GIRAR'
                : button.getAttribute('aria-label') === 'Esquerda' ? '←'
                    : button.getAttribute('aria-label') === 'Direita' ? '→'
                        : button.getAttribute('aria-label') === 'Cima' ? '↑' : '↓';
        });
        gameCanvas.setAttribute('aria-label', `Área do jogo ${mode}`);
        setGameStatus();
        renderGame();
        gameCanvas.focus({ preventScroll: true });
        gameFrame = requestAnimationFrame(runGameFrame);
    };

    const stopGame = (hide = true) => {
        if (gameFrame) cancelAnimationFrame(gameFrame);
        gameFrame = 0;
        gameMode = null;
        gameState = null;
        gameKeys.clear();
        if (hide) gamePanel.hidden = true;
    };

    const finishGame = () => {
        gameState.over = true;
        gameKeys.clear();
        setGameStatus();
        renderGame();
    };

    const snakeStep = () => {
        const state = gameState;
        state.direction = state.nextDirection;
        const head = {
            x: state.body[0].x + state.direction.x,
            y: state.body[0].y + state.direction.y
        };
        const foundFood = head.x === state.food.x && head.y === state.food.y;
        const bodyToCheck = foundFood ? state.body : state.body.slice(0, -1);

        if (
            head.x < 0 || head.x >= canvasWidth / cellSize ||
            head.y < 0 || head.y >= canvasHeight / cellSize ||
            bodyToCheck.some((part) => part.x === head.x && part.y === head.y)
        ) {
            finishGame();
            return;
        }

        state.body.unshift(head);
        if (foundFood) {
            state.score += 10;
            state.food = randomFood(state.body);
        } else {
            state.body.pop();
        }
        setGameStatus();
    };

    const tetrisCollides = (x, y, shape = gameState.piece.shape) => shape.some((row, rowIndex) =>
        row.some((cell, columnIndex) => {
            if (!cell) return false;
            const boardX = x + columnIndex;
            const boardY = y + rowIndex;
            return boardX < 0 || boardX >= 10 || boardY >= 16 || (boardY >= 0 && gameState.board[boardY][boardX]);
        })
    );

    const spawnTetrisPiece = () => {
        gameState.piece = makeTetrisPiece();
        if (tetrisCollides(gameState.piece.x, gameState.piece.y)) finishGame();
    };

    const lockTetrisPiece = () => {
        const { piece, board } = gameState;
        piece.shape.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
            if (!cell) return;
            const y = piece.y + rowIndex;
            if (y < 0) {
                finishGame();
                return;
            }
            board[y][piece.x + columnIndex] = piece.color;
        }));
        if (gameState.over) return;

        let cleared = 0;
        for (let row = board.length - 1; row >= 0; row -= 1) {
            if (board[row].every(Boolean)) {
                board.splice(row, 1);
                board.unshift(Array(10).fill(null));
                cleared += 1;
                row += 1;
            }
        }
        if (cleared) {
            gameState.lines += cleared;
            gameState.score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
            setGameStatus();
        }
        spawnTetrisPiece();
    };

    const moveTetrisDown = () => {
        if (!tetrisCollides(gameState.piece.x, gameState.piece.y + 1)) {
            gameState.piece.y += 1;
            return true;
        }
        lockTetrisPiece();
        return false;
    };

    const rotateTetrisPiece = () => {
        const shape = gameState.piece.shape;
        const rotated = shape[0].map((_, columnIndex) =>
            shape.map((row) => row[columnIndex]).reverse()
        );
        if (!tetrisCollides(gameState.piece.x, gameState.piece.y, rotated)) {
            gameState.piece.shape = rotated;
        }
    };

    const updateSpaceGame = (delta) => {
        const state = gameState;
        const seconds = delta / 1000;
        if (gameKeys.has('ArrowLeft') || gameKeys.has('a')) state.playerX -= 260 * seconds;
        if (gameKeys.has('ArrowRight') || gameKeys.has('d')) state.playerX += 260 * seconds;
        state.playerX = Math.max(18, Math.min(canvasWidth - 18, state.playerX));

        state.shootTimer -= delta;
        if ((gameKeys.has('Space') || gameKeys.has('action')) && state.shootTimer <= 0) {
            state.bullets.push({ x: state.playerX, y: canvasHeight - 38 });
            state.shootTimer = 230;
        }

        state.spawnTimer += delta;
        if (state.spawnTimer >= 850) {
            state.spawnTimer = 0;
            state.enemies.push({
                x: 20 + Math.random() * (canvasWidth - 40),
                y: -16,
                speed: 55 + Math.random() * 45
            });
        }

        state.bullets.forEach((bullet) => { bullet.y -= 300 * seconds; });
        state.bullets = state.bullets.filter((bullet) => bullet.y > -10);
        state.enemies.forEach((enemy) => { enemy.y += enemy.speed * seconds; });

        state.enemies = state.enemies.filter((enemy) => {
            if (enemy.y > canvasHeight - 32) {
                state.lives -= 1;
                if (state.lives <= 0) finishGame();
                else setGameStatus();
                return false;
            }
            return true;
        });

        for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
            const enemy = state.enemies[enemyIndex];
            const bulletIndex = state.bullets.findIndex((bullet) =>
                Math.abs(bullet.x - enemy.x) < 18 && Math.abs(bullet.y - enemy.y) < 15
            );
            if (bulletIndex !== -1) {
                state.enemies.splice(enemyIndex, 1);
                state.bullets.splice(bulletIndex, 1);
                state.score += 10;
                setGameStatus();
            }
        }

        if (state.lives <= 0) finishGame();
    };

    const drawSnake = () => {
        drawBackground();
        const state = gameState;
        context.fillStyle = '#ff7188';
        context.fillRect(state.food.x * cellSize + 4, state.food.y * cellSize + 4, cellSize - 8, cellSize - 8);
        state.body.forEach((part, index) => {
            context.fillStyle = index === 0 ? '#8cff66' : '#45e7e2';
            context.fillRect(part.x * cellSize + 2, part.y * cellSize + 2, cellSize - 4, cellSize - 4);
        });
        if (state.over) drawGameMessage('FIM DE JOGO', 'Pressione REINICIAR para jogar novamente');
    };

    const drawSpaceship = () => {
        drawBackground();
        const state = gameState;
        context.fillStyle = '#45e7e2';
        state.bullets.forEach((bullet) => context.fillRect(bullet.x - 2, bullet.y - 7, 4, 12));
        state.enemies.forEach((enemy) => {
            context.fillStyle = '#e85bd7';
            context.fillRect(enemy.x - 11, enemy.y - 7, 22, 14);
            context.fillRect(enemy.x - 7, enemy.y + 7, 5, 4);
            context.fillRect(enemy.x + 2, enemy.y + 7, 5, 4);
        });
        context.fillStyle = '#8cff66';
        context.beginPath();
        context.moveTo(state.playerX, canvasHeight - 42);
        context.lineTo(state.playerX - 15, canvasHeight - 16);
        context.lineTo(state.playerX + 15, canvasHeight - 16);
        context.closePath();
        context.fill();
        context.textAlign = 'left';
        context.fillStyle = '#a0b0bb';
        context.font = '11px Consolas, monospace';
        context.fillText(`VIDAS: ${state.lives}`, 12, 20);
        if (state.over) drawGameMessage('NAVE DESTRUÍDA', 'Pressione REINICIAR para outra partida');
    };

    const drawTetrisCell = (x, y, color, size = 20) => {
        context.fillStyle = color;
        context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
        context.fillStyle = 'rgba(255,255,255,0.2)';
        context.fillRect(x * size + 3, y * size + 3, size - 6, 2);
    };

    const drawTetris = () => {
        drawBackground();
        const offsetX = (canvasWidth - 200) / 2;
        context.save();
        context.translate(offsetX, 0);
        gameState.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) drawTetrisCell(x, y, color);
        }));
        gameState.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
            if (cell) drawTetrisCell(gameState.piece.x + x, gameState.piece.y + y, gameState.piece.color);
        }));
        context.restore();
        context.textAlign = 'left';
        context.fillStyle = '#a0b0bb';
        context.font = '12px Consolas, monospace';
        context.fillText('TETRIS', 18, 30);
        context.fillStyle = '#45e7e2';
        context.fillText(`LINHAS: ${gameState.lines}`, 18, 50);
        if (gameState.over) drawGameMessage('FIM DE JOGO', 'Pressione REINICIAR para jogar novamente');
    };

    const renderGame = () => {
        if (!gameState) return;
        if (gameMode === 'snake') drawSnake();
        else if (gameMode === 'spaceship') drawSpaceship();
        else drawTetris();
    };

    const runGameFrame = (time) => {
        if (!gameMode || !gameState || gameState.over) {
            gameFrame = 0;
            return;
        }
        if (!previousFrameTime) previousFrameTime = time;
        const delta = Math.min(time - previousFrameTime, 50);
        previousFrameTime = time;

        if (!gameState.paused) {
            if (gameMode === 'snake') {
                gameAccumulator += delta;
                if (gameAccumulator >= 170) {
                    gameAccumulator = 0;
                    snakeStep();
                }
            } else if (gameMode === 'spaceship') {
                updateSpaceGame(delta);
            } else {
                gameAccumulator += delta;
                if (gameAccumulator >= 550) {
                    gameAccumulator = 0;
                    moveTetrisDown();
                }
            }
        }

        renderGame();
        if (gameMode && gameState && !gameState.over) gameFrame = requestAnimationFrame(runGameFrame);
        else gameFrame = 0;
    };

    const setDirection = (direction) => {
        const directions = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };
        if (gameMode !== 'snake' || !directions[direction]) return;
        const next = directions[direction];
        if (next.x !== -gameState.direction.x || next.y !== -gameState.direction.y) {
            gameState.nextDirection = next;
        }
    };

    const gameAction = (action) => {
        if (action === 'stop') {
            stopGame();
            writeLine('Jogo encerrado. Digite /games para escolher outro.');
            input.focus();
            return;
        }
        if (action === 'restart' && gameMode) {
            startGame(gameMode);
            return;
        }
        if (!gameMode || !gameState || gameState.over) return;

        if (gameMode === 'snake') {
            setDirection(action);
            if (action === 'action') {
                gameState.paused = !gameState.paused;
                setGameStatus();
            }
        } else if (gameMode === 'spaceship') {
            if (action === 'left') gameState.playerX = Math.max(18, gameState.playerX - 24);
            if (action === 'right') gameState.playerX = Math.min(canvasWidth - 18, gameState.playerX + 24);
            if (action === 'action') {
                gameState.bullets.push({ x: gameState.playerX, y: canvasHeight - 38 });
            }
        } else {
            if (action === 'left' && !tetrisCollides(gameState.piece.x - 1, gameState.piece.y)) gameState.piece.x -= 1;
            if (action === 'right' && !tetrisCollides(gameState.piece.x + 1, gameState.piece.y)) gameState.piece.x += 1;
            if (action === 'down') moveTetrisDown();
            if (action === 'up' || action === 'action') rotateTetrisPiece();
        }
        renderGame();
    };

    const runCommand = (rawCommand) => {
        const command = rawCommand.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
        if (!command) return;

        const echo = document.createElement('p');
        echo.className = 'terminal-command';
        const prompt = document.createElement('span');
        prompt.textContent = 'visitor@nathan:~$ ';
        echo.append(prompt, document.createTextNode(rawCommand.trim()));
        output.append(echo);

        if (command === '/clear') {
            output.replaceChildren();
            input.value = '';
            return;
        }
        if (command === '/help') {
            helpLines.forEach((line) => writeLine(line));
        } else if (command === '/games') {
            gameLines.forEach((line) => writeLine(line));
        } else if (command === '/tema') {
            writeLine('Temas disponíveis:');
            themeCommands.forEach((line) => writeLine(line));
        } else if (command === '/claro') {
            setTheme('theme-light');
            writeLine('Variação mais clara aplicada.');
        } else if (command === '/escuro') {
            setTheme('');
            writeLine('Tema escuro original da página restaurado.');
        } else if (command === '/retro') {
            setTheme('theme-retro');
            writeLine('Tema retrô ativado. Bora jogar no modo 8-bit!');
        } else if (command === '/preto e branco') {
            setTheme('theme-mono');
            writeLine('Tema preto e branco ativado.');
        } else if (command === '/kawai') {
            setTheme('theme-kawaii');
            writeLine('Tema kawaii ativado: paleta pastel, ilustrações e detalhes fofos.');
        } else if (command === '/anime') {
            setTheme('theme-anime');
            writeLine('Tema mangá ativado: páginas em preto e branco com painéis de leitura.');
        } else if (command === '/snake') {
            writeLine('Snake iniciado. Use as setas ou WASD; AÇÃO pausa o jogo.');
            startGame('snake');
        } else if (command === '/spaceship') {
            writeLine('Galaxy Space iniciado. Mova a nave e pressione Enter, espaço ou AÇÃO para atirar.');
            startGame('spaceship');
        } else if (command === '/tetris') {
            writeLine('Tetris iniciado. Setas movem, cima ou AÇÃO gira e espaço derruba a peça.');
            startGame('tetris');
        } else if (command === '/stop') {
            stopGame();
            writeLine('Jogo encerrado.');
        } else {
            writeLine(`Comando não reconhecido: ${rawCommand.trim()}. Digite /help para ver as opções.`);
        }

        output.scrollTop = output.scrollHeight;
        input.value = '';
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        runCommand(input.value);
    });

    document.querySelectorAll('[data-game-action]').forEach((button) => {
        button.addEventListener('click', () => gameAction(button.dataset.gameAction));
    });

    soundToggle.addEventListener('click', () => {
        cuteSoundsEnabled = !cuteSoundsEnabled;
        soundToggle.setAttribute('aria-pressed', String(cuteSoundsEnabled));
        soundToggle.textContent = cuteSoundsEnabled ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
        soundToggle.setAttribute('aria-label', cuteSoundsEnabled ? 'Desativar sons kawaii' : 'Ativar sons kawaii');
        if (cuteSoundsEnabled) playCuteSound();
    });

    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a, button:not(.sound-toggle), input, .game-canvas')) {
            playCuteSound();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (!gameMode || !gameState || gameState.over) return;
        if (event.target instanceof HTMLElement && event.target.closest('.terminal-input, button, a')) return;

        const key = event.key.toLowerCase();
        const directionKeys = {
            arrowup: 'up',
            w: 'up',
            arrowdown: 'down',
            s: 'down',
            arrowleft: 'left',
            a: 'left',
            arrowright: 'right',
            d: 'right'
        };

        if (directionKeys[key] && gameMode === 'snake') {
            event.preventDefault();
            setDirection(directionKeys[key]);
        } else if (gameMode === 'spaceship' && ['arrowleft', 'arrowright', 'a', 'd', ' ', 'enter'].includes(key)) {
            event.preventDefault();
            const mappedKey = key === ' ' ? 'Space' : key === 'enter' ? 'action' : key;
            gameKeys.add(mappedKey === 'arrowleft' ? 'ArrowLeft' : mappedKey === 'arrowright' ? 'ArrowRight' : mappedKey);
        } else if (gameMode === 'tetris') {
            if (key === 'arrowleft' || key === 'a') gameAction('left');
            else if (key === 'arrowright' || key === 'd') gameAction('right');
            else if (key === 'arrowdown' || key === 's') gameAction('down');
            else if (key === 'arrowup' || key === 'w') gameAction('up');
            else if (key === ' ') {
                event.preventDefault();
                while (gameMode === 'tetris' && !gameState.over && moveTetrisDown()) {}
                renderGame();
            }
        }
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        gameKeys.delete(key === ' ' ? 'Space' : key === 'enter' ? 'action' : key === 'arrowleft' ? 'ArrowLeft' : key === 'arrowright' ? 'ArrowRight' : key);
    });

    window.addEventListener('blur', () => gameKeys.clear());
})();

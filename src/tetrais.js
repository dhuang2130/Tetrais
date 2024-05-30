const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

context.scale(BLOCK_SIZE, BLOCK_SIZE);

const COLORS = [
    null,
    'cyan',
    'magenta',
    'red',
    'green',
    'yellow',
    'blue',
    'orange'
];

const SHAPES = [
    [],
    [[1, 1, 1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]]
];

var firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

class Tetris {
    constructor() {
        this.grid = this.createGrid();
        this.score = 0;
        this.keyMap = {
            moveLeft: 'ArrowLeft',
            moveRight: 'ArrowRight',
            moveDown: 'ArrowDown',
            rotate: 'ArrowUp',
            slamDown: 'Space',
            storeBlock: 'ShiftLeft'
        };

        this.reset();
        this.updateScore();
        this.bindKeys();
    }

    createGrid() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    reset() {
        this.grid.forEach(row => row.fill(0));
        this.piece = this.randomPiece();
        this.nextPiece = this.randomPiece();
        this.storedPiece = null;
        this.canStore = true;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
    }

    randomPiece() {
        const typeId = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
        return new Piece(SHAPES[typeId], COLORS[typeId]);
    }

    draw() {
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        this.drawMatrix(this.grid, { x: 0, y: 0 });
        this.drawMatrix(this.piece.matrix, this.piece.pos);
    }

    drawMatrix(matrix, offset) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    context.fillStyle = COLORS[value];
                    context.fillRect(x + offset.x, y + offset.y, 1, 1);
                }
            });
        });
    }

    updateScore() {
        document.getElementById('score').innerText = this.score;
        db.collection("scores").add({
            score: this.score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }


    bindKeys() {
        document.addEventListener('keydown', event => {
            if (event.code === this.keyMap.moveLeft) {
                this.move(-1);
            } else if (event.code === this.keyMap.moveRight) {
                this.move(1);
            } else if (event.code === this.keyMap.moveDown) {
                this.drop();
            } else if (event.code === this.keyMap.rotate) {
                this.rotate();
            } else if (event.code === this.keyMap.slamDown) {
                this.slamDown();
            } else if (event.code === this.keyMap.storeBlock) {
                this.store();
            }
        });
    }

    move(dir) {
        this.piece.pos.x += dir;
        if (this.collide()) {
            this.piece.pos.x -= dir;
        }
    }

    drop() {
        this.piece.pos.y++;
        if (this.collide()) {
            this.piece.pos.y--;
            this.merge();
            this.resetPiece();
        }
        this.dropCounter = 0;
    }

    slamDown() {
        while (!this.collide()) {
            this.piece.pos.y++;
        }
        this.piece.pos.y--;
        this.merge();
        this.resetPiece();
    }

    store() {
        if (!this.canStore) return;
        if (this.storedPiece) {
            [this.piece, this.storedPiece] = [this.storedPiece, this.piece];
            this.piece.pos = { x: 3, y: 0 };
        } else {
            this.storedPiece = this.piece;
            this.resetPiece();
        }
        this.canStore = false;
    }

    collide() {
        const [m, o] = [this.piece.matrix, this.piece.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (this.grid[y + o.y] && this.grid[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge() {
        this.piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.grid[y + this.piece.pos.y][x + this.piece.pos.x] = value;
                }
            });
        });
        this.clearLines();
    }

    clearLines() {
        let rowCount = 1;
        outer: for (let y = this.grid.length - 1; y > 0; --y) {
            for (let x = 0; x < this.grid[y].length; ++x) {
                if (this.grid[y][x] === 0) {
                    continue outer;
                }
            }
            const row = this.grid.splice(y, 1)[0].fill(0);
            this.grid.unshift(row);
            ++y;
            this.score += rowCount * 10;
            rowCount *= 2;
        }
    }

    resetPiece() {
        this.piece = this.nextPiece;
        this.nextPiece = this.randomPiece();
        this.piece.pos = { x: 3, y: 0 };
        if (this.collide()) {
            this.reset();
            this.score = 0;
            this.updateScore();
        }
        this.canStore = true;
    }

    rotate() {
        const pos = this.piece.pos.x;
        let offset = 1;
        this.rotateMatrix(this.piece.matrix);
        while (this.collide()) {
            this.piece.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.piece.matrix[0].length) {
                this.rotateMatrix(this.piece.matrix, false);
                this.piece.pos.x = pos;
                return;
            }
        }
    }

    rotateMatrix(matrix, clockwise = true) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        if (clockwise) {
            matrix.forEach(row => row.reverse());
        } else {
            matrix.reverse();
        }
    }

    update(time = 0) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.drop();
        }
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }
}

class Piece {
    constructor(matrix, color) {
        this.matrix = matrix;
        this.color = color;
        this.pos = { x: 3, y: 0 };
    }
}

document.getElementById('start-button').addEventListener('click', () => {
    const tetris = new Tetris();
    tetris.update();
});

document.getElementById('keybind-button').addEventListener('click', () => {
    const keybinds = document.getElementById('keybinds');
    keybinds.classList.toggle('hidden');
});

document.getElementById('save-keybinds').addEventListener('click', () => {
    const tetris = new Tetris();
    const moveLeft = document.getElementById('move-left').innerText;
    const moveRight = document.getElementById('move-right').innerText;
    const moveDown = document.getElementById('move-down').innerText;
    const rotate = document.getElementById('rotate').innerText;
    const slamDown = document.getElementById('slam-down').innerText;
    const storeBlock = document.getElementById('store-block').innerText;

    tetris.keyMap.moveLeft = moveLeft;
    tetris.keyMap.moveRight = moveRight;
    tetris.keyMap.moveDown = moveDown;
    tetris.keyMap.rotate = rotate;
    tetris.keyMap.slamDown = slamDown;
    tetris.keyMap.storeBlock = storeBlock;

    keybinds.classList.add('hidden');
});

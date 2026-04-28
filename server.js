const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ============ HARDCODED USERS ============
const users = [
    { username: 'admin', password: 'admin123', displayName: 'Administrator' },
    { username: 'user', password: 'user123', displayName: 'Test User' },
    { username: 'demo', password: 'demo', displayName: 'Demo Account' }
];

// In-memory file store
const fileStore = [];

// Simple session tracking (in-memory)
const sessions = new Map();

function authenticate(req, res, next) {
    const token = req.headers['x-session-token'];
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    req.user = sessions.get(token);
    next();
}

// ============ ROUTES ============

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }
    const token = uuidv4();
    sessions.set(token, { username: user.username, displayName: user.displayName });
    res.json({ token, displayName: user.displayName, username: user.username });
});

// Logout
app.post('/api/logout', authenticate, (req, res) => {
    const token = req.headers['x-session-token'];
    sessions.delete(token);
    res.json({ message: 'Abgemeldet' });
});

// Upload file
app.post('/api/files', authenticate, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    const { password } = req.body;
    if (!password || password.length < 3) {
        // Remove uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Passwort muss mindestens 3 Zeichen lang sein' });
    }
    const fileEntry = {
        id: uuidv4(),
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        uploadedBy: req.user.username,
        uploadedAt: new Date(),
        password: password,
        mimeType: req.file.mimetype
    };
    fileStore.push(fileEntry);
    res.json({
        id: fileEntry.id,
        originalName: fileEntry.originalName,
        size: fileEntry.size,
        uploadedAt: fileEntry.uploadedAt
    });
});

// List files
app.get('/api/files', authenticate, (req, res) => {
    const files = fileStore.map(f => ({
        id: f.id,
        originalName: f.originalName,
        size: f.size,
        uploadedBy: f.uploadedBy,
        uploadedAt: f.uploadedAt,
        mimeType: f.mimeType,
        isOwner: f.uploadedBy === req.user.username
    }));
    res.json(files);
});

// Download file (requires password)
app.post('/api/files/:id/download', authenticate, (req, res) => {
    const file = fileStore.find(f => f.id === req.params.id);
    if (!file) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    const { password } = req.body;
    if (password !== file.password) {
        return res.status(403).json({ error: 'Falsches Passwort' });
    }
    const filePath = path.join(uploadsDir, file.storedName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Datei nicht auf dem Server gefunden (Testdatei)' });
    }
    res.download(filePath, file.originalName);
});

// Delete file (only owner)
app.delete('/api/files/:id', authenticate, (req, res) => {
    const idx = fileStore.findIndex(f => f.id === req.params.id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    if (fileStore[idx].uploadedBy !== req.user.username) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const file = fileStore.splice(idx, 1)[0];
    const filePath = path.join(uploadsDir, file.storedName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ message: 'Datei gelöscht' });
});

app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║        🔒 VaultDrop Server           ║`);
    console.log(`  ║     http://localhost:${PORT}             ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
    console.log(`  Test-Accounts:`);
    console.log(`  ─────────────────────────────────────`);
    users.forEach(u => console.log(`  👤 ${u.username} / ${u.password}`));
    console.log();
});

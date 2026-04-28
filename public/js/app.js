// ============================================
//  VaultDrop — Frontend Application
// ============================================

const API = '';
let sessionToken = null;
let currentUser = null;
let downloadFileId = null;

// ============ DOM ELEMENTS ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginScreen = $('#login-screen');
const appScreen = $('#app-screen');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const usernameInput = $('#username');
const passwordInput = $('#password');

const userAvatar = $('#user-avatar');
const userDisplayName = $('#user-display-name');
const btnLogout = $('#btn-logout');

const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');
const uploadForm = $('#upload-form');
const selectedFileName = $('#selected-file-name');
const selectedFileSize = $('#selected-file-size');
const btnRemoveFile = $('#btn-remove-file');
const filePasswordInput = $('#file-password');
const btnUpload = $('#btn-upload');
const uploadProgress = $('#upload-progress');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

const filesList = $('#files-list');
const filesEmpty = $('#files-empty');
const fileCount = $('#file-count');

const modalOverlay = $('#modal-overlay');
const modalFileName = $('#modal-file-name');
const downloadPasswordInput = $('#download-password');
const modalError = $('#modal-error');
const btnCloseModal = $('#btn-close-modal');
const btnCancelDownload = $('#btn-cancel-download');
const btnConfirmDownload = $('#btn-confirm-download');

const toastContainer = $('#toast-container');

let selectedFile = null;

// ============ UTILITY ============

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getFileExtension(name) {
    const ext = name.split('.').pop().toLowerCase();
    return ext;
}

function getFileTypeClass(name) {
    const ext = getFileExtension(name);
    if (['pdf'].includes(ext)) return 'pdf';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
    if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'doc';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'img';
    return 'default';
}

function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ TOAST NOTIFICATIONS ============

function showToast(message, type = 'info') {
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${sanitizeText(message)}</span>`;
    toastContainer.appendChild(toast);

    // Haptic-like feedback: brief CSS pulse
    toast.addEventListener('animationend', () => {}, { once: true });

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3500);
}

// ============ RIPPLE EFFECT ============

function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    btn.classList.remove('ripple');
    void btn.offsetWidth; // force reflow
    btn.classList.add('ripple');
    setTimeout(() => btn.classList.remove('ripple'), 600);
}

$$('.btn').forEach(btn => btn.addEventListener('click', addRipple));

// ============ AUTH ============

async function login(username, password) {
    const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

async function logout() {
    await fetch(`${API}/api/logout`, {
        method: 'POST',
        headers: { 'X-Session-Token': sessionToken }
    });
    sessionToken = null;
    currentUser = null;
    switchScreen('login');
}

function switchScreen(screen) {
    loginScreen.classList.remove('active');
    appScreen.classList.remove('active');
    if (screen === 'login') {
        loginScreen.classList.add('active');
        usernameInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
    } else {
        appScreen.classList.add('active');
        loadFiles();
    }
}

// ============ LOGIN FORM ============

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('.btn-login');
    btn.classList.add('loading');
    loginError.textContent = '';
    loginError.classList.remove('visible');

    try {
        const data = await login(usernameInput.value.trim(), passwordInput.value);
        sessionToken = data.token;
        currentUser = { username: data.username, displayName: data.displayName };
        userAvatar.textContent = data.displayName[0].toUpperCase();
        userDisplayName.textContent = data.displayName;
        switchScreen('app');
        showToast(`Willkommen, ${sanitizeText(data.displayName)}!`, 'success');
    } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.add('visible');
        // Shake the form
        loginForm.style.animation = 'none';
        void loginForm.offsetWidth;
        loginForm.style.animation = 'shakeError 0.5s ease';
    } finally {
        btn.classList.remove('loading');
    }
});



// ============ LOGOUT ============

btnLogout.addEventListener('click', () => {
    logout();
    showToast('Abgemeldet', 'info');
});

// ============ FILE UPLOAD ============

// Drag & drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        selectFile(e.dataTransfer.files[0]);
    }
});

uploadZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        selectFile(fileInput.files[0]);
    }
});

function selectFile(file) {
    if (file.size > 50 * 1024 * 1024) {
        showToast('Datei ist zu groß (max. 50 MB)', 'error');
        return;
    }
    selectedFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);
    uploadForm.style.display = '';
    uploadForm.style.animation = 'none';
    void uploadForm.offsetWidth;
    uploadForm.style.animation = 'slideDown 0.3s ease both';
    filePasswordInput.value = '';
    filePasswordInput.focus();
}

btnRemoveFile.addEventListener('click', () => {
    clearFileSelection();
});

function clearFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    uploadForm.style.display = 'none';
}

btnUpload.addEventListener('click', async () => {
    if (!selectedFile) return;
    const password = filePasswordInput.value;
    if (password.length < 3) {
        showToast('Passwort muss mindestens 3 Zeichen haben', 'error');
        filePasswordInput.focus();
        return;
    }

    btnUpload.classList.add('loading');
    uploadProgress.style.display = '';
    progressFill.style.width = '0%';
    progressText.textContent = 'Wird hochgeladen...';

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('password', password);

    try {
        // Simulated progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 15, 90);
            progressFill.style.width = progress + '%';
        }, 200);

        const res = await fetch(`${API}/api/files`, {
            method: 'POST',
            headers: { 'X-Session-Token': sessionToken },
            body: formData
        });

        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = 'Erfolgreich hochgeladen!';

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast('Datei erfolgreich gesichert!', 'success');
        clearFileSelection();
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 1500);
        loadFiles();
    } catch (err) {
        showToast(err.message, 'error');
        uploadProgress.style.display = 'none';
    } finally {
        btnUpload.classList.remove('loading');
    }
});

// ============ FILES LIST ============

async function loadFiles() {
    try {
        const res = await fetch(`${API}/api/files`, {
            headers: { 'X-Session-Token': sessionToken }
        });
        const files = await res.json();
        renderFiles(files);
    } catch (err) {
        showToast('Fehler beim Laden der Dateien', 'error');
    }
}

function renderFiles(files) {
    if (files.length === 0) {
        filesList.innerHTML = '';
        filesEmpty.style.display = '';
        fileCount.textContent = '0 Dateien';
        return;
    }

    filesEmpty.style.display = 'none';
    fileCount.textContent = `${files.length} Datei${files.length !== 1 ? 'en' : ''}`;

    filesList.innerHTML = files.map((f, i) => {
        const typeClass = getFileTypeClass(f.originalName);
        const ext = getFileExtension(f.originalName);
        return `
            <div class="file-card" style="animation-delay: ${i * 0.05}s" data-id="${sanitizeText(f.id)}">
                <div class="file-card-icon ${typeClass}">${sanitizeText(ext)}</div>
                <div class="file-card-info">
                    <div class="file-card-name">${sanitizeText(f.originalName)}</div>
                    <div class="file-card-meta">
                        <span>${formatBytes(f.size)}</span>
                        <span>von ${sanitizeText(f.uploadedBy)}</span>
                        <span>${formatDate(f.uploadedAt)}</span>
                    </div>
                </div>
                <div class="file-card-lock">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Gesichert
                </div>
                <div class="file-card-actions">
                    <button class="btn-icon btn-download" onclick="openDownloadModal('${sanitizeText(f.id)}', '${sanitizeText(f.originalName)}')" title="Herunterladen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </button>
                    ${f.isOwner ? `
                    <button class="btn-icon btn-delete" onclick="deleteFile('${sanitizeText(f.id)}')" title="Löschen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ============ DOWNLOAD MODAL ============

function openDownloadModal(fileId, fileName) {
    downloadFileId = fileId;
    modalFileName.textContent = fileName;
    downloadPasswordInput.value = '';
    modalError.textContent = '';
    modalOverlay.style.display = '';
    downloadPasswordInput.focus();
}

function closeModal() {
    modalOverlay.style.display = 'none';
    downloadFileId = null;
}

btnCloseModal.addEventListener('click', closeModal);
btnCancelDownload.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Close modal with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
        closeModal();
    }
});

// Confirm download with Enter in modal
downloadPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        btnConfirmDownload.click();
    }
});

btnConfirmDownload.addEventListener('click', async () => {
    const password = downloadPasswordInput.value;
    if (!password) {
        modalError.textContent = 'Bitte Passwort eingeben';
        modalError.classList.add('visible');
        return;
    }

    btnConfirmDownload.classList.add('loading');
    modalError.textContent = '';

    try {
        const res = await fetch(`${API}/api/files/${downloadFileId}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ password })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error);
        }

        // Create download
        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'download';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
            if (match) filename = match[1];
        } else {
            filename = modalFileName.textContent;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        closeModal();
        showToast('Download gestartet!', 'success');
    } catch (err) {
        modalError.textContent = err.message;
        modalError.classList.add('visible');
        // Shake modal
        const modal = $('#download-modal');
        modal.style.animation = 'none';
        void modal.offsetWidth;
        modal.style.animation = 'shakeError 0.5s ease';
    } finally {
        btnConfirmDownload.classList.remove('loading');
    }
});

// ============ DELETE FILE ============

async function deleteFile(fileId) {
    const card = document.querySelector(`.file-card[data-id="${fileId}"]`);

    try {
        const res = await fetch(`${API}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'X-Session-Token': sessionToken }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Animate removal
        if (card) {
            card.classList.add('removing');
            card.addEventListener('animationend', () => {
                loadFiles();
            }, { once: true });
        } else {
            loadFiles();
        }
        showToast('Datei gelöscht', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Make functions globally accessible for inline onclick handlers
window.openDownloadModal = openDownloadModal;
window.deleteFile = deleteFile;

// ============ KEYBOARD SHORTCUTS ============

document.addEventListener('keydown', (e) => {
    // Ctrl+U to focus upload
    if (e.ctrlKey && e.key === 'u' && appScreen.classList.contains('active')) {
        e.preventDefault();
        fileInput.click();
    }
});

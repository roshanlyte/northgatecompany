document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const dashboardScreen = document.getElementById('dashboard-screen');
    const logoutBtn = document.getElementById('logout-btn');
    const tbody = document.getElementById('ledger-body');
    const emptyState = document.getElementById('empty-state');
    const entryModal = document.getElementById('entry-modal');
    const entryForm = document.getElementById('entry-form');
    const closeEntryBtn = document.getElementById('close-modal-btn');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const modalTitle = document.getElementById('modal-title');

    // Hide the login screen and show dashboard immediately
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';
    dashboardScreen.classList.add('active');

    // Hide the lock button (no longer needed)
    if (logoutBtn) logoutBtn.style.display = 'none';

    let ledgerData = [];

    // --- Load Data from Firebase via Netlify Function ---
    async function loadLedger() {
        try {
            const response = await fetch('/.netlify/functions/api?load_all=true');
            if (response.ok) {
                const data = await response.json();
                ledgerData = data.redirects || [];
                renderTable();
            } else {
                console.error('Failed to load ledger data:', response.status);
            }
        } catch (e) {
            console.error('Network error loading ledger:', e);
        }
    }

    // --- Save Data to Firebase via Netlify Function ---
    async function saveLedgerAPI() {
        try {
            const res = await fetch('/.netlify/functions/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redirects: ledgerData })
            });
            if (!res.ok) alert('Failed to save changes to the database.');
            else renderTable();
        } catch (e) {
            alert('Network error: Could not reach the database.');
        }
    }

    // --- Render Table ---
    function renderTable() {
        tbody.innerHTML = '';

        if (ledgerData.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            ledgerData.sort((a, b) => parseInt(a.cardId) - parseInt(b.cardId));

            ledgerData.forEach(entry => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${entry.businessName}</strong></td>
                    <td style="font-family: monospace; color: var(--text-muted);">#${entry.cardId}</td>
                    <td><a href="${entry.nfcLink}" target="_blank" style="color: #00aaff; text-decoration: none;">${entry.nfcLink}</a></td>
                    <td class="td-actions">
                        <button class="btn action-edit" data-id="${entry.cardId}">Edit</button>
                        <button class="btn action-delete" data-id="${entry.cardId}">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // --- Add Entry ---
    addEntryBtn.addEventListener('click', () => {
        entryForm.reset();
        document.getElementById('entry-id').value = '';
        modalTitle.textContent = 'Add New Redirect';
        entryModal.classList.add('active');
    });

    closeEntryBtn.addEventListener('click', () => {
        entryModal.classList.remove('active');
    });

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const oldCardId = document.getElementById('entry-id').value;
        const bName = document.getElementById('business-name').value;
        const cId = document.getElementById('card-id').value;
        const nLink = document.getElementById('nfc-link').value;

        const newEntry = { businessName: bName, cardId: cId, nfcLink: nLink };
        const primaryButton = entryForm.querySelector('.primary-btn');
        primaryButton.textContent = 'Saving...';

        if (oldCardId) {
            const idx = ledgerData.findIndex(item => item.cardId === oldCardId);
            if (idx > -1) ledgerData[idx] = newEntry;
            else ledgerData.push(newEntry);
        } else {
            if (ledgerData.find(item => item.cardId === cId)) {
                alert('This Card ID already exists!');
                primaryButton.textContent = 'Save Entry';
                return;
            }
            ledgerData.push(newEntry);
        }

        await saveLedgerAPI();
        primaryButton.textContent = 'Save Entry';
        entryModal.classList.remove('active');
    });

    // --- Edit / Delete ---
    tbody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('action-delete')) {
            const id = e.target.getAttribute('data-id');
            if (confirm(`Delete Card #${id} permanently?`)) {
                ledgerData = ledgerData.filter(item => item.cardId !== id);
                await saveLedgerAPI();
            }
        } else if (e.target.classList.contains('action-edit')) {
            const id = e.target.getAttribute('data-id');
            const entry = ledgerData.find(item => item.cardId === id);
            if (entry) {
                document.getElementById('entry-id').value = entry.cardId;
                document.getElementById('business-name').value = entry.businessName;
                document.getElementById('card-id').value = entry.cardId;
                document.getElementById('nfc-link').value = entry.nfcLink;
                modalTitle.textContent = 'Edit Redirect Settings';
                entryModal.classList.add('active');
            }
        }
    });

    // Hide export button
    const exportBtn = document.getElementById('export-link-btn');
    if (exportBtn) exportBtn.style.display = 'none';

    // Load on startup
    loadLedger();
});

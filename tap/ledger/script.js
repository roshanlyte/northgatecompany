document.addEventListener('DOMContentLoaded', () => {

    // --- State & DOM Elements ---
    let PASSCODE = ""; 
    
    // Screens
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    // Login
    const loginBtn = document.getElementById('login-btn');
    const passcodeInp = document.getElementById('passcode');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Table
    const tbody = document.getElementById('ledger-body');
    const emptyState = document.getElementById('empty-state');
    
    // Modals
    const entryModal = document.getElementById('entry-modal');
    
    // Entry Form
    const entryForm = document.getElementById('entry-form');
    const closeEntryBtn = document.getElementById('close-modal-btn');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const modalTitle = document.getElementById('modal-title');
    
    // Ledger Array
    let ledgerData = [];

    // --- Authentication & DB Fetching ---
    async function checkAuthAndLoad() {
        const storedAuth = sessionStorage.getItem('ledger_auth');
        if (storedAuth) {
            PASSCODE = storedAuth;
            try {
                loginBtn.textContent = "Loading Database...";
                const response = await fetch('/.netlify/functions/api?load_all=true', {
                    headers: { 'Authorization': `Bearer ${PASSCODE}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    ledgerData = data.redirects || [];
                    
                    loginScreen.classList.remove('active');
                    dashboardScreen.classList.add('active');
                    renderTable();
                } else if (response.status === 401) {
                    throw new Error("Unauthorized");
                } else {
                    throw new Error("Server Error");
                }
            } catch (err) {
                sessionStorage.removeItem('ledger_auth');
                loginError.textContent = "Session expired or invalid token.";
                loginScreen.classList.add('active');
                dashboardScreen.classList.remove('active');
            } finally {
                loginBtn.textContent = "Unlock Ledger";
            }
        } else {
            loginScreen.classList.add('active');
            dashboardScreen.classList.remove('active');
        }
    }

    loginBtn.addEventListener('click', () => {
        if (passcodeInp.value) {
            sessionStorage.setItem('ledger_auth', passcodeInp.value);
            loginError.textContent = "";
            checkAuthAndLoad();
        }
    });

    passcodeInp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('ledger_auth');
        PASSCODE = "";
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
        passcodeInp.value = "";
    });

    // --- Core CRUD API Mutators ---
    async function saveLedgerAPI() {
        try {
            const res = await fetch('/.netlify/functions/api', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${PASSCODE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ redirects: ledgerData })
            });
            if (!res.ok) {
                if (res.status === 401) {
                    alert("Session expired. Please log in again.");
                    logoutBtn.click();
                } else {
                    alert("Failed to save changes to the database.");
                }
            } else {
                renderTable();
            }
        } catch (e) {
            alert("Network error: Could not reach the server.");
        }
    }

    function renderTable() {
        tbody.innerHTML = '';
        
        if (ledgerData.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            // Sort by Card ID
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

    // --- Entry Modal Interactions ---
    addEntryBtn.addEventListener('click', () => {
        entryForm.reset();
        document.getElementById('entry-id').value = '';
        modalTitle.textContent = "Add New Redirect";
        entryModal.classList.add('active');
    });

    closeEntryBtn.addEventListener('click', () => {
        entryModal.classList.remove('active');
    });

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const oldCardId = document.getElementById('entry-id').value;
        let bName = document.getElementById('business-name').value;
        const cId = document.getElementById('card-id').value;
        const nLink = document.getElementById('nfc-link').value;
        
        const newEntry = { businessName: bName, cardId: cId, nfcLink: nLink };
        const primaryButton = entryForm.querySelector('.primary-btn');
        const originalText = primaryButton.textContent;
        primaryButton.textContent = "Saving...";

        if (oldCardId) {
            const idx = ledgerData.findIndex(item => item.cardId === oldCardId);
            if (idx > -1) ledgerData[idx] = newEntry;
            else ledgerData.push(newEntry);
        } else {
            if (ledgerData.find(item => item.cardId === cId)) {
                alert("This Card ID already exists!");
                primaryButton.textContent = originalText;
                return;
            }
            ledgerData.push(newEntry);
        }

        await saveLedgerAPI();
        
        primaryButton.textContent = originalText;
        entryModal.classList.remove('active');
    });

    // Delete / Edit Delegation
    tbody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('action-delete')) {
            const id = e.target.getAttribute('data-id');
            if (confirm(`Are you sure you want to delete Card #${id}?`)) {
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
                
                modalTitle.textContent = "Edit Redirect Settings";
                entryModal.classList.add('active');
            }
        }
    });

    // Hide export button (automated now)
    const exportBtn = document.getElementById('export-link-btn');
    if (exportBtn) exportBtn.style.display = 'none';

    // Init check
    checkAuthAndLoad();
});

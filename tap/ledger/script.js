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

    // Redirect table
    const tbody = document.getElementById('ledger-body');
    const emptyState = document.getElementById('empty-state');
    
    // Redirect Modal
    const entryModal = document.getElementById('entry-modal');
    const entryForm = document.getElementById('entry-form');
    const closeEntryBtn = document.getElementById('close-modal-btn');
    const addEntryBtn = document.getElementById('add-entry-btn');
    const modalTitle = document.getElementById('modal-title');

    // Accounts table
    const accountsBody = document.getElementById('accounts-body');
    const accountsEmptyState = document.getElementById('accounts-empty-state');

    // Account Modal
    const accountModal = document.getElementById('account-modal');
    const accountForm = document.getElementById('account-form');
    const closeAccountModalBtn = document.getElementById('close-account-modal-btn');
    const addAccountBtn = document.getElementById('add-account-btn');
    const accountModalTitle = document.getElementById('account-modal-title');

    // Data
    let ledgerData = [];
    let accountsData = [];

    // ── Tabs ─────────────────────────────────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // ── Auth ─────────────────────────────────────────────────────────────────
    async function checkAuthAndLoad() {
        const storedAuth = sessionStorage.getItem('ledger_auth');
        if (storedAuth) {
            PASSCODE = storedAuth;
            try {
                loginBtn.textContent = "Loading Database...";
                const [redirectRes, accRes] = await Promise.all([
                    fetch('/.netlify/functions/api?load_all=true', { headers: { 'Authorization': `Bearer ${PASSCODE}` } }),
                    fetch('/.netlify/functions/api?load_accounts=true', { headers: { 'Authorization': `Bearer ${PASSCODE}` } })
                ]);
                
                if (redirectRes.ok && accRes.ok) {
                    const redirectData = await redirectRes.json();
                    const accData = await accRes.json();
                    ledgerData = redirectData.redirects || [];
                    accountsData = accData.accounts || [];
                    
                    loginScreen.classList.remove('active');
                    dashboardScreen.classList.add('active');
                    renderTable();
                    renderAccounts();
                } else if (redirectRes.status === 401 || accRes.status === 401) {
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

    // ── Redirects CRUD ───────────────────────────────────────────────────────
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
                const errorData = await res.json().catch(() => ({ error: "Unknown Server Error" }));
                if (res.status === 401) {
                    alert("Session expired. Please log in again.");
                    logoutBtn.click();
                } else {
                    alert(`Failed to save: ${errorData.error || "Check console for details"}`);
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

    addEntryBtn.addEventListener('click', () => {
        entryForm.reset();
        document.getElementById('entry-id').value = '';
        modalTitle.textContent = "Add New Redirect";
        entryModal.classList.add('active');
    });

    closeEntryBtn.addEventListener('click', () => entryModal.classList.remove('active'));

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldCardId = document.getElementById('entry-id').value;
        const bName = document.getElementById('business-name').value;
        const cId = document.getElementById('card-id').value;
        const nLink = document.getElementById('nfc-link').value;
        const newEntry = { businessName: bName, cardId: cId, nfcLink: nLink };
        const primaryButton = entryForm.querySelector('.primary-btn');
        const originalText = primaryButton.textContent;
        primaryButton.textContent = "Saving...";

        if (oldCardId) {
            const idx = ledgerData.findIndex(item => item.cardId === oldCardId);
            if (idx > -1) ledgerData[idx] = { ...ledgerData[idx], ...newEntry };
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

    // ── Business Accounts CRUD ───────────────────────────────────────────────
    async function saveAccountsAPI() {
        try {
            const res = await fetch('/.netlify/functions/api', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PASSCODE}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accounts: accountsData })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Unknown" }));
                if (res.status === 401) { alert("Session expired."); logoutBtn.click(); }
                else alert(`Failed to save accounts: ${err.error}`);
            } else {
                renderAccounts();
            }
        } catch (e) {
            alert("Network error saving accounts.");
        }
    }

    function renderAccounts() {
        accountsBody.innerHTML = '';
        if (accountsData.length === 0) {
            accountsEmptyState.classList.remove('hidden');
        } else {
            accountsEmptyState.classList.add('hidden');
            accountsData.forEach((acc, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${acc.businessName}</strong></td>
                    <td style="font-family: monospace; color: var(--text-muted);">#${acc.cardId}</td>
                    <td><span class="username-badge">${acc.username}</span></td>
                    <td style="color: var(--text-muted); font-size: 0.85rem;">••••••••</td>
                    <td class="td-actions">
                        <button class="btn action-edit acc-edit-btn" data-index="${index}">Edit</button>
                        <button class="btn action-delete acc-delete-btn" data-index="${index}">Delete</button>
                    </td>
                `;
                accountsBody.appendChild(tr);
            });
        }
    }

    addAccountBtn.addEventListener('click', () => {
        accountForm.reset();
        document.getElementById('account-edit-index').value = '';
        accountModalTitle.textContent = "Add Business Account";
        accountModal.classList.add('active');
    });

    closeAccountModalBtn.addEventListener('click', () => accountModal.classList.remove('active'));

    accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editIndex = document.getElementById('account-edit-index').value;
        const newAcc = {
            cardId: document.getElementById('acc-card-id').value.trim(),
            businessName: document.getElementById('acc-business-name').value.trim(),
            username: document.getElementById('acc-username').value.trim(),
            password: document.getElementById('acc-password').value.trim()
        };
        const submitBtn = accountForm.querySelector('.primary-btn');
        const orig = submitBtn.textContent;
        submitBtn.textContent = "Saving...";

        if (editIndex !== '') {
            accountsData[parseInt(editIndex)] = newAcc;
        } else {
            if (accountsData.find(a => a.username === newAcc.username)) {
                alert("This username already exists!");
                submitBtn.textContent = orig;
                return;
            }
            accountsData.push(newAcc);
        }

        await saveAccountsAPI();
        submitBtn.textContent = orig;
        accountModal.classList.remove('active');
    });

    accountsBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('acc-delete-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            if (confirm(`Delete account for "${accountsData[index].businessName}"?`)) {
                accountsData.splice(index, 1);
                await saveAccountsAPI();
            }
        } else if (e.target.classList.contains('acc-edit-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const acc = accountsData[index];
            document.getElementById('account-edit-index').value = index;
            document.getElementById('acc-card-id').value = acc.cardId;
            document.getElementById('acc-business-name').value = acc.businessName;
            document.getElementById('acc-username').value = acc.username;
            document.getElementById('acc-password').value = acc.password;
            accountModalTitle.textContent = "Edit Business Account";
            accountModal.classList.add('active');
        }
    });

    // Hide export button (automated now)
    const exportBtn = document.getElementById('export-link-btn');
    if (exportBtn) exportBtn.style.display = 'none';

    // Init
    checkAuthAndLoad();
});

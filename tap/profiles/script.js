document.addEventListener('DOMContentLoaded', () => {

    // --- State & DOM Elements ---
    let PASSCODE = ""; 
    let ledgerData = [];
    let currentEditCardId = null;
    let tempProfiles = []; // holds profiles while modal is open
    
    // Screens
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    // Login
    const loginBtn = document.getElementById('login-btn');
    const passcodeInp = document.getElementById('passcode');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Table
    const tbody = document.getElementById('profiles-body');
    const emptyState = document.getElementById('empty-state');
    
    // Modal
    const entryModal = document.getElementById('entry-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveProfilesBtn = document.getElementById('save-profiles-btn');
    const addProfileBtn = document.getElementById('add-profile-btn');
    
    // Modal internal elements
    const modalCardId = document.getElementById('modal-card-id');
    const modalBusinessName = document.getElementById('modal-business-name');
    const currentProfilesList = document.getElementById('current-profiles-list');
    const noProfilesMsg = document.getElementById('no-profiles-msg');
    
    // New Profile Fields
    const newProfileName = document.getElementById('new-profile-name');
    const newProfilePhoto = document.getElementById('new-profile-photo');

    // --- Authentication & DB Fetching ---
    async function checkAuthAndLoad() {
        // Reuse the same session storage key as ledger so they share auth
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
                loginBtn.textContent = "Unlock Records";
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
            
            // Sort by Card ID
            ledgerData.sort((a, b) => parseInt(a.cardId) - parseInt(b.cardId));

            ledgerData.forEach(entry => {
                const tr = document.createElement('tr');
                const profileCount = entry.profiles ? entry.profiles.length : 0;
                tr.innerHTML = `
                    <td><strong>${entry.businessName}</strong></td>
                    <td style="font-family: monospace; color: var(--text-muted);">#${entry.cardId}</td>
                    <td><span style="background:rgba(0,170,255,0.2); color:#00aaff; padding:3px 8px; border-radius:12px; font-weight:bold; font-size: 0.9em;">${profileCount} Profiles</span></td>
                    <td class="td-actions">
                        <button class="btn action-edit action-manage-profiles" data-id="${entry.cardId}">Manage Profiles</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // Modal Interaction delegates
    tbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('action-manage-profiles')) {
            const id = e.target.getAttribute('data-id');
            const entry = ledgerData.find(item => item.cardId === id);
            if (entry) {
                currentEditCardId = id;
                modalCardId.textContent = entry.cardId;
                modalBusinessName.textContent = entry.businessName;
                
                // clone profiles array so we can edit fearlessly before saving
                tempProfiles = entry.profiles ? [...entry.profiles] : [];
                
                renderProfilesInModal();
                entryModal.classList.add('active');
            }
        }
    });

    closeModalBtn.addEventListener('click', () => {
        entryModal.classList.remove('active');
        newProfileName.value = '';
        newProfilePhoto.value = '';
    });

    function renderProfilesInModal() {
        currentProfilesList.innerHTML = '';
        if (tempProfiles.length === 0) {
            noProfilesMsg.style.display = 'block';
        } else {
            noProfilesMsg.style.display = 'none';
            tempProfiles.forEach((prof, index) => {
                const li = document.createElement('li');
                li.className = 'profile-item';
                
                // fallback avatar if no photo url provided
                const photoSrc = prof.photoUrl ? prof.photoUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name)}&background=random`;

                li.innerHTML = `
                    <div class="profile-info">
                        <img src="${photoSrc}" alt="${prof.name}" class="profile-img">
                        <span class="profile-name">${prof.name}</span>
                    </div>
                    <button type="button" class="delete-profile-btn" data-index="${index}">Delete</button>
                `;
                currentProfilesList.appendChild(li);
            });
        }
    }

    // Add new profile locally
    addProfileBtn.addEventListener('click', () => {
        const nameVal = newProfileName.value.trim();
        const photoVal = newProfilePhoto.value.trim();
        
        if (!nameVal) {
            alert("Profile Name is required!");
            return;
        }

        const newProf = {
            id: Date.now().toString(),
            name: nameVal,
            photoUrl: photoVal
        };

        tempProfiles.push(newProf);
        renderProfilesInModal();
        
        // Reset inputs
        newProfileName.value = '';
        newProfilePhoto.value = '';
    });

    // Delete profile locally
    currentProfilesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-profile-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            tempProfiles.splice(index, 1);
            renderProfilesInModal();
        }
    });

    // Save Changes to Database
    saveProfilesBtn.addEventListener('click', async () => {
        const entryIndex = ledgerData.findIndex(item => item.cardId === currentEditCardId);
        if (entryIndex > -1) {
            const originalText = saveProfilesBtn.textContent;
            saveProfilesBtn.textContent = "Saving...";
            saveProfilesBtn.disabled = true;

            ledgerData[entryIndex].profiles = tempProfiles;
            await saveLedgerAPI();
            
            saveProfilesBtn.textContent = originalText;
            saveProfilesBtn.disabled = false;
            
            entryModal.classList.remove('active');
        }
    });

    // Init check
    checkAuthAndLoad();
});

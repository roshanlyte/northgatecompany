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
    const newProfileFile = document.getElementById('new-profile-file');
    const fileUploadStatus = document.getElementById('file-upload-status');
    let localBase64Image = '';

    // --- Authentication & DB Fetching ---
    async function checkAuthAndLoad() {
        // Use an isolated session storage key so this page asks for password explicitly
        const storedAuth = sessionStorage.getItem('profiles_auth');
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
                    
                    loginBtn.textContent = "Access Granted";
                    loginBtn.style.backgroundColor = "#4BB543";
                    loginBtn.style.color = "white";
                    
                    setTimeout(() => {
                        loginScreen.classList.remove('active');
                        dashboardScreen.classList.add('active');
                        renderTable();
                        
                        setTimeout(() => {
                            loginBtn.style.backgroundColor = "white";
                            loginBtn.style.color = "black";
                            loginBtn.textContent = "Unlock Profiles";
                        }, 500);
                    }, 800);
                } else if (response.status === 401) {
                    throw new Error("Unauthorized");
                } else {
                    throw new Error("Server Error");
                }
            } catch (err) {
                sessionStorage.removeItem('profiles_auth');
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
            sessionStorage.setItem('profiles_auth', passcodeInp.value);
            loginError.textContent = "";
            checkAuthAndLoad();
        }
    });

    passcodeInp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('profiles_auth');
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
                    <td style="text-align: left; padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);"><strong>${entry.businessName}</strong></td>
                    <td style="text-align: left; padding: 24px; color: #aaaaaa; border-bottom: 1px solid rgba(255,255,255,0.05);">#${entry.cardId}</td>
                    <td style="text-align: left; padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color:#00aaff; font-size: 0.9em;">${profileCount} Profiles</span></td>
                    <td style="text-align: right; padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <button class="btn action-manage-profiles" data-id="${entry.cardId}" style="background: #1a3044; color: #00aaff; border: none; border-radius: 4px; padding: 6px 16px; font-size: 0.85rem; font-weight: 500; cursor: pointer;">Manage Profiles</button>
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
        newProfileFile.value = '';
        localBase64Image = '';
        fileUploadStatus.style.display = 'none';
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

    // File Upload Base64 Processor
    newProfileFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            localBase64Image = '';
            fileUploadStatus.style.display = 'none';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 150;
                canvas.height = 150;
                
                const minDim = Math.min(img.width, img.height);
                const startX = (img.width - minDim) / 2;
                const startY = (img.height - minDim) / 2;
                
                ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 150, 150);
                
                localBase64Image = canvas.toDataURL('image/jpeg', 0.8);
                fileUploadStatus.style.display = 'block';
                newProfilePhoto.value = ''; // clear url input prioritizing upload
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Add new profile locally
    addProfileBtn.addEventListener('click', () => {
        const nameVal = newProfileName.value.trim();
        let photoVal = newProfilePhoto.value.trim();
        
        if (localBase64Image) {
            photoVal = localBase64Image;
        }
        
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
        newProfileFile.value = '';
        localBase64Image = '';
        fileUploadStatus.style.display = 'none';
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

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM ──────────────────────────────────────────────────────────────────
    const loginScreen        = document.getElementById('login-screen');
    const dashboardScreen    = document.getElementById('dashboard-screen');
    const usernameInp        = document.getElementById('biz-username');
    const passwordInp        = document.getElementById('biz-password');
    const loginBtn           = document.getElementById('biz-login-btn');
    const loginError         = document.getElementById('biz-login-error');
    const logoutBtn          = document.getElementById('biz-logout-btn');

    const dashBusinessName   = document.getElementById('dash-business-name');
    const dashCardId         = document.getElementById('dash-card-id');

    const statTotal          = document.getElementById('stat-total');
    const statMonth          = document.getElementById('stat-month');
    const statMonthLabel     = document.getElementById('stat-month-label');
    const statAvg            = document.getElementById('stat-avg');
    const statTop            = document.getElementById('stat-top');

    const profilesGrid       = document.getElementById('profiles-grid');
    const reviewFeed         = document.getElementById('review-feed');
    const filterBar          = document.getElementById('filter-bar');

    // ── State ────────────────────────────────────────────────────────────────
    let allReviews = [];
    let currentFilter = 'all';
    let sessionData = null; // { cardId, businessName }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function formatDate(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
             + ' · '
             + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    function starsHtml(rating) {
        if (!rating) return '';
        const r = parseInt(rating);
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    }

    function avatarUrl(name, photoUrl) {
        if (photoUrl && !photoUrl.startsWith('data:image')) return photoUrl;
        if (photoUrl && photoUrl.startsWith('data:image')) return photoUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a2030&color=aaaaff&bold=true`;
    }

    function getFilteredReviews() {
        const now = new Date();
        return allReviews.filter(r => {
            if (currentFilter === 'week') {
                const d = new Date(r.timestamp);
                return (now - d) <= 7 * 24 * 60 * 60 * 1000;
            }
            if (currentFilter === 'month') {
                const d = new Date(r.timestamp);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            if (currentFilter === 'comments') {
                return r.comment && r.comment.trim().length > 0;
            }
            return true; // 'all'
        });
    }

    // ── Auth ─────────────────────────────────────────────────────────────────
    async function tryLogin(username, password) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
        loginError.textContent = '';

        try {
            const url = `/.netlify/functions/api?business_login=true&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok || data.error) {
                loginError.textContent = res.status === 401 ? 'Invalid username or password.' : (data.error || 'Login failed.');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
                return;
            }

            // Store session
            sessionStorage.setItem('biz_session', JSON.stringify({
                cardId: data.cardId,
                businessName: data.businessName,
                username
            }));

            sessionData = { cardId: data.cardId, businessName: data.businessName };
            allReviews = data.reviews || [];
            showDashboard();

        } catch (e) {
            loginError.textContent = 'Network error. Please try again.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.add('active');
        dashBusinessName.textContent = sessionData.businessName || 'My Dashboard';
        dashCardId.textContent = sessionData.cardId ? `Card #${sessionData.cardId}` : '';
        renderAll();
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }

    function logout() {
        sessionStorage.removeItem('biz_session');
        sessionData = null;
        allReviews = [];
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.remove('active');
        usernameInp.value = '';
        passwordInp.value = '';
        loginError.textContent = '';
    }

    // Check existing session on load
    const storedSession = sessionStorage.getItem('biz_session');
    if (storedSession) {
        try {
            const parsed = JSON.parse(storedSession);
            // Re-fetch fresh data for the stored session
            (async () => {
                loginBtn.textContent = 'Loading...';
                loginBtn.disabled = true;
                try {
                    const url = `/.netlify/functions/api?business_login=true&username=${encodeURIComponent(parsed.username)}&password=__reuse__`;
                    // If reuse fails, just show login - we'll re-auth using stored credentials instead
                    // Actually we store username only so we can't silently re-auth. Show login.
                    sessionStorage.removeItem('biz_session');
                } catch(e) {}
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
            })();
        } catch(e) {
            sessionStorage.removeItem('biz_session');
        }
    }

    // ── Login Events ─────────────────────────────────────────────────────────
    loginBtn.addEventListener('click', () => {
        const u = usernameInp.value.trim();
        const p = passwordInp.value.trim();
        if (!u || !p) { loginError.textContent = 'Please enter both username and password.'; return; }
        tryLogin(u, p);
    });

    [usernameInp, passwordInp].forEach(inp => {
        inp.addEventListener('keypress', e => { if (e.key === 'Enter') loginBtn.click(); });
    });

    logoutBtn.addEventListener('click', logout);

    // ── Render All ───────────────────────────────────────────────────────────
    function renderAll() {
        renderStats();
        renderProfileRanking();
        renderReviewFeed();
    }

    // ── Stats ────────────────────────────────────────────────────────────────
    function renderStats() {
        const total = allReviews.length;
        statTotal.textContent = total;

        const now = new Date();
        const monthReviews = allReviews.filter(r => {
            const d = new Date(r.timestamp);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        statMonth.textContent = monthReviews.length;
        statMonthLabel.textContent = now.toLocaleString('en-GB', { month: 'long' });

        // Avg star rating
        const rated = allReviews.filter(r => r.starRating && parseInt(r.starRating) > 0);
        if (rated.length > 0) {
            const avg = rated.reduce((sum, r) => sum + parseInt(r.starRating), 0) / rated.length;
            statAvg.textContent = avg.toFixed(1);
        } else {
            statAvg.textContent = '—';
        }

        // Top profile
        const counts = {};
        allReviews.forEach(r => { counts[r.profileName] = (counts[r.profileName] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
        statTop.textContent = sorted.length > 0 ? sorted[0][0] : '—';
    }

    // ── Profile Ranking ──────────────────────────────────────────────────────
    function renderProfileRanking() {
        profilesGrid.innerHTML = '';

        // Count per profile
        const counts = {};
        const photoMap = {};
        allReviews.forEach(r => {
            counts[r.profileName] = (counts[r.profileName] || 0) + 1;
            if (r.profilePhoto && !photoMap[r.profileName]) photoMap[r.profileName] = r.profilePhoto;
        });

        const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
        const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

        if (sorted.length === 0) {
            profilesGrid.innerHTML = `
                <div class="empty-placeholder" style="grid-column: 1/-1;">
                    <div class="icon">👤</div>
                    <p>No reviews recorded yet.</p>
                </div>`;
            return;
        }

        sorted.forEach(([name, count], i) => {
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
            const rankLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
            const barWidth = Math.round((count / maxCount) * 100);
            const photo = avatarUrl(name, photoMap[name]);
            const card = document.createElement('div');
            card.className = 'profile-rank-card';
            card.innerHTML = `
                <div class="rank-badge ${rankClass}">${rankLabel}</div>
                <img class="profile-avatar" src="${photo}" alt="${name}">
                <div class="profile-info">
                    <div class="name">${name}</div>
                    <div class="count">${count} review${count !== 1 ? 's' : ''}</div>
                    <div class="bar-wrap"><div class="bar-fill" style="width: ${barWidth}%"></div></div>
                </div>
            `;
            profilesGrid.appendChild(card);
        });
    }

    // ── Review Feed ──────────────────────────────────────────────────────────
    function renderReviewFeed() {
        reviewFeed.innerHTML = '';
        const filtered = getFilteredReviews();

        // Sort newest first
        filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (filtered.length === 0) {
            reviewFeed.innerHTML = `
                <div class="empty-placeholder">
                    <div class="icon">📭</div>
                    <p>No reviews match this filter.</p>
                </div>`;
            return;
        }

        filtered.forEach(r => {
            const photo = avatarUrl(r.profileName, r.profilePhoto);
            const item = document.createElement('div');
            item.className = 'review-item';
            item.innerHTML = `
                <img class="review-avatar" src="${photo}" alt="${r.profileName}">
                <div class="review-body">
                    <div class="review-profile-name">${r.profileName}</div>
                    ${r.starRating ? `<div class="review-stars">${starsHtml(r.starRating)}</div>` : ''}
                    ${r.comment && r.comment.trim()
                        ? `<div class="review-comment">"${r.comment.trim()}"</div>`
                        : `<div class="review-no-comment">No comment left</div>`}
                </div>
                <div class="review-meta">
                    <div class="review-date">${formatDate(r.timestamp)}</div>
                </div>
            `;
            reviewFeed.appendChild(item);
        });
    }

    // ── Filter Chips ─────────────────────────────────────────────────────────
    filterBar.addEventListener('click', e => {
        if (e.target.classList.contains('filter-chip')) {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderReviewFeed();
        }
    });

});

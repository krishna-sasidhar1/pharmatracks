/* ================================================================
   PHARMATRACK — scripts.js  (Firebase Edition)
   ================================================================ */

// ─── FIREBASE IMPORTS ─────────────────────────────────────────
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection, doc, addDoc, setDoc, getDoc,
    updateDoc, deleteDoc, onSnapshot,
    serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── APP STATE ────────────────────────────────────────────────
let allMedicines      = [];   // populated by Firestore onSnapshot
let currentShopkeeper = null; // { uid, name, shopName, address, phone, email }
let currentUserRole   = null; // 'user' | 'shopkeeper' | null

// ─── HELPERS ─────────────────────────────────────────────────
function stockLevelFromQty(qty) {
    if (qty <= 0)  return 'out';
    if (qty <= 20) return 'low';
    return 'high';
}
function stockLabel(level) {
    return { high: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }[level] || '';
}
function buildStockClass(level) {
    return { high: 'in-stock', low: 'low-stock', out: 'out-of-stock' }[level] || '';
}

// ─── SEED DATA ────────────────────────────────────────────────
const SEED = [
    { name:"Paracetamol 500mg",  type:"Tablet",     shopName:"Apollo Pharmacy",  address:"Road 12, Banjara Hills, Hyderabad",  stockQty:120, price:"₹30.00",  distance:"0.5 km", description:"Used to relieve mild to moderate pain and reduce fever.", shopId:"seed", isShopOpen:true },
    { name:"Dolo 650",           type:"Tablet",     shopName:"MedPlus",          address:"KPHB Colony, Kukatpally, Hyderabad", stockQty:12,  price:"₹35.00",  distance:"1.2 km", description:"Paracetamol 650mg for fast relief of fever and body ache.", shopId:"seed", isShopOpen:true },
    { name:"Cetirizine 10mg",    type:"Tablet",     shopName:"Wellness Forever", address:"Road 36, Jubilee Hills, Hyderabad",  stockQty:200, price:"₹25.00",  distance:"2.1 km", description:"Antihistamine for allergy symptoms like runny nose, sneezing, itchy eyes.", shopId:"seed", isShopOpen:true },
    { name:"Azithromycin 500mg", type:"Antibiotic", shopName:"Apollo Pharmacy",  address:"Road 12, Banjara Hills, Hyderabad",  stockQty:0,   price:"₹120.00", distance:"0.5 km", description:"Broad-spectrum antibiotic for bacterial infections.", shopId:"seed", isShopOpen:true },
    { name:"Vitamin C Chewable", type:"Supplement", shopName:"Health & Glow",    address:"Somajiguda Circle, Hyderabad",       stockQty:300, price:"₹150.00", distance:"1.5 km", description:"Immune booster supplement for daily nutritional needs.", shopId:"seed", isShopOpen:true },
    { name:"Paracetamol 650mg",  type:"Tablet",     shopName:"Trust Chemists",   address:"Ameerpet Rd, Hyderabad",             stockQty:90,  price:"₹40.00",  distance:"3.0 km", description:"Higher dose paracetamol for stronger pain and fever relief.", shopId:"seed", isShopOpen:true },
    { name:"Digene Gel",         type:"Syrup",      shopName:"MedPlus",          address:"KPHB Colony, Kukatpally, Hyderabad", stockQty:55,  price:"₹110.00", distance:"1.2 km", description:"Antacid gel for quick relief from acidity and heartburn.", shopId:"seed", isShopOpen:true },
    { name:"Shelcal 500",        type:"Supplement", shopName:"Apollo Pharmacy",  address:"Gachibowli Main Rd, Hyderabad",      stockQty:8,   price:"₹130.00", distance:"0.8 km", description:"Calcium + Vitamin D3 for strong bones and teeth.", shopId:"seed", isShopOpen:true },
];

async function seedIfNeeded() {
    try {
        const metaRef  = doc(db, '_meta', 'seeded');
        const metaSnap = await getDoc(metaRef);
        if (metaSnap.exists()) return;
        const batch = writeBatch(db);
        SEED.forEach(med => {
            const level = stockLevelFromQty(med.stockQty);
            batch.set(doc(collection(db, 'medicines')), {
                ...med, stockLevel: level, stock: stockLabel(level), createdAt: serverTimestamp()
            });
        });
        batch.set(metaRef, { seededAt: serverTimestamp() });
        await batch.commit();
        console.log('PharmaTrack: seed data written to Firestore.');
    } catch (e) { console.warn('Seed skipped:', e.message); }
}

// ─── DOM REFS ────────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const searchInput     = $('searchInput');
const resultsSection  = $('resultsSection');
const searchSpinner   = $('searchSpinner');
const searchClearBtn  = $('searchClearBtn');
const navbar          = $('navbar');
const navHomeLink     = $('navHomeLink');
const navPharmaciesLink  = $('navPharmaciesLink');
const navDashboardLink   = $('navDashboardLink');
const mobileNavHome      = $('mobileNavHome');
const mobileNavPharmacies= $('mobileNavPharmacies');
const mobileNavDashboard = $('mobileNavDashboard');
const hamburger       = $('hamburger');
const mobileNav       = $('mobileNav');
const searchView      = $('searchView');
const dashboardView   = $('dashboardView');
const pharmaciesView  = $('pharmaciesView');
const loginBtn        = $('loginBtn');
const logoutBtn       = $('logoutBtn');
const loginModal      = $('loginModal');
const closeModalBtn   = $('closeModalBtn');
const customerLoginBtn      = $('customerLoginBtn');
const showShopkeeperFormBtn = $('showShopkeeperFormBtn');
const roleSelectionArea     = $('roleSelectionArea');
const shopkeeperLoginForm   = $('shopkeeperLoginForm');
const skLoginForm           = $('skLoginForm');
const backToRolesBtn        = $('backToRolesBtn');
const loginError            = $('loginError');
const registerModal      = $('registerModal');
const closeRegisterModal = $('closeRegisterModal');
const registerForm       = $('registerForm');
const openRegisterBtn    = $('openRegisterBtn');
const backToLoginBtn     = $('backToLoginBtn');
const registerError      = $('registerError');
const registerErrorMsg   = $('registerErrorMsg');
const addNewMedBtn        = $('addNewMedBtn');
const addMedFormContainer = $('addMedFormContainer');
const cancelAddMedBtn     = $('cancelAddMedBtn');
const addMedForm          = $('addMedForm');
const inventoryGrid       = $('inventoryGrid');
const qaCheckInteraction  = $('qaCheckInteraction');
const qaScanPrescription  = $('qaScanPrescription');
const qaViewHistory       = $('qaViewHistory');
const interactionModal      = $('interactionModal');
const closeInteractionModal = $('closeInteractionModal');
const checkInteractionBtn   = $('checkInteractionBtn');
const interactionResult     = $('interactionResult');
const historyModal      = $('historyModal');
const closeHistoryModal = $('closeHistoryModal');
const historyList       = $('historyList');
const themeToggle   = $('themeToggle');
const themeIcon     = $('themeIcon');
const toastContainer= $('toastContainer');

// ─── CARD BUILDING ────────────────────────────────────────────
function buildMedicineCard(med, isDashboard = false) {
    const sc   = buildStockClass(med.stockLevel);
    const desc = med.description || '';
    const shop = med.shopName || med.pharmacy || '';
    const addr = med.address  || '';

    if (isDashboard) {
        const qty = med.stockQty !== undefined ? med.stockQty : 0;
        return `
        <div class="medicine-card" role="listitem">
            <div class="card-accent-bar"></div>
            <div class="card-body">
                <div class="card-header">
                    <div class="card-title-group">
                        <div class="medicine-name">${med.name}</div>
                        <span class="medicine-type"><i class="fa-solid fa-capsules" style="font-size:.6rem;"></i> ${med.type}</span>
                        ${desc ? `<p class="medicine-description">${desc}</p>` : ''}
                    </div>
                    <span class="stock-badge ${sc}">${med.stock}</span>
                </div>
                <div class="price" style="margin-bottom:8px;">${med.price}</div>
                <div class="dashboard-toggle">
                    <label>Qty:</label>
                    <input type="number" class="stock-qty-input" min="0" value="${qty}"
                        id="qty-${med.docId}"
                        onchange="changeStockQty('${med.docId}', this.value)"
                        aria-label="Stock quantity for ${med.name}">
                    <span class="stock-badge ${sc}" id="badge-${med.docId}" style="margin-left:4px;">${med.stock}</span>
                    <button class="delete-btn" onclick="deleteStock('${med.docId}')" title="Delete Medicine">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    const shopOpen      = med.isShopOpen !== false;
    const statusClass   = shopOpen ? 'shop-open-label'   : 'shop-closed-label';
    const statusText    = shopOpen ? 'Open'              : 'Closed';
    const statusIcon    = shopOpen ? 'fa-door-open'      : 'fa-door-closed';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop + ', ' + addr)}`;

    return `
    <div class="medicine-card" role="listitem">
        <div class="card-accent-bar"></div>
        <div class="card-body">
            <div class="card-header">
                <div class="card-title-group">
                    <div class="medicine-name-row">
                        <div class="medicine-name">${med.name}</div>
                        <span class="${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${statusText}</span>
                    </div>
                    ${desc ? `<p class="medicine-description">${desc}</p>` : ''}
                    <span class="medicine-type"><i class="fa-solid fa-capsules" style="font-size:.6rem;"></i> ${med.type}</span>
                </div>
                <span class="stock-badge ${sc}">${med.stock}</span>
            </div>
            <div class="pharmacy-info">
                <div class="pharmacy-name"><i class="fa-solid fa-house-medical-circle-check"></i> ${shop}</div>
                <p class="pharmacy-address">${addr}</p>
                <span class="pharmacy-distance"><i class="fa-solid fa-location-dot"></i> ${med.distance || ''} away</span>
            </div>
        </div>
        <div class="card-footer">
            <div class="price">${med.price}</div>
            <button class="btn btn-primary btn-sm" onclick="window.open('${mapsUrl}','_blank')" aria-label="Get directions to ${shop}">
                <i class="fa-solid fa-diamond-turn-right"></i> Directions
            </button>
        </div>
    </div>`;
}

// ─── SEARCH ───────────────────────────────────────────────────
let searchDebounce = null;

function renderMedicines(items) {
    if (!items.length) {
        resultsSection.innerHTML = `
        <div class="empty-state">
            <div class="empty-illustration"><i class="fa-solid fa-pills"></i></div>
            <h3>No medicines found</h3>
            <p>Try a different name or check for spelling errors.</p>
        </div>`;
        return;
    }
    resultsSection.innerHTML = `<div class="results-grid" role="list">${items.map(m => buildMedicineCard(m)).join('')}</div>`;
}

function showEmptyHero() {
    resultsSection.innerHTML = `
    <div class="empty-state" id="emptyState">
        <div class="empty-illustration"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
        <h3>Start your search</h3>
        <p>Type a medicine name or pharmacy to see real-time availability.</p>
    </div>`;
}

searchInput.addEventListener('input', e => {
    const q = e.target.value.trim();
    searchClearBtn.style.display = q ? 'flex' : 'none';
    clearTimeout(searchDebounce);
    if (!q) { showEmptyHero(); searchSpinner.classList.remove('visible'); return; }
    searchSpinner.classList.add('visible');
    searchDebounce = setTimeout(() => {
        const ql = q.toLowerCase();
        const filtered = allMedicines.filter(m =>
            (m.name    || '').toLowerCase().includes(ql) ||
            (m.shopName|| '').toLowerCase().includes(ql) ||
            (m.type    || '').toLowerCase().includes(ql)
        );
        renderMedicines(filtered);
        searchSpinner.classList.remove('visible');
        addToHistory(q);
    }, 350);
});

searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    searchSpinner.classList.remove('visible');
    showEmptyHero();
    searchInput.focus();
});

// ─── NAVIGATION ───────────────────────────────────────────────
function setActiveNav(links) {
    $$('.nav-item').forEach(el => el.classList.remove('active'));
    links.forEach(el => el && el.classList.add('active'));
}

function showView(name) {
    searchView.style.display     = 'none';
    dashboardView.style.display  = 'none';
    pharmaciesView.style.display = 'none';
    mobileNav.style.display = 'none';
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if      (name === 'search')     searchView.style.display     = 'block';
    else if (name === 'dashboard')  dashboardView.style.display  = 'block';
    else if (name === 'pharmacies') pharmaciesView.style.display = 'block';
}

navHomeLink.addEventListener('click', e => {
    e.preventDefault(); setActiveNav([navHomeLink, mobileNavHome]); showView('search');
});
navPharmaciesLink.addEventListener('click', e => {
    e.preventDefault(); setActiveNav([navPharmaciesLink, mobileNavPharmacies]); showView('pharmacies'); initPharmaciesView();
});
navDashboardLink.addEventListener('click', e => {
    e.preventDefault(); setActiveNav([navDashboardLink, mobileNavDashboard]); showView('dashboard'); renderDashboard();
});
mobileNavHome.addEventListener('click',       e => { e.preventDefault(); navHomeLink.click(); });
mobileNavPharmacies.addEventListener('click', e => { e.preventDefault(); navPharmaciesLink.click(); });
mobileNavDashboard.addEventListener('click',  e => { e.preventDefault(); navDashboardLink.click(); });
$('navHome').addEventListener('click', e => { e.preventDefault(); navHomeLink.click(); });

// ─── MODALS ───────────────────────────────────────────────────
function openModal(m)  { m.classList.add('active'); }
function closeModal(m) { m.classList.remove('active'); }
[loginModal, interactionModal, historyModal, registerModal].forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); })
);

loginBtn.addEventListener('click',      () => openModal(loginModal));
closeModalBtn.addEventListener('click', () => closeModal(loginModal));

customerLoginBtn.addEventListener('click', () => {
    currentUserRole = 'user';
    closeModal(loginModal);
    updateAuthUI();
    showToast('Signed in as Customer 👋', 'success');
});

showShopkeeperFormBtn.addEventListener('click', () => {
    roleSelectionArea.style.display   = 'none';
    shopkeeperLoginForm.style.display = 'block';
});

backToRolesBtn.addEventListener('click', () => {
    roleSelectionArea.style.display   = 'block';
    shopkeeperLoginForm.style.display = 'none';
    loginError.style.display          = 'none';
    skLoginForm.reset();
});

// ─── SHOPKEEPER LOGIN (Firebase Auth) ─────────────────────────
skLoginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('skEmail').value.trim();
    const pass  = $('skPassword').value;
    loginError.style.display = 'none';
    const btn = skLoginForm.querySelector('[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal(loginModal);
        skLoginForm.reset();
        setTimeout(() => {
            roleSelectionArea.style.display   = 'block';
            shopkeeperLoginForm.style.display = 'none';
            loginError.style.display          = 'none';
        }, 300);
    } catch {
        loginError.style.display = 'flex';
        $('skPassword').value = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
    if (currentUserRole === 'shopkeeper') await signOut(auth);
    else { currentUserRole = null; updateAuthUI(); }
    setActiveNav([navHomeLink, mobileNavHome]);
    showView('search');
    showToast('Signed out successfully', 'info');
});

// ─── AUTH UI UPDATE ───────────────────────────────────────────
function updateAuthUI() {
    const loggedIn = !!currentUserRole;
    loginBtn.style.display  = loggedIn ? 'none'        : 'inline-flex';
    logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    const isDash = currentUserRole === 'shopkeeper';
    navDashboardLink.style.display   = isDash ? 'inline-flex' : 'none';
    mobileNavDashboard.style.display = isDash ? 'flex'        : 'none';
}

// ─── REGISTER (Firebase Auth + Firestore) ─────────────────────
openRegisterBtn.addEventListener('click', () => {
    closeModal(loginModal); openModal(registerModal);
    registerForm.reset(); registerError.style.display = 'none';
});
closeRegisterModal.addEventListener('click', () => closeModal(registerModal));
backToLoginBtn.addEventListener('click', () => {
    closeModal(registerModal); openModal(loginModal);
    roleSelectionArea.style.display   = 'block';
    shopkeeperLoginForm.style.display = 'none';
});

function showRegisterError(msg) {
    registerErrorMsg.textContent = msg;
    registerError.style.display  = 'flex';
}

registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    registerError.style.display = 'none';
    const name    = $('regName').value.trim();
    const shop    = $('regShop').value.trim();
    const address = $('regAddress').value.trim();
    const email   = $('regEmail').value.trim();
    const phone   = $('regPhone').value.trim();
    const pass    = $('regPassword').value;
    const confirm = $('regConfirm').value;

    if (!name || !shop || !address || !email || !pass) { showRegisterError('Please fill in all required fields.'); return; }
    if (pass.length < 6)  { showRegisterError('Password must be at least 6 characters.'); return; }
    if (pass !== confirm) { showRegisterError('Passwords do not match.'); return; }

    const btn = registerForm.querySelector('[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Registering...';
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, 'shopkeepers', cred.user.uid), {
            name, shopName: shop, address, email, phone,
            isOpen: true, createdAt: serverTimestamp()
        });
        registerForm.reset();
        closeModal(registerModal);
        showToast(`🎉 Welcome, ${name}! Your pharmacy is registered.`, 'success');
    } catch (err) {
        if (err.code === 'auth/email-already-in-use')
            showRegisterError('This email is already registered. Please log in.');
        else if (err.code === 'auth/invalid-email')
            showRegisterError('Invalid email address.');
        else showRegisterError(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-store"></i> Register Pharmacy';
    }
});

// ─── SEARCH HISTORY (localStorage only) ───────────────────────
const MAX_HISTORY = 10;
function getHistory() { return JSON.parse(localStorage.getItem('pharmaHistory') || '[]'); }
function addToHistory(q) {
    if (!q || q.length < 2) return;
    let h = getHistory().filter(x => x !== q);
    h.unshift(q);
    if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
    localStorage.setItem('pharmaHistory', JSON.stringify(h));
}

// ─── QUICK ACTIONS ────────────────────────────────────────────
qaCheckInteraction.addEventListener('click', () => {
    openModal(interactionModal);
    interactionResult.style.display = 'none';
    $('drug1').value = ''; $('drug2').value = '';
});
qaScanPrescription.addEventListener('click', () => showToast('Prescription scanner coming soon! 📋', 'info'));
qaViewHistory.addEventListener('click', () => { renderHistory(); openModal(historyModal); });

// ─── INTERACTION CHECKER ──────────────────────────────────────
const knownInteractions = [
    { drugs:['aspirin','ibuprofen'],    level:'moderate',  note:'Both NSAIDs — increased risk of GI bleeding.' },
    { drugs:['aspirin','warfarin'],     level:'dangerous', note:'High risk of serious bleeding. Avoid without doctor supervision.' },
    { drugs:['paracetamol','alcohol'],  level:'dangerous', note:'Combining paracetamol with alcohol increases risk of liver damage.' },
    { drugs:['cetirizine','alcohol'],   level:'moderate',  note:'May increase drowsiness. Avoid operating heavy machinery.' },
    { drugs:['metformin','alcohol'],    level:'moderate',  note:'Risk of lactic acidosis. Limit alcohol consumption.' },
    { drugs:['azithromycin','antacids'],level:'moderate',  note:'Antacids may reduce azithromycin absorption. Take 2 hours apart.' },
    { drugs:['dolo','paracetamol'],     level:'dangerous', note:'Dolo 650 contains paracetamol — double dosing is dangerous.' },
];
closeInteractionModal.addEventListener('click', () => closeModal(interactionModal));
checkInteractionBtn.addEventListener('click', () => {
    const d1 = $('drug1').value.trim().toLowerCase();
    const d2 = $('drug2').value.trim().toLowerCase();
    if (!d1 || !d2) { showToast('Please enter both medicine names.', 'error'); return; }
    checkInteractionBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';
    checkInteractionBtn.disabled = true;
    setTimeout(() => {
        checkInteractionBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Check Interaction';
        checkInteractionBtn.disabled = false;
        const match = knownInteractions.find(r =>
            (r.drugs[0].includes(d1)||d1.includes(r.drugs[0]))&&(r.drugs[1].includes(d2)||d2.includes(r.drugs[1]))||
            (r.drugs[0].includes(d2)||d2.includes(r.drugs[0]))&&(r.drugs[1].includes(d1)||d1.includes(r.drugs[1]))
        );
        interactionResult.style.display = 'block';
        if (match) {
            const icons = { safe:'✅', moderate:'⚠️', dangerous:'🚨' };
            interactionResult.className = `interaction-result ${match.level}`;
            interactionResult.innerHTML = `<div class="interaction-result-title">${icons[match.level]} ${match.level.charAt(0).toUpperCase()+match.level.slice(1)} Interaction</div><div class="interaction-result-desc">${match.note}</div>`;
        } else {
            interactionResult.className = 'interaction-result safe';
            interactionResult.innerHTML = `<div class="interaction-result-title">✅ No Known Interaction</div><div class="interaction-result-desc">No significant interaction found between <strong>${d1}</strong> and <strong>${d2}</strong>. Always consult your doctor.</div>`;
        }
    }, 800);
});

// ─── HISTORY MODAL ────────────────────────────────────────────
closeHistoryModal.addEventListener('click', () => closeModal(historyModal));
function renderHistory() {
    const h = getHistory();
    if (!h.length) {
        historyList.innerHTML = `<div class="empty-state" style="padding:32px 0;"><div class="empty-illustration" style="font-size:2rem;"><i class="fa-solid fa-clock-rotate-left"></i></div><p>No search history yet.</p></div>`;
        return;
    }
    historyList.innerHTML = h.map(q => `
    <button class="history-item" onclick="window._applyHistorySearch('${q.replace(/'/g,"\\\'")}')">
        <i class="fa-solid fa-clock-rotate-left" style="color:var(--text-faint);font-size:.8rem;"></i>
        <span>${q}</span>
        <i class="fa-solid fa-arrow-up-left" style="color:var(--text-faint);font-size:.75rem;margin-left:auto;"></i>
    </button>`).join('');
}
window._applyHistorySearch = function(q) {
    closeModal(historyModal); setActiveNav([navHomeLink,mobileNavHome]); showView('search');
    searchInput.value = q; searchClearBtn.style.display = 'flex';
    searchInput.dispatchEvent(new Event('input'));
};
const historyStyle = document.createElement('style');
historyStyle.textContent = `.history-item{display:flex;align-items:center;gap:10px;width:100%;padding:12px 4px;background:none;border:none;border-bottom:1px solid var(--border-dark);color:var(--text-body);font-size:.9rem;font-weight:500;cursor:pointer;font-family:inherit;text-align:left;transition:color .2s}.history-item:hover{color:var(--primary)}.history-item:last-child{border-bottom:none}`;
document.head.appendChild(historyStyle);

// ─── DASHBOARD ────────────────────────────────────────────────
addNewMedBtn.addEventListener('click', () => {
    addMedFormContainer.style.display = 'block';
    addMedFormContainer.scrollIntoView({ behavior:'smooth', block:'nearest' });
});
cancelAddMedBtn.addEventListener('click', () => { addMedFormContainer.style.display = 'none'; addMedForm.reset(); });

addMedForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentShopkeeper) { showToast('Not logged in.', 'error'); return; }
    const priceVal = parseFloat($('medPrice').value).toFixed(2);
    const qty   = parseInt($('medStockQty').value, 10) || 0;
    const level = stockLevelFromQty(qty);
    try {
        await addDoc(collection(db, 'medicines'), {
            shopId:    currentShopkeeper.uid,
            shopName:  currentShopkeeper.shopName,
            address:   currentShopkeeper.address,
            name:      $('medName').value,
            type:      $('medType').value,
            description: $('medDescription').value.trim(),
            price:     '₹' + priceVal,
            stockQty:  qty,
            stockLevel: level,
            stock:     stockLabel(level),
            distance:  '0.0 km',
            isShopOpen: true,
            createdAt: serverTimestamp()
        });
        addMedForm.reset();
        addMedFormContainer.style.display = 'none';
        showToast(`Medicine added to inventory ✓`, 'success');
    } catch(err) { showToast('Failed to add medicine: ' + err.message, 'error'); }
});

window.changeStockQty = async function(docId, rawVal) {
    const qty   = Math.max(0, parseInt(rawVal, 10) || 0);
    const level = stockLevelFromQty(qty);
    try {
        await updateDoc(doc(db, 'medicines', docId), {
            stockQty: qty, stockLevel: level, stock: stockLabel(level)
        });
        showToast(`Stock updated → ${stockLabel(level)} (${qty} units)`, 'success');
    } catch(err) { showToast('Update failed: ' + err.message, 'error'); }
};

window.deleteStock = async function(docId) {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    try {
        await deleteDoc(doc(db, 'medicines', docId));
        showToast('Medicine deleted', 'info');
    } catch(err) { showToast('Delete failed: ' + err.message, 'error'); }
};

function renderDashboard() {
    if (!currentShopkeeper) return;
    const myShop = currentShopkeeper.shopName;
    const myMeds = allMedicines.filter(m => m.shopId === currentShopkeeper.uid);
    const isOpen = currentShopkeeper.isOpen !== false;
    const tog = $('shopStatusToggle');
    const lbl = $('shopStatusLabel');
    if (tog) tog.checked = isOpen;
    if (lbl) lbl.textContent = isOpen ? 'Shop is Open' : 'Shop is Closed';
    if (!myMeds.length) {
        inventoryGrid.innerHTML = `<div class="empty-state"><div class="empty-illustration"><i class="fa-solid fa-boxes-stacked"></i></div><h3>No medicines yet</h3><p>Click "Add Medicine" to get started.</p></div>`;
        return;
    }
    inventoryGrid.innerHTML = myMeds.map(m => buildMedicineCard(m, true)).join('');
}

// Shop open/close toggle
document.addEventListener('change', async e => {
    if (e.target && e.target.id === 'shopStatusToggle' && currentShopkeeper) {
        const isOpen = e.target.checked;
        try {
            await updateDoc(doc(db, 'shopkeepers', currentShopkeeper.uid), { isOpen });
            currentShopkeeper.isOpen = isOpen;
            const lbl = $('shopStatusLabel');
            if (lbl) lbl.textContent = isOpen ? 'Shop is Open' : 'Shop is Closed';
            showToast(isOpen ? '🟢 Your shop is now Open' : '🔴 Your shop is now Closed', isOpen ? 'success' : 'info');
        } catch(err) { showToast('Failed to update status', 'error'); }
    }
});

// ─── MAP & LOCATION ───────────────────────────────────────────
let map = null, userMarker = null, pharmacyMarkers = [];

function initPharmaciesView() {
    const stored = localStorage.getItem('pharmaLocation');
    if (stored) showMapSection(JSON.parse(stored));
    else showLocationPrompt();
}
function showLocationPrompt() { $('locationPrompt').style.display = 'flex'; $('mapSection').style.display = 'none'; }
function showMapSection(loc)  { $('locationPrompt').style.display = 'none'; $('mapSection').style.display = 'block'; loadMap(loc); }

$('useMyLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported.', 'error'); return; }
    const btn = $('useMyLocationBtn');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Locating...'; btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
        pos => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            localStorage.setItem('pharmaLocation', JSON.stringify(loc));
            btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My Location'; btn.disabled = false;
            showMapSection(loc);
        },
        () => {
            btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My Location'; btn.disabled = false;
            showToast('Location access denied. Try entering your address.', 'error');
        },
        { timeout: 10000 }
    );
});

$('searchAddressBtn').addEventListener('click', searchByAddress);
$('addressInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchByAddress(); });

async function searchByAddress() {
    const address = $('addressInput').value.trim();
    if (!address) { showToast('Please enter an address first.', 'error'); return; }
    const btn = $('searchAddressBtn');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; btn.disabled = true;
    $('addressError').style.display = 'none';
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        const data = await resp.json();
        if (!data.length) { $('addressError').style.display = 'flex'; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>'; btn.disabled = false; return; }
        const loc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
        localStorage.setItem('pharmaLocation', JSON.stringify(loc));
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>'; btn.disabled = false;
        showMapSection(loc);
    } catch { showToast('Network error.', 'error'); btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>'; btn.disabled = false; }
}

$('changeLocationBtn').addEventListener('click', () => {
    localStorage.removeItem('pharmaLocation');
    if (map) { pharmacyMarkers.forEach(m => map.removeLayer(m)); pharmacyMarkers = []; if (userMarker) { map.removeLayer(userMarker); userMarker = null; } }
    $('pharmacyCountBar').style.display = 'none'; $('addressInput').value = ''; $('addressError').style.display = 'none';
    showLocationPrompt();
});

async function loadMap(loc) {
    if (loc.label) { const short = loc.label.split(',').slice(0,3).join(','); $('locationLabel').textContent = `Showing pharmacies near ${short}`; }
    else $('locationLabel').textContent = 'Showing pharmacies near your current location.';
    if (!map) { map = L.map('map').setView([loc.lat, loc.lng], 15); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map); }
    else map.setView([loc.lat, loc.lng], 15);
    setTimeout(() => map.invalidateSize(), 150);
    pharmacyMarkers.forEach(m => map.removeLayer(m)); pharmacyMarkers = [];
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    const userIcon = L.divIcon({ className:'user-loc-icon', html:'<div class="user-loc-ring"></div><div class="user-loc-dot"></div>', iconSize:[40,40], iconAnchor:[20,20] });
    userMarker = L.marker([loc.lat, loc.lng], { icon: userIcon, zIndexOffset:1000 }).addTo(map).bindPopup('<b>📍 You are here</b>');
    $('mapLoader').style.display = 'flex'; $('pharmacyCountBar').style.display = 'none';
    try {
        const pharmacies = await fetchNearbyPharmacies(loc.lat, loc.lng);
        $('mapLoader').style.display = 'none';
        if (!pharmacies.length) { $('pharmacyCountBar').style.display = 'flex'; $('pharmacyCountIcon').className = 'fa-solid fa-store-slash'; $('pharmacyCountText').textContent = 'No pharmacies found within 2 km.'; return; }
        $('pharmacyCountBar').style.display = 'flex'; $('pharmacyCountIcon').className = 'fa-solid fa-store';
        $('pharmacyCountText').textContent = `${pharmacies.length} pharmacies found nearby`;
        const pharmIcon = L.divIcon({ className:'pharm-icon', html:'<div class="pharm-marker"><i class="fa-solid fa-plus"></i></div>', iconSize:[34,34], iconAnchor:[17,17] });
        pharmacies.forEach(p => {
            const t = p.tags||{}, name = t.name||'Pharmacy', street = [t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '), city = t['addr:city']||t['addr:suburb']||'';
            const addrStr = [street,city].filter(Boolean).join(', '), phone = t.phone||t['contact:phone']||'', hours = t.opening_hours||'';
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
            const popup = `<div class="map-popup"><div class="map-popup-name">${name}</div>${addrStr?`<div class="map-popup-row"><i class="fa-solid fa-location-dot"></i>&nbsp;${addrStr}</div>`:''}${phone?`<div class="map-popup-row"><i class="fa-solid fa-phone"></i>&nbsp;${phone}</div>`:''}${hours?`<div class="map-popup-row"><i class="fa-regular fa-clock"></i>&nbsp;${hours}</div>`:''}<a href="${mapsUrl}" target="_blank" rel="noopener" class="map-popup-btn"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</a></div>`;
            pharmacyMarkers.push(L.marker([p.lat,p.lon],{icon:pharmIcon}).addTo(map).bindPopup(popup,{maxWidth:280}));
        });
        map.fitBounds(L.featureGroup([userMarker,...pharmacyMarkers]).getBounds().pad(0.12));
    } catch(err) { $('mapLoader').style.display = 'none'; console.error('Map error:', err); showToast('Could not load pharmacies.', 'error'); }
}

async function fetchNearbyPharmacies(lat, lng, radius = 2000) {
    const query = `[out:json][timeout:25];node[amenity=pharmacy](around:${radius},${lat},${lng});out tags;`;
    const resp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
    return (await resp.json()).elements || [];
}

// ─── FIRESTORE REALTIME LISTENER ──────────────────────────────
onSnapshot(collection(db, 'medicines'), snapshot => {
    allMedicines = snapshot.docs.map(d => ({ docId: d.id, ...d.data() }));
    // If dashboard is visible, re-render it
    if (dashboardView.style.display === 'block') renderDashboard();
});

// ─── FIREBASE AUTH STATE ──────────────────────────────────────
onAuthStateChanged(auth, async user => {
    if (user) {
        try {
            const snap = await getDoc(doc(db, 'shopkeepers', user.uid));
            if (snap.exists()) {
                currentShopkeeper = { uid: user.uid, ...snap.data() };
                currentUserRole   = 'shopkeeper';
                updateAuthUI();
                showToast(`Signed in as Shopkeeper 🏪 — ${currentShopkeeper.shopName}`, 'success');
            }
        } catch(err) { console.error('Auth state error:', err); }
    } else {
        if (currentUserRole === 'shopkeeper') {
            currentShopkeeper = null;
            currentUserRole   = null;
            updateAuthUI();
        }
    }
});

// ─── INIT ─────────────────────────────────────────────────────
seedIfNeeded();

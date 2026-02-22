// --- إعدادات النظام ---
const API = 'https://script.google.com/macros/s/AKfycbx4Qqf7JbTe4wOyYkjpdMxbTyPU1A8byClgYdhGiKj5ZyjZOw-GghAYaU6UkJYK2Sbc9g/exec'; 
const ADMIN_ID = "777216718"; 

// --- نظام السلايدر لصور واجهة الدخول ---
let currentSlideIndex = 1;
let slideInterval;

function startSlider() {
    slideInterval = setInterval(() => {
        changeSlide(1);
    }, 10000);
}

function changeSlide(direction) {
    const bannerImg = document.getElementById('auth-banner-img');
    if (!isLoggedIn && bannerImg && !bannerImg.hasAttribute('data-custom')) {
        bannerImg.style.opacity = 0;
        setTimeout(() => {
            currentSlideIndex += direction;
            if (currentSlideIndex > 5) currentSlideIndex = 1;
            if (currentSlideIndex < 1) currentSlideIndex = 5;
            bannerImg.src = `img/${currentSlideIndex}.jpg`;
            bannerImg.style.opacity = 1;
        }, 500);
    }
}

function manualSlide(direction) {
    playSound('click');
    clearInterval(slideInterval);
    changeSlide(direction);
    startSlider();
}

startSlider();

// --- متغيرات الحالة ---
let myUser = "", myPass = "", isReg = false, isAdmin = false, isEditMode = false, isImpersonating = false, isGuest = false;
let pendingRequest = false; 
let userRank = "عادي"; 

let currentCardsData = []; 
let currentUserOrders = [];
let currentTopupsData = []; 
let currentTransfersData = []; 
let allUsersCache = []; 

let currentVouchersList = [];
let currentCouponsList = [];
let currentFlashList = [];
let currentWheelHistory = []; // متغير جديد خاص بعجلة الحظ للمدير

let realBalance = "0.00"; 
let isBalanceHidden = true; 
let isLoggedIn = false;
let bgInterval = null;
let chatInterval = null; 
let notifInterval = null;
let whatsappNumber = "967777216718"; 
let globalBankAcc = "123456";
let rememberMe = true;
let userFavorites = JSON.parse(localStorage.getItem('user_favorites') || '[]');
let showFavoritesOnly = false;
let deferredPrompt;
let globalInstructions = "";
let flashSaleEnabled = false;
let notificationStack = []; 

// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isSoundEnabled = localStorage.getItem('app_sound') !== 'false';

function toggleAppSounds() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('app_sound', isSoundEnabled);
    document.getElementById('sound-checkbox').classList.toggle('checked', isSoundEnabled);
    if(isSoundEnabled) playSound('success');
}

function playSound(type) {
    try {
        if(!isSoundEnabled) return;
        if(audioCtx.state === 'suspended') audioCtx.resume().catch(e => console.log(e));
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if(type === 'click') {
            osc.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if(type === 'success') {
            osc.frequency.setValueAtTime(500, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if(type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        }
    } catch(err) {
        console.log("تم تجاهل خطأ الصوت للمحافظة على عمل النظام");
    }
}

// --- الاحتفال (Confetti) ---
function triggerConfetti() {
    if(typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#f9d976', '#d4af37', '#ffffff'] });
    }
}

function vibrate() { if(navigator.vibrate) navigator.vibrate(15); }
function formatCurrency(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function formatPhoneInput(input) { let val = input.value.replace(/\D/g, ''); if (val.length > 9) val = val.substring(0, 9); input.value = val; }

function showMyQR() {
    const qrImg = document.getElementById('my-qr-img');
    const phone = myUser;
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${phone}`;
    document.getElementById('qr-phone-display').innerText = phone;
    document.getElementById('qr-modal').style.display = 'flex';
}

function checkNetworkStatus() {
    const banner = document.getElementById('offline-alert');
    const pingDot = document.getElementById('ping-dot');
    if (!navigator.onLine) {
        banner.style.display = 'block';
        if(pingDot) { pingDot.classList.add('offline'); pingDot.classList.remove('online'); }
    } else {
        banner.style.display = 'none';
        if(pingDot) { pingDot.classList.add('online'); pingDot.classList.remove('offline'); }
    }
}
window.addEventListener('online', checkNetworkStatus);
window.addEventListener('offline', checkNetworkStatus);

function refreshData() {
    if(!isLoggedIn) return;
    loading(true);
    let activeTab = localStorage.getItem('last_sec');
    if(activeTab === 'store') loadStore();
    if(activeTab === 'mycards') loadMyCards();
    if(activeTab === 'topup') loadLogs();
    if(activeTab === 'statement') loadStatement();
    if(activeTab === 'loans') loadLoans(); 
    if(activeTab === 'transfer') loadTransferLogs();
    if(isAdmin && activeTab === 'admin') fetchAdminOrders();
    
    setTimeout(() => { loading(false); showT("تم تحديث البيانات ✅"); playSound('success'); }, 1500);
}

// تحديث الوقت للعروض الخاطفة كل ثانية
setInterval(() => {
    document.querySelectorAll('.flash-timer').forEach(el => {
        const end = parseInt(el.getAttribute('data-endtime'));
        const now = new Date().getTime();
        const diff = end - now;
        if(diff <= 0) { 
            el.innerText = "انتهى العرض"; 
            el.style.color = "var(--error)";
        } else {
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            el.innerText = `⏳ ينتهي خلال: ${h}س ${m}د ${s}ث`;
        }
    });
}, 1000);

// --- Notification System ---
function monitorNotifications() {
     if(notifInterval) clearInterval(notifInterval);
     notifInterval = setInterval(() => {
         const badge = document.getElementById('notif-badge');
         let count = parseInt(badge.innerText) || 0;
         if(count > 0 && !document.getElementById('side-menu').classList.contains('open')) {
             vibrate(); playSound('click'); 
         }
     }, 10000); 
}

function checkNotifications() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    
    if(notificationStack.length > 0) {
        list.innerHTML = notificationStack.map(n => `<div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:8px; margin-bottom:5px; font-size:0.85rem; border-right:3px solid var(--gold);">${n}</div>`).reverse().join('');
    } else {
        list.innerHTML = "<p style='text-align:center; opacity:0.6;'>لا توجد إشعارات حالياً</p>";
    }

    document.getElementById('notif-modal').style.display = 'flex';
    badge.innerText = "0"; badge.classList.add('hidden');
    document.querySelector('.notif-box').classList.remove('has-new');
    notificationStack = []; 
}

function triggerNotification(reason) {
     const badge = document.getElementById('notif-badge');
     let count = parseInt(badge.innerText) || 0; count++;
     badge.innerText = count; badge.classList.remove('hidden');
     document.querySelector('.notif-box').classList.add('has-new');
     if(reason) notificationStack.push(reason);
     vibrate(); playSound('success');
}

function toggleBalVisibility() {
    if(isGuest) return showT("يرجى تسجيل الدخول أولاً", true);
    isBalanceHidden = !isBalanceHidden;
    document.getElementById('bal-display').innerText = isBalanceHidden ? "****" : formatCurrency(realBalance) + " ريال";
    document.getElementById('bal-label').innerText = isBalanceHidden ? "انقر لإظهار الرصيد" : "انقر لإخفاء الرصيد";
}

function togglePass(id) {
    const inp = document.getElementById(id);
    inp.type = inp.type === "password" ? "text" : "password";
}

function toggleRemember() {
    rememberMe = !rememberMe;
    document.getElementById('check-remember').classList.toggle('checked', rememberMe);
    document.getElementById('bio-login-btn').classList.toggle('hidden', !rememberMe);
}

function setTheme(theme) {
    document.body.removeAttribute('data-theme');
    if (theme !== 'default') document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    showT("تم تغيير الثيم ✅");
}

function startIdleTimer() {
    const resetTimer = () => { /* idleTime = 0; */ };
    window.onmousemove = resetTimer; window.onmousedown = resetTimer; window.ontouchstart = resetTimer;
    window.onclick = resetTimer; window.onkeypress = resetTimer; window.addEventListener('scroll', resetTimer, true); 
}

// دعم البصمة وطرق تسجيل الدخول الأحدث
async function biometricLogin() {
    const u = localStorage.getItem('m_u'), p = localStorage.getItem('m_p');
    if(u && p) {
        playSound('click'); document.getElementById('bio-login-btn').style.borderColor = 'var(--success)';
        setTimeout(() => { document.getElementById('auth-user').value = u; document.getElementById('auth-pass').value = p; handleAuth(); }, 500);
    } else { showT("لا توجد بيانات محفوظة للبصمة", true); }
}

// فصل تبويبات التسجيل والدخول
function setAuthMode(mode) {
    playSound('click');
    isReg = (mode === 'register');
    document.getElementById('tab-login').classList.toggle('active', !isReg);
    document.getElementById('tab-register').classList.toggle('active', isReg);
    document.getElementById('btn-auth-main').innerText = isReg ? "إنشاء حساب" : "تسجيل الدخول";
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-options').classList.toggle('hidden', isReg);
}

// --- المصادقة والاسم الرباعي ---
async function handleAuth() {
    if (isReg && localStorage.getItem('device_registered') === 'true') {
        playSound('error'); return showT("عذراً، هذا الجهاز مسجل بحساب مسبقاً ولا يمكن تسجيل حساب جديد", true);
    }

    const u = toEnNum(document.getElementById('auth-user').value.trim());
    const p = document.getElementById('auth-pass').value.trim();
    let b = document.getElementById('auth-bank').value.trim();
    const ref = document.getElementById('auth-ref-code').value.trim();

    if(u.length !== 9) { playSound('error'); return showT("رقم الهاتف يجب أن يكون 9 أرقام", true); }
    if(p.length < 5) { playSound('error'); return showT("كلمة المرور قصيرة", true); }
    
    if(isReg) {
        b = b.replace(/\s+/g, ' ').trim(); 
        let nameParts = b.split(' ');
        if(nameParts.length < 4) { playSound('error'); return showT("يجب إدخال الاسم الرباعي كاملاً", true); }
        document.getElementById('auth-bank').value = b;

        const pc = document.getElementById('auth-pass-confirm').value.trim();
        if(p !== pc) { playSound('error'); return showT("كلمات المرور غير متطابقة", true); }
        if(!b) { playSound('error'); return showT("الاسم مطلوب", true); }
    }
    
    loading(true);
    try {
        const act = isReg ? 'register' : 'getWallet';
        let url = `${API}?action=${act}&id=${u}&password=${p}&bankName=${encodeURIComponent(b)}&deviceId=${getID()}`;
        if(isReg && ref) url += `&refCode=${encodeURIComponent(ref)}`;

        const res = await fetch(url).then(r => r.json());
        
        if(res.isBanned) {
             playSound('error'); showT(res.msg, true); alert(res.msg); 
             loading(false); return;
        }
        
        if(res.success) {
            if(isReg) localStorage.setItem('device_registered', 'true');

            myUser = u; myPass = p; isAdmin = res.isAdmin || (u === ADMIN_ID);
            userRank = res.rank || "عادي"; isGuest = false;
            
            if(rememberMe) {
                localStorage.setItem('m_u', u); localStorage.setItem('m_p', p); localStorage.setItem('remember', 'true');
            } else {
                localStorage.removeItem('m_u'); localStorage.removeItem('m_p'); localStorage.removeItem('remember');
            }
            
            if(p === "1234" && !isAdmin) {
                document.getElementById('force-pass-modal').style.display = 'flex';
            } else if(res.needsPin) {
                document.getElementById('pin-setup-modal').style.display = 'flex';
            } else {
                playSound('success'); loginOk(res.balance, res.paymentName);
            }
        } else {
            playSound('error');
            if(res.isLocked) document.getElementById('locked-box').classList.remove('hidden');
            if(res.isMaintenance) document.getElementById('maintenance-modal').classList.remove('hidden');
            showT(res.msg, true);
        }
    } catch(e) { playSound('error'); showT("خطأ في الاتصال", true); }
    loading(false);
}

function loginGuest() {
    myUser = "GUEST"; myPass = ""; isAdmin = false; isGuest = true; userRank = "زائر";
    playSound('success'); loginOk(0, "زائر"); showT("أهلاً بك في وضع التصفح 👁️");
}

function loginOk(bal, bank) {
    if(!isGuest) localStorage.setItem('device_registered', 'true');
    realBalance = bal; isLoggedIn = true;
    startIdleTimer(); checkNetworkStatus(); monitorNotifications(); 

    document.getElementById('page-auth').classList.add('hidden');
    document.getElementById('page-main').classList.remove('hidden');
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('info-btn').classList.remove('hidden'); 
    
    document.getElementById('bal-display').innerText = "****";
    document.getElementById('menu-user-name').innerText = isImpersonating ? (bank + " (تقمص)") : (isAdmin ? "المدير العام" : bank);
    document.getElementById('menu-user-id').innerText = isGuest ? "وضع الزائر" : myUser;
    document.getElementById('menu-user-rank').innerText = userRank === "موزع" ? "⭐ عميل ذهبي (موزع)" : (isGuest ? "👁️ تصفح فقط" : "👤 عميل عادي");
    
    if(!isGuest) {
        document.getElementById('acc-bank').value = bank || "";
        document.getElementById('display-payment-name').innerText = bank || "غير مسجل";
        document.getElementById('top-ref').value = bank || "";
        document.getElementById('ref-card-container').style.display = 'block';
        document.getElementById('my-ref-code-display').innerText = "REF-" + myUser.substring(5); 
    } else {
         document.getElementById('ref-card-container').style.display = 'none';
    }

    const isTrueAdmin = isAdmin && !isImpersonating;
    document.querySelectorAll('.client-item').forEach(el => {
        el.style.display = isTrueAdmin ? 'none' : '';
    });

    if (isTrueAdmin) {
         document.getElementById('admin-menu-btn').classList.remove('hidden');
         switchSec('admin');
         fetchAdminOrders();
    } else {
         const lastSec = localStorage.getItem('last_sec') || 'dashboard';
         switchSec((lastSec === 'admin' && !isAdmin) ? 'dashboard' : lastSec);
    }
    
    initSystemSettings();
    loadStore(); 
    if(!isGuest) { loadTransferLogs(); loadLogs(); startBackgroundSync(); }
}

async function initSystemSettings() {
    try {
        const res = await fetch(`${API}?action=getSettings`).then(r => r.json());
        if(res.success) {
            if(res.maintenance && !isAdmin) { document.getElementById('maintenance-modal').classList.remove('hidden'); return; }
            if(res.whatsapp) whatsappNumber = res.whatsapp;
            if(res.bankName) document.getElementById('bank-name-title').innerText = res.bankName;
            if(res.bankAcc) { globalBankAcc = res.bankAcc; document.getElementById('bank-acc-num').innerText = res.bankAcc; }
            if(res.instructions) globalInstructions = res.instructions;
            if(res.ads && res.ads !== "") { document.getElementById('news-content').innerText = res.ads; document.getElementById('news-bar').style.display = "block"; }
            
            flashSaleEnabled = res.flashSaleEnabled || false;
            
            if(res.bonus && res.bonus > 0) document.getElementById('reg-ref-container').style.display = 'block';
            else document.getElementById('reg-ref-container').style.display = 'none';
            
            const bannerUrl = res.bannerUrl || res.logoUrl;
            if(bannerUrl) {
                const bannerImg = document.getElementById('auth-banner-img');
                bannerImg.src = bannerUrl; bannerImg.setAttribute('data-custom', 'true');
                bannerImg.style.display = 'block'; document.getElementById('auth-logo-img').style.display = 'none';
            }
            
            if(res.logoUrl && !bannerUrl) {
                document.getElementById('hero-img').src = res.logoUrl; document.getElementById('hero-img').style.display = 'block';
            }
        }
    } catch(e) {}
}

function showInstructionsModal() {
    document.getElementById('instructions-content').innerHTML = globalInstructions || "لا توجد تعليمات حالياً.";
    document.getElementById('instructions-modal').style.display = 'flex';
}

function startBackgroundSync() {
    if(bgInterval) clearInterval(bgInterval);
    if(isGuest) return;
    
    (async () => {
        if(!isLoggedIn) return;
        try {
           const res = await fetch(`${API}?action=getWallet&id=${myUser}&password=${myPass}&deviceId=${getID()}`).then(r => r.json());
           if(res.success && realBalance !== res.balance) {
               realBalance = res.balance;
               if(!isBalanceHidden) document.getElementById('bal-display').innerText = formatCurrency(realBalance) + " ريال";
               if(document.getElementById('total-rem')) document.getElementById('total-rem').innerText = formatCurrency(realBalance) + " ريال";
           }
        } catch(e){}
    })();

    bgInterval = setInterval(async () => {
        if(!isLoggedIn) return;
        checkNetworkStatus(); 
        
        if(isAdmin && !isImpersonating && !document.getElementById('sec-admin').classList.contains('hidden')) {
            fetchAdminOrders(true); // silent fetch
        }

        try {
            const res = await fetch(`${API}?action=getWallet&id=${myUser}&password=${myPass}&deviceId=${getID()}`).then(r => r.json());
            
            if (res.isBanned) { alert("⛔ تم حظر حسابك أثناء الجلسة."); logout(); return; }

            if(res.success) {
                if(realBalance !== res.balance) {
                    realBalance = res.balance;
                    triggerNotification("💰 تحديث في الرصيد: " + formatCurrency(realBalance) + " ريال");
                    if(!isBalanceHidden) document.getElementById('bal-display').innerText = formatCurrency(realBalance) + " ريال";
                    const remDisplay = document.getElementById('total-rem');
                    if(remDisplay) remDisplay.innerText = formatCurrency(realBalance) + " ريال";
                }
            }
        } catch(e) {}
        
        let activeTab = localStorage.getItem('last_sec');
        if(activeTab === 'store') loadStore(true);
        if(activeTab === 'mycards') loadMyCards(true);
        if(activeTab === 'topup') loadLogs(true);
        if(activeTab === 'statement') loadStatement(true);
        if(activeTab === 'loans') loadLoanHistory(document.getElementById('loan-month-selector').value, true);
    }, 20000); 
}

async function loadMonthlyReport() {
    if(isGuest) return showT("يجب التسجيل", true);
    loading(true);
    try {
        const res = await fetch(`${API}?action=getMonthlyReport&id=${myUser}`).then(r => r.json());
        if(res.success) {
            const spent = res.totalSpent || 0; const charged = res.totalCharged || 0;
            document.getElementById('report-spent').innerText = formatCurrency(spent) + " ريال";
            document.getElementById('report-charged').innerText = formatCurrency(charged) + " ريال";
            document.getElementById('report-total-out').innerText = formatCurrency(spent) + " ريال";
            
            const total = spent + charged; let deg = 0;
            if(total > 0) deg = (charged / total) * 360;
            document.getElementById('report-chart').style.background = `conic-gradient(var(--success) 0deg ${deg}deg, var(--error) ${deg}deg 360deg)`;
            
            document.getElementById('monthly-report-modal').style.display = 'flex';
        }
    } catch(e) { showT("فشل جلب التقرير", true); }
    loading(false);
}

async function manageBan(actionType) {
    const sid = document.getElementById('adm-search-id').value;
    if(!sid) return showT("حدد المستخدم أولاً", true);
    
    let reason = "";
    if(actionType === 'ban') {
        reason = prompt("أدخل سبب الحظر:");
        if(!reason) return;
    }
    
    if(!confirm(`هل أنت متأكد من ${actionType === 'ban' ? 'حظر' : 'فك حظر'} المستخدم؟`)) return;
    loading(true);
    try {
        let url = `${API}?action=manageBan&adminPass=${encodeURIComponent(myPass)}&targetId=${sid}&subAction=${actionType}`;
        if(reason) url += `&reason=${encodeURIComponent(reason)}`;
        
        const res = await fetch(url).then(r => r.json());
        showT(res.msg, !res.success);
    } catch(e) { showT("خطأ في الاتصال", true); }
    loading(false);
}

async function loadLoans() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    const area = document.getElementById('loan-status-area');
    area.innerHTML = `
        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; border:1px dashed var(--gold);">
            <h3 style="margin:0 0 10px;">حالة الخدمة</h3>
            <p>الخدمة متاحة للعملاء الملتزمين والنشطين فقط.</p>
            <small style="color:var(--pending)">سيتم خصم المبلغ تلقائياً عند أول عملية شحن.</small>
        </div>
    `;
    loadLoanHistory(); 
}

async function loadLoanHistory(month, silent = false) {
    if(isGuest) return;
    const list = document.getElementById('loan-history-list');
    if(!silent) list.innerHTML = '<div class="skeleton" style="height:50px;"></div>';
    try {
        const res = await fetch(`${API}?action=getLoanStatement&id=${myUser}&month=${month || "all"}`).then(r=>r.json());
        if(res.success) {
            if(!month) {
                  const months = [...new Set(res.loans.map(l => l.date.substring(0, 7)))];
                  const sel = document.getElementById('loan-month-selector');
                  sel.innerHTML = '<option value="all">الكل</option>';
                  months.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
            }
            list.innerHTML = res.loans.map(l => 
                `<div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.85rem;">
                    <div style="display:flex; justify-content:space-between;">
                         <span>${l.date}</span>
                         <b style="color:${l.status.includes('Paid') ? 'var(--success)' : 'var(--error)'}">${l.amount}</b>
                    </div>
                    <small style="opacity:0.7">${l.status}</small>
                </div>`
            ).join('');
            if(res.loans.length===0) list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد سجلات</p>";
        }
    } catch(e) { if(!silent) list.innerHTML = "خطأ تحميل"; }
}

async function requestLoan() {
    try { playSound('click'); } catch(e) {}
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    if(!confirm("هل أنت متأكد من طلب السلفة؟")) return;
    loading(true);
    try {
        const res = await fetch(`${API}?action=requestLoan&id=${myUser}`).then(r=>r.json());
        if(res.success) {
            try { playSound('success'); } catch(e){}
            showT(res.msg); 
            refreshData(); 
            loadLoans();
        } else { 
            try { playSound('error'); } catch(e){}
            showT(res.msg, true); 
        }
    } catch(e) { showT("خطأ اتصال", true); }
    loading(false);
}

async function spinWheel() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    const wheel = document.getElementById('wheel-obj'), resDiv = document.getElementById('wheel-result');
    resDiv.innerText = ""; loading(true);
    try {
        const res = await fetch(`${API}?action=spinWheel&id=${myUser}`).then(r=>r.json());
        loading(false);
        if(res.success) {
            let deg = 1800 + Math.floor(Math.random() * 360); 
            wheel.style.transform = `rotate(${deg}deg)`; playSound('click'); 
            
            setTimeout(() => {
                playSound('success'); triggerConfetti(); resDiv.innerText = res.msg;
                if(res.prize > 0) refreshData();
            }, 4000);
        } else { showT(res.msg, true); }
    } catch(e) { loading(false); showT("خطأ اتصال", true); }
}

async function loadTickets(month) {
    if(isGuest) return;
    const list = document.getElementById('tickets-list');
    list.innerHTML = '<div class="skeleton" style="height:60px;"></div>';
    try {
        const res = await fetch(`${API}?action=getMyTickets&id=${myUser}&month=${month || "all"}`).then(r=>r.json());
        if(res.success) {
            if(!month && res.tickets.length > 0) {
                  const months = [...new Set(res.tickets.map(t => t.date.substring(0, 7)))];
                  const sel = document.getElementById('ticket-month-selector');
                  sel.innerHTML = '<option value="all">الكل</option>';
                  months.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
            }
            if(res.tickets.length > 0) {
                 list.innerHTML = res.tickets.map(t => `
                    <div class="card" style="padding:15px; text-align:right;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${t.title}</strong>
                            <small style="color:${t.status==='Open'?'var(--success)':'#aaa'}">${t.status}</small>
                        </div>
                        <p style="font-size:0.85rem; opacity:0.8;">${t.id} - ${t.date}</p>
                        ${t.reply ? `<div style="background:rgba(255,255,255,0.1); padding:10px; margin-top:10px; border-radius:10px;"><strong>الرد:</strong> ${t.reply}</div>` : ''}
                    </div>
                `).join('');
            } else { list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد تذاكر</p>"; }
        }
    } catch(e) {}
}

async function createTicket() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    const title = document.getElementById('ticket-title').value, msg = document.getElementById('ticket-msg').value;
    if(!title || !msg) return showT("أكمل البيانات", true);
    loading(true);
    try {
        const res = await fetch(`${API}?action=createTicket&id=${myUser}&title=${encodeURIComponent(title)}&message=${encodeURIComponent(msg)}`).then(r=>r.json());
        if(res.success) { showT(res.msg); document.getElementById('ticket-title').value = ""; document.getElementById('ticket-msg').value = ""; loadTickets(); }
    } catch(e) {} loading(false);
}

function populateMonthSelector(data, selectorId, callback) {
    const selector = document.getElementById(selectorId);
    if(!selector) return; selector.innerHTML = "";
    const months = [...new Set(data.map(o => o.date.substring(0, 7)))]; 
    
    if(months.length === 0) months.push(new Date().toISOString().substring(0, 7));
    months.sort().reverse();

    months.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.innerText = m; selector.appendChild(opt); });
    selector.value = months[0]; if(callback) callback(months[0]);
}

async function loadStatement(silent = false) {
    if(isGuest) return;
    const tbody = document.getElementById('statement-body');
    if(!silent) tbody.innerHTML = '<tr><td colspan="3"><div class="skeleton" style="height:30px; margin:5px;"></div><div class="skeleton" style="height:30px; margin:5px;"></div></td></tr>';
    try {
        const res = await fetch(`${API}?action=getOrders&id=${myUser}`).then(r => r.json());
        if(res.success) {
            currentUserOrders = res.orders.reverse();
            populateMonthSelector(currentUserOrders, 'stmt-month-selector', (m) => renderStatement(m, false));
        } else { if(!silent) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد عمليات</td></tr>'; }
    } catch(e) { if(!silent) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--error);">خطأ في التحميل</td></tr>'; }
}

function renderStatement(monthKey, isAdminView) {
    const targetBody = isAdminView ? document.getElementById('admin-stmt-body') : document.getElementById('statement-body');
    const targetIn = isAdminView ? document.getElementById('admin-total-in') : document.getElementById('total-in');
    const targetOut = isAdminView ? document.getElementById('admin-total-out') : document.getElementById('total-out');
    const targetRem = isAdminView ? document.getElementById('admin-total-rem') : document.getElementById('total-rem');

    let totalIn = 0, totalOut = 0, rows = "";
    const filtered = currentUserOrders.filter(o => o.date.startsWith(monthKey));

    if(filtered.length === 0) {
        targetBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد عمليات في هذا الشهر</td></tr>';
        if(targetIn) targetIn.innerText = "0"; if(targetOut) targetOut.innerText = "0";
        return;
    }

    filtered.forEach(o => {
        let amt = parseFloat(o.amount) || 0; let desc = "", isCredit = false, statusColor = "#fff";

        if (o.ref.includes("كود")) { desc = "شراء " + o.ref.split(':')[0]; totalOut += amt; }
        else if (o.ref.includes("تحويل")) { desc = "تحويل لـ " + o.ref.replace("تحويل:", ""); totalOut += amt; }
        else if (o.ref.includes("استلام")) { desc = "استلام من " + o.ref.replace("استلام:", ""); totalIn += amt; isCredit = true; }
        else { desc = "شحن رصيد"; if(o.status.includes("مكتمل")) { totalIn += amt; isCredit = true; } else { desc += " (" + o.status + ")"; statusColor = "var(--pending)"; } }
        if(o.status && o.status.includes("مرفوض")) statusColor = "var(--error)";

        rows += `<tr class="stmt-row" onclick="playSound('click'); showTransactionDetails('${o.date}', '${desc}', '${isCredit ? '+' : '-'}${formatCurrency(Math.abs(amt))}', '${o.ref}', '${o.status}')">
            <td style="font-size:0.7rem; opacity:0.8;">${o.date.split(' ')[0]}<br>${o.date.split(' ')[1] || ''}</td>
            <td style="font-size:0.75rem;">${desc}</td>
            <td dir="ltr" style="font-weight:bold; color:${isCredit ? 'var(--success)' : (statusColor !== '#fff' ? statusColor : 'var(--error)')}">${isCredit ? '+' : '-'}${formatCurrency(Math.abs(amt))}</td>
        </tr>`;
    });

    targetBody.innerHTML = rows;
    if(targetIn) targetIn.innerText = formatCurrency(totalIn) + " ريال";
    if(targetOut) targetOut.innerText = formatCurrency(Math.abs(totalOut)) + " ريال";
    if(targetRem && !isAdminView) targetRem.innerText = formatCurrency(realBalance) + " ريال";

    if(!isAdminView) {
        const total = totalIn + Math.abs(totalOut); let pIn = 50, pOut = 50;
        if(total > 0) { pIn = (totalIn / total) * 100; pOut = (Math.abs(totalOut) / total) * 100; }
        const barIn = document.getElementById('bar-in'), barOut = document.getElementById('bar-out');
        if(barIn && barOut) { barIn.style.width = pIn + "%"; barOut.style.width = pOut + "%"; }
    }
}

function showTransactionDetails(date, desc, amount, ref, status) {
    const modal = document.getElementById('txn-details-modal'), body = document.getElementById('txn-details-body');
    body.innerHTML = `<strong>التاريخ:</strong> ${date}<br><strong>الوصف:</strong> ${desc}<br><strong>المبلغ:</strong> <span dir="ltr">${amount}</span><br><strong>المرجع:</strong> ${ref}<br><strong>الحالة:</strong> ${status}`;
    modal.style.display = 'flex';
}

function printStatement() { window.print(); }

function exportToExcel() {
    if(currentUserOrders.length === 0) return showT("لا توجد بيانات للتصدير", true);
    let csvContent = "\uFEFFالتاريخ,الوقت,نوع العملية,المبلغ,الحالة\n";
    
    currentUserOrders.forEach(o => {
        let row = [ o.date.split(' ')[0], o.date.split(' ')[1] || '', o.ref.replace(/,/g, ' '), o.amount, o.status ].join(",");
        csvContent += row + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `statement_${myUser}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// --- المتجر الذكي والمفضلة ---
async function loadStore(silent = false) { 
    const grid = document.getElementById('cards-grid'); 
    if(!silent) grid.innerHTML = '<div class="skeleton" style="height:150px; grid-column:span 2;"></div>'; 
    try { 
        const res = await fetch(`${API}?action=getStock&id=${myUser}`).then(r => r.json()); 
        if(res.success) { 
            grid.innerHTML = ""; 
            const select = document.getElementById('stock-type-select'), flashSelect = document.getElementById('flash-card-type');
            if(!silent) { select.innerHTML = ""; if(flashSelect) flashSelect.innerHTML = ""; }

            const baseDisc = userRank === "موزع" ? (res.discountGold || 0.10) : (res.discount || 0); 
            if(res.hasFlashSale && flashSaleEnabled) document.getElementById('flash-sale-banner').style.display = 'block';
            else document.getElementById('flash-sale-banner').style.display = 'none';

            let sortedKeys = Object.keys(res.stock).sort((a, b) => {
                const isFavA = userFavorites.includes(a), isFavB = userFavorites.includes(b);
                if (isFavA && !isFavB) return -1; if (!isFavA && isFavB) return 1; return 0;
            });

            for(let name of sortedKeys) { 
                let item = res.stock[name], price = parseInt(name.replace(/[^0-9]/g, '')) || 0; 
                
                let itemSpecificDisc = baseDisc;
                let isFlash = false;
                let endTime = 0;
                
                if(res.hasFlashSale && res.flashSales[name]) {
                     itemSpecificDisc = res.flashSales[name].discount;
                     endTime = res.flashSales[name].endTime;
                     isFlash = true;
                }
                
                let finalP = Math.floor(price * (1 - itemSpecificDisc)); 
                let isOut = item.count <= 0, isFav = userFavorites.includes(name);
                
                let btnHtml = isOut 
                    ? `<button class="btn" style="background:#555; cursor:not-allowed;" disabled>نفذت الكمية 🚫</button>` 
                    : `<button class="btn" onclick="playSound('click'); vibrate(); openQtyModal('${name}', ${item.count})">شراء</button>`;

                grid.innerHTML += `
                <div class="store-item ${isOut ? 'frozen' : ''}" data-name="${name}" data-fav="${isFav}">
                    <div class="card" style="padding:15px; text-align:center; overflow:visible; ${isFlash ? 'border:1px solid #ff00cc;' : ''}">
                        ${isFlash && !isOut ? `<div class="discount-badge flash-badge">⚡ عرض خاص ${Math.round(itemSpecificDisc * 100)}%</div>` : (itemSpecificDisc > 0 && !isOut ? `<div class="discount-badge">خصم ${Math.round(itemSpecificDisc * 100)}%</div>` : '')}
                        <div class="pkg-size">${item.size}</div>
                        <div class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${name}')">★</div>
                        <div style="font-size:0.95rem; margin:15px 0 10px; font-weight:bold; height:40px; display:flex; align-items:center; justify-content:center;">${name}</div>
                        <small style="display:block; margin-bottom:5px; opacity:0.8; font-size:0.7rem; color:${isOut ? 'var(--error)' : 'var(--success)'}">
                            ${isOut ? 'المتبقي: 0' : `متوفر: ${item.count}`}
                        </small>
                        ${isFlash && !isOut ? `<small class="flash-timer" data-endtime="${endTime}" style="color:var(--gold); font-size:0.75rem; display:block; margin-bottom:5px;">⏳ جاري الحساب...</small>` : ''}
                        <div class="price-container">
                            ${itemSpecificDisc > 0 ? `<span class="old-price">${formatCurrency(price)} ريال</span>` : ''}
                            <span class="final-price">${formatCurrency(finalP)} ريال</span>
                        </div>
                        ${btnHtml}
                    </div>
                </div>`; 
                
                if(!silent) { select.innerHTML += `<option value="${name}">${name}</option>`; if(flashSelect) flashSelect.innerHTML += `<option value="${name}">${name}</option>`; }
            } 
        } 
    } catch(e) {} 
}

function toggleFavorite(name) {
    playSound('click'); vibrate();
    const index = userFavorites.indexOf(name);
    if (index > -1) userFavorites.splice(index, 1); else userFavorites.push(name);
    localStorage.setItem('user_favorites', JSON.stringify(userFavorites)); loadStore();
}

function toggleFavFilter(btn) {
    showFavoritesOnly = !showFavoritesOnly;
    btn.style.color = showFavoritesOnly ? "var(--gold)" : "#555";
    btn.style.borderColor = showFavoritesOnly ? "var(--gold)" : "#555"; filterStore();
}

function filterStore() {
    const query = document.getElementById('store-search').value.toLowerCase();
    document.querySelectorAll('.store-item').forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase(), isFav = item.getAttribute('data-fav') === 'true';
        let matchesSearch = name.includes(query), matchesFav = showFavoritesOnly ? isFav : true;
        item.style.display = (matchesSearch && matchesFav) ? 'block' : 'none';
    });
}

function openQtyModal(n, m) { 
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    document.getElementById('qty-pkg-name').innerText = n; document.getElementById('qty-input-field').value = "1";
    document.getElementById('coupon-val').value = ""; document.getElementById('qty-input-field').max = m; 
    document.getElementById('qty-modal').style.display = 'flex'; document.getElementById('confirm-qty-btn').onclick = () => executePurchase(n, m); 
}

async function executePurchase(n, m) {
    let q = parseInt(toEnNum(document.getElementById('qty-input-field').value)), coupon = document.getElementById('coupon-val').value.trim(); 
    if(!q || q <= 0) { playSound('error'); return showT("الكمية خطأ", true); }
    if(q > m) { playSound('error'); return showT(`عذراً، المتوفر حالياً ${m} فقط`, true); }
    
    closeModal('qty-modal'); loading(true);
    try {
        let url = `${API}?action=buyCard&id=${myUser}&password=${myPass}&cardType=${encodeURIComponent(n)}&qty=${q}`;
        if(coupon) url += `&coupon=${encodeURIComponent(coupon)}`; 
        
        const res = await fetch(url).then(r => r.json());
        if(res.success) { 
            playSound('success'); triggerConfetti(); 
            document.getElementById('codes-display').innerText = res.codes.join("\n"); 
            document.getElementById('codes-modal').style.display = 'flex'; 
            updateRealBalance(res.newBalance); 
            showReceipt("شراء كروت", formatCurrency(q * (res.pricePerUnit || 0)), "كود " + n, res.codes.length + " كروت");
            loadStore(); 
        } else { playSound('error'); showT(res.msg, true); }
    } catch(e) { playSound('error'); } loading(false);
}

// --- سجل الكروت ---
async function loadMyCards(silent = false) { 
    if(isGuest) return;
    const list = document.getElementById('my-cards-list'); 
    if(!silent) list.innerHTML = '<div class="skeleton" style="height:80px; margin-bottom:10px;"></div><div class="skeleton" style="height:80px;"></div>'; 
    try { 
        const res = await fetch(`${API}?action=getOrders&id=${myUser}`).then(r => r.json()); 
        if(res.success) { 
            currentCardsData = res.orders.filter(o => o.ref.includes("كود")).reverse(); 
            if(!silent) populateMonthSelector(currentCardsData, 'mycards-month-selector', (m) => filterMyCards(m));
            else filterMyCards(document.getElementById('mycards-month-selector').value);
        } 
    } catch(e) {} 
}

function filterMyCards(monthKey) {
    const list = document.getElementById('my-cards-list');
    const filtered = currentCardsData.filter(c => c.date.startsWith(monthKey));
    if(filtered.length === 0) { list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد كروت في هذا الشهر</p>"; return; }
    list.innerHTML = filtered.map(c => { 
        let type = c.ref.split(':')[0] || "باقة", codes = c.ref.replace(type + ":", "").trim(); 
        return `<div class="card" style="padding:15px; border-right:4px solid var(--gold);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><strong style="color:var(--gold)">${type}</strong><button onclick="playSound('click'); vibrate(); copyVerticalSingle('${type}', '${codes}')" style="background:rgba(249, 217, 118, 0.2); color:var(--gold); border:none; padding:4px 10px; border-radius:8px; font-size:0.7rem; cursor:pointer;">نسخ</button></div><div style="font-family:monospace; font-size:0.85rem; opacity:0.9; white-space:pre-wrap;">${codes}</div><small style="display:block; margin-top:10px; opacity:0.5;">${c.date} | ${formatCurrency(c.amount)} ريال</small></div>`; 
    }).join('');
}

// --- التحويل المالي ---
async function transferMoney() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    if(parseFloat(realBalance) < 1000) { playSound('error'); return showT("لا يمكنك التحويل ورصيدك أقل من 1000 ريال", true); }
    const tid = toEnNum(document.getElementById('tr-id').value), amt = toEnNum(document.getElementById('tr-amt').value);
    if(!tid || !amt || amt <= 0) { playSound('error'); return showT("أكمل البيانات", true); }
    if(tid === myUser) { playSound('error'); return showT("لا يمكنك التحويل لنفسك!", true); }
    const pin = await requestPinFromUser(); if(!pin) return;
    loading(true);
    try {
        const res = await fetch(`${API}?action=transfer&id=${myUser}&password=${myPass}&targetId=${tid}&amount=${amt}&pin=${pin}`).then(r => r.json());
        if(res.success) { 
            playSound('success'); triggerConfetti(); showT("تم التحويل بنجاح ✅"); 
            updateRealBalance(res.newBalance); document.getElementById('tr-amt').value = ""; 
            showReceipt("تحويل رصيد", formatCurrency(amt), "إلى: " + tid, "عملية ناجحة"); loadTransferLogs(); 
        } else { playSound('error'); showT(res.msg, true); }
    } catch(e) { playSound('error'); showT("خطأ اتصال", true); }
    loading(false);
}

async function loadTransferLogs() { 
    if(isGuest) return;
    const logContainer = document.getElementById('transfer-logs-list'); 
    try { 
        const res = await fetch(`${API}?action=getOrders&id=${myUser}`).then(r => r.json()); 
        if(res.success) { 
            currentTransfersData = res.orders.filter(o => o.ref.includes("تحويل") || o.ref.includes("استلام")).reverse(); 
            populateMonthSelector(currentTransfersData, 'transfer-month-selector', (m) => filterTransferLogs(m));
        } 
    } catch(e) {} 
}

function filterTransferLogs(monthKey) {
    const filtered = currentTransfersData.filter(t => t.date.startsWith(monthKey)); renderTransferLogs(filtered);
}

function filterTransferLogsByText() {
    const query = document.getElementById('transfer-search-input').value.toLowerCase();
    const filtered = currentTransfersData.filter(t => t.ref.toLowerCase().includes(query) || t.amount.toString().includes(query) || t.date.includes(query));
    renderTransferLogs(filtered);
}

function renderTransferLogs(data) {
    const list = document.getElementById('transfer-logs-list');
    if(data.length === 0) { list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد عمليات مطابقة</p>"; return; }
    list.innerHTML = data.map(t => `<div style="font-size:0.75rem; border-bottom:1px solid rgba(255,255,255,0.1); padding:8px;">📅 ${t.date} | 💰 ${formatCurrency(t.amount)}<br><small style="color:var(--gold)">${t.ref}</small></div>`).join('');
}

// --- سجل الشحن ---
async function loadLogs(silent = false) { 
    if(isGuest) return;
    const list = document.getElementById('logs-list'); 
    if(!silent) list.innerHTML = '<div class="skeleton" style="height:60px; margin-bottom:10px;"></div><div class="skeleton" style="height:60px;"></div>'; 
    pendingRequest = false; 
    try { 
        const res = await fetch(`${API}?action=getOrders&id=${myUser}`).then(r => r.json()); 
        if(res.success) { 
            currentTopupsData = res.orders.filter(o => !o.ref.includes("كود") && !o.ref.includes("تحويل") && !o.ref.includes("استلام")).reverse(); 
            if(!silent) populateMonthSelector(currentTopupsData, 'topup-month-selector', (m) => filterTopupLogs(m));
            else filterTopupLogs(document.getElementById('topup-month-selector').value);
        } 
    } catch(e) {} 
}

function filterTopupLogs(monthKey) { const filtered = currentTopupsData.filter(t => t.date.startsWith(monthKey)); renderTopupLogs(filtered); }

function filterTopupLogsByText() {
    const query = document.getElementById('topup-search-input').value.toLowerCase();
    const filtered = currentTopupsData.filter(t => t.amount.toString().includes(query) || t.status.includes(query) || t.date.includes(query));
    renderTopupLogs(filtered);
}

function renderTopupLogs(data) {
    const list = document.getElementById('logs-list');
    if(data.length === 0) { list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد عمليات</p>"; return; }
    
    list.innerHTML = data.map(t => { 
        let isP = t.status.includes("قيد الانتظار"); if(isP) pendingRequest = true; 
        let color = t.status.includes("مكتمل") ? "var(--success)" : (t.status.includes("مرفوض") ? "var(--error)" : "var(--pending)"); 
        let deleteBtn = isP ? `<span onclick="cancelOrder('${t.date}')" style="margin-right:10px; color:var(--error); cursor:pointer; font-weight:bold; border:1px solid var(--error); padding:2px 5px; border-radius:5px;">✕ حذف</span>` : '';

        return `<div class="card" style="padding:12px; margin-bottom:10px; border-right:4px solid ${color};"><div style="display:flex; justify-content:space-between;"><strong>${formatCurrency(t.amount)} ريال</strong><div><small style="color:${color}">${t.status}</small>${deleteBtn}</div></div><small style="opacity:0.6; font-size:0.7rem;">${t.date}</small></div>`; 
    }).join('');
}

// --- شحن الفاوتشر ---
async function redeemVoucher() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    const code = document.getElementById('voucher-code-input').value.trim();
    if(!code) { playSound('error'); return showT("أدخل الكود", true); }
    loading(true); closeModal('voucher-modal');
    try {
        const res = await fetch(`${API}?action=redeemVoucher&id=${myUser}&code=${encodeURIComponent(code)}`).then(r => r.json());
        if(res.success) {
            playSound('success'); triggerConfetti(); showT(res.msg); refreshData();
        } else { playSound('error'); showT(res.msg, true); }
    } catch(e) { playSound('error'); showT("خطأ اتصال", true); }
    loading(false);
}

// --- الدردشة والملفات ---
let selectedFileBase64 = null, selectedFileName = "";

async function loadChat(silent = false) {
    if(isGuest) return;
    if(!silent) document.getElementById('chat-box').innerHTML = "<small>جاري التحميل...</small>";
    try {
        let url = `${API}?action=getChatMessages&id=${myUser}&isAdmin=${isAdmin}`;
        if(isAdmin) url += `&adminPass=${encodeURIComponent(myPass)}`;
        
        const res = await fetch(url).then(r => r.json());
        if(res.success) {
            const box = document.getElementById('chat-box');
            box.innerHTML = res.messages.map(m => {
                const isMe = m.senderId.toString() === myUser.toString(), isAdminMsg = m.rank === "admin";
                let displayText = m.text;
                if(displayText.startsWith("FILE:")) {
                     const fileUrl = displayText.replace("FILE:", "");
                     displayText = `<a href="${fileUrl}" target="_blank" style="color:var(--gold); text-decoration:underline;">📎 ملف مرفق (اضغط للفتح)</a>`;
                } else if(displayText.startsWith("IMG:")) {
                     const imgUrl = displayText.replace("IMG:", "");
                     displayText = `<img src="${imgUrl}" class="img-preview" onclick="window.open(this.src)">`;
                }
                return `<div class="chat-msg ${isMe ? 'me' : 'other'} ${isAdminMsg ? 'admin-msg' : ''}"><strong>${m.senderName}</strong><br>${displayText}<span class="chat-time">${m.time}</span></div>`;
            }).join('');
            if(!silent) box.scrollTop = box.scrollHeight;
        }
    } catch(e) {}
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if(file.size > 2 * 1024 * 1024) { showT("الملف كبير جداً (الحد الأقصى 2MB)", true); input.value = ""; return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedFileBase64 = e.target.result; selectedFileName = file.name;
            document.getElementById('file-name-preview').innerText = "📎 " + selectedFileName;
            document.getElementById('file-preview-area').style.display = "flex";
        }
        reader.readAsDataURL(file);
    }
}

function clearFileSelection() {
    selectedFileBase64 = null; selectedFileName = ""; document.getElementById('chat-file-input').value = "";
    document.getElementById('file-preview-area').style.display = "none";
}

async function sendChat() {
    if(isGuest) return showT("يجب تسجيل الدخول", true);
    const inp = document.getElementById('chat-input'), txt = inp.value.trim();
    if(!txt && !selectedFileBase64) return;
    
    if(selectedFileBase64) {
        loading(true);
        try {
            let msgType = selectedFileBase64.startsWith("data:image") ? "IMG:" : "FILE:";
            await fetch(`${API}?action=sendChatMessage&id=${myUser}&password=${myPass}&msg=${encodeURIComponent(msgType + " [ملف مرفق بانتظار المعالجة]")}&fileData=${encodeURIComponent(selectedFileBase64)}`);
            clearFileSelection(); showT("تم إرسال الملف");
        } catch(e) { showT("فشل إرسال الملف", true); }
        loading(false);
    }

    if(txt) {
        inp.value = "";
        try { await fetch(`${API}?action=sendChatMessage&id=${myUser}&password=${myPass}&msg=${encodeURIComponent(txt)}`); } catch(e) {}
    }
    loadChat(true);
}

// --- Admin Live Chat Manager ---
let liveChatTarget = "";
let liveChatInterval = null;

async function loadAdminChatList() {
    const list = document.getElementById('admin-chat-users-list');
    list.innerHTML = '<div class="skeleton" style="height:50px;"></div>';
    try {
        const res = await fetch(`${API}?action=getChatUsers&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json());
        if(res.success && res.users.length > 0) {
            list.innerHTML = res.users.map(u => `
                <div style="background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:10px; cursor:pointer;" onclick="openAdminInternalChat('${u.id}', '${u.name}')">
                    <div style="display:flex; justify-content:space-between;"><b>${u.name}</b><small>${u.time}</small></div>
                    <small style="opacity:0.7;">${u.lastMsg.substring(0, 30)}...</small>
                </div>
            `).join('');
        } else {
            list.innerHTML = "<p>لا توجد محادثات نشطة</p>";
        }
    } catch(e) { list.innerHTML = "خطأ في الاتصال"; }
}

function openAdminInternalChat(userId, userName) {
    if(!userId) return showT("حدد المستخدم أولاً", true);
    liveChatTarget = userId;
    document.getElementById('admin-chat-target-name').innerText = userName || userId;
    document.getElementById('admin-live-chat-modal').style.display = 'flex';
    fetchAdminLiveChat();
    liveChatInterval = setInterval(fetchAdminLiveChat, 3000);
}

function closeAdminLiveChat() {
    document.getElementById('admin-live-chat-modal').style.display = 'none';
    if(liveChatInterval) clearInterval(liveChatInterval);
    liveChatTarget = "";
}

async function fetchAdminLiveChat() {
    if(!liveChatTarget) return;
    try {
        const res = await fetch(`${API}?action=getChatMessages&id=${myUser}&isAdmin=true&adminPass=${encodeURIComponent(myPass)}&targetUser=${liveChatTarget}`).then(r=>r.json());
        if(res.success) {
            const box = document.getElementById('admin-live-chat-box');
            box.innerHTML = res.messages.map(m => {
                const isAdminMsg = m.rank === "admin";
                return `<div class="chat-msg ${isAdminMsg ? 'me' : 'other'}"><strong>${m.senderName}</strong><br>${m.text}<span class="chat-time">${m.time}</span></div>`;
            }).join('');
        }
    } catch(e){}
}

async function sendAdminLiveChat() {
    const inp = document.getElementById('admin-live-chat-input');
    const txt = inp.value.trim();
    if(!txt) return;
    inp.value = "";
    try {
        await fetch(`${API}?action=sendChatMessage&id=${myUser}&adminPass=${encodeURIComponent(myPass)}&msg=${encodeURIComponent(txt)}&targetUser=${liveChatTarget}`);
        fetchAdminLiveChat();
    } catch(e){}
}

// --- حفظ التعليمات ---
async function saveInstructions() {
    const text = document.getElementById('admin-inst-text').value;
    loading(true);
    try {
        const res = await fetch(`${API}?action=updateInstructions&adminPass=${encodeURIComponent(myPass)}&text=${encodeURIComponent(text)}`).then(r=>r.json());
        showT(res.msg);
        if(res.success) globalInstructions = text;
    } catch(e) { showT("حدث خطأ أثناء الحفظ", true); }
    loading(false);
}

// --- لوحة المدير ---
async function openAdminUsersModal() {
    if(!isAdmin) return;
    loading(true);
    try {
        const res = await fetch(`${API}?action=getAllUsers&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json());
        if(res.success) {
            allUsersCache = res.users; renderAdminUsersList(allUsersCache);
            document.getElementById('admin-users-modal').style.display = 'flex';
        }
    } catch(e) { showT("فشل جلب القائمة", true); }
    loading(false);
}

function renderAdminUsersList(list) {
    const container = document.getElementById('admin-users-list');
    container.innerHTML = list.map(u => `
        <div onclick="selectAdminUser('${u.id}')" style="padding:10px; border-bottom:1px solid #444; cursor:pointer; display:flex; justify-content:space-between;">
            <div><b>${u.name}</b><br><small style="color:var(--gold)">${u.id}</small></div>
            <div style="text-align:left;">${u.balance} ريال<br><small style="color:${u.rank==='موزع'?'var(--success)':'#aaa'}">${u.rank}</small></div>
        </div>
    `).join('');
}

function filterUserList() {
    const q = document.getElementById('admin-user-search').value.toLowerCase();
    const filtered = allUsersCache.filter(u => u.name.toLowerCase().includes(q) || u.id.toString().includes(q));
    renderAdminUsersList(filtered);
}

function selectAdminUser(id) { closeModal('admin-users-modal'); document.getElementById('adm-search-id').value = id; searchUser(); }

// --- إعدادات المدير ---
async function loadSettings() { 
    try { 
        const res = await fetch(`${API}?action=getSettings&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json()); 
        if(res.success) { 
            document.getElementById('set-discount').value = res.discount; 
            document.getElementById('set-discount-gold').value = res.resellerDiscount || 0; 
            document.getElementById('set-minBalance').value = res.minBalance || 0; 
            document.getElementById('set-whatsapp').value = res.whatsapp || "967777216718"; 
            document.getElementById('set-bonus').value = res.bonus; 
            document.getElementById('set-ads').value = res.ads; 
            document.getElementById('set-adminPass').value = res.adminPass; 
            document.getElementById('set-email').value = res.email || ""; 
            document.getElementById('set-bankName').value = res.bankName || "";
            document.getElementById('set-bankAcc').value = res.bankAcc || "";
            document.getElementById('set-maintenance').checked = res.maintenance || false;
            document.getElementById('set-enableLoan').checked = res.enableLoan;
            document.getElementById('set-enableWheel').checked = res.enableWheel;
            document.getElementById('set-enableFlash').checked = res.flashSaleEnabled || false;
            document.getElementById('set-loanAmount').value = res.loanAmount;
            document.getElementById('set-wheelMax').value = res.wheelMaxPrize || 50; 
            document.getElementById('set-referralReward').value = res.referralReward || 0;
            document.getElementById('set-logoUrl').value = res.logoUrl || "";
        } 
    } catch(e) {} 
}

async function saveSettings() { 
    const data = { 
        discount: toEnNum(document.getElementById('set-discount').value), 
        resellerDiscount: toEnNum(document.getElementById('set-discount-gold').value),
        minBalance: toEnNum(document.getElementById('set-minBalance').value),
        whatsapp: toEnNum(document.getElementById('set-whatsapp').value),
        bonus: toEnNum(document.getElementById('set-bonus').value), 
        ads: document.getElementById('set-ads').value, 
        adminPass: document.getElementById('set-adminPass').value, 
        email: document.getElementById('set-email').value,
        bankName: document.getElementById('set-bankName').value,
        bankAcc: toEnNum(document.getElementById('set-bankAcc').value),
        maintenance: document.getElementById('set-maintenance').checked,
        enableLoan: document.getElementById('set-enableLoan').checked,
        enableWheel: document.getElementById('set-enableWheel').checked,
        flashSaleEnabled: document.getElementById('set-enableFlash').checked,
        loanAmount: document.getElementById('set-loanAmount').value,
        wheelMaxPrize: document.getElementById('set-wheelMax').value,
        referralReward: document.getElementById('set-referralReward').value,
        logoUrl: document.getElementById('set-logoUrl').value
    }; 
    loading(true); 
    try { 
        const res = await fetch(`${API}?action=updateSettings&adminPass=${encodeURIComponent(myPass)}&data=${encodeURIComponent(JSON.stringify(data))}`).then(r => r.json()); 
        showT(res.msg); 
        if(res.success) { 
            playSound('success'); myPass = data.adminPass; whatsappNumber = data.whatsapp; initSystemSettings();
        } else playSound('error');
    } catch(e) { playSound('error'); } loading(false); 
}

// --- دوال مساعدة ---
function copyRefCode() {
     const code = document.getElementById('my-ref-code-display').innerText;
     if(code && !code.includes("جاري")) { navigator.clipboard.writeText(code).then(() => showT("تم نسخ كود الإحالة ✅")); vibrate(); }
}

function openWhatsAppSupport() { window.open(`https://wa.me/${whatsappNumber}`, '_blank'); }
function copyBankAcc() { vibrate(); navigator.clipboard.writeText(globalBankAcc); showT('تم نسخ رقم الحساب ✅'); }
function requestPinFromUser() { return new Promise((resolve) => { const modal = document.getElementById('custom-pin-modal'), input = document.getElementById('custom-pin-input'), btn = document.getElementById('custom-pin-confirm'); input.value = ""; modal.style.display = 'flex'; input.focus(); btn.onclick = () => { const pin = input.value.trim(); if(pin) { modal.style.display = 'none'; resolve(pin); } else { showT("يرجى إدخال الرمز", true); } }; }); }
function showReceipt(type, amt, ref, extra) { document.getElementById('rec-type').innerText = type; document.getElementById('rec-amt').innerText = amt + " ريال"; document.getElementById('rec-date').innerText = new Date().toLocaleString(); document.getElementById('rec-ref').innerText = ref; document.getElementById('receipt-modal').style.display = 'flex'; }
function toEnNum(str) { return String(str).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴٥٦۷٨٩".indexOf(d)); }
function loading(s) { document.getElementById('loader').style.display = s ? "flex" : "none"; }
function showT(m, err=false) { const t = document.getElementById('toast'); t.innerText = m; t.style.display = "block"; t.style.background = err ? "var(--error)" : "var(--gold)"; t.style.color = err ? "#fff" : "#000"; setTimeout(() => t.style.display = "none", 4000); }

function getID() { 
    let id = localStorage.getItem('m_dev');
    if(!id) {
        id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'D-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('m_dev', id);
    }
    return id; 
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.removeItem('m_u'); localStorage.removeItem('m_p'); location.reload(); }

function openResetModal() { document.getElementById('reset-modal').style.display = 'flex'; }
function toggleMenu() { document.getElementById('side-menu').classList.toggle('open'); document.getElementById('overlay').style.display = document.getElementById('side-menu').classList.contains('open') ? 'block' : 'none'; }

function switchSec(id) { 
    document.querySelectorAll('.sec').forEach(s => s.classList.add('hidden')); 
    document.getElementById('sec-' + id).classList.remove('hidden'); 
    localStorage.setItem('last_sec', id); 
    if(document.getElementById('side-menu').classList.contains('open')) toggleMenu(); 
    
    if(id === 'admin') {
        document.getElementById('admin-home-grid').style.display = 'grid';
        document.getElementById('admin-nav-tabs').classList.add('hidden');
        document.querySelectorAll('.admin-sec').forEach(s => s.classList.add('hidden'));
    }

    if(chatInterval) clearInterval(chatInterval);
    if(id === 'chat') {
        chatInterval = setInterval(() => loadChat(true), 4000); 
        loadChat(true); 
        document.getElementById('wa-btn-chat').style.display = 'flex'; 
    } else {
        document.getElementById('wa-btn-chat').style.display = 'none'; 
    }
}

function handleAdminBack() {
    const grid = document.getElementById('admin-home-grid');
    if (grid.style.display === 'none') {
        grid.style.display = 'grid';
        document.getElementById('admin-nav-tabs').classList.add('hidden');
        document.querySelectorAll('.admin-sec').forEach(s => s.classList.add('hidden'));
    } else {
        switchSec('dashboard');
    }
}

function switchAdminTab(t, b) { 
    document.getElementById('admin-home-grid').style.display = 'none';
    document.getElementById('admin-nav-tabs').classList.remove('hidden');
    document.querySelectorAll('.admin-sec').forEach(s => s.classList.add('hidden')); 
    document.getElementById('admin-' + t).classList.remove('hidden'); 
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); 
    
    if(b) b.classList.add('active');
    else {
        const tabBtn = document.querySelector(`.tab-btn[onclick*="${t}"]`);
        if(tabBtn) tabBtn.classList.add('active');
    }
}

function copyVerticalSingle(type, codes) { vibrate(); navigator.clipboard.writeText(`--- ${type} ---\n` + codes.split(',').join('\n').trim()).then(() => showT("تم النسخ ✅")); }
function copyAllCardsVertical() { if(currentCardsData.length === 0) return showT("لا توجد كروت", true); let allContent = "💎 سجل كروتي 💎\n\n"; currentCardsData.forEach(c => { let type = c.ref.split(':')[0] || "باقة"; let codes = c.ref.replace(type + ":", "").trim(); allContent += `📦 ${type}:\n${codes.split(',').join('\n').trim()}\n------------------\n`; }); navigator.clipboard.writeText(allContent).then(() => showT("تم نسخ الأرشيف كاملاً ✅")); }
function copyAndClose() { vibrate(); navigator.clipboard.writeText(document.getElementById('codes-display').innerText).then(() => { showT("تم النسخ ✅"); closeModal('codes-modal'); }); }
function updateRealBalance(newB) { realBalance = newB; if(!isBalanceHidden) document.getElementById('bal-display').innerText = formatCurrency(newB) + " ريال"; }

// دوال الباك اند
async function loadAdminUserStatement() { const sid = toEnNum(document.getElementById('adm-search-id').value); if(!sid) return showT("ابحث عن عميل أولاً", true); loading(true); try { const res = await fetch(`${API}?action=getOrders&id=${sid}`).then(r => r.json()); if(res.success) { currentUserOrders = res.orders.reverse(); const container = document.getElementById('admin-stmt-container'); container.innerHTML = `<div style="background:#222; padding:10px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--gold);">اختر الشهر:</span><select id="admin-month-selector" class="month-select" onchange="renderStatement(this.value, true)"></select></div><div class="stmt-summary-box"><div class="stmt-item"><small>وارد</small><span class="val-in" id="admin-total-in">0</span></div><div class="stmt-item"><small>صادر</small><span class="val-out" id="admin-total-out">0</span></div></div><div style="overflow-x:auto;"><table class="stmt-table"><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody id="admin-stmt-body"></tbody></table></div>`; populateMonthSelector(currentUserOrders, 'admin-month-selector', (m) => renderStatement(m, true)); document.getElementById('admin-stmt-modal').style.display = 'flex'; } else { showT("لا توجد بيانات", true); } } catch(e) {} loading(false); }
async function updateProfile() { if(isGuest) return; const b = document.getElementById('acc-bank').value; const p = document.getElementById('acc-new-pass').value; const pc = document.getElementById('acc-new-pass-confirm').value; const newPin = document.getElementById('acc-new-pin').value; if(p && p.length < 5) { showT("كلمة المرور قصيرة", true); isEditMode = true; return; } if(p !== pc) { showT("كلمات المرور غير متطابقة", true); isEditMode = true; return; } if(newPin && newPin.length < 4) { showT("الرمز PIN قصير جداً", true); isEditMode = true; return; } loading(true); try { let url = `${API}?action=updateProfile&id=${myUser}&oldPass=${myPass}&newName=${encodeURIComponent(b)}`; if(p) url += `&newPass=${p}`; const res = await fetch(url).then(r => r.json()); if(res.success) { if(newPin) await fetch(`${API}?action=setupPin&id=${myUser}&pin=${newPin}`).then(r=>r.json()); if(p) { myPass = p; localStorage.setItem('m_p', p); } showT("تم حفظ البيانات ✅"); playSound('success'); document.getElementById('acc-bank').disabled = true; document.getElementById('acc-new-pass').disabled = true; document.getElementById('acc-new-pass-confirm').disabled = true; document.getElementById('acc-new-pin').disabled = true; document.getElementById('btn-profile-action').innerText = "تعديل البيانات"; document.getElementById('btn-profile-action').style.background = ""; isEditMode = false; } else { showT(res.msg, true); isEditMode = true; } } catch(e) { isEditMode = true; } loading(false); }
function toggleEditProfile() { if(isGuest) return showT("غير متاح للزائر", true); isEditMode = !isEditMode; const bankInput = document.getElementById('acc-bank'); const passInput = document.getElementById('acc-new-pass'); const passConfirm = document.getElementById('acc-new-pass-confirm'); const pinInput = document.getElementById('acc-new-pin'); const btn = document.getElementById('btn-profile-action'); bankInput.disabled = !isEditMode; passInput.disabled = !isEditMode; passConfirm.disabled = !isEditMode; pinInput.disabled = !isEditMode; if(isEditMode) { btn.innerText = "حفظ التغييرات الآن"; btn.style.background = "var(--success)"; btn.style.color = "#000"; } else { updateProfile(); } }

async function fetchAdminOrders(silent = false) { const list = document.getElementById('admin-pending-list'); try { const res = await fetch(`${API}?action=getAdminOrders&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json()); if(res.success && res.orders.length > 0) { list.innerHTML = res.orders.map(o => `<div class="card" style="padding:12px; border-right:4px solid var(--pending);"><div style="font-size:0.85rem;"><b>${o.ref || o.user}</b> <small>(${o.user})</small></div><div style="margin:5px 0;">طلب شحن <b style="color:var(--gold)">${o.amount}</b> ريال</div><div style="display:flex; gap:5px; margin-top:10px;"><button class="btn" style="padding:6px; background:var(--success); color:#000;" onclick="playSound('click'); processOrder(${o.row}, 'approve')">قبول</button><button class="btn" style="padding:6px; background:var(--error); color:#fff;" onclick="playSound('click'); processOrder(${o.row}, 'reject')">رفض</button></div></div>`).join(''); } else list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا طلبات جديدة</p>"; loadStats(); } catch(e) {} }

async function processOrder(row, type) { 
    loading(true); const act = type === 'approve' ? 'adminApprove' : 'adminReject'; 
    try { 
        const res = await fetch(`${API}?action=${act}&row=${row}&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json()); 
        showT(res.msg);
        if(res.loanDeducted) { alert(`⚠️ تنبيه للنظام:\nتم خصم مبلغ السلفة (${res.deductedAmount} ريال) من رصيد العميل تلقائياً.`); }
        fetchAdminOrders(); 
    } catch(e) {} loading(false); 
}

async function searchUser() { 
    const sid = toEnNum(document.getElementById('adm-search-id').value); 
    loading(true); 
    try { 
        const res = await fetch(`${API}?action=getWallet&id=${sid}&adminPass=${encodeURIComponent(myPass)}&impersonate=true`).then(r => r.json()); 
        if(res.success) { 
            document.getElementById('user-tools').classList.remove('hidden'); 
            document.getElementById('user-info-box').innerHTML = `<b>${res.paymentName}</b><br>💰 رصيد: ${res.balance}<br>🎖️ رتبة: ${res.rank || 'عادي'}<br><div style="background:rgba(255,0,0,0.1); padding:5px; margin-top:5px; border-radius:5px; border:1px dashed #f00;">🔒 باسوورد: <span style="user-select:all; color:var(--gold)">${res.userPass}</span><br>🔑 PIN: <span style="user-select:all; color:var(--gold)">${res.userPin || 'غير معين'}</span></div>`; 
            document.getElementById('adm-set-rank').value = res.rank || "عادي"; 
        } else showT("غير موجود", true); 
    } catch(e) {} 
    loading(false); 
}

// دالة حذف العميل من كافة الأوراق
async function adminDeleteUser() {
    const sid = toEnNum(document.getElementById('adm-search-id').value);
    if(!confirm("⚠️ تحذير خطير!\nهل أنت متأكد من حذف هذا الحساب وكل بياناته (محافظ، ديون، تذاكر) بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    loading(true);
    try {
        const res = await fetch(`${API}?action=deleteUserAccount&adminPass=${encodeURIComponent(myPass)}&targetId=${sid}`).then(r => r.json());
        showT(res.msg);
        if(res.success) { 
            document.getElementById('user-tools').classList.add('hidden'); 
            document.getElementById('adm-search-id').value = ""; 
        }
    } catch(e) { playSound('error'); showT("فشل الحذف", true); }
    loading(false);
}

async function adminForceAction(subAction) { const sid = toEnNum(document.getElementById('adm-search-id').value); const amt = toEnNum(document.getElementById('adm-action-amt').value); if(!amt || amt <= 0) { playSound('error'); return showT("المبلغ خطأ", true); } loading(true); try { const res = await fetch(`${API}?action=adminForceAction&adminPass=${encodeURIComponent(myPass)}&targetId=${sid}&amount=${amt}&subAction=${subAction}`).then(r => r.json()); showT(res.msg); if(res.success) searchUser(); } catch(e) { playSound('error'); } loading(false); }
async function updateUserRank(rank) { const sid = toEnNum(document.getElementById('adm-search-id').value); loading(true); try { const res = await fetch(`${API}?action=updateRank&adminPass=${encodeURIComponent(myPass)}&targetId=${sid}&rank=${encodeURIComponent(rank)}`).then(r => r.json()); showT(res.msg); if(res.success) searchUser(); } catch(e) {} loading(false); }
async function submitNewStock() { const type = document.getElementById('stock-type-select').value; const codesRaw = document.getElementById('stock-input').value.trim(); if(!codesRaw) { playSound('error'); return showT("أين الأكواد؟", true); } const uniqueCodes = [...new Set(codesRaw.split('\n').map(c => c.trim()).filter(c => c))]; loading(true); try { const res = await fetch(`${API}?action=addStock&adminPass=${encodeURIComponent(myPass)}&cardType=${encodeURIComponent(type)}&codes=${encodeURIComponent(uniqueCodes.join('\n'))}`).then(r => r.json()); showT(res.msg); if(res.success) { playSound('success'); document.getElementById('stock-input').value = ""; loadStore(); } } catch(e) { playSound('error'); } loading(false); }
async function previewStockCurrent() { const type = document.getElementById('stock-type-select').value; if(!type) return showT("اختر نوع كرت أولاً", true); loading(true); try { const res = await fetch(`${API}?action=previewStock&adminPass=${encodeURIComponent(myPass)}&cardType=${encodeURIComponent(type)}`).then(r => r.json()); if(res.success && res.samples.length > 0) { alert(`عينات من كرت ${type}:\n\n` + res.samples.join("\n")); } else { showT("المخزون فارغ أو خطأ", true); } } catch(e) {} loading(false); }

async function adminGenerateVouchers() {
    const qty = document.getElementById('gen-v-qty').value; const val = document.getElementById('gen-v-val').value; if(!qty || !val) { playSound('error'); return showT("أكمل البيانات", true); } loading(true); try { const res = await fetch(`${API}?action=generateVouchers&adminPass=${encodeURIComponent(myPass)}&qty=${qty}&value=${val}&type=numeric`).then(r=>r.json()); if(res.success) { const outputContainer = document.getElementById('gen-v-output-container'); const output = document.getElementById('gen-v-output'); outputContainer.classList.remove('hidden'); output.innerText = res.codes.join("\n"); playSound('success'); showT("تم التوليد بنجاح"); loadAdminVouchers(); } } catch(e){} loading(false);
}

function copyVerticalGeneratedVouchers() { const text = document.getElementById('gen-v-output').innerText; if(!text) return; navigator.clipboard.writeText(text).then(() => showT("تم النسخ عمودياً ✅")); }

function printGridVouchers() {
    const text = document.getElementById('gen-v-output').innerText;
    if(!text) return showT("ولد كروت أولاً", true);
    
    const codes = text.split('\n');
    const value = document.getElementById('gen-v-val').value;
    const container = document.getElementById('printable-vouchers');
    container.innerHTML = "";
    
    codes.forEach(code => {
        if(code.trim()) {
            const card = document.createElement('div');
            card.className = "voucher-card-print";
            card.innerHTML = `<strong>${value} ريال</strong><span style="font-family:monospace; font-size:1.2rem; margin:5px 0;">${code}</span><small>الماجد </small>`;
            container.appendChild(card);
        }
    });
    window.print();
}

async function adminAddCoupon() { const code = document.getElementById('cpn-code').value; const disc = document.getElementById('cpn-disc').value; const max = document.getElementById('cpn-max').value; if(!code || !disc) { playSound('error'); return showT("أكمل البيانات", true); } loading(true); try { const res = await fetch(`${API}?action=addCoupon&adminPass=${encodeURIComponent(myPass)}&code=${encodeURIComponent(code)}&discount=${disc}&maxUses=${max}`).then(r=>r.json()); showT(res.msg); loadAdminCoupons(); } catch(e){} loading(false); }

async function loadAdminVouchers() {
    if(currentVouchersList.length > 0) renderAdminList('vouchers', currentVouchersList); 
    const list = document.getElementById('admin-vouchers-list');
    if(currentVouchersList.length === 0) list.innerHTML = '<div class="skeleton" style="height:80px;"></div>';
    try {
        const res = await fetch(`${API}?action=getAdminList&type=vouchers&adminPass=${encodeURIComponent(myPass)}`).then(r=>r.json());
        if(res.success) { currentVouchersList = res.list || []; renderAdminList('vouchers', currentVouchersList); }
    } catch(e) {}
}

async function loadAdminCoupons() {
    if(currentCouponsList.length > 0) renderAdminList('coupons', currentCouponsList);
    const list = document.getElementById('admin-coupons-list');
    if(currentCouponsList.length === 0) list.innerHTML = '<div class="skeleton" style="height:80px;"></div>';
    try {
        const res = await fetch(`${API}?action=getAdminList&type=coupons&adminPass=${encodeURIComponent(myPass)}`).then(r=>r.json());
        if(res.success) { currentCouponsList = res.list || []; renderAdminList('coupons', currentCouponsList); }
    } catch(e) {}
}

async function loadAdminFlashSales() {
    if(currentFlashList.length > 0) renderAdminList('flash', currentFlashList);
    const list = document.getElementById('active-flash-list');
    if(currentFlashList.length === 0) list.innerHTML = '<div class="skeleton" style="height:80px;"></div>';
    try {
         const res = await fetch(`${API}?action=getAdminList&type=flash&adminPass=${encodeURIComponent(myPass)}`).then(r=>r.json());
        if(res.success) { currentFlashList = res.list || []; renderAdminList('flash', currentFlashList); }
    } catch(e) {}
}

function renderAdminList(type, data) {
    let containerId = "";
    if(type === 'vouchers') containerId = 'admin-vouchers-list';
    if(type === 'coupons') containerId = 'admin-coupons-list';
    if(type === 'flash') containerId = 'active-flash-list';
    
    const list = document.getElementById(containerId);
    if(!data || data.length === 0) { list.innerHTML = "<p style='text-align:center; opacity:0.5;'>لا توجد بيانات</p>"; return; }
    
    list.innerHTML = data.map(item => {
        let title = "", code = "", meta = "", colorBorder = "var(--gold)", btnAction = "";
        
        if(type === 'vouchers') {
            title = `قيمة: ${item.value}`; code = item.code; 
            let usedStr = item.usedBy ? `استخدم بواسطة: ${item.usedByName} (${item.usedBy})` : 'غير مستخدم';
            meta = `${item.date} | ${item.status}<br><small style="color:var(--gold);">${usedStr}</small>`;
            colorBorder = item.status === 'Active' ? 'var(--success)' : 'var(--error)';
            btnAction = `<button onclick="playSound('click'); vibrate(); copyVerticalSingle('${title}', '${code}')" style="background:rgba(255, 255, 255, 0.1); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.7rem; cursor:pointer;">نسخ</button>`;
        } else if (type === 'coupons') {
            title = `خصم: ${item.discount*100}%`; code = item.code; meta = `الحد: ${item.max} | المستخدم: ${item.used}`; colorBorder = 'var(--pending)';
             btnAction = `<button onclick="playSound('click'); vibrate(); copyVerticalSingle('${title}', '${code}')" style="background:rgba(255, 255, 255, 0.1); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.7rem; cursor:pointer;">نسخ</button>`;
        } else if (type === 'flash') {
            title = item.cardType; code = `خصم ${item.discount*100}% - ${item.hours} ساعة`; meta = `ينتهي: ${item.endTime}`; colorBorder = '#ff4b2b';
            btnAction = `<button onclick="playSound('click'); deleteFlashSale(${item.row})" style="background:var(--error); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.7rem; cursor:pointer;">حذف 🗑️</button>`;
        }

        return `
        <div class="card" style="padding:15px; border-right:4px solid ${colorBorder};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong style="color:${colorBorder}">${title}</strong>${btnAction}
            </div>
            <div style="font-family:monospace; font-size:0.85rem; opacity:0.9; white-space:pre-wrap;">${code}</div>
            <small style="display:block; margin-top:10px; opacity:0.5;">${meta}</small>
        </div>`; 
    }).join('');
}

function filterAdminList(type) {
    const query = document.getElementById('admin-' + type + '-search').value.toLowerCase();
    let sourceData = [];
    if(type === 'vouchers') sourceData = currentVouchersList;
    if(type === 'coupons') sourceData = currentCouponsList;
    if(type === 'flash') sourceData = currentFlashList;
    
    const filtered = sourceData.filter(item => JSON.stringify(item).toLowerCase().includes(query));
    renderAdminList(type, filtered);
}

function copyAdminListVertical(type) {
    let sourceData = [], headerTitle = "";
    if(type === 'vouchers') { sourceData = currentVouchersList; headerTitle = "💎 تقرير الفاوتشرات 💎"; }
    if(type === 'coupons') { sourceData = currentCouponsList; headerTitle = "🏷️ تقرير الكوبونات 💎"; }
    if(type === 'flash') { sourceData = currentFlashList; headerTitle = "⚡ تقرير العروض 💎"; }

    if(sourceData.length === 0) return showT("لا توجد بيانات للنسخ", true);
    
    let allContent = headerTitle + "\n\n";
    sourceData.forEach(item => {
         let line = "";
         if(type === 'vouchers') line = `🎫 ${item.value} ريال: ${item.code} (${item.status})`;
         if(type === 'coupons') line = `🏷️ ${item.code}: خصم ${item.discount*100}%`;
         if(type === 'flash') line = `⚡ ${item.cardType}: ${item.discount*100}%`;
         allContent += line + "\n------------------\n";
    });
    
    navigator.clipboard.writeText(allContent).then(() => showT("تم نسخ التقرير عمودياً ✅"));
}

// إرسال طلب شحن يتضمن التفاصيل كاملة 
async function confirmTopupRequest() { 
    if(isGuest) return showT("يجب تسجيل الدخول", true); 
    const amt = toEnNum(document.getElementById('top-amt').value); 
    if(!amt || amt <= 0) { playSound('error'); return showT("أدخل المبلغ", true); } 
    if(pendingRequest) { playSound('error'); return showT("لديك طلب معلق", true); } 
    const btn = document.getElementById('btn-topup-main'); btn.disabled = true; loading(true); 
    
    try { 
        let refName = document.getElementById('top-ref').value;
        const res = await fetch(`${API}?action=requestTopup&id=${myUser}&amount=${amt}&ref=${encodeURIComponent(refName)}&userName=${encodeURIComponent(refName)}&userPhone=${encodeURIComponent(myUser)}`).then(r => r.json()); 
        if(res.success) { playSound('success'); showT("تم الإرسال ✅"); document.getElementById('top-amt').value = ""; loadLogs(); } 
        else { playSound('error'); showT(res.msg, true); } 
    } catch(e) { playSound('error'); } loading(false); btn.disabled = false; 
}

async function submitResetRequest() { const u = toEnNum(document.getElementById('auth-user').value), b = document.getElementById('reset-bank-name').value.trim(), pin = document.getElementById('reset-pin-val').value.trim(); if(!b || !pin) { playSound('error'); return showT("أكمل البيانات", true); } loading(true); try { const res = await fetch(`${API}?action=resetDevice&id=${u}&bankName=${encodeURIComponent(b)}&pin=${pin}`).then(r => r.json()); if(res.success) { playSound('success'); showT("تم فك الارتباط ✅"); closeModal('reset-modal'); document.getElementById('locked-box').classList.add('hidden'); handleAuth(); } else showT(res.msg, true); } catch(e) {} loading(false); }
async function setupUserPin() { const pin = document.getElementById('setup-pin-val').value.trim(); if(pin.length < 4) { playSound('error'); return showT("قصير جداً", true); } loading(true); try { const res = await fetch(`${API}?action=setupPin&id=${myUser}&pin=${pin}`).then(r => r.json()); if(res.success) { playSound('success'); closeModal('pin-setup-modal'); handleAuth(); } else showT(res.msg, true); } catch(e) {} loading(false); }
async function submitForcedPass() { const np = document.getElementById('new-forced-pass').value.trim(), cp = document.getElementById('confirm-forced-pass').value.trim(); if(np.length < 5 || np === "1234") { playSound('error'); return showT("غير مقبول", true); } if(np !== cp) { playSound('error'); return showT("غير متطابق", true); } loading(true); try { const res = await fetch(`${API}?action=updateProfile&id=${myUser}&oldPass=1234&newPass=${np}`).then(r => r.json()); if(res.success) { myPass = np; localStorage.setItem('m_p', np); closeModal('force-pass-modal'); showT("تم ✅"); handleAuth(); } else showT(res.msg, true); } catch(e) {} loading(false); }

async function cancelOrder(d) { 
    if(!confirm("هل تريد حذف هذا الطلب المعلق؟")) return; 
    loading(true);
    try { await fetch(`${API}?action=deleteTopup&id=${myUser}&date=${encodeURIComponent(d)}`); showT("تم الحذف بنجاح"); loadLogs(); } catch(e) { showT("حدث خطأ", true); } 
    loading(false);
}

async function startImpersonation() { const sid = toEnNum(document.getElementById('adm-search-id').value); loading(true); try { const res = await fetch(`${API}?action=getWallet&id=${sid}&adminPass=${encodeURIComponent(myPass)}&impersonate=true`).then(r => r.json()); if(res.success) { myUser = sid; isAdmin = false; isImpersonating = true; document.getElementById('impersonate-badge').classList.remove('hidden'); loginOk(res.balance, res.paymentName); showT("تقمص: " + res.paymentName); } } catch(e) {} loading(false); }
async function loadStats() { if(!isAdmin) return; try { const res = await fetch(`${API}?action=getStats&adminPass=${encodeURIComponent(myPass)}`).then(r => r.json()); if(res.success) { const container = document.getElementById('admin-stats-container'); container.innerHTML = `<div class="card" style="background:rgba(0,0,0,0.4); border:1px solid var(--gold);"><h4 style="text-align:center; margin:0 0 10px 0; color:var(--gold);">📊 الإحصائيات المالية</h4><div style="display:flex; justify-content:space-around; text-align:center;"><div><small>وارد اليوم</small><br><b style="color:var(--success)">${formatCurrency(res.daily)}</b></div><div><small>وارد الشهر</small><br><b style="color:var(--success)">${formatCurrency(res.monthly)}</b></div><div><small>مبيعات كروت</small><br><b style="color:var(--pending)">${formatCurrency(res.sales || 0)}</b></div></div></div>`; } } catch(e) {} }

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(isLoggedIn) document.getElementById('pwa-install-banner').style.display = 'flex'; });
async function installPWA() { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; closePWA(); } }
function closePWA() { document.getElementById('pwa-install-banner').style.display = 'none'; }
function saveReceiptImage() { const receiptDiv = document.querySelector("#receipt-content"); html2canvas(receiptDiv, { backgroundColor: "#ffffff" }).then(canvas => { const link = document.createElement('a'); link.download = `receipt_${Date.now()}.png`; link.href = canvas.toDataURL(); link.click(); showT("تم حفظ الصورة ✅"); }); }
function shareReceipt() { const receiptDiv = document.querySelector("#receipt-content"); html2canvas(receiptDiv, { backgroundColor: "#ffffff" }).then(canvas => { canvas.toBlob(async (blob) => { const file = new File([blob], `receipt_${Date.now()}.png`, { type: 'image/png' }); if (navigator.share) { try { await navigator.share({ title: 'إيصال عملية - الماجد', text: 'إيصال عملية ناجحة من محفظة الماجد.', files: [file] }); showT("تمت المشاركة بنجاح ✅"); } catch (err) {} } else { const link = document.createElement('a'); link.download = `receipt_${Date.now()}.png`; link.href = canvas.toDataURL(); link.click(); showT("تم تحميل الصورة (المشاركة غير مدعومة)"); } }); }); }

// --- دوال العروض الخاطفة المفقودة ---
function openFlashSaleModal() {
    document.getElementById('flash-sale-modal').style.display = 'flex';
}

async function submitFlashSale() {
    const cardType = document.getElementById('flash-card-type').value;
    const discount = document.getElementById('flash-discount').value;
    const hours = document.getElementById('flash-hours').value;

    if(!cardType || !discount || !hours) { playSound('error'); return showT("أكمل البيانات أولاً", true); }
    loading(true);
    try {
        const res = await fetch(`${API}?action=addFlashSale&adminPass=${encodeURIComponent(myPass)}&cardType=${encodeURIComponent(cardType)}&discount=${discount}&hours=${hours}`).then(r=>r.json());
        showT(res.msg);
        if(res.success) {
            closeModal('flash-sale-modal');
            loadAdminFlashSales();
        }
    } catch(e) { showT("خطأ في الاتصال", true); }
    loading(false);
}

async function deleteFlashSale(row) {
    if(!confirm("هل أنت متأكد من إنهاء هذا العرض الخاطف؟")) return;
    loading(true);
    try {
        const res = await fetch(`${API}?action=deleteFlashSale&adminPass=${encodeURIComponent(myPass)}&row=${row}`).then(r=>r.json());
        showT(res.msg);
        if(res.success) loadAdminFlashSales();
    } catch(e) { showT("خطأ في الاتصال", true); }
    loading(false);
}

// --- دوال إدارة عجلة الحظ للمدير ---
async function loadAdminWheel() {
    const list = document.getElementById('admin-wheel-list');
    list.innerHTML = '<div class="skeleton" style="height:60px;"></div>';
    try {
        const res = await fetch(`${API}?action=getAdminWheelHistory&adminPass=${encodeURIComponent(myPass)}`).then(r=>r.json());
        if(res.success) {
            currentWheelHistory = res.history;
            populateMonthSelector(currentWheelHistory, 'admin-wheel-month', (m) => filterAdminWheel(m));
        } else {
            list.innerHTML = "<p style='text-align:center; opacity:0.6;'>لا توجد بيانات</p>";
        }
    } catch(e) { list.innerHTML = "خطأ في الاتصال"; }
}

function filterAdminWheel(monthKey) {
    const list = document.getElementById('admin-wheel-list');
    const filtered = currentWheelHistory.filter(h => h.date.startsWith(monthKey));
    if(filtered.length === 0) { 
        list.innerHTML = "<p style='text-align:center; opacity:0.6;'>لا يوجد فائزين في هذا الشهر</p>"; 
        return; 
    }
    list.innerHTML = filtered.map(h => `
        <div class="card" style="padding:12px; margin-bottom:10px; border-right:4px solid var(--success);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="font-size:0.9rem;">${h.name}</b> 
                <b style="color:var(--gold); font-size:1.1rem;">${h.amount} ريال</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:5px; opacity:0.7; font-size:0.75rem;">
                <span>📱 ${h.user}</span>
                <span>📅 ${h.date}</span>
            </div>
        </div>
    `).join('');
}

// --- دالة مشاركة التطبيق ---
function shareApp() {
    playSound('click');
    if (navigator.share) {
        navigator.share({
            title: 'محفظة الماجد',
            text: 'حمل تطبيق محفظة الماجد واستمتع بأفضل عروض الشحن والكروت.',
            url: 'https://play.google.com/store/apps/details?id=com.qadasi.telecom'
        });
    } else {
        navigator.clipboard.writeText('https://play.google.com/store/apps/details?id=com.qadasi.telecom');
        showT("تم نسخ رابط التطبيق ✅");
    }
}

window.onload = () => { checkNetworkStatus(); const savedTheme = localStorage.getItem('app_theme') || 'default'; if(savedTheme !== 'default') document.body.setAttribute('data-theme', savedTheme); if(isSoundEnabled) document.getElementById('sound-checkbox').classList.add('checked'); if(localStorage.getItem('m_u') && localStorage.getItem('m_p')) { document.getElementById('auth-user').value = localStorage.getItem('m_u'); document.getElementById('auth-pass').value = localStorage.getItem('m_p'); if(localStorage.getItem('remember')) { rememberMe = true; document.getElementById('check-remember').classList.add('checked'); handleAuth(); } } };

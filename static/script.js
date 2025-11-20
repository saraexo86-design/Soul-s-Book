
/* Updated script.js
   - Prevents page refresh/jump on vote
   - Updates vote count inline
   - Resorts books by votes and re-renders current page while preserving scroll position
   - Keeps HTML structure intact so your CSS works unchanged
*/

const SERVER_URL = 'http://127.0.0.1:5000';
const DATA_PATH_PREFIX = 'data/';

let allBooksData = [];
let allMBTITypes = [];
let allMBTI_Recs = [];
let allBook_Genres = [];
let allGenres = [];

let currentPage = 1;
const itemsPerPage = 10;
let recommendedBooks = [];

const WELCOME_SCREEN_ID = 'welcome-screen';
const MBTI_INPUT_SELECTION_ID = 'mbti-input-selection';
const RESULTS_CONTAINER_ID = 'results-container';
const BOOKS_LIST_ID = 'book-list';

const MBTI_COLOR_MAP = {
    'NT': '#dfd2f8ff',
    'NF': '#d9f4d9ff',
    'SJ': '#d6e8f9ff',
    'SP': '#fbfbccff'
};

function getMbtiGroupKey(typeName) {
    if (!typeName || typeName.length !== 4) return 'NF';
    const N_S = typeName[1];
    if (N_S === 'N' && typeName.includes('T')) return 'NT';
    if (N_S === 'N' && typeName.includes('F')) return 'NF';
    if (N_S === 'S' && typeName.includes('J')) return 'SJ';
    if (N_S === 'S' && typeName.includes('P')) return 'SP';
    return 'NF';
}

function showSelection(selectionId){
    const selections = [WELCOME_SCREEN_ID, MBTI_INPUT_SELECTION_ID, RESULTS_CONTAINER_ID];
    selections.forEach(id => {
        const element = document.getElementById(id);
        if (element){
            element.style.display = (id === selectionId) ? 'block' : 'none';
        }
    });
}

async function getAIRecommendations(selectedTypeID) {
    try {
        const response = await fetch(`${SERVER_URL}/api/recommend-genres`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ type_id: selectedTypeID })
        });

        if (!response.ok) {
            console.error('Server responded with status', response.status);
            return [];
        }

        const data = await response.json();
        return Array.isArray(data.recommended_books) ? data.recommended_books : [];
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

async function handleVote(bookId) {
    // جلوگیری از رأی دوباره
    const votedBooks = JSON.parse(localStorage.getItem("votedBooks") || "[]");

    if (votedBooks.includes(bookId)) {
        showPopup("رأی شما قبلاً ثبت شده است.","warning");
        return; 
    }

    try {
        const res = await fetch(`${SERVER_URL}/api/vote`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ book_id: Number(bookId) })
        });

        if (!res.ok) {
            alert("ثبت رای ناموفق بود.");
            return;
        }

        const data = await res.json();

        // آپدیت نمایش تعداد آرا
        const voteElement = document.getElementById(`vote-count-${bookId}`);
        if (voteElement) {
            voteElement.textContent =` مجموع آراء: ${data.new_vote_count}`;
        }

        // ذخیره در localStorage (جلوگیری از رأی دوباره)
        votedBooks.push(bookId);
        localStorage.setItem("votedBooks", JSON.stringify(votedBooks));

        showPopup("رأی شما با موفقیت ثبت شد!","success");

        // غیرفعال کردن دکمه رأی
        const btn = document.querySelector(`button[data-book-id="${bookId}"]`);
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
            btn.style.cursor = "not-allowed";
        }

    } catch (err) {
        console.error(err);
        alert("خطا در ثبت رای.");
    }
}   

async function loadData() {
    if (allMBTITypes.length > 0) {
        showSelection(MBTI_INPUT_SELECTION_ID);
        return;
    }

    try {
        const [booksRes, mbtiRes, mbtiRecsRes, bookGenresRes, genresRes] = await Promise.all([
            fetch(`${DATA_PATH_PREFIX}books.json`),
            fetch(`${DATA_PATH_PREFIX}mbti_types.json`),
            fetch(`${DATA_PATH_PREFIX}mbti_recs.json`),
            fetch(`${DATA_PATH_PREFIX}book_genres.json`),
            fetch(`${DATA_PATH_PREFIX}genres.json`)
        ]);

        if (!booksRes.ok || !mbtiRes.ok) {
            throw new Error('Failed to load some data files.');
        }

        allBooksData = await booksRes.json();
        allMBTITypes = await mbtiRes.json();
        allMBTI_Recs = mbtiRecsRes.ok ? await mbtiRecsRes.json() : [];
        allBook_Genres = bookGenresRes.ok ? await bookGenresRes.json() : [];
        allGenres = genresRes.ok ? await genresRes.json() : [];

        populateMBTISelector();
        showSelection(MBTI_INPUT_SELECTION_ID);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('خطا در بارگذاری داده‌ها. لطفاً بررسی کنید فایل‌های data/ در دسترس باشند.');
    }
}

function populateMBTISelector(){
    const selector = document.getElementById('mbti-selector');
    if (!selector) return;

    selector.innerHTML = '';

    if (!Array.isArray(allMBTITypes) || allMBTITypes.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'هیچ تایپی یافت نشد';
        selector.appendChild(opt);
        return;
    }

    allMBTITypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.TypeName;
        option.textContent = type.TypeName;
        selector.appendChild(option);
    });
}

async function displayRecommendations() {
    currentPage = 1;

    const selectedTypeName = document.getElementById('mbti-selector').value || '';
    document.getElementById('selected-mbti-type').textContent = selectedTypeName;
    showSelection(RESULTS_CONTAINER_ID);

    const selectedType = allMBTITypes.find(type => type.TypeName === selectedTypeName);
    if (!selectedType) {
        document.getElementById(BOOKS_LIST_ID).innerHTML = '<li> خطا: تایپ شخصیتی انتخاب شده یافت نشد. </li>';
        return;
    }

    const selectedTypeID = selectedType.TypeID;
    const allBooksWithVotes = await getAIRecommendations(selectedTypeID);

    if (!Array.isArray(allBooksWithVotes) || allBooksWithVotes.length === 0) {
        document.getElementById(BOOKS_LIST_ID).innerHTML = `<li> متاسفانه برای تایپ ${selectedTypeName} پیشنهادی در دست نیست. </li>;`
        recommendedBooks = [];
        updatePaginationControls();
        return;
    }

    allBooksWithVotes.sort((a,b) => (b.TotalVotes || 0) - (a.TotalVotes || 0));
    recommendedBooks = allBooksWithVotes;
    renderPage();
}

function renderBookCard (book, cardBackgroundColor){
    const bookCard = document.createElement('div');
    bookCard.classList.add('book-card');
    if (cardBackgroundColor) bookCard.style.backgroundColor = cardBackgroundColor;
    bookCard.id = `book-${book.BookID}`;
    // add data-votes attribute for optional DOM sorting reference
    bookCard.setAttribute('data-votes', String(book.TotalVotes || 0));

    bookCard.innerHTML = 
        `<div class="card-inner">
            <div class="book-cover-shadow">
                <img src="${book.CoverImagePath ? book.CoverImagePath : 'images/placeholder.jpg'}" 
                     alt="${escapeHtml(book.Title || '')}" class="book-cover">
                     </div>
            <div class="book-details">
                <h3 class="book-title">${escapeHtml(book.Title || '')}</h3>
                <p class="book-author">${escapeHtml(book.Author || 'نامشخص')}</p>
                <p class="book-description">${escapeHtml(book.Description || 'خلاصه موجود نیست.')}</p>
                
                <div class="vote-section">
                    <span id="vote-count-${book.BookID}" class="vote-count">مجموع آراء: ${book.TotalVotes || 0}</span>
                    <button class="vote-button" type="button" data-book-id="${book.BookID}">رای دادن 👍</button>
                    <span class="source-tag"> (MBTI Match) </span>
                </div>
            </div>
        </div>`;

    return bookCard; 
}

function renderPage() {
    const booksList = document.getElementById(BOOKS_LIST_ID);
    if (!booksList) return;
    booksList.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const booksToRender = recommendedBooks.slice(startIndex, endIndex);

    const selectedTypeName = document.getElementById('mbti-selector').value || '';
    const mbtiGroupKey = getMbtiGroupKey(selectedTypeName);
    const cardBackgroundColor = MBTI_COLOR_MAP[mbtiGroupKey] || null;

    if (booksToRender.length > 0){
        booksToRender.forEach(book => {
            const bookCard = renderBookCard(book, cardBackgroundColor);
            booksList.appendChild(bookCard);
        });
    } else {
        booksList.innerHTML = '<li> کتابی برای نمایش در این صفحه وجود ندارد. </li>';
    }

    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.max(1, Math.ceil((recommendedBooks.length || 0) / itemsPerPage));
    let controls = document.getElementById('pagination-controls');

    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'pagination-controls';
        const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
        if (resultsContainer) resultsContainer.appendChild(controls);
    }

    controls.innerHTML = ''; 

    const prevBtn = document.createElement('button');
    prevBtn.classList.add('page-btn');
    prevBtn.textContent = 'صفحه قبل';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
            window.scrollTo(0, 0);
        }
    });
    controls.appendChild(prevBtn);

    const pageStatus = document.createElement('span');
    pageStatus.textContent = ` صفحه ${currentPage} از ${totalPages}`;
    controls.appendChild(pageStatus);

    const nextBtn = document.createElement('button');
    nextBtn.classList.add('page-btn');
    nextBtn.textContent = 'صفحه بعد';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
            window.scrollTo(0, 0);
        }
    });
    controls.appendChild(nextBtn);

    const backBtn = document.createElement('button');
    backBtn.classList.add('page-btn');
    backBtn.textContent = 'بازگشت';
    backBtn.addEventListener('click', () => showSelection(MBTI_INPUT_SELECTION_ID));
    controls.appendChild(backBtn);
}

function showPopup(message, type="success") {
    const popup = document.getElementById("popup-message");

    popup.textContent = message;
    popup.className = `popup show ${type}`;

    setTimeout(() => {
        popup.classList.remove("show");
        setTimeout(() => popup.classList.add("hidden"), 300);
    }, 1800);
}

/* Global click listener for vote buttons — prevents default & stops propagation */
document.addEventListener('click', (event) =>{
    const target = event.target;
    if (target && target.classList && target.classList.contains('vote-button')){
        // fully prevent default behavior and propagation to avoid any form submit or other handlers
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const bookId = target.getAttribute('data-book-id');
        if (bookId) {
            // pass the clicked button element so we can disable it while request is in flight
            handleVote(bookId, target);
        }
    }
});

function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    showSelection(WELCOME_SCREEN_ID);

    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) enterBtn.addEventListener('click', loadData);

    const mbtiTestBtn = document.getElementById('mbti-test-btn');
    if (mbtiTestBtn) mbtiTestBtn.addEventListener('click', () => {
        window.open('https://www.16personalities.com/free-personality-test', '_blank');
    });

    const getRecsBtn = document.getElementById('get-recs-btn');
    if (getRecsBtn) getRecsBtn.addEventListener('click', displayRecommendations);
});

// ========== API SETTINGS ==========
const API_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
    query ($search: String) {
        Media(search: $search, type: ANIME) {
            id
            title {
                romaji
                english
            }
            coverImage {
                large
            }
            episodes
            status
            siteUrl
            nextAiringEpisode {
                episode
                airingAt
            }
        }
    }
`;

const AIRING_QUERY = `
  query {
    Page(page: 1, perPage: 10) {
      media(
        type: ANIME
        status: RELEASING
        sort: POPULARITY_DESC
        isAdult: false
      ) {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        status
        nextAiringEpisode {
          episode
          airingAt
        }
      }
    }
  }
`;

const MEDIA_BY_ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      status
      nextAiringEpisode {
        episode
        airingAt
      }
    }
  }
`;

const TMDB_API_KEY = "49e59f8090b5106b0267f0d7b72d0841";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const LAZY_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1' viewBox='0 0 1 1'></svg>");

function attachLazyImageLoader(root = document) {
    const images = root.querySelectorAll('img[data-lazy]');
    if (!images.length) return;

    if (!('IntersectionObserver' in window)) {
        images.forEach(img => {
            if (img.dataset.lazy) img.src = img.dataset.lazy;
            img.removeAttribute('data-lazy');
        });
        return;
    }

    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const img = entry.target;
            const actualSrc = img.dataset.lazy;
            if (actualSrc) {
                img.src = actualSrc;
            }

            img.loading = 'lazy';
            img.decoding = 'async';
            img.removeAttribute('data-lazy');
            observerInstance.unobserve(img);
        });
    }, { rootMargin: '180px 0px' });

    images.forEach(img => observer.observe(img));
}

function hydrateLazyImages(root = document) {
    const images = root.querySelectorAll('img');
    images.forEach(img => {
        if (!img.dataset.lazy && img.getAttribute('src') && img.getAttribute('src') !== LAZY_PLACEHOLDER) {
            img.dataset.lazy = img.getAttribute('src');
            img.setAttribute('src', LAZY_PLACEHOLDER);
        }
        if (img.dataset.lazy) {
            img.loading = 'lazy';
            img.decoding = 'async';
        }
    });
    attachLazyImageLoader(root);
}



function updateBackgroundBasedOnTime() {
    const currentHour = new Date().getHours();
    const bodyElement = document.body;

    const morningCard = document.getElementById('morning');
    const afternoonCard = document.getElementById('afternoon');
    const eveningCard = document.getElementById('evening');

    bodyElement.classList.remove('theme-morning', 'theme-afternoon', 'theme-evening');
    morningCard.classList.remove('active');
    afternoonCard.classList.remove('active');
    eveningCard.classList.remove('active');

    if (currentHour >= 6 && currentHour < 12) {
        // Morning
        bodyElement.classList.add('theme-morning');
        morningCard.classList.add('active');
    }
    else if (currentHour >= 12 && currentHour < 18) {
        // Afternoon
        bodyElement.classList.add('theme-afternoon');
        afternoonCard.classList.add('active');
    }
    else {
        // Evening
        bodyElement.classList.add('theme-evening');
        eveningCard.classList.add('active');
    }
}

updateBackgroundBasedOnTime();
setInterval(updateBackgroundBasedOnTime, 1000);

document.body.classList.add('loading');

window.addEventListener('load', () => {
    const pageLoader = document.getElementById('page-loader');
    if (pageLoader) {
        setTimeout(() => {
            pageLoader.classList.add('hidden');
            document.body.classList.remove('loading');
            setTimeout(() => pageLoader.remove(), 100);
        }, 300);
    }
});

const toggleBtn = document.getElementById('notification-toggle');

const isNotificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';

if (isNotificationsEnabled && Notification.permission === 'granted') {
    toggleBtn.classList.add('active');
} else {
    toggleBtn.classList.remove('active');
    if (Notification.permission !== 'granted') {
        localStorage.setItem('notificationsEnabled', 'false');
    }
}

toggleBtn.addEventListener('click', function () {
    if (Notification.permission === "denied") {
        alert("Notifications are completely blocked. Click the lock icon in your URL address bar to re-enable them.");
        return;
    }

    if (!toggleBtn.classList.contains('active')) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                toggleBtn.classList.add('active');
                localStorage.setItem('notificationsEnabled', 'true');
                new Notification("Subscribed!", { body: "You will now receive notifications when new episodes are added to your list." });
            }
        });
    } else {
        toggleBtn.classList.remove('active');
        localStorage.setItem('notificationsEnabled', 'false');
    }
});

function canNotify() {
    return typeof Notification !== "undefined"
        && localStorage.getItem("notificationsEnabled") === "true"
        && Notification.permission === "granted";
};

function updateClock() {
    const options = { hour: '2-digit', minute: '2-digit' };

    document.getElementById('live-clock').textContent = new Date().toLocaleTimeString([], options);
}

updateClock();
setInterval(updateClock, 1000);

// ========== SEARCH ANIME ON ANILIST ==========
async function searchAnime(name) {
    const body = {
        query: SEARCH_QUERY,
        variables: { search: name }
    };

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.errors) {
        console.error("AniList search error:", data.errors);
        return null;
    }

    if (!data.data || !data.data.Media) {
        return null;
    }

    return data.data.Media;
}

const animeSubmit = document.getElementById("anime-submit");
const bar = document.getElementById("searchBar");
const warning = document.querySelector('.warning');
const listContent = document.getElementById("listContent");
const suggestions = document.querySelectorAll(".add");
const suggestionsText = document.querySelector('.popularText');

animeSubmit.addEventListener('click', async function () {

    const animeInput = document.getElementById("animeName").value.trim();

    if (animeInput === "") {
        bar.classList.add("active");
        warning.classList.remove("not-found", "duplicate", "not-airing");
        warning.classList.add("active");

        setTimeout(() => {
            bar.classList.remove("active");
            warning.classList.remove("active");
        }, 2000);
    }
    else {
        const animeData = await searchAnime(animeInput);

        if (!animeData) {
            warning.classList.remove("duplicate", "not-airing");
            warning.classList.add("active", "not-found");
            setTimeout(() => {
                warning.classList.remove("active", "not-found");
            }, 2000);
            return;
        }

        const alreadyExists = listContent.querySelector(`[data-id="${animeData.id}"]`);
        if (alreadyExists) {
            warning.classList.remove("not-found", "not-airing");
            warning.classList.add("active", "duplicate");
            setTimeout(() => {
                warning.classList.remove("active", "duplicate");
            }, 2000);
            return;
        }

        const allowed = ["RELEASING", "NOT_YET_RELEASED"];
        if (!allowed.includes(animeData.status)) {
            warning.classList.remove("not-found", "duplicate");
            warning.classList.add("active", "not-airing");
            setTimeout(() => {
                warning.classList.remove("active", "not-airing");
            }, 5000);
            return;
        }

        // Create card with REAL data
        createAnimeCard(animeData);
        document.getElementById("animeName").value = "";
        saveData();
    }

});

// Convert a future timestamp into { days, hours, mins, secs }
function getCountdownParts(airingAt) {
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    let diff = airingAt - now;

    if (diff <= 0) {
        return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
    }

    const days = Math.floor(diff / 86400);
    diff = diff % 86400;
    const hours = Math.floor(diff / 3600);
    diff = diff % 3600;
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;

    return { days, hours, mins, secs, expired: false };
}

function createAnimeCard(anime) {
    const title = anime.title.english || anime.title.romaji || "Unknown";
    const image = anime.coverImage.large;

    // Next episode info (may be null if anime is finished)
    const next = anime.nextAiringEpisode;
    const episodeText = next
        ? `Next: Ep ${next.episode}`
        : anime.status === "RELEASING"
            ? "Waiting for schedule"
            : "No upcoming ep";
    const airingAt = next ? next.airingAt : null;

    // First countdown values
    let d = "--", h = "--", m = "--", s = "--";
    if (airingAt) {
        const parts = getCountdownParts(airingAt);
        d = String(parts.days).padStart(2, "0") + "d";
        h = String(parts.hours).padStart(2, "0") + "h";
        m = String(parts.mins).padStart(2, "0") + "m";
        s = String(parts.secs).padStart(2, "0") + "s";
    }

    const card = document.createElement("div");
    card.className = "anime-card";
    card.dataset.id = anime.id;
    card.dataset.status = anime.status || "";
    if (!airingAt && anime.status === "RELEASING") {
        card.dataset.awaitingSchedule = "true";
    }

    // Store the airing time so we can update the countdown later
    if (airingAt) {
        card.dataset.airingAt = airingAt;
    }

    card.innerHTML = `
    <div class="card-top">
      <img class="anime-img" src="${LAZY_PLACEHOLDER}" data-lazy="${image}" alt="${title}" loading="lazy" decoding="async">
      <div class="anime-middle">
        <div class="anime-info">
          <h3 class="anime-title">${title}</h3>
          <div class="anime-badges">
            <span class="badge episode">${episodeText}</span>
            <span class="badge format">Subbed</span>
            <span class="badge resolution">1080p</span>
            <button class="delete-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="M9.25 3a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v.75H19a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1 0-1.5h4.25z" />
                <path fill="currentColor" fill-rule="evenodd" d="M6.24 7.945a.5.5 0 0 1 .497-.445h10.526a.5.5 0 0 1 .497.445l.2 1.801a44.2 44.2 0 0 1 0 9.771l-.02.177a2.6 2.6 0 0 1-2.226 2.29a26.8 26.8 0 0 1-7.428 0a2.6 2.6 0 0 1-2.227-2.29l-.02-.177a44.2 44.2 0 0 1 0-9.77zm4.51 3.455a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0zm4 0a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div class="countdown-container">
          <div class="time-block"><span class="time-number days">${d}</span><span class="time-label">DAYS</span></div>
          <span class="time-colon">:</span>
          <div class="time-block"><span class="time-number hours">${h}</span><span class="time-label">HOURS</span></div>
          <span class="time-colon">:</span>
          <div class="time-block"><span class="time-number mins">${m}</span><span class="time-label">MINS</span></div>
          <span class="time-colon">:</span>
          <div class="time-block"><span class="time-number secs">${s}</span><span class="time-label">SECS</span></div>
        </div>
      </div>
    </div>
  `;

    listContent.appendChild(card);
    attachLazyImageLoader(listContent);
};

function updateAllCountdowns() {
    const cards = document.querySelectorAll(".anime-card[data-airing-at]");

    cards.forEach(function (card) {
        const airingAt = Number(card.dataset.airingAt);
        if (!airingAt) return;

        const parts = getCountdownParts(airingAt);

        const daysEl = card.querySelector(".time-number.days");
        const hoursEl = card.querySelector(".time-number.hours");
        const minsEl = card.querySelector(".time-number.mins");
        const secsEl = card.querySelector(".time-number.secs");

        if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

        if (parts.expired) {
            daysEl.textContent = "00d";
            hoursEl.textContent = "00h";
            minsEl.textContent = "00m";
            secsEl.textContent = "00s";

            // Notify once, then refresh from API
            if (card.dataset.notified !== "true") {
                card.dataset.notified = "true";

                const titleEl = card.querySelector(".anime-title");
                const epEl = card.querySelector(".badge.episode");
                const title = titleEl ? titleEl.textContent : "Anime";
                const ep = epEl ? epEl.textContent : "New episode";

                notifyEpisode(title, ep);
                card.dataset.awaitingSchedule = "true";
                card.removeAttribute("data-airing-at");
                if (epEl) epEl.textContent = "Waiting for schedule";
                daysEl.textContent = "--";
                hoursEl.textContent = "--";
                minsEl.textContent = "--";
                secsEl.textContent = "--";
                saveData();
                refreshCardFromApi(card);
            }
        } else {
            daysEl.textContent = String(parts.days).padStart(2, "0") + "d";
            hoursEl.textContent = String(parts.hours).padStart(2, "0") + "h";
            minsEl.textContent = String(parts.mins).padStart(2, "0") + "m";
            secsEl.textContent = String(parts.secs).padStart(2, "0") + "s";
        }
    });
};
// Run every second
setInterval(updateAllCountdowns, 1000);

const refreshingAnimeCards = new WeakSet();

async function refreshCardFromApi(card) {
    if (refreshingAnimeCards.has(card)) return;

    const id = Number(card.dataset.id);
    if (!id) return;

    refreshingAnimeCards.add(card);
    try {
        const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: MEDIA_BY_ID_QUERY,
                variables: { id: id }
            })
        });

        const json = await response.json();
        const anime = json.data && json.data.Media;
        if (!anime) return;

        const next = anime.nextAiringEpisode;
        card.dataset.status = anime.status || card.dataset.status || "";
        const episodeBadge = card.querySelector(".badge.episode");
        const daysEl = card.querySelector(".time-number.days");
        const hoursEl = card.querySelector(".time-number.hours");
        const minsEl = card.querySelector(".time-number.mins");
        const secsEl = card.querySelector(".time-number.secs");

        const nextAiringAt = Number(next?.airingAt);
        if (!next || !Number.isFinite(nextAiringAt) || nextAiringAt <= Math.floor(Date.now() / 1000)) {
            card.removeAttribute("data-airing-at");
            card.dataset.awaitingSchedule = anime.status === "RELEASING" ? "true" : "false";
            if (episodeBadge) {
                episodeBadge.textContent = card.dataset.awaitingSchedule === "true"
                    ? "Waiting for schedule"
                    : "No upcoming ep";
            }
            if (daysEl) daysEl.textContent = "--";
            if (hoursEl) hoursEl.textContent = "--";
            if (minsEl) minsEl.textContent = "--";
            if (secsEl) secsEl.textContent = "--";
            if (typeof saveData === "function") saveData();
            return;
        }

        // Restart countdown with new episode
        if (episodeBadge) {
            episodeBadge.textContent = "Next: Ep " + next.episode;
        }

        card.dataset.airingAt = String(nextAiringAt);
        card.dataset.notified = "false";
        delete card.dataset.awaitingSchedule;

        const parts = getCountdownParts(nextAiringAt);
        if (daysEl) daysEl.textContent = String(parts.days).padStart(2, "0") + "d";
        if (hoursEl) hoursEl.textContent = String(parts.hours).padStart(2, "0") + "h";
        if (minsEl) minsEl.textContent = String(parts.mins).padStart(2, "0") + "m";
        if (secsEl) secsEl.textContent = String(parts.secs).padStart(2, "0") + "s";

        if (typeof saveData === "function") saveData();
    } catch (err) {
        console.error("Refresh failed", err);
    } finally {
        refreshingAnimeCards.delete(card);
    }
};

function refreshAwaitingAnimeSchedules() {
    document.querySelectorAll('.anime-card[data-awaiting-schedule="true"]')
        .forEach(card => refreshCardFromApi(card));
}

setInterval(refreshAwaitingAnimeSchedules, 5 * 60 * 1000);

async function showAiringList() {
    const popularList = document.getElementById("suggestionsText");
    if (!popularList) return;

    popularList.innerHTML = "<p style='opacity:0.7;font-size:13px'>Loading...</p>";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: AIRING_QUERY })
        });

        const data = await response.json();
        const animeList = data.data.Page.media || [];

        popularList.innerHTML = "";

        if (animeList.length === 0) {
            popularList.innerHTML = "<p style='opacity:0.7;font-size:13px'>No airing anime found.</p>";
            return;
        }

        animeList.forEach(function (anime) {
            const title = anime.title.english || anime.title.romaji || "Unknown";
            const alreadyExists = listContent.querySelector(`[data-id="${anime.id}"]`);

            const item = document.createElement("div");
            item.className = "popular-item";
            const titleElement = document.createElement("span");
            titleElement.textContent = title;

            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "add";
            addButton.textContent = alreadyExists ? "Added" : "+ Add";
            addButton.disabled = Boolean(alreadyExists);

            addButton.addEventListener("click", function () {
                // Already have full data — no need to search again
                if (listContent.querySelector(`[data-id="${anime.id}"]`)) {
                    addButton.textContent = "Added";
                    addButton.disabled = true;
                    return;
                }

                createAnimeCard(anime);
                saveData();
                addButton.textContent = "Added";
                addButton.disabled = true;
            });

            item.append(titleElement, addButton);
            popularList.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        popularList.innerHTML = "<p style='opacity:0.7;font-size:13px'>Could not load list.</p>";
    }
}

function saveData() {
    localStorage.setItem("data", listContent.innerHTML);
};

listContent.addEventListener("click", function (event) {
    if (!(event.target instanceof Element)) {
        return;
    }

    const deleteButton = event.target.closest(".delete-btn");
    if (!deleteButton) {
        return;
    }

    deleteButton.closest(".anime-card").remove();
    saveData();
});

function loadData() {
    const savedData = localStorage.getItem("data");
    if (savedData !== null) {
        listContent.innerHTML = savedData;
        hydrateLazyImages(listContent);
        listContent.querySelectorAll(".anime-card:not([data-airing-at])").forEach(card => {
            const episodeBadge = card.querySelector(".badge.episode");
            if (episodeBadge?.textContent === "Waiting for schedule") {
                card.dataset.awaitingSchedule = "true";
            }
        });
    }
};


function notifyEpisode(title, episodeText) {
    if (canNotify()) {
        new Notification("New Episode Is Out!!!", {
            body: title + " · " + episodeText
        });
    } else {
        alert(title + " · " + episodeText);
    }
};

loadData();
refreshAwaitingAnimeSchedules();
showAiringList();

const animeTab = document.getElementById("tab-anime");
const tvTab = document.getElementById("tab-tv");
const mangaTab = document.getElementById("tab-manga");

const animePage = document.getElementById("anime-page");
const tvPage = document.getElementById("tvshows-page");
const mangaPage = document.getElementById("manga-page");

function switchPage() {
    animePage.hidden = !animeTab.checked;
    tvPage.hidden = !tvTab.checked;
    mangaPage.hidden = !mangaTab.checked;

    localStorage.setItem(
        "selectedTab",
        animeTab.checked ? "anime" :
            tvTab.checked ? "tv" : "manga"
    );
}

animeTab.addEventListener("change", switchPage);
tvTab.addEventListener("change", switchPage);
mangaTab.addEventListener("change", switchPage);

const savedTab = localStorage.getItem("selectedTab");

if (savedTab === "tv") {
    tvTab.checked = true;
} else if (savedTab === "manga") {
    mangaTab.checked = true;
} else {
    animeTab.checked = true;
}

switchPage();
// ============================================================
//  TV SHOWS — TMDB + TVmaze schedules
//  HTML: #tvName, #tv-submit, #tvListContent
// ============================================================

const tvNameInput = document.getElementById("tvName");
const tvSubmitBtn = document.getElementById("tv-submit");
const tvListContent = document.getElementById("tvListContent");
const tvSuggestionsText = document.getElementById("tvSuggestionsText");

async function searchTvShow(name) {
    const url =
        TMDB_BASE +
        "/search/tv?api_key=" +
        TMDB_API_KEY +
        "&query=" +
        encodeURIComponent(name);

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        return null;
    }
    return data.results[0];
}

async function getTvDetails(id) {
    const url = TMDB_BASE + "/tv/" + id + "?api_key=" + TMDB_API_KEY;
    const response = await fetch(url);
    if (!response.ok) throw new Error("TMDB could not load TV show details");
    return await response.json();
}

async function addTvShowToTracker(showResult) {
    const show = await getTvDetails(showResult.id);
    if (tvListContent.querySelector('[data-id="' + show.id + '"]')) return false;

    const nextEpisode = await getTvMazeNextEpisode(show.name || showResult.name);
    createTvCard(show, nextEpisode);
    saveTvData();
    return true;
}

async function loadPopularTvShows() {
    if (!tvSuggestionsText) return;

    tvSuggestionsText.textContent = "Loading...";

    try {
        const response = await fetch(
            TMDB_BASE + "/tv/popular?api_key=" + TMDB_API_KEY + "&language=en-US&page=1"
        );
        if (!response.ok) throw new Error("TMDB could not load popular TV shows");

        const data = await response.json();
        const shows = data.results || [];
        tvSuggestionsText.replaceChildren();

        if (shows.length === 0) {
            tvSuggestionsText.textContent = "No popular TV shows found.";
            return;
        }

        shows.slice(0, 10).forEach(show => {
            const item = document.createElement("div");
            item.className = "popular-item";

            const title = document.createElement("span");
            title.textContent = show.name || "Unknown";

            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "add";
            addButton.textContent = tvListContent.querySelector('[data-id="' + show.id + '"]')
                ? "Added"
                : "+ Add";
            addButton.disabled = addButton.textContent === "Added";

            addButton.addEventListener("click", async () => {
                addButton.disabled = true;
                addButton.textContent = "Adding...";

                try {
                    await addTvShowToTracker(show);
                    addButton.textContent = "Added";
                } catch (error) {
                    console.error("Could not add popular TV show", error);
                    addButton.textContent = "+ Add";
                    addButton.disabled = false;
                }
            });

            item.append(title, addButton);
            tvSuggestionsText.appendChild(item);
        });
    } catch (error) {
        console.error("Could not load popular TV shows", error);
        tvSuggestionsText.textContent = "Could not load popular TV shows.";
    }
}

async function getTvMazeNextEpisode(name) {
    try {
        const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(name)}&embed=nextepisode`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        return data._embedded?.nextepisode || null;
    } catch (error) {
        console.warn("TVmaze episode lookup failed", error);
        return null;
    }
}

function createTvCard(show, tvMazeEpisode = null) {
    if (!tvListContent) return;

    const title = show.name || "Unknown";
    const image = show.poster_path ? TMDB_IMG + show.poster_path : "";
    const tmdbNext = show.next_episode_to_air;
    const next = tvMazeEpisode || tmdbNext;
    const tvMazeAirTime = tvMazeEpisode?.airstamp
        ? Date.parse(tvMazeEpisode.airstamp)
        : NaN;

    let episodeText = "No upcoming ep";
    let seasonText = show.number_of_seasons
        ? "Season " + show.number_of_seasons
        : "TV";

    if (next) {
        const seasonNumber = next.season ?? next.season_number;
        const episodeNumber = next.number ?? next.episode_number;
        episodeText = seasonNumber != null && episodeNumber != null
            ? "Next: S" + String(seasonNumber).padStart(2, "0") + " E" + String(episodeNumber).padStart(2, "0")
            : "Next episode";
    }

    const card = document.createElement("div");
    card.className = "tv-card";
    card.dataset.id = show.id;

    if (Number.isFinite(tvMazeAirTime)) {
        card.dataset.airTime = String(tvMazeAirTime);
    } else if (tmdbNext && tmdbNext.air_date) {
        card.dataset.airDate = tmdbNext.air_date;
    }

    card.innerHTML = `
        <div class="card-top">
            <img class="tv-img" src="${LAZY_PLACEHOLDER}" data-lazy="${image || LAZY_PLACEHOLDER}" alt="${title}" loading="lazy" decoding="async">
            <div class="tv-middle">
                <div class="tv-info">
                    <h3 class="tv-title">${title}</h3>
                    <div class="tv-badges">
                        <span class="badge episode">${episodeText}</span>
                        <span class="badge format">${seasonText}</span>
                        <span class="badge resolution">1080p</span>
                        <button class="delete-btn" type="button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                <path d="M0 0h24v24H0z" fill="none" />
                                <path fill="currentColor" d="M9.25 3a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v.75H19a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1 0-1.5h4.25z" />
                                <path fill="currentColor" fill-rule="evenodd" d="M6.24 7.945a.5.5 0 0 1 .497-.445h10.526a.5.5 0 0 1 .497.445l.2 1.801a44.2 44.2 0 0 1 0 9.771l-.02.177a2.6 2.6 0 0 1-2.226 2.29a26.8 26.8 0 0 1-7.428 0a2.6 2.6 0 0 1-2.227-2.29l-.02-.177a44.2 44.2 0 0 1 0-9.77zm4.51 3.455a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0zm4 0a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="countdown-container">
                    <div class="time-block"><span class="time-number">--</span><span class="time-label">DAYS</span></div>
                    <span class="time-colon">:</span>
                    <div class="time-block"><span class="time-number">--</span><span class="time-label">HOURS</span></div>
                    <span class="time-colon">:</span>
                    <div class="time-block"><span class="time-number">--</span><span class="time-label">MINS</span></div>
                    <span class="time-colon">:</span>
                    <div class="time-block"><span class="time-number">--</span><span class="time-label">SECS</span></div>
                </div>
            </div>
        </div>`;

    tvListContent.appendChild(card);
    attachLazyImageLoader(tvListContent);
    updateTvCountdowns();
}

function updateTvCountdowns() {
    const cards = document.querySelectorAll(".tv-card");

    cards.forEach(function (card) {
        const airTime = card.dataset.airTime;
        const airDate = card.dataset.airDate;
        const countdown = card.querySelector(".countdown-container");
        if (!airTime && !airDate) {
            if (countdown && countdown.dataset.unscheduled !== "true") {
                countdown.textContent = "No episode date scheduled";
                countdown.dataset.unscheduled = "true";
            }
            return;
        }

        const targetDate = airDate ? new Date(airDate + "T00:00:00") : null;
        const target = airTime ? Number(airTime) : targetDate.getTime();
        if (Number.isNaN(target)) {
            if (countdown) countdown.textContent = "Episode date unavailable";
            return;
        }

        let diff = Math.floor((target - Date.now()) / 1000);

        const numbers = card.querySelectorAll(".countdown-container .time-number");
        if (numbers.length < 4) return;

        const episodeBadge = card.querySelector(".badge.episode");
        if (diff <= 0) {
            const now = new Date();
            const isToday = targetDate
                && targetDate.getFullYear() === now.getFullYear()
                && targetDate.getMonth() === now.getMonth()
                && targetDate.getDate() === now.getDate();

            if (card.dataset.notified !== "true" && (airTime || isToday)) {
                card.dataset.notified = "true";
                const title = card.querySelector(".tv-title")?.textContent || "TV show";
                const episodeText = airTime
                    ? episodeBadge?.textContent || "New episode"
                    : "Episode airs today";
                notifyEpisode(title, episodeText);
                saveTvData();
            }

            numbers[0].textContent = "00d";
            numbers[1].textContent = "00h";
            numbers[2].textContent = "00m";
            numbers[3].textContent = "00s";
            if (episodeBadge) {
                if (airTime) {
                    episodeBadge.textContent = "Episode time reached";
                } else {
                    episodeBadge.textContent = isToday ? "Airs today" : "Air date passed";
                }
            }
            return;
        }

        const days = Math.floor(diff / 86400);
        diff = diff % 86400;
        const hours = Math.floor(diff / 3600);
        diff = diff % 3600;
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;

        numbers[0].textContent = String(days).padStart(2, "0") + "d";
        numbers[1].textContent = String(hours).padStart(2, "0") + "h";
        numbers[2].textContent = String(mins).padStart(2, "0") + "m";
        numbers[3].textContent = String(secs).padStart(2, "0") + "s";
    });
}

function saveTvData() {
    if (!tvListContent) return;
    localStorage.setItem("tvTrackerData", tvListContent.innerHTML);
}

function loadTvData() {
    if (!tvListContent) return;
    const saved = localStorage.getItem("tvTrackerData");
    if (saved) {
        tvListContent.innerHTML = saved;
        hydrateLazyImages(tvListContent);
        updateTvCountdowns();
    }
}

if (tvSubmitBtn) {
    tvSubmitBtn.addEventListener("click", async function () {
        const name =
            tvNameInput && tvNameInput.value ? tvNameInput.value.trim() : "";

        if (!name) {
            alert("enter a tv show name");
            return;
        }

        try {
            const result = await searchTvShow(name);
            if (!result) {
                alert("tv show not found");
                return;
            }

            if (!await addTvShowToTracker(result)) {
                alert("already in your list");
                return;
            }

            if (tvNameInput) tvNameInput.value = "";
        } catch (err) {
            console.error(err);
            alert("something went wrong. check api key or console.");
        }
    });
}

if (tvListContent) {
    tvListContent.addEventListener("click", function (e) {
        const btn = e.target.closest(".delete-btn");
        if (!btn) return;

        const card = btn.closest(".tv-card");
        if (card) {
            card.remove();
            saveTvData();
        }
    });
}

setInterval(updateTvCountdowns, 1000);
loadTvData();
loadPopularTvShows();

const mangaNameInput = document.getElementById("mangaName");
const mangaSubmitBtn = document.getElementById("manga-submit");
const mangaListContent = document.getElementById("mangaListContent");
const mangaSuggestionsText = document.getElementById("mangaSuggestionsText");
const mangaWarning = document.getElementById("mangaWarning");
let mangaWarningTimer;

const MANGA_SEARCH_QUERY = `
    query ($search: String) {
        Media(search: $search, type: MANGA) {
            id
            title {
                english
                romaji
            }
            coverImage {
                large
            }
            status
            chapters
            volumes
        }
    }
`;

const POPULAR_MANGA_QUERY = `
    query {
        Page(page: 1, perPage: 10) {
            media(type: MANGA, status_not: FINISHED, sort: POPULARITY_DESC, isAdult: false) {
                id
                title {
                    english
                    romaji
                }
                coverImage {
                    large
                }
                status
                chapters
                volumes
            }
        }
    }
`;

async function requestManga(query, variables = {}) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
    });
    const data = await response.json();
    if (!response.ok || data.errors) {
        throw new Error("AniList manga request failed");
    }
    return data.data;
}

async function searchManga(name) {
    const data = await requestManga(MANGA_SEARCH_QUERY, { search: name });
    return data?.Media || null;
}

function showMangaWarning(message) {
    const warningText = mangaWarning?.querySelector(".warning-text");
    if (!warningText) return;

    warningText.textContent = message;
    mangaWarning.classList.add("active");
    clearTimeout(mangaWarningTimer);
    mangaWarningTimer = setTimeout(() => mangaWarning.classList.remove("active"), 3500);
}

function createMangaCard(manga) {
    const title = manga.title.english || manga.title.romaji || "Unknown";
    const image = manga.coverImage?.large || "";
    const statusLabels = {
        RELEASING: "Publishing",
        NOT_YET_RELEASED: "Upcoming",
        HIATUS: "On hiatus",
        CANCELLED: "Cancelled",
        FINISHED: "Complete"
    };
    const status = statusLabels[manga.status] || "Manga";
    const chapters = manga.chapters ? `${manga.chapters} chapters` : "Chapters TBA";
    const nextChapter = manga.status === "NOT_YET_RELEASED"
        ? "Next: Ch. 1"
        : manga.status === "RELEASING" && Number.isFinite(manga.chapters) && manga.chapters > 0
            ? `Est. next: Ch. ${manga.chapters + 1}`
            : "Next: TBA";
    const card = document.createElement("div");
    card.className = "anime-card manga-card";
    card.dataset.id = manga.id;

    card.innerHTML = `
        <div class="card-top">
            <img class="anime-img" src="${LAZY_PLACEHOLDER}" data-lazy="${image || LAZY_PLACEHOLDER}" alt="${title}" loading="lazy" decoding="async">
            <div class="anime-middle">
                <div class="anime-info">
                    <h3 class="anime-title">${title}</h3>
                    <div class="anime-badges">
                        <span class="badge format">${status}</span>
                        <span class="badge resolution">${chapters}</span>
                        <span class="badge episode">${nextChapter}</span>
                        <button class="delete-btn" type="button" aria-label="Remove ${title}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                <path d="M0 0h24v24H0z" fill="none" />
                                <path fill="currentColor" d="M9.25 3a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v.75H19a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1 0-1.5h4.25z" />
                                <path fill="currentColor" fill-rule="evenodd" d="M6.24 7.945a.5.5 0 0 1 .497-.445h10.526a.5.5 0 0 1 .497.445l.2 1.801a44.2 44.2 0 0 1 0 9.771l-.02.177a2.6 2.6 0 0 1-2.226 2.29a26.8 26.8 0 0 1-7.428 0a2.6 2.6 0 0 1-2.227-2.29l-.02-.177a44.2 44.2 0 0 1 0-9.77zm4.51 3.455a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0zm4 0a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    mangaListContent.appendChild(card);
    attachLazyImageLoader(mangaListContent);
}

function saveMangaData() {
    localStorage.setItem("mangaTrackerData", mangaListContent.innerHTML);
}

function loadMangaData() {
    const saved = localStorage.getItem("mangaTrackerData");
    if (saved !== null) {
        mangaListContent.innerHTML = saved;
        hydrateLazyImages(mangaListContent);
    }
}

async function addMangaToTracker(manga) {
    if (manga.status === "FINISHED") return false;
    if (mangaListContent.querySelector(`[data-id="${manga.id}"]`)) return false;
    createMangaCard(manga);
    saveMangaData();
    return true;
}

async function showPopularManga() {
    if (!mangaSuggestionsText) return;
    mangaSuggestionsText.textContent = "Loading...";

    try {
        const data = await requestManga(POPULAR_MANGA_QUERY);
        const mangaList = (data?.Page?.media || []).filter(manga => manga.status !== "FINISHED");
        mangaSuggestionsText.replaceChildren();

        if (mangaList.length === 0) {
            mangaSuggestionsText.textContent = "No popular manga found.";
            return;
        }

        mangaList.forEach(manga => {
            const title = manga.title.english || manga.title.romaji || "Unknown";
            const item = document.createElement("div");
            item.className = "popular-item";
            const titleElement = document.createElement("span");
            titleElement.textContent = title;

            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "add";
            addButton.textContent = mangaListContent.querySelector(`[data-id="${manga.id}"]`)
                ? "Added"
                : "+ Add";
            addButton.disabled = addButton.textContent === "Added";
            addButton.addEventListener("click", async () => {
                addButton.disabled = true;
                addButton.textContent = "Adding...";
                try {
                    await addMangaToTracker(manga);
                    addButton.textContent = "Added";
                } catch (error) {
                    console.error("Could not add manga", error);
                    addButton.textContent = "+ Add";
                    addButton.disabled = false;
                }
            });

            item.append(titleElement, addButton);
            mangaSuggestionsText.appendChild(item);
        });
    } catch (error) {
        console.error("Could not load popular manga", error);
        mangaSuggestionsText.textContent = "Could not load popular manga.";
    }
}

if (mangaSubmitBtn) {
    mangaSubmitBtn.addEventListener("click", async () => {
        const name = mangaNameInput.value.trim();
        if (!name) {
            showMangaWarning("Enter a manga name.");
            return;
        }

        try {
            const manga = await searchManga(name);
            if (!manga) {
                showMangaWarning("Manga not found. Try another name.");
                return;
            }
            if (manga.status === "FINISHED") {
                showMangaWarning("Completed manga can't be added.");
                return;
            }
            if (!await addMangaToTracker(manga)) {
                showMangaWarning("This manga is already in your list.");
                return;
            }
            mangaNameInput.value = "";
        } catch (error) {
            console.error("Manga search failed", error);
            showMangaWarning("Could not search Manga. Check your connection and try again.");
        }
    });
}

if (mangaListContent) {
    mangaListContent.addEventListener("click", event => {
        if (!(event.target instanceof Element)) return;
        const deleteButton = event.target.closest(".delete-btn");
        const card = deleteButton?.closest(".manga-card");
        if (!card) return;
        card.remove();
        saveMangaData();
    });
}

if (mangaListContent) {
    loadMangaData();
    showPopularManga();
}

const box = document.querySelector('.category');
const scrollTrigger = 80;

function handleScroll(e) {
    if (!box) return;
    const targetScroll = (e.target && typeof e.target.scrollTop === 'number') ? e.target.scrollTop : 0;
    const scrollTop = Math.max(window.scrollY, targetScroll);

    if (scrollTop > scrollTrigger) {
        box.classList.add('is-centered');
    } else {
        box.classList.remove('is-centered');
    }
}
document.addEventListener('scroll', handleScroll, true);

let ticking = false;

function updateCardAnimations() {
    // Safely gather cards even if one of the variables isn't defined yet
    const containers = [
        typeof listContent !== 'undefined' ? listContent : null,
        typeof tvListContent !== 'undefined' ? tvListContent : null,
        typeof mangaListContent !== 'undefined' ? mangaListContent : null
    ];

    const cards = containers.flatMap(container => container ? Array.from(container.children) : []);
    const viewportHeight = window.innerHeight;
    let visibleBatch = 0;

    cards.forEach((card) => {
        card.classList.add('scroll-card');

        const rect = card.getBoundingClientRect();
        // Skip cards that have 0 height/width (hidden tabs)
        if (rect.height === 0 && rect.width === 0) return;

        const isVisible = card.classList.contains('is-visible');
        const trueTop = isVisible ? rect.top : rect.top - 22;
        const trueBottom = isVisible ? rect.bottom : rect.bottom - 22;
        const inView = trueTop < viewportHeight - 10 && trueBottom > 10;

        if (inView && !isVisible) {
            card.style.setProperty('--stagger', `${visibleBatch * 65}ms`);
            card.classList.add('is-visible');
            visibleBatch++;
        } else if (!inView && isVisible) {
            card.style.setProperty('--stagger', '0ms');
            card.classList.remove('is-visible');
        }
    });

    ticking = false;
}

function onScroll() {
    if (!ticking) {
        window.requestAnimationFrame(updateCardAnimations);
        ticking = true;
    }
}

document.addEventListener('scroll', onScroll, true);
window.addEventListener('resize', onScroll);

// Also re-run whenever you click a category radio tab (Anime, TV Shows, Manga)
document.querySelectorAll('input[name="category-toggle"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        setTimeout(updateCardAnimations, 50);
    });
});

// Run immediately on load
updateCardAnimations();

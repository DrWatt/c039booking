(() => {
  "use strict";

  const cfg = window.GPU_BOOKING_CONFIG || {};
  const state = {
    owner: "",
    repo: "",
    weekStart: startOfWeek(new Date()),
    gpu: null,
    bookings: [],
    loading: false
  };

  const els = {
    machineName: document.querySelector("#machine-name"),
    repoLink: document.querySelector("#repo-link"),
    etiquetteList: document.querySelector("#etiquette-list"),
    gpuSelect: document.querySelector("#gpu-select"),
    selectedGpuLabel: document.querySelector("#selected-gpu-label"),
    weekTitle: document.querySelector("#week-title"),
    calendarHead: document.querySelector("#calendar thead"),
    calendarBody: document.querySelector("#calendar tbody"),
    previousWeek: document.querySelector("#previous-week"),
    nextWeek: document.querySelector("#next-week"),
    today: document.querySelector("#today"),
    refresh: document.querySelector("#refresh"),
    syncStatus: document.querySelector("#sync-status"),
    apiNote: document.querySelector("#api-note"),
    bookingDialog: document.querySelector("#booking-dialog"),
    bookingForm: document.querySelector("#booking-form"),
    dialogTitle: document.querySelector("#dialog-title"),
    bookingGpu: document.querySelector("#booking-gpu"),
    bookingDate: document.querySelector("#booking-date"),
    bookingStart: document.querySelector("#booking-start"),
    bookingEnd: document.querySelector("#booking-end"),
    bookingPurpose: document.querySelector("#booking-purpose"),
    bookingWarning: document.querySelector("#booking-warning"),
    closeDialog: document.querySelector("#close-dialog"),
    cancelDialog: document.querySelector("#cancel-dialog"),
    detailsDialog: document.querySelector("#details-dialog"),
    detailsTitle: document.querySelector("#details-title"),
    detailsBody: document.querySelector("#details-body"),
    detailsLink: document.querySelector("#details-link"),
    closeDetails: document.querySelector("#close-details"),
    dismissDetails: document.querySelector("#dismiss-details")
  };

  init();

  function init() {
    validateConfig();
    const inferred = inferRepository();
    state.owner = cfg.githubOwner && !cfg.githubOwner.startsWith("YOUR_") ? cfg.githubOwner : inferred.owner;
    state.repo = cfg.githubRepo || inferred.repo;
    state.gpu = cfg.gpus[0];

    els.machineName.textContent = cfg.machineName || "Shared GPU Workstation";
    document.title = `${els.machineName.textContent} — booking board`;
    els.repoLink.href = `https://github.com/${encodeURIComponent(state.owner)}/${encodeURIComponent(state.repo)}`;
    els.etiquetteList.replaceChildren(...(cfg.etiquette || []).map(text => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }));

    for (const gpu of cfg.gpus) {
      const option = document.createElement("option");
      option.value = gpu;
      option.textContent = gpu;
      els.gpuSelect.append(option);
    }

    els.gpuSelect.addEventListener("change", () => {
      state.gpu = els.gpuSelect.value;
      render();
    });
    els.previousWeek.addEventListener("click", () => moveWeek(-7));
    els.nextWeek.addEventListener("click", () => moveWeek(7));
    els.today.addEventListener("click", () => {
      state.weekStart = startOfWeek(new Date());
      render();
    });
    els.refresh.addEventListener("click", () => loadBookings({ force: true }));
    els.closeDialog.addEventListener("click", closeBookingDialog);
    els.cancelDialog.addEventListener("click", closeBookingDialog);
    els.closeDetails.addEventListener("click", () => els.detailsDialog.close());
    els.dismissDetails.addEventListener("click", () => els.detailsDialog.close());
    els.bookingEnd.addEventListener("change", validateDialogOverlap);
    els.bookingForm.addEventListener("submit", submitBooking);

    render();
    loadBookings();
  }

  function validateConfig() {
    if (!Array.isArray(cfg.gpus) || cfg.gpus.length === 0) {
      throw new Error("config.js must define at least one GPU in `gpus`.");
    }
    if ((cfg.slotMinutes || 60) <= 0 || 60 % (cfg.slotMinutes || 60) !== 0) {
      throw new Error("slotMinutes must be a positive divisor of 60.");
    }
  }

  function inferRepository() {
    const host = location.hostname;
    const parts = location.pathname.split("/").filter(Boolean);
    if (host.endsWith(".github.io")) {
      return {
        owner: host.replace(/\.github\.io$/, ""),
        repo: parts[0] || host.replace(/\.github\.io$/, "") + ".github.io"
      };
    }
    return { owner: "YOUR_GITHUB_USERNAME_OR_ORG", repo: cfg.githubRepo || "gpu-booking" };
  }

  async function loadBookings({ force = false } = {}) {
    if (state.owner.startsWith("YOUR_")) {
      setStatus("Edit config.js with your GitHub owner before publishing.", true);
      render();
      return;
    }
    if (state.loading) return;
    state.loading = true;
    els.refresh.disabled = true;
    setStatus("Loading bookings…");

    const cacheKey = `gpu-bookings:${state.owner}/${state.repo}`;
    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        state.bookings = cached;
        render();
      }
    }

    try {
      const issues = await fetchAllBookingIssues();
      state.bookings = issues.map(parseBookingIssue).filter(Boolean);
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: state.bookings }));
      const now = new Date();
      setStatus(`Updated ${new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(now)}`);
      render();
    } catch (error) {
      console.error(error);
      setStatus("Could not refresh from GitHub. Showing cached data if available.", true);
    } finally {
      state.loading = false;
      els.refresh.disabled = false;
    }
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.at > 5 * 60 * 1000) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  async function fetchAllBookingIssues() {
    const all = [];
    for (let page = 1; page <= 5; page += 1) {
      const url = new URL(`https://api.github.com/repos/${state.owner}/${state.repo}/issues`);
      url.searchParams.set("state", "open");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "created");
      url.searchParams.set("direction", "desc");
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10"
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
      }
      const batch = await response.json();
      all.push(...batch.filter(issue => !issue.pull_request && issue.title.startsWith("[GPU BOOKING]")));
      if (batch.length < 100) break;
    }
    return all;
  }

  function parseBookingIssue(issue) {
    const fields = parseIssueFormBody(issue.body || "");
    const gpu = fields["GPU"];
    const date = fields["Date"];
    const start = fields["Start time"];
    const end = fields["End time"];
    const purpose = fields["Purpose"] || "";
    if (!gpu || !date || !start || !end) return null;
    if (!cfg.gpus.includes(gpu)) return null;

    const startAt = localDateTime(date, start);
    const endAt = localDateTime(date, end);
    if (!startAt || !endAt || endAt <= startAt) return null;

    return {
      id: issue.id,
      number: issue.number,
      url: issue.html_url,
      author: issue.user?.login || "unknown",
      gpu,
      date,
      start,
      end,
      startAt,
      endAt,
      purpose: purpose.trim(),
      title: issue.title
    };
  }

  function parseIssueFormBody(body) {
    const result = {};
    const re = /^###\s+(.+?)\s*$\n+([\s\S]*?)(?=\n+###\s+|$)/gm;
    let match;
    while ((match = re.exec(body)) !== null) {
      result[match[1].trim()] = match[2].trim().replace(/^_No response_$/i, "");
    }
    return result;
  }

  function render() {
    els.selectedGpuLabel.textContent = state.gpu;
    const weekEnd = addDays(state.weekStart, cfg.daysShown - 1);
    els.weekTitle.textContent = `${formatDate(state.weekStart, { day: "numeric", month: "short" })} – ${formatDate(weekEnd, { day: "numeric", month: "short", year: "numeric" })}`;

    renderHeader();
    renderBody();
    els.apiNote.textContent = state.owner.startsWith("YOUR_")
      ? "Setup mode: configure the GitHub repository in config.js."
      : `Bookings are read from open issues in ${state.owner}/${state.repo}. No token is stored in this page.`;
  }

  function renderHeader() {
    const tr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "Time";
    tr.append(corner);
    const todayKey = dateKey(new Date());

    for (let i = 0; i < cfg.daysShown; i += 1) {
      const day = addDays(state.weekStart, i);
      const th = document.createElement("th");
      th.scope = "col";
      if (dateKey(day) === todayKey) th.classList.add("today-column");
      const name = document.createElement("span");
      name.className = "day-name";
      name.textContent = formatDate(day, { weekday: "short" });
      const date = document.createElement("span");
      date.className = "day-date";
      date.textContent = formatDate(day, { day: "numeric", month: "short" });
      th.append(name, date);
      tr.append(th);
    }
    els.calendarHead.replaceChildren(tr);
  }

  function renderBody() {
    const fragment = document.createDocumentFragment();
    const now = new Date();
    const slotMinutes = cfg.slotMinutes || 60;
    const totalMinutes = (cfg.endHour - cfg.startHour) * 60;

    for (let offset = 0; offset < totalMinutes; offset += slotMinutes) {
      const tr = document.createElement("tr");
      const minuteOfDay = cfg.startHour * 60 + offset;
      const label = document.createElement("th");
      label.scope = "row";
      label.className = "time-label";
      label.textContent = minutesToTime(minuteOfDay);
      tr.append(label);

      for (let dayOffset = 0; dayOffset < cfg.daysShown; dayOffset += 1) {
        const day = addDays(state.weekStart, dayOffset);
        const startAt = setMinutesOfDay(day, minuteOfDay);
        const endAt = new Date(startAt.getTime() + slotMinutes * 60000);
        const matching = state.bookings.filter(b => b.gpu === state.gpu && overlaps(startAt, endAt, b.startAt, b.endAt));
        tr.append(renderSlot(day, startAt, endAt, matching, now));
      }
      fragment.append(tr);
    }
    els.calendarBody.replaceChildren(fragment);
  }

  function renderSlot(day, startAt, endAt, bookings, now) {
    const td = document.createElement("td");
    td.className = "slot";
    const button = document.createElement("button");
    button.type = "button";

    if (endAt <= now) {
      td.classList.add("past");
      button.disabled = true;
      button.setAttribute("aria-label", `${formatDate(day)} ${formatTime(startAt)}: past`);
    } else if (bookings.length === 0) {
      td.classList.add("free");
      button.setAttribute("aria-label", `Book ${state.gpu}, ${formatDate(day)}, ${formatTime(startAt)}`);
      const hint = document.createElement("span");
      hint.className = "book-hint";
      hint.textContent = "+ book";
      button.append(hint);
      button.addEventListener("click", () => openBookingDialog(day, startAt));
    } else {
      td.classList.add(bookings.length > 1 ? "conflict" : "booked");
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = bookings.length > 1 ? `${bookings.length} overlapping bookings` : `@${bookings[0].author}`;
      const purpose = document.createElement("span");
      purpose.className = "purpose";
      purpose.textContent = bookings.length > 1 ? "Click to inspect conflict" : bookings[0].purpose || `${bookings[0].start}–${bookings[0].end}`;
      button.append(who, purpose);
      button.addEventListener("click", () => showBookingDetails(bookings));
    }
    td.append(button);
    return td;
  }

  function openBookingDialog(day, startAt) {
    const date = dateKey(day);
    const start = formatClock(startAt);
    els.dialogTitle.textContent = `Book ${state.gpu}`;
    els.bookingGpu.value = state.gpu;
    els.bookingDate.value = date;
    els.bookingStart.value = start;
    els.bookingPurpose.value = "";
    els.bookingWarning.hidden = true;

    const options = [];
    const slotMinutes = cfg.slotMinutes || 60;
    const maxEnd = Math.min(cfg.endHour * 60, clockToMinutes(start) + cfg.maxBookingHours * 60);
    for (let minute = clockToMinutes(start) + slotMinutes; minute <= maxEnd; minute += slotMinutes) {
      const option = document.createElement("option");
      option.value = minutesToTime(minute);
      option.textContent = minutesToTime(minute);
      options.push(option);
    }
    els.bookingEnd.replaceChildren(...options);
    if (options.length >= 2) els.bookingEnd.selectedIndex = 1;
    validateDialogOverlap();
    els.bookingDialog.showModal();
    setTimeout(() => els.bookingPurpose.focus(), 0);
  }

  function closeBookingDialog() {
    els.bookingDialog.close();
  }

  function validateDialogOverlap() {
    const startAt = localDateTime(els.bookingDate.value, els.bookingStart.value);
    const endAt = localDateTime(els.bookingDate.value, els.bookingEnd.value);
    if (!startAt || !endAt) return;
    const collisions = state.bookings.filter(b => b.gpu === els.bookingGpu.value && overlaps(startAt, endAt, b.startAt, b.endAt));
    els.bookingWarning.hidden = collisions.length === 0;
    els.bookingWarning.textContent = collisions.length
      ? `This range currently overlaps ${collisions.length} booking${collisions.length === 1 ? "" : "s"}. Choose a different end time or inspect the board first.`
      : "";
  }

  function submitBooking(event) {
    event.preventDefault();
    const gpu = els.bookingGpu.value;
    const date = els.bookingDate.value;
    const start = els.bookingStart.value;
    const end = els.bookingEnd.value;
    const purpose = els.bookingPurpose.value.trim();
    const startAt = localDateTime(date, start);
    const endAt = localDateTime(date, end);
    const collisions = state.bookings.filter(b => b.gpu === gpu && overlaps(startAt, endAt, b.startAt, b.endAt));
    if (collisions.length) {
      els.bookingWarning.hidden = false;
      els.bookingWarning.textContent = "That period is already booked. Please choose a free range.";
      return;
    }

    const url = new URL(`https://github.com/${state.owner}/${state.repo}/issues/new`);
    url.searchParams.set("template", "booking.yml");
    url.searchParams.set("title", `[GPU BOOKING] ${gpu} — ${date} ${start}-${end}`);
    url.searchParams.set("gpu", gpu);
    url.searchParams.set("date", date);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    url.searchParams.set("purpose", purpose);
    window.open(url, "_blank", "noopener,noreferrer");
    closeBookingDialog();
  }

  function showBookingDetails(bookings) {
    const first = bookings[0];
    els.detailsTitle.textContent = bookings.length > 1 ? "Overlapping bookings" : `${first.gpu} booked by @${first.author}`;
    if (bookings.length === 1) {
      els.detailsBody.innerHTML = "";
      const dl = document.createElement("dl");
      dl.className = "booking-detail-list";
      appendDetail(dl, "When", `${first.date}, ${first.start}–${first.end}`);
      appendDetail(dl, "Booked by", `@${first.author}`);
      appendDetail(dl, "Purpose", first.purpose || "—");
      appendDetail(dl, "Issue", `#${first.number}`);
      els.detailsBody.append(dl);
      els.detailsLink.href = first.url;
      els.detailsLink.textContent = "Open booking issue ↗";
      els.detailsLink.hidden = false;
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "conflict-list";
      const intro = document.createElement("p");
      intro.textContent = "These bookings overlap. Open the issues and coordinate which one should move.";
      wrapper.append(intro);
      for (const booking of bookings) {
        const p = document.createElement("p");
        const a = document.createElement("a");
        a.href = booking.url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = `#${booking.number} @${booking.author}: ${booking.start}–${booking.end} — ${booking.purpose || "no purpose"}`;
        p.append(a);
        wrapper.append(p);
      }
      els.detailsBody.replaceChildren(wrapper);
      els.detailsLink.hidden = true;
    }
    els.detailsDialog.showModal();
  }

  function appendDetail(dl, term, description) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    dl.append(dt, dd);
  }

  function moveWeek(days) {
    state.weekStart = addDays(state.weekStart, days);
    render();
  }

  function setStatus(text, isError = false) {
    els.syncStatus.textContent = text;
    els.syncStatus.style.color = isError ? "var(--conflict-border)" : "";
  }

  function startOfWeek(date) {
    const copy = stripTime(date);
    const start = Number.isInteger(cfg.weekStartsOn) ? cfg.weekStartsOn : 1;
    const delta = (copy.getDay() - start + 7) % 7;
    copy.setDate(copy.getDate() - delta);
    return copy;
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function setMinutesOfDay(date, minutes) {
    const d = stripTime(date);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function localDateTime(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const result = new Date(year, month - 1, day, hour, minute, 0, 0);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function clockToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function formatClock(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatDate(date, options = { day: "numeric", month: "short", year: "numeric" }) {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }
})();

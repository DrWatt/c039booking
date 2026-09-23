# GPU booking board for GitHub Pages

A deliberately lightweight, human-centric booking board for a shared GPU workstation.

There is **no scheduler and no backend**. GitHub Pages hosts the interface and ordinary GitHub Issues are the booking ledger:

1. A student clicks a free cell in the weekly table.
2. The site opens a GitHub Issue Form with GPU/date/time/purpose already filled in.
3. The student reviews it and submits the issue.
4. The page reads open booking issues through GitHub's public REST API and shows them in the table.
5. To cancel or release a booking, the student closes their issue.

This makes bookings visible and attributable while keeping the workflow social rather than enforcing compute policy.

## 1. Create the repository

Create a **public** GitHub repository, for example `gpu-booking`, and copy all files from this template into it.

A public repository is the simplest setup because a GitHub Pages site can read public issues without storing an access token. Do not put private information in booking purposes.

## 2. Configure the board

Edit `config.js`.

At minimum, set:

```js
window.GPU_BOOKING_CONFIG = {
  githubOwner: "YOUR_GITHUB_USERNAME_OR_ORG",
  githubRepo: "gpu-booking",
  machineName: "Shared GPU Workstation",
  timeZone: "Europe/Rome",
  gpus: ["GPU 0", "GPU 1", "GPU 2", "GPU 3"],
  startHour: 8,
  endHour: 22,
  slotMinutes: 60,
  daysShown: 7,
  weekStartsOn: 1,
  maxBookingHours: 8,
  etiquette: [
    "Book only the time you reasonably expect to use.",
    "Release/cancel a booking by closing its GitHub issue."
  ]
};
```

If the site is published as `https://OWNER.github.io/REPO/`, the owner/repository can usually be inferred, but explicitly setting them is clearer and also works with custom domains.

## 3. Enable Issues

In the repository settings, make sure **Issues** are enabled.

The issue form is already included at:

`.github/ISSUE_TEMPLATE/booking.yml`

Do not rename its field IDs (`gpu`, `date`, `start`, `end`, `purpose`, `agreement`) unless you also update `app.js`.

## 4. Enable GitHub Pages

In **Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/ (root)`

GitHub will publish the site at a URL similar to:

`https://OWNER.github.io/gpu-booking/`

## 5. Test it

Open the Pages URL, click a future free cell, enter a purpose, and continue to GitHub. Submit the issue.

Return to the board and click **Refresh**. The slot should show your GitHub username and purpose.

Close the booking issue and refresh again; the slot should become free.

## Booking format

The page recognizes open issues whose title starts with:

`[GPU BOOKING]`

and whose Issue Form body contains these headings:

- `GPU`
- `Date`
- `Start time`
- `End time`
- `Purpose`

This means normal repository issues are ignored.

## Conflicts

This is intentionally not a transactional booking service. The browser checks the current board before opening a booking form, but two people could still submit overlapping bookings at nearly the same moment.

If that happens, the table marks the slot as a **conflict** and links to both issues so the students can resolve it themselves. That is consistent with the goal here: visible coordination rather than scheduler-like enforcement.

## Privacy and access model

The simple version assumes a public repository. Booking issues therefore expose:

- the student's GitHub username;
- GPU/date/time;
- the short purpose they type.

Keep the purpose field suitable for public viewing. If you need a private board, a static GitHub Pages site is no longer enough by itself: private-issue access requires authentication, and you should not embed a personal access token in browser JavaScript.

## API limits

The board uses GitHub's unauthenticated REST API for public repository issues. GitHub currently documents a primary limit of **60 unauthenticated requests per hour per originating IP address**. The page caches results for five minutes and refreshes only on load or when the user presses Refresh, so a small lab should normally stay well below that limit.

## Files

- `index.html` — page markup
- `styles.css` — responsive/light-dark styling
- `app.js` — calendar, GitHub API reading, booking URL generation
- `config.js` — the file you normally customize
- `.github/ISSUE_TEMPLATE/booking.yml` — booking form
- `.github/ISSUE_TEMPLATE/config.yml` — disables unrelated blank issues
- `.nojekyll` — tells GitHub Pages to serve the files directly

## Optional policy text

A simple lab policy that matches this tool:

> The workstation is a shared resource. Please book only the time you reasonably expect to need. If your computation finishes early, close your booking so others can see that the resource is free. Short interactive experiments do not need to consume the whole day, and unusually long or multi-GPU runs should be coordinated with the group first.

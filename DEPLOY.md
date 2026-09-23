# Five-minute deployment checklist

1. Create a **public** GitHub repository, e.g. `gpu-booking`.
2. Upload/commit this entire folder, including `.github/` and `.nojekyll`.
3. Edit `config.js`:
   - `githubOwner`
   - `githubRepo`
   - GPU names/count
   - opening/closing hours
4. Repository **Settings → General → Features**: ensure **Issues** is enabled.
5. Repository **Settings → Pages**:
   - Deploy from a branch
   - `main`
   - `/ (root)`
6. Open the Pages URL and create one test booking.
7. Refresh the page and verify the booking appears.
8. Close the test issue and verify it disappears after Refresh.

## Recommended repository description

> Human-friendly booking board for our shared GPU workstation.

## Recommended link to send students

Send only the GitHub Pages URL, not the repository issue list. The page links to GitHub only when they need to confirm or cancel a booking.

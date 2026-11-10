# Publish on GitHub (Cursor + Pages)

With GitHub linked in Cursor, follow these steps **once**; later updates are a push.

## 1. Push the project to a new repo

In **Cursor**:

1. Open the `planned-surveys-api` folder.
2. **Source Control** (branch icon).
3. **Initialize Repository** if prompted.
4. Commit message example: `Planned Surveys web converter + API`.
5. **Commit** (exclude `.venv`; `.gitignore` handles it).
6. **Publish to GitHub** → public or private:
   - **Public** if you want a shareable converter URL (static `web/` only on Pages; full SLB app needs Azure/Render).
   - Suggested name: `planned-surveys-api`.

If **Publish to GitHub** is missing, install [Git for Windows](https://git-scm.com/download/win) and retry.

## 2. Enable GitHub Pages (before deploy)

In the browser: `https://github.com/<user>/<repo>/settings/pages`

1. **Build and deployment** → **Source**: **GitHub Actions** (not “Deploy from a branch”).
2. Save the settings page once if options are missing.

If the workflow fails with **404** / *Ensure GitHub Pages has been enabled*:

1. Repo **Public** (free Pages on private repos often fails).
2. **Settings → Pages → Source = GitHub Actions**.
3. Push the latest `github-pages.yml` and **Re-run** the workflow.

**Plan B (`gh-pages` branch):**

1. **Actions** → **GitHub Pages (gh-pages branch)** → **Run workflow**.
2. **Settings → Pages** → branch **`gh-pages`**, folder **`/(root)`**.

3. After push to `main`, confirm the job is green.

## 3. Public URL

`https://<user>.github.io/<repo>/`

Static converter only (paste Excel columns B–J → `Planned_surveys_.xml`). For SLB login, deploy FastAPI (Azure/Render/local on port 8000).

## 4. Later updates

Source Control → commit → **Sync** / **Push**. Actions republish `web/` in seconds.

## Web-only minimal repo

Upload only `web/index.html` and `web/witsml.js` to the repo root and set workflow `path: web` to `.` if needed.

## Try without publishing

For **static only** (no SLB):

```powershell
cd C:\Apps\planned-surveys-api\web
python -m http.server 8080
```

For **SLB + converter**, use FastAPI on port **8000** (see README).

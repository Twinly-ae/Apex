# Tasks widget (iPhone home screen)

iOS doesn't let a website — even one added to the home screen — draw a widget.
The free **Scriptable** app can, so Apex exposes a tiny read-only endpoint that
Scriptable reads.

## 1. Set a token on the API

On Railway, add a variable to the **API** service:

```
WIDGET_TOKEN=<paste a long random string>
```

Generate one with `openssl rand -hex 24`. Until this is set the endpoint stays
off and returns 503. Changing it later instantly revokes any widget using the
old value.

## 2. Check the endpoint

```
curl -H "x-widget-token: $WIDGET_TOKEN" https://<your-api-host>/api/widget/tasks
```

You should get JSON with `counts` and up to 8 `tasks`. It is **read-only** —
there is no way to change data through it.

## 3. Add the widget

1. Install **Scriptable** from the App Store (free).
2. Open it, tap **+**, and paste the contents of `apex-tasks.js`.
3. Edit the three values at the top: `API_BASE`, `TOKEN`, and `APP_URL`.
4. Name the script **Apex Tasks** and close the editor.
5. On your home screen, long-press → **+** → **Scriptable** → pick a size.
6. Long-press the new widget → **Edit Widget** → Script: **Apex Tasks**.

Tap the widget to jump straight to your tasks. iOS decides how often widgets
refresh (usually every 15–30 minutes) — that's an iOS limit, not an Apex one.

## Sizes

| Size   | Shows            |
| ------ | ---------------- |
| Small  | 3 tasks          |
| Medium | 4 tasks          |
| Large  | 8 tasks          |

Overdue tasks are red, due-today violet, everything else grey; the footer
counts what you finished today.

## Note on Safari

Using Apex from a Safari tab works fine, but **Share → Add to Home Screen**
gives you the full-screen app, offline shell, and push notifications. The
widget works either way.

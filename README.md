# Darkhan-Us Suvag Repair App

Дархан-Ус Суваг ХХК-ийн ус түгээх байрны засвар, үйлчилгээний дуудлагын веб программын эхний ажиллах хувилбар.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Local mock data + localStorage persistence

## Included Scope

- Public home page
- Public complaint form
- Station list and station detail pages
- Dispatcher dashboard
- Engineer dashboard
- Brigade leader mobile page
- Admin management page
- Mock login and role-based redirect

## Not Included

- Driver features
- Tank filling / sav duurgelt
- Water delivery vehicle logic
- Citizen login/register
- ERP / HR / finance / inventory modules
- Backend integration

## Mock Accounts

- `admin / admin123`
- `dispatcher / dispatch123`
- `chief / chief123`
- `eng1 / eng123`
- `bat / bat123`

Additional seeded brigade leaders:

- `dorj / dorj123`
- `oyun / oyun123`

## Run Locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Open On Phone Over The Same Wi-Fi

Start the dev server:

```bash
npm run dev
```

Explicit LAN binding also works:

```bash
npm run dev -- --host
```

Optional custom port:

```bash
npm run dev -- --host --port 5173
```

Find your computer's local IP address on Windows:

```powershell
ipconfig
```

Look for the active Wi-Fi adapter and copy its `IPv4 Address`, for example `192.168.1.23`.

Open this on your phone while both devices are on the same Wi-Fi:

```text
http://<local-ip>:5173
```

Example:

```text
http://192.168.1.23:5173
```

Notes:

- Your phone and computer must be on the same local network.
- Windows Firewall may ask to allow Node.js access. Allow it on private networks.
- If the port is changed, use that same port on the phone URL.

## Build

```bash
npm run build
```

## Preview Build Over LAN

Recommended for phone testing if `npm run dev` feels slow or freezes on mobile.

```bash
npm run build
npm run preview:lan
```

Then open:

```text
http://<local-ip>:4173
```

You can still run preview manually:

```bash
npm run preview
npm run preview -- --host --port 4173
```

You can also use:

```bash
npm run dev:lan
```

Notes:

- `dev` mode includes HMR and development transforms, so some phones may feel laggy.
- `preview` serves the built app and is usually much more stable on phones.

## Data Notes

- All app data is mocked in the frontend.
- State is persisted in browser `localStorage`.
- Refreshing the page keeps changes until local storage is cleared.
- The structure is separated so it can be replaced later with Supabase or PostgreSQL backed APIs.

## Folder Overview

```text
src/
  app/              # shared app state and auth context
  components/       # reusable UI, form, layout, station components
  data/             # mock seed data
  lib/              # utilities and business helpers
  pages/
    internal/       # dispatcher, engineer, brigade, admin
    public/         # home, complaint, stations, station detail
  routes/           # route guards
  types.ts          # shared frontend models
```

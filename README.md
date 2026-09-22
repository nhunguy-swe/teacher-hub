# Teacher Hub

[🇻🇳 Tiếng Việt](./README.vi.md)

**Teacher Hub** is a website for teachers to manage and share teaching content, track student progress, and run classroom engagement activities — all in one place.

Built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, and **Firebase**, the app ships with a public-facing class site and a full admin dashboard, with a modern, responsive interface for desktop, tablet, and mobile, plus built-in **dark mode**.

🔗 **Live demo:** [teacher-hub-jet.vercel.app](https://lophoccuacotruc.vercel.app/)

---

## Table of Contents

- [Features](#features)
- [Technologies](#technologies)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Responsive Design](#responsive-design)
- [Dark Mode](#dark-mode)
- [Production Build](#production-build)
- [Deployment](#deployment)
- [Git Workflow](#git-workflow)
- [Terms of Use](#terms-of-use)

---

## Features

### Public Site

- **Homepage** — hero section introducing the teacher and the class.
- **Announcements** — paginated class announcements, updated in real time.
- **Class schedule** — weekly timetable (morning/afternoon), synced live from Firestore, with **one-click Excel export** (`.xlsx`, styled with merged cells and borders).
- **Learning materials** — slide decks and assignments, filterable by tab (Slides / Assignments), with subject tags and share links.
- **Educational games** — practice games organized by grade level (1–5), filterable by subject and difficulty.
- **Photo gallery** — a scrollable album of classroom moments with a lightbox viewer and download option.
- **FAQ** — expandable frequently-asked-questions accordion.
- **Contact section** — contact info and a message form.
- **Responsive layout** — optimized for desktop, tablet, and mobile.
- **Dark mode** — full light/dark theme support across every section.

### Class Engagement System

- **Weekly scoring** — each student starts the week with a base score, adjusted by activity log entries (bonuses/penalties) recorded during the week.
- **Star / cumulative points** — long-term point tracking per student, shown alongside weekly scores.
- **Team competition (Tổ)** — students are grouped into teams; team rankings are calculated from both member scores and team-level bonuses, updated live.
- **Leaderboard ("Bảng Vàng")** — highlights the top-performing students of the week.
- **Privilege cards & lucky draw** — teachers create reward "privilege cards" (targeted at students, teams, or both); students or teams can be selected to spin/reveal a random reward, with results logged to the activity history.
- **Seating chart ("Sơ đồ lớp")** — a printable, drag-organized classroom seating layout with a dedicated print stylesheet and light/dark-safe print colors.

### Admin Dashboard

Password-protected area for the teacher/administrator, backed by Firebase Authentication:

- Admin login and password recovery.
- Central admin dashboard.
- **Students** — manage student roster, avatars, groups/teams, and star counts.
- **Seating chart** — build and print the classroom layout.
- **Team competition** — manage team bonuses and standings.
- **Privilege cards** — create, edit, delete, and assign reward cards; run the lucky-draw flow.
- **Announcements** — create/edit/delete class announcements.
- **Schedule** — edit the weekly timetable; export to Excel.
- **Learning materials** — manage slides and assignments.
- **Educational games** — manage the game library by grade/subject.
- **Gallery** — upload and manage classroom photos.
- **Contacts** — view and manage messages submitted through the contact form.
- **Toast notifications** — consistent success/error/info feedback across all admin actions.

---

## Technologies

| Category | Stack |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| UI Library | [React](https://react.dev/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + custom CSS (theming, dark mode, print styles) |
| Backend / Data | [Firebase](https://firebase.google.com/) — Authentication, Firestore, Storage |
| Excel export | [xlsx-js-style](https://www.npmjs.com/package/xlsx-js-style) |
| Hosting | [Vercel](https://vercel.com/) |

---

## Project Structure

```
teacher-hub/
├── app/              # Next.js App Router — pages, layouts, admin routes
├── components/       # Reusable UI components (public site + admin)
├── lib/              # Firebase config, data helpers (e.g. weekly score logic)
├── public/           # Static assets
├── AGENTS.md         # Guidelines for AI coding agents working in this repo
├── CLAUDE.md         # Claude-specific project instructions
├── README.md         # This file
└── README.vi.md      # Vietnamese version of this file
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/nhunguy-swe/teacher-hub.git
cd teacher-hub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

See [Environment Variables](#environment-variables) below.

### 4. Run the development server

```bash
npm run dev
```

Then open your browser at:

```
http://localhost:3000
```

---

## Environment Variables

This project uses Firebase for Authentication, Firestore, and Storage. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> ⚠️ Never commit `.env.local` or any private/secret keys to GitHub. It should already be listed in `.gitignore`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the app for production |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |

---

## Responsive Design

The site is fully responsive, with dedicated breakpoints for:

- Desktop
- Laptop
- Tablet
- Mobile (including a hamburger navigation menu)

Layout and spacing are handled with Tailwind CSS utilities combined with custom responsive CSS (`@media` breakpoints at 900px, 640px, and 400px).

---

## Dark Mode

Teacher Hub ships with a complete dark theme, toggled via a `.dark` class on the root element:

- Theme colors (backgrounds, text, borders, tags, badges) are defined as CSS custom properties and re-mapped under `.dark`.
- Tailwind's color palette is overridden at the variable level so utility classes like `bg-amber-50` or `text-slate-600` automatically adapt in dark mode — no need to hand-write `dark:` variants everywhere.
- The classroom seating chart has its own isolated color tokens (`--sc-*`) so it can render correctly both on-screen and when printed, in either theme.

---

## Production Build

Build the project for production:

```bash
npm run build
```

Run the production build locally:

```bash
npm start
```

---

## Deployment

The project is deployed on **Vercel**.

```
GitHub Repository
        │
        ▼
      Vercel
        │
        ▼
  Next.js Build
        │
        ▼
   Production
```

When deploying, make sure to configure the same **Environment Variables** (see above) in the Vercel project settings.

---

## Git Workflow

```bash
git add .
git commit -m "feat: add new feature"
git push
```

### Commit Convention

This project follows a simplified [Conventional Commits](https://www.conventionalcommits.org/) style:

| Prefix | Use for |
|---|---|
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `style:` | UI / CSS changes (no logic change) |
| `refactor:` | Code restructuring without behavior change |
| `docs:` | Documentation updates |
| `chore:` | Config, tooling, or dependency updates |

Example:

```bash
git commit -m "feat: add privilege card lucky draw for teams"
```

---

## Terms of Use

> **ANY USE OF THIS PROJECT IN ANY FORM IS STRICTLY PROHIBITED WITHOUT PRIOR PERMISSION FROM THE OWNER.**

**Teacher Hub** is a personal project. All source code, interfaces, designs, content, images, documentation, directory structures, components, and related materials are owned and controlled by the project owner.

Making this repository public does not mean the source code is freely licensed for use, reuse, or redistribution.

---

### Teacher Hub

A personal platform for a teacher, their students, and shared learning resources.

**© 2026 Teacher Hub — All Rights Reserved.**

# Teacher Hub

[🇻🇳 Tiếng Việt](./README.vi.md)

A website that helps teachers manage and share teaching content, learning materials, and information for students.

The project is built with **Next.js**, **React**, **TypeScript**, and **Tailwind CSS**, featuring a modern, responsive, and user-friendly interface for desktop, tablet, and mobile devices.

---

## Features

### User Features

* Homepage introducing the website.
* Teacher introduction.
* Display announcements.
* Display class schedules and activities.
* Manage and display learning materials.
* Image gallery.
* Educational games.
* FAQ - Frequently Asked Questions.
* Contact information.
* Website footer.
* Responsive interface for desktop, tablet, and mobile devices.

### Admin Features

An administration area for teachers or administrators.

* Admin login.
* Password recovery.
* Admin dashboard.
* Manage announcements.
* Manage contacts.
* Manage the image gallery.
* Manage educational games.
* Manage learning materials.
* Manage schedules.

---

## Technologies

* **Next.js** - A React framework for building web applications.
* **React** - A library for building user interfaces.
* **TypeScript** - A JavaScript superset with static typing.
* **Tailwind CSS** - A CSS framework for building interfaces and responsive layouts.
* **CSS** - Used for custom styling.
* **JavaScript** - Used for client-side logic.
* **Firebase** - Used for Authentication, Database, and Storage.
* **Vercel** - Used for application deployment.

---

## Installation

### 1. Clone the repository

Clone the repository to your computer:

```bash
git clone <repository-url>
```

Navigate to the project directory:

```bash
cd teacher-hub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development environment

```bash
npm run dev
```

Then open your browser at:

```text
http://localhost:3000
```

---

## Environment Variables

If the project uses Firebase or external services, create a `.env.local` file.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Do not commit sensitive information, private keys, or secret keys to GitHub.

The `.env.local` file should be included in `.gitignore`.

---

## Responsive

The website is designed to be responsive and supports multiple screen sizes:

* Desktop
* Laptop
* Tablet
* Mobile

Responsive breakpoints and styles are managed using Tailwind CSS combined with custom CSS.

---

## Production Build

Build the project for production:

```bash
npm run build
```

Run the production version:

```bash
npm start
```

---

## Deployment

The project is intended to be deployed on Vercel.

Basic deployment flow:

```text
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

When deploying, configure the required Environment Variables on Vercel if the project uses Firebase or external services.

---

## Git Workflow

Changes can be committed using:

```bash
git add .
git commit -m "feat: update teacher hub"
git push
```

### Commit Convention

The following prefixes can be used:

```text
feat:      Add a new feature
fix:       Fix a bug
style:     Change UI / CSS
refactor:  Refactor code structure
docs:      Update documentation
chore:     Update configuration or dependencies
```

Example:

```bash
git commit -m "feat: add admin schedule management"
```

---

# TERMS OF USE

> **ANY USE OF THIS PROJECT IN ANY FORM IS STRICTLY PROHIBITED WITHOUT PRIOR PERMISSION FROM THE OWNER.**

**Teacher Hub** is a personal project, and all source code, interfaces, designs, content, images, documentation, directory structures, components, and related materials are owned and controlled by the project owner.

Making this repository public does not mean that the source code is freely licensed for use.

---

### Teacher Hub

A personal platform for teachers, students, and learning resources.

**© 2026 Teacher Hub — All Rights Reserved.**

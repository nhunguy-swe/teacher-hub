# Teacher Hub

[🇻🇳 Tiếng Việt](./README.vi.md)

A website that helps teachers manage and share teaching content, learning materials, and information for students.

The project is built with **Next.js**, **React**, **TypeScript**, and **Tailwind CSS**, featuring a modern, responsive, and user-friendly interface for desktop, tablet, and mobile devices.

---

## ✨ Features

### 🌐 User Features

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

### 🔐 Admin Features

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

## 🛠️ Technologies

* **Next.js** - A React framework for building web applications.
* **React** - A library for building user interfaces.
* **TypeScript** - A JavaScript superset with static typing.
* **Tailwind CSS** - A CSS framework for building interfaces and responsive layouts.
* **CSS** - Used for custom styling.
* **JavaScript** - Used for client-side logic.
* **Firebase** - Planned for Authentication, Database, and Storage.
* **Vercel** - Planned for application deployment.

---

## 📁 Project Structure

The main project structure is as follows:

```text
teacher-hub/
│
├── .next/                              # Next.js build directory
│
├── app/                                # Next.js App Router
│   │
│   ├── admin/                          # Administration area
│   │   │
│   │   ├── forgot-password/
│   │   │   └── page.tsx                # Forgot password page
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                # Admin login page
│   │   │
│   │   ├── admin.css                   # Admin-specific CSS
│   │   └── page.tsx                    # Admin page
│   │
│   ├── globals.css                     # Global CSS
│   ├── home.css                        # Homepage CSS
│   ├── icon.svg                        # Website icon
│   ├── layout.tsx                      # Shared layout
│   └── page.tsx                        # Homepage
│
├── components/                         # React Components
│   │
│   ├── admin/
│   │   ├── AdminAnnouncements.tsx      # Announcement management
│   │   ├── AdminContact.tsx            # Contact management
│   │   ├── AdminDashboard.tsx          # Admin dashboard
│   │   ├── AdminGallery.tsx            # Gallery management
│   │   ├── AdminGames.tsx              # Game management
│   │   ├── AdminMaterials.tsx          # Learning material management
│   │   └── AdminSchedule.tsx           # Schedule management
│   │
│   ├── Announcement.tsx                # Announcement display
│   ├── Contact.tsx                     # Contact section
│   ├── ContactForm.tsx                 # Contact form
│   ├── FAQ.tsx                         # Frequently Asked Questions
│   ├── Footer.tsx                      # Footer
│   ├── Gallery.tsx                     # Image gallery
│   ├── Games.tsx                       # Educational games
│   ├── Hero.tsx                        # Hero section
│   ├── LearningMaterials.tsx            # Learning materials
│   ├── Navbar.tsx                      # Navigation bar
│   └── Schedule.tsx                    # Schedule
│
├── lib/                                # Shared helpers and utilities
├── public/                             # Static assets
│
├── .env.local                          # Local environment variables
├── .gitignore                          # Git ignore configuration
├── AGENTS.md                           # Instructions for AI agents
├── CLAUDE.md                           # Instructions for Claude
├── eslint.config.mjs                   # ESLint configuration
├── next-env.d.ts                       # Next.js TypeScript definitions
├── next.config.ts                      # Next.js configuration
├── package.json                        # Dependencies and scripts
├── package-lock.json                   # Dependency lock file
├── postcss.config.mjs                 # PostCSS configuration
├── README.md                           # Documentation
├── tailwind.config.ts                  # Tailwind configuration
└── tsconfig.json                       # TypeScript configuration
```

---

## 🚀 Installation

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

## 🔑 Environment Variables

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

## 🧩 Component Architecture

The project is divided into two main component groups.

### Public Components

Components intended for website users:

```text
Navbar
Hero
Announcement
LearningMaterials
Schedule
Gallery
Games
FAQ
Contact
ContactForm
Footer
```

These components are used to build the main website interface.

### Admin Components

Components intended for the administration area:

```text
AdminDashboard
AdminAnnouncements
AdminContact
AdminGallery
AdminGames
AdminMaterials
AdminSchedule
```

Each Admin component is responsible for a specific management function.

---

## 🔐 Admin

The Admin area is available at `/admin`.

Current Admin pages:

```text
/admin
/admin/login
/admin/forgot-password
```

Admins can manage announcements, contacts, images, games, learning materials, and schedules.

Future versions may include Firebase Authentication, Database, Storage, and user role management.

---

## 📱 Responsive

The website is designed to be responsive and supports multiple screen sizes:

* Desktop
* Laptop
* Tablet
* Mobile

Responsive breakpoints and styles are managed using Tailwind CSS combined with custom CSS.

---

## 📦 Production Build

Build the project for production:

```bash
npm run build
```

Run the production version:

```bash
npm start
```

---

## ☁️ Deployment

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

## 🌱 Git Workflow

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

## 🗺️ Roadmap

### Website

* [ ] Build the homepage
* [ ] Build the Navbar
* [ ] Build the Hero section
* [ ] Build the Announcement section
* [ ] Build the Gallery
* [ ] Build the Games section
* [ ] Build the Learning Materials section
* [ ] Build the Schedule section
* [ ] Build the Contact section
* [ ] Build the FAQ section
* [ ] Responsive UI

### Admin

* [ ] Build the Admin area
* [ ] Login page
* [ ] Forgot Password page
* [ ] Admin Dashboard
* [ ] Admin Announcements
* [ ] Admin Contact
* [ ] Admin Gallery
* [ ] Admin Games
* [ ] Admin Materials
* [ ] Admin Schedule

### Backend

* [ ] Connect Firebase Authentication
* [ ] Connect Firebase Database
* [ ] Connect Firebase Storage
* [ ] Complete Admin authorization
* [ ] Complete data CRUD
* [ ] Implement data security
* [ ] Implement data validation

### Deployment

* [ ] Deploy to Vercel
* [ ] Configure Environment Variables
* [ ] Connect a custom domain
* [ ] Test the production environment

---

# ⚠️ TERMS OF USE

> **ANY USE OF THIS PROJECT IN ANY FORM IS STRICTLY PROHIBITED WITHOUT PRIOR PERMISSION FROM THE OWNER.**

**Teacher Hub** is a personal project, and all source code, interfaces, designs, content, images, documentation, directory structures, components, and related materials are owned and controlled by the project owner.

Making this repository public does not mean that the source code is freely licensed for use.

## 🚫 Prohibited Uses

Without prior permission from the owner, you may not:

* ❌ Copy all or any part of the source code.
* ❌ Use the source code for personal projects.
* ❌ Use the source code for commercial projects.
* ❌ Copy or use the website interface.
* ❌ Copy the design, layout, or structure of the website.
* ❌ Copy or reuse any components.
* ❌ Modify and republish the source code.
* ❌ Rename the project and use it as your own product.
* ❌ Distribute or share the source code.
* ❌ Sell or provide the source code to third parties.
* ❌ Re-upload the source code to GitHub, GitLab, Bitbucket, or other platforms.
* ❌ Use the source code in another product, website, or application.
* ❌ Use the project's images, content, or documentation in another project.
* ❌ Use the project to develop or integrate into another product without permission.
* ❌ Claim authorship or ownership of the project.
* ❌ Remove or alter copyright information in order to reuse the project.
* ❌ Use any part of the project for any other purpose without permission.

## 👁️ Viewing and Reference

Access to the repository is provided solely for viewing and referencing project information.

Access to the repository does not grant permission to use, copy, modify, distribute, republish, or commercialize the project.

The source code, interface, design, content, or any component of the project may not be used without prior permission from the owner.

## 🔒 Rights Reserved

All rights to the source code, UI/UX, interface design, components, content, images, documentation, system structure, project name, and related resources are reserved.

Third-party components remain subject to their respective licenses and the rights of their owners.

## 📩 Permission Requests

If you wish to use all or any part of this project, please contact the project owner for review and permission.

Do not use this project in any form without permission.

---

# © Copyright

Copyright © 2026 **Teacher Hub**.

All rights reserved.

No permission is granted to use, copy, modify, distribute, or exploit this project without permission from the project owner.

---

## 📄 License

**No License is granted.**

This project is not licensed for reuse, modification, distribution, or commercial use.

All rights are reserved by the project owner.

---

### Teacher Hub

A personal platform for teachers, students, and learning resources.

**© 2026 Teacher Hub — All Rights Reserved.**

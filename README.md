# Joys Splitter

<p align="center">
A modern Angular app for managing shared expenses in trips, dinners, rentals, and group activities.
</p>

<p align="center">

![Angular](https://img.shields.io/badge/Angular-21-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Firebase](https://img.shields.io/badge/Firebase-RealtimeDB-orange)
![Tailwind](https://img.shields.io/badge/TailwindCSS-UI-38B2AC)
![License](https://img.shields.io/badge/license-MIT-green)

</p>

---

# Overview

**Joys Splitter** helps you track and split expenses with friends without spreadsheets or messy calculations.

Instead of focusing only on bills, the app organizes spending into three simple layers:
Joy → Group → Expense


**Joy**  
An event such as a trip, dinner, rent cycle, or shared activity.

**Group**  
The people sharing expenses within that joy.

**Expense**  
Individual spending records.

This structure makes group expense management clean, intuitive, and scalable.

---

# Features

## Joy Management

Create and manage events where expenses happen.

Examples:

- Trip
- Dinner
- Rent cycle
- Entertainment
- Utilities

Features:

- create joys with categories
- set event date ranges
- open joy dashboard
- view total spending summary

---

## Groups

Groups organize members and expenses inside a joy.

Example:
Japan Trip
├─ Hotel
├─ Food
└─ Transport


Features:

- create multiple groups per joy
- add friends as members
- search members
- maximum 10 members per group

---

## Expense Tracking

Track spending inside each group.

Expense fields:

- title
- amount
- payer
- date
- included members

Supported split methods:

| Mode | Description |
|-----|-------------|
| Equal | Split evenly between members |
| Percentage | Assign percentage per member |
| Custom | Exact amount per member |

Group totals update automatically.

---

## Friends List

Reusable contacts for inviting into groups.

Features:

- add / edit / delete friends
- email duplication prevention
- normalized phone numbers
- desktop table + mobile card layout

---

## Activity History

All actions are logged for transparency.

Examples:

- joy created
- group created
- expense added
- friend added
- currency changed

---

## Personalization

Users can customize:

| Setting | Options |
|-------|--------|
| Language | EN / VN |
| Currency | USD / VND |
| Theme | Light / Dark / System |

Stored locally using `localStorage`.

---

## Responsive UI

Optimized for desktop and mobile.

Desktop:

- collapsible sidebar
- data tables

Mobile:

- bottom navigation
- floating action buttons
- swipe-to-delete interactions

---

# Architecture

Simplified data structure:
Firebase Realtime Database

joys
└── {joyId}
└── groups
└── {groupId}
└── expenses
friends
activities


Key services:
joy.service.ts
friend.service.ts
activity.service.ts


---

# Tech Stack

| Technology | Purpose |
|-----------|--------|
| Angular 21 | Frontend framework |
| TypeScript 5 | Type safety |
| Firebase Realtime DB | Data storage |
| Firebase Analytics | Usage tracking |
| Tailwind CSS | UI styling |

Deployment ready for:

- GitHub Pages
- Netlify
- Static hosting

---

# Project Structure
src
├── components
│ ├── dashboard
│ ├── friends-page
│ ├── group-detail
│ ├── add-expense-dialog
│ └── activities-page
│
├── services
│ ├── joy.service.ts
│ ├── friend.service.ts
│ └── activity.service.ts
│
├── types
├── pipes
├── environments
├── firebase.ts
├── main.ts
└── index.html


---

# Quick Start

## Requirements

- Node.js 20+
- npm
- Firebase project

---

## Install
npm install

---

## Run locally
npm start

Open the URL shown in the terminal.

---

## Build production
npx ng build


---

# Firebase Setup

Update the configuration inside:
src/environments/environment.ts


Required values:
apiKey
authDomain
projectId
storageBucket
messagingSenderId
appId
measurementId
databaseURL


---

# Demo Scenario

Quick way to test the app:

1. Add 3 friends
2. Create joy **Weekend Trip**
3. Create group **Dinner**
4. Add expenses
5. Split equally
6. Check dashboard summary
7. Open activity history

---

# Roadmap

Planned future improvements:

- authentication
- settle-up calculations
- expense analytics
- report export
- global search
- group photo uploads

---

# License

MIT License

---

<p align="center">
Built with ❤️ using Angular + Firebase
</p>
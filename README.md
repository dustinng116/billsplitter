# Joys Splitter

Joys Splitter is a standalone Angular app for managing shared expenses around trips, dinners, rentals, and other group activities.

Instead of focusing on "bills" only, the app organizes spending inside **Joys** (high-level events or contexts), then inside **Groups** (the people sharing costs), and finally inside **Expenses** (individual spend items).

## What this project does

The app helps you:

- create a **Joy** such as a trip, dinner, rent cycle, or event
- create one or more **Groups** inside that joy
- invite friends into a group
- add expenses to a group
- split expenses **equally**, by **percentage**, or by **custom amount**
- track friends, activity history, theme, language, and currency preferences
- sync data through **Firebase Realtime Database**

## Main functionality

### 1. Joys management
A **Joy** is the top-level container for shared spending.

Current Joy features:

- view all joys in a paginated table or mobile card layout
- create a new joy with:
  - joy name
  - category
  - start date
  - end date
- open a joy dashboard
- edit joy settings from the dashboard
- see joy category styling and icon mapping

Supported joy categories:

- Food
- Dinner
- Transport
- Trip
- Entertainment
- Utilities
- Accommodation
- Rent
- Others
- General

### 2. Joy dashboard
When you open a joy, the dashboard shows the summary of that joy.

Dashboard features:

- total group spend summary
- total amount you owe summary
- list of all groups in the selected joy
- quick action to create a new group
- quick action to add an expense directly to a group
- split-bill summary by member
- joy settings dialog for editing:
  - joy name
  - category
  - date range

### 3. Group management
Each joy can contain multiple groups.

Group features:

- create a group inside the selected joy
- edit an existing group
- set group name
- choose a group category
- use built-in categories such as trip, home, dinner, entertainment, shopping, work, family, sport, or other
- provide a custom category name when `Other` is selected
- keep a group photo field with a built-in default image
- add members from the Friends list
- search members by name or email when the friend list is large
- use chip-style quick member selection when the friend list is small
- limit group size to 10 members

### 4. Expense management
Each group supports expense tracking.

Expense features:

- add a new expense to a group
- view expense details in read-only mode
- delete an expense with confirmation
- track:
  - title
  - amount
  - date
  - payer
  - split type
  - included members
- automatically update the group total spent after adding or deleting an expense

Supported split modes:

- **Equally**: split the amount evenly across selected members
- **Percentage**: assign each selected member a percentage
- **Custom**: assign exact custom amounts per selected member

### 5. Friends management
The Friends page acts like a reusable contact book for future group invitations.

Friend features:

- list friends in table view on desktop and card view on mobile
- add a friend
- edit a friend inline
- delete a friend with confirmation
- paginate the friends list
- prevent duplicate email addresses when adding a new friend
- sanitize phone input to digits only
- mobile swipe-to-delete interaction

### 6. Activity history
The Activities page displays the user action log stored in Firebase.

Tracked activities include:

- create joy
- create group
- update group
- add expense
- add friend
- update friend
- delete friend
- change currency
- logout

The activity type model also includes additional placeholders such as navigation, language change, and theme change, but those are not fully emitted by the current UI yet.

### 7. Preferences and personalization
The app includes several user preferences.

Available preferences:

- **Language**: English (`EN`) and Vietnamese (`VN`)
- **Currency**: USD (`$`) and VND (`đ`)
- **Theme**: Light, Dark, and System

Persistence behavior:

- language is stored in `localStorage`
- currency is stored in `localStorage`
- theme mode is stored in `localStorage`

### 8. Responsive UI behavior
The app is designed for both desktop and mobile.

Responsive behavior includes:

- desktop sidebar with collapse support
- mobile bottom navigation
- mobile quick-action floating buttons
- swipe-to-delete on friend cards and expense cards
- mobile-friendly dialogs and form controls

## How to use the app

### Typical flow
1. Open the app.
2. Go to **Joys**.
3. Click **Create Joy**.
4. Enter the joy name, category, and date range.
5. Open the newly created joy dashboard.
6. Create a **Group** inside that joy.
7. Add members from the **Friends** list.
8. Open the group.
9. Add one or more **Expenses**.
10. Choose how the expense is split.
11. Review the dashboard and activity history.

## Page-by-page usage guide

### Joys page
Use this page to create and browse all joys.

How to use:

1. Click **Create Joy**.
2. Fill in:
   - Joy name
   - Category
   - Start date
   - End date
3. Submit the dialog.
4. Click **Dashboard** on any row/card to open that joy.

Validation rules:

- joy name is required
- category is required
- start date is required
- end date is required
- start date must not be later than end date

### Dashboard page
Use this page to understand one joy at a glance.

How to use:

1. Open a joy from the Joys page.
2. Review totals and group summaries.
3. Click **New Group** to create a group.
4. Click the settings icon to edit the joy.
5. Click any group card to open group details.
6. Use the quick add-expense action on a group card when needed.

### New Group dialog
Use this dialog to create or update a group.

How to use:

1. Open the dialog from the dashboard.
2. Enter a group name.
3. Pick a category.
4. If category is `Other`, enter a custom category name.
5. Add members from available friends.
6. Submit the dialog.

Validation rules:

- a joy must already be selected
- group name is required
- at least one member is required
- max members per group: 10

### Group Detail page
Use this page to manage a specific group.

How to use:

1. Open a group from the dashboard.
2. Review the recent expenses list.
3. Review the members list and group metadata.
4. Click **Add Expense** to add a new expense.
5. Click the settings icon to edit group details.
6. Click an expense to open its detail view.
7. Delete an expense from desktop action buttons or mobile swipe action.

### Add Expense dialog
Use this dialog to add spending records.

How to use:

1. Open the dialog from the group detail page or quick action.
2. Enter the expense title.
3. Enter the amount.
4. Select the date.
5. Choose who paid.
6. Select the split type:
   - Equally
   - Percentage
   - Custom
7. Choose which members are included.
8. Submit the dialog.

Validation rules:

- expense title is required
- amount must be greater than 0
- date is required
- payer is required
- at least one member must be selected
- joy and group must already exist

Notes:

- in custom mode, the UI shows whether the assigned split is under or over the total
- the group total spent is updated automatically

### Friends page
Use this page to maintain reusable contacts.

How to use:

1. Open **Friends**.
2. Click **Add Friend**.
3. Enter name, email, and phone number.
4. Save the friend.
5. Use edit to update any friend inline.
6. Use delete to remove a friend.

Validation rules:

- name is required
- email is required
- phone is required
- email must contain `@`
- duplicate email addresses are blocked when adding a friend
- phone numbers are normalized to digits only

### Activities page
Use this page to review what happened in the app.

How to use:

1. Open **Activities**.
2. Scroll through the list of logged actions.
3. Review time, title, and description for each entry.

### Account and settings areas
There are multiple places to adjust preferences:

- **Header**: language and currency toggles
- **Sidebar theme menu**: theme switcher on desktop
- **Mobile account page**: language, currency, theme, and logout action

## Tech stack

- Angular 21 standalone components
- TypeScript 5
- Firebase Realtime Database
- Firebase Analytics
- Tailwind CSS
- Netlify configuration for static hosting

## Data model at a glance

### Firebase collections / paths
The app stores data under these main Realtime Database paths:

- `joys`
- `joys/{joyId}/groups`
- `joys/{joyId}/groups/{groupId}/expenses`
- `friends`
- `activities`

## Local development

### Requirements

- Node.js 20+ recommended
- npm
- a Firebase project with Realtime Database enabled

### Install
```bash
npm install
```

### Run locally
```bash
npm start
```

Then open the Angular dev server URL shown in the terminal.

### Build
For Windows, use this command because it is shell-safe everywhere:

```bash
npx ng build
```

> Note: `npm run build` currently uses `rm -rf dist`, which works in Unix-like shells but may fail in plain Windows Command Prompt.

## Firebase setup

This project reads Firebase config from `src/environments/environment.ts`.

If you want to use your own Firebase project:

1. Create a Firebase project.
2. Enable **Realtime Database**.
3. Replace the values inside `src/environments/environment.ts`.
4. Make sure your Realtime Database rules allow the app to read/write during development.

Required Firebase values:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`
- `databaseURL`

### Hiding Firebase config in this repo

This workspace no longer keeps real Firebase values in committed Angular environment files.

What changed:

- `src/environments/environment.ts` now contains placeholders only
- `src/environments/environment.prod.ts` is a placeholder template only
- the GitHub Actions workflow creates the real production file during CI from repository secrets

Important note:

- Firebase **web app config** is not a true secret in a browser application because it can still be seen in the built client bundle
- the real protection must come from Firebase Realtime Database rules, App Check, and API key restrictions
- because this repository previously contained real Firebase config values, you should rotate or review those credentials and update the GitHub secrets with the new values

### Local development setup

1. Open `src/environments/environment.ts`
2. Replace each `CHANGE_ME` value with your Firebase web app config
3. Run:

```bash
npm install
npm start
```

If you do not want to keep local values in git history, only keep them as uncommitted local changes.

### GitHub Actions deployment setup

This repository now deploys with `.github/workflows/deploy.yml`.

Before the workflow can build successfully, add these repository secrets in GitHub:

1. Open your GitHub repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Create these secrets:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `FIREBASE_DATABASE_URL`

You can use `.env.example` as a checklist for the values you need.

### How deployment works in GitHub Actions

On every push to `main` or a manual workflow run:

1. GitHub Actions checks out the repository
2. installs dependencies with `npm ci`
3. creates `src/environments/environment.prod.ts` from GitHub secrets
4. runs Angular production build
5. uploads the built site
6. deploys it to GitHub Pages

### GitHub Pages requirement

Make sure GitHub Pages is configured to deploy from **GitHub Actions** for this repository.

### Secret example mapping

Use this mapping when copying values from Firebase into GitHub Secrets:

- `apiKey` → `FIREBASE_API_KEY`
- `authDomain` → `FIREBASE_AUTH_DOMAIN`
- `projectId` → `FIREBASE_PROJECT_ID`
- `storageBucket` → `FIREBASE_STORAGE_BUCKET`
- `messagingSenderId` → `FIREBASE_MESSAGING_SENDER_ID`
- `appId` → `FIREBASE_APP_ID`
- `measurementId` → `FIREBASE_MEASUREMENT_ID`
- `databaseURL` → `FIREBASE_DATABASE_URL`

## Project structure

```text
src/
  components/
    activities-page/
    add-expense-dialog/
    dashboard/
    friends-page/
    group-detail/
    header/
    joys-table/
    main-content/
    new-group-dialog/
    shared-common/
    sidebar/
  environments/
  pipes/
  services/
  types/
  firebase.ts
  global_styles.css
  index.html
  main.ts
```

## Current limitations / notes

These are important to know when using or extending the project:

- the search box in the header is currently visual only and is not connected to filtering logic
- the sidebar `Settings` item does not have a dedicated settings screen yet
- logout is currently a mock UI action with activity logging, not real authentication
- group photo upload UI exists, but actual upload handling is not implemented yet
- joy deletion exists in the service layer but is not exposed in the current UI
- some deployment config still references `demo` paths, so review build/deploy settings before production deployment

## Suggested first demo script

If you want to quickly test the app manually:

1. add 2 to 4 friends
2. create one joy called `Weekend Trip`
3. create one group inside that joy
4. add all friends to the group
5. add a dinner expense
6. add a transport expense
7. switch currency between USD and VND
8. switch language between EN and VN
9. open Activities to verify that actions were logged

## Future improvement ideas

- real authentication and user accounts
- real search/filtering across joys, groups, and friends
- photo upload for groups and avatars
- settle-up calculations per member
- export/share reports
- edit and delete joy from the UI
- richer analytics and charts

---

If you are maintaining this project, the best place to start is:

1. `src/main.ts` for app bootstrap
2. `src/components/main-content/main-content.component.ts` for view switching
3. `src/services/joy.service.ts` for main Firebase data flow
4. `src/services/friend.service.ts` and `src/services/activity.service.ts` for related data modules

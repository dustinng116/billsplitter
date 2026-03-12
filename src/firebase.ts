import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { Database, getDatabase } from 'firebase/database';
import { environment } from './environments/environment';

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
// Must explicitly pass databaseURL for non-default regions (e.g. asia-southeast1)
const db: Database = getDatabase(app, environment.firebase.databaseURL);

let analyticsInstance: Analytics | null = null;
let analyticsInitialization: Promise<Analytics | null> | null = null;

function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance !== null) {
    return Promise.resolve(analyticsInstance);
  }

  if (analyticsInitialization !== null) {
    return analyticsInitialization;
  }

  analyticsInitialization = isSupported()
    .then((supported) => {
      if (!supported) {
        return null;
      }

      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    })
    .catch(() => null);

  return analyticsInitialization;
}

export { app as firebaseApp, db, initializeFirebaseAnalytics };

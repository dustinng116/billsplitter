import { Injectable } from '@angular/core';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { firebaseApp } from '../firebase';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private userSubject = new BehaviorSubject<User | null>(null);
  private initialAuthResolved = false;
  user$ = this.userSubject.asObservable();

  constructor() {
    this.auth = getAuth(firebaseApp);

    void setPersistence(this.auth, browserLocalPersistence).catch((error) => {
      console.error('Failed to enable persistent Firebase auth:', error);
    });

    void getRedirectResult(this.auth).catch((error) => {
      console.error('Google redirect login failed:', error);
    });

    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      this.initialAuthResolved = true;
      this.emitAuthState(user);
    });
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const isIOS = /iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent ?? '');
    if (isIOS) {
      return signInWithRedirect(this.auth, provider);
    }

    return signInWithPopup(this.auth, provider);
  }

  // Expose to window for splash login
  static exposeToWindow(authService: AuthService) {
    (window as any).firebaseAuthSignInWithGoogle = () => authService.signInWithGoogle();
  }

  private emitAuthState(user: User | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(new CustomEvent('joys-auth-state', {
      detail: {
        isReady: this.initialAuthResolved,
        isAuthenticated: !!user
      }
    }));
  }

  signOut() {
    return signOut(this.auth);
  }

  get currentUser() {
    return this.auth.currentUser;
  }
}

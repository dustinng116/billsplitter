import { Injectable } from '@angular/core';
import { getAuth, signInWithPopup, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { firebaseApp } from '../firebase';
import { BehaviorSubject } from 'rxjs';
import { UserDirectoryService } from './user-directory.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private userSubject = new BehaviorSubject<User | null>(null);
  private initialAuthResolved = false;
  private hasAuthStateValue = false;
  private redirectResultChecked = false;
  private latestUser: User | null = null;
  private readonly pendingMobileLoginKey = 'joys:auth:pending-mobile-login';
  private readonly wasAuthenticatedKey = 'joys:auth:was-authenticated';
  user$ = this.userSubject.asObservable();

  constructor(private readonly userDirectoryService: UserDirectoryService) {
    this.auth = getAuth(firebaseApp);
    localStorage.removeItem(this.pendingMobileLoginKey);

    void setPersistence(this.auth, browserLocalPersistence).catch((error) => {
      console.error('Failed to enable persistent Firebase auth:', error);
    });

    void getRedirectResult(this.auth)
      .catch((error) => {
        console.error('Google redirect login failed:', error);
        this.emitAuthError(error);
      })
      .finally(() => {
        this.redirectResultChecked = true;
        this.maybeResolveInitialAuth();
      });

    onAuthStateChanged(this.auth, (user) => {
      this.latestUser = user;
      this.hasAuthStateValue = true;
      this.userSubject.next(user);

      if (user) {
        localStorage.setItem(this.wasAuthenticatedKey, '1');
        localStorage.removeItem(this.pendingMobileLoginKey);
        void this.userDirectoryService.upsertCurrentUser(user).catch((error) => {
          console.error('Failed to record user in directory:', error);
        });
      }

      this.maybeResolveInitialAuth();
    });
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    localStorage.removeItem(this.pendingMobileLoginKey);
    return signInWithPopup(this.auth, provider);
  }

  // Expose to window for splash login
  static exposeToWindow(authService: AuthService) {
    (window as any).firebaseAuthSignInWithGoogle = () => authService.signInWithGoogle();
  }

  private maybeResolveInitialAuth(): void {
    if (!this.hasAuthStateValue || !this.redirectResultChecked) {
      this.emitAuthState(this.latestUser, false);
      return;
    }

    this.initialAuthResolved = true;

    if (!this.latestUser) {
      localStorage.removeItem(this.wasAuthenticatedKey);
      localStorage.removeItem(this.pendingMobileLoginKey);
    }

    this.emitAuthState(this.latestUser, true);
  }

  private emitAuthState(user: User | null, forceReady?: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }

    const isReady = typeof forceReady === 'boolean'
      ? forceReady
      : this.initialAuthResolved;

    (window as any).__joysAuthState = {
      isReady,
      isAuthenticated: !!user
    };

    if (typeof (window as any).joysHandleAuthState === 'function') {
      (window as any).joysHandleAuthState({
        isReady,
        isAuthenticated: !!user
      });
    }

    window.dispatchEvent(new CustomEvent('joys-auth-state', {
      detail: {
        isReady,
        isAuthenticated: !!user
      }
    }));
  }

  private emitAuthError(error: unknown): void {
    if (typeof window === 'undefined') {
      return;
    }

    const message = (error as { message?: string })?.message || 'Sign in failed. Please try again.';
    (window as any).__joysAuthError = message;

    if (typeof (window as any).joysHandleAuthError === 'function') {
      (window as any).joysHandleAuthError(message);
    }

    window.dispatchEvent(new CustomEvent('joys-auth-error', {
      detail: { message }
    }));
  }

  signOut() {
    localStorage.removeItem(this.wasAuthenticatedKey);
    localStorage.removeItem(this.pendingMobileLoginKey);
    return signOut(this.auth);
  }

  get currentUser() {
    return this.auth.currentUser;
  }
}

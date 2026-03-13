import { Injectable } from '@angular/core';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { firebaseApp } from '../firebase';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor() {
    this.auth = getAuth(firebaseApp);
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
    });
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  // Expose to window for splash login
  static exposeToWindow(authService: AuthService) {
    (window as any).firebaseAuthSignInWithGoogle = () => authService.signInWithGoogle();
  }

  signOut() {
    return signOut(this.auth);
  }

  get currentUser() {
    return this.auth.currentUser;
  }
}

import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from 'firebase/auth';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  constructor(private auth: AuthService) {}

  get user$(): Observable<User | null> { 
    return this.auth.user$;
  }

  signInWithGoogle() { 
    return this.auth.signInWithGoogle();
  }

  signOut() {
    return this.auth.signOut();
  }
}

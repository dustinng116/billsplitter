import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppView = 'joys-table' | 'dashboard' | 'group-detail' | 'friends' | 'activities' | 'account';

export interface AppRouteState {
  view: AppView;
  selectedJoyId: string;
  selectedGroupId: string;
  path: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppRouteService {
  private readonly stateSubject = new BehaviorSubject<AppRouteState>(this.resolveRoute(this.getBrowserPath()));
  readonly state$ = this.stateSubject.asObservable();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const initialState = this.resolveRoute(this.getBrowserPath());
    this.stateSubject.next(initialState);
    if (window.location.pathname !== this.getFullPath(initialState.path)) {
      window.history.replaceState({}, '', this.getFullPath(initialState.path));
    }

    window.addEventListener('popstate', this.handlePopState);
  }

  get current(): AppRouteState {
    return this.stateSubject.value;
  }

  goToJoysTable(): void {
    this.navigate('/joys');
  }

  goToDashboard(joyId: string): void {
    if (!joyId) {
      this.goToJoysTable();
      return;
    }

    this.navigate(`/joys/${encodeURIComponent(joyId)}`);
  }

  goToGroupDetail(joyId: string, groupId: string): void {
    if (!joyId || !groupId) {
      this.goToDashboard(joyId);
      return;
    }

    this.navigate(`/joys/${encodeURIComponent(joyId)}/groups/${encodeURIComponent(groupId)}`);
  }

  goToFriends(): void {
    this.navigate('/friends');
  }

  goToActivities(): void {
    this.navigate('/activities');
  }

  goToAccount(): void {
    this.navigate('/account');
  }

  private readonly handlePopState = (): void => {
    this.stateSubject.next(this.resolveRoute(this.getBrowserPath()));
  };

  private navigate(path: string): void {
    const nextState = this.resolveRoute(path);
    const currentState = this.stateSubject.value;

    if (currentState.path === nextState.path) {
      return;
    }

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', this.getFullPath(nextState.path));
    }

    this.stateSubject.next(nextState);
  }

  private getBrowserPath(): string {
    if (typeof window === 'undefined') {
      return '/joys';
    }

    const pathname = window.location.pathname || '/';
    const basePath = this.getBasePath();
    
    // Strip the basePath from the beginning of the pathname if it exists
    if (basePath !== '/' && pathname.startsWith(basePath)) {
      const stripped = pathname.substring(basePath.length);
      return stripped.startsWith('/') ? stripped : '/' + stripped;
    }
    
    return pathname;
  }
  
  private getBasePath(): string {
    if (typeof document === 'undefined') return '/';
    const baseElement = document.querySelector('base');
    let href = baseElement ? baseElement.getAttribute('href') : '/';
    if (!href) href = '/';
    return href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;
  }
  
  private getFullPath(appPath: string): string {
    const basePath = this.getBasePath();
    if (basePath === '/') return appPath;
    
    // Join basePath and appPath cleanly
    const cleanBase = basePath;
    const cleanApp = appPath.startsWith('/') ? appPath : '/' + appPath;
    return cleanBase + cleanApp;
  }

  private resolveRoute(pathname: string): AppRouteState {
    const normalizedPath = this.normalizePath(pathname);
    const segments = normalizedPath.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'joys')) {
      return this.buildState('joys-table', '', '', '/joys');
    }

    if (segments[0] === 'joys' && segments.length === 2) {
      return this.buildState('dashboard', segments[1], '', `/joys/${encodeURIComponent(segments[1])}`);
    }

    if (segments[0] === 'joys' && segments.length === 4 && segments[2] === 'groups') {
      return this.buildState(
        'group-detail',
        segments[1],
        segments[3],
        `/joys/${encodeURIComponent(segments[1])}/groups/${encodeURIComponent(segments[3])}`
      );
    }

    if (segments.length === 1 && segments[0] === 'friends') {
      return this.buildState('friends', '', '', '/friends');
    }

    if (segments.length === 1 && segments[0] === 'activities') {
      return this.buildState('activities', '', '', '/activities');
    }

    if (segments.length === 1 && segments[0] === 'account') {
      return this.buildState('account', '', '', '/account');
    }

    return this.buildState('joys-table', '', '', '/joys');
  }

  private buildState(view: AppView, selectedJoyId: string, selectedGroupId: string, path: string): AppRouteState {
    return {
      view,
      selectedJoyId,
      selectedGroupId,
      path
    };
  }

  private normalizePath(pathname: string): string {
    const safePath = pathname.trim() || '/joys';
    if (safePath === '/') {
      return '/joys';
    }

    return safePath.endsWith('/') && safePath.length > 1 ? safePath.slice(0, -1) : safePath;
  }
}

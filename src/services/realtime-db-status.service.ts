import { Injectable } from '@angular/core';
import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { db } from '../firebase';

@Injectable({
  providedIn: 'root'
})
export class RealtimeDbStatusService {
  private readonly connectedReference = ref(db, '.info/connected');

  listenToConnectionState(onStatusChanged: (connected: boolean) => void, onError?: (error: unknown) => void): Unsubscribe {
    return onValue(
      this.connectedReference,
      (snapshot) => {
        onStatusChanged(snapshot.val() === true);
      },
      (error) => {
        console.error('Unable to determine Realtime Database connection state.', error);
        onStatusChanged(false);
        onError?.(error);
      }
    );
  }
}
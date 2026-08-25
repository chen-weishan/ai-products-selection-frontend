import { Injectable, signal ,WritableSignal} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private requestsCount = 0;
 isLoading: WritableSignal<boolean> =signal<boolean>(false);

  show(): void{
    this.requestsCount++;
    this.isLoading.set(true);
  }

  hide(): void{
    this.requestsCount=Math.max(0,this.requestsCount-1);
    if(this.requestsCount===0){
      this.isLoading.set(false);
    }
  }
}

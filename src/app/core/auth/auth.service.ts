import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, UserInfo, UserRole } from '../models/auth-model';
import { Observable, tap } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
private http = inject(HttpClient);
private router=inject(Router);

private readonly ACCESS_TOKEN_KEY='ssds_access_Token';
private readonly REFRESH_TOKEN_KEY='ssds_refresh_Token';
private readonly USER_KEY='ssds_user_info';

readonly currentUser=signal<UserInfo | null>(this.getStoredUser());

readonly isLoggedIn=computed(()=>!!this.currentUser &&!!this.getAccessToken())

login(credentials:LoginRequest):Observable<LoginResponse>{
  return this.http.post<LoginResponse>('/api/vi/auth/login',credentials).pipe(
    tap(res=>{
      this.saveAuthData(res);
    })
  );
}

loginout():void{
  localStorage.removeItem(this.ACCESS_TOKEN_KEY);
  localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  localStorage.removeItem(this.USER_KEY);
this.currentUser.set(null);
this.router.navigate(['/login']);
}
getAccessToken():string | null {
return localStorage.getItem(this.ACCESS_TOKEN_KEY);
}
gatrefreshToken():string|null{
  return localStorage.getItem(this.REFRESH_TOKEN_KEY);
}
hasRole(roles:UserRole|UserRole[]):boolean{
  const user=this.currentUser();
  if(!user) return false;

  if(Array.isArray(roles)){
  return roles.includes(user.role);
  }
  return user.role===roles;
}

private saveAuthData(response:LoginResponse){
  localStorage.setItem(this.ACCESS_TOKEN_KEY,response.accessToken);

  if (response.refreshToken) {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
  }

  localStorage.setItem(this.USER_KEY,JSON.stringify(response.user));
  this.currentUser.set(response.user);
}

private getStoredUser():UserInfo | null{
  const data =localStorage.getItem(this.USER_KEY);
  if(!data) return null;
  try{
    return JSON.parse(data) as UserInfo;
  }catch{
    return null;
  }
}

}

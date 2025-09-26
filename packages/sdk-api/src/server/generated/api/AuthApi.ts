import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import type { LoginUser200Response, LoginUserRequest, RegisterUser201Response, RegisterUserRequest,  } from '../models/index.js';


@Injectable()
export abstract class AuthApi {

  abstract loginUser(loginUserRequest: LoginUserRequest,  request: Request): LoginUser200Response | Promise<LoginUser200Response> | Observable<LoginUser200Response>;


  abstract registerUser(registerUserRequest: RegisterUserRequest,  request: Request): RegisterUser201Response | Promise<RegisterUser201Response> | Observable<RegisterUser201Response>;

}

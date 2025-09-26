/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AuthApi } from '@qzd/sdk-api/server';
import type {
  LoginUser200Response,
  LoginUserRequest,
  RegisterUser201Response,
  RegisterUserRequest,
} from '@qzd/sdk-api/server';

@Injectable()
export class AuthApiImpl extends AuthApi {
  override loginUser(
    loginUserRequest: LoginUserRequest,
    request: Request,
  ): LoginUser200Response | Promise<LoginUser200Response> | Observable<LoginUser200Response> {
    throw new Error('Method not implemented.');
  }

  override registerUser(
    registerUserRequest: RegisterUserRequest,
    request: Request,
  ): RegisterUser201Response | Promise<RegisterUser201Response> | Observable<RegisterUser201Response> {
    throw new Error('Method not implemented.');
  }
}

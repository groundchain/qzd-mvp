/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Optional } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { AuthApi } from '@qzd/sdk-api/server';
import type {
  LoginUser200Response,
  LoginUserRequest,
  RegisterUser201Response,
  RegisterUserRequest,
} from '@qzd/sdk-api/server';
import { InMemoryBankService, getFallbackBankService } from '../in-memory-bank.service.js';

@Injectable()
export class AuthApiImpl extends AuthApi {
  private readonly bank: InMemoryBankService;

  constructor(@Optional() bank?: InMemoryBankService) {
    super();
    this.bank = bank ?? getFallbackBankService();
  }

  override loginUser(
    loginUserRequest: LoginUserRequest,
    _request: Request,
  ): LoginUser200Response | Promise<LoginUser200Response> | Observable<LoginUser200Response> {
    return this.bank.loginUser(loginUserRequest);
  }

  override registerUser(
    registerUserRequest: RegisterUserRequest,
    _request: Request,
  ): RegisterUser201Response | Promise<RegisterUser201Response> | Observable<RegisterUser201Response> {
    return this.bank.registerUser(registerUserRequest);
  }
}

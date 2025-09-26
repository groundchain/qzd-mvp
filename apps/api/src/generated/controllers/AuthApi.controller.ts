import { Body, Controller, Post, Param, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { AuthApi } from '../api/index.js';
import type { LoginUser200Response, LoginUserRequest, RegisterUser201Response, RegisterUserRequest,  } from '../models/index.js';

@Controller()
export class AuthApiController {
  constructor(private readonly authApi: AuthApi) {}

  @Post('/auth/login')
  loginUser(@Body() loginUserRequest: LoginUserRequest, @Req() request: Request): LoginUser200Response | Promise<LoginUser200Response> | Observable<LoginUser200Response> {
    return this.authApi.loginUser(loginUserRequest, request);
  }

  @Post('/auth/register')
  registerUser(@Body() registerUserRequest: RegisterUserRequest, @Req() request: Request): RegisterUser201Response | Promise<RegisterUser201Response> | Observable<RegisterUser201Response> {
    return this.authApi.registerUser(registerUserRequest, request);
  }

}
